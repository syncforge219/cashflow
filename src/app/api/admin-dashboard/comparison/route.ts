import { toDateKey, todayKey, isDateKey, istDayRange, addDaysKey, addMonthsKey, monthBoundsKey, formatDate } from "@/lib/dates";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Expense from "@/models/Expense";
import Brand from "@/models/Brand";

export async function GET(req: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const preset = searchParams.get("preset") || "this_month_vs_last_month";
    const periodAStartRaw = searchParams.get("periodA_start");
    const periodAEndRaw = searchParams.get("periodA_end");
    const periodBStartRaw = searchParams.get("periodB_start");
    const periodBEndRaw = searchParams.get("periodB_end");
    const brandParam = searchParams.get("brand");

    const isBrandFiltered = Boolean(
      brandParam && brandParam !== "All" && brandParam !== "All Brands"
    );
    const brandRegex =
      isBrandFiltered && brandParam
        ? new RegExp(
            `^${brandParam.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")}$`,
            "i"
          )
        : null;

    let targetBrandId: any = null;
    if (isBrandFiltered && brandParam) {
      const brandDoc = (mongoose.Types.ObjectId.isValid(brandParam)
        ? await Brand.findById(brandParam).lean()
        : await Brand.findOne({ $or: [{ name: brandRegex }, { code: brandRegex }] }).lean()) as any;
      if (brandDoc) {
        targetBrandId = brandDoc._id;
      }
    }

    // Periods are built from IST calendar days, whatever time zone the server runs in
    const today = todayKey();
    const formatDateStr = (d: Date | string) => toDateKey(d);
    const range =(fromKey: string, toKey: string) => istDayRange(fromKey, toKey);
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;

    let pA: { start: Date; end: Date };
    let pB: { start: Date; end: Date };
    let periodALabel = "Period A";
    let periodBLabel = "Period B";

    if (preset === "today_vs_yesterday") {
      const yesterday = addDaysKey(today, -1);
      pA = range(today, today);
      pB = range(yesterday, yesterday);
      periodALabel = `Today (${formatDate(today)})`;
      periodBLabel = `Yesterday (${formatDate(yesterday)})`;
    } else if (preset === "this_week_vs_last_week") {
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
      const monday = addDaysKey(today, -(weekday === 0 ? 6 : weekday - 1));
      pA = range(monday, today);
      pB = range(addDaysKey(monday, -7), addDaysKey(monday, -1));
      periodALabel = "This Week";
      periodBLabel = "Last Week";
    } else if (preset === "this_quarter_vs_last_quarter") {
      const month = Number(today.slice(5, 7)) - 1;
      const quarter = Math.floor(month / 3);
      const qStart = `${today.slice(0, 4)}-${String(quarter * 3 + 1).padStart(2, "0")}-01`;
      const prevQStart = addMonthsKey(qStart, -3);
      pA = range(qStart, today);
      pB = range(prevQStart, addDaysKey(qStart, -1));
      periodALabel = `Q${quarter + 1} ${today.slice(0, 4)}`;
      periodBLabel = `Q${quarter === 0 ? 4 : quarter} ${prevQStart.slice(0, 4)}`;
    } else if (
      preset === "custom" &&
      isDateKey(periodAStartRaw) && isDateKey(periodAEndRaw) && isDateKey(periodBStartRaw) && isDateKey(periodBEndRaw)
    ) {
      pA = range(periodAStartRaw, periodAEndRaw);
      pB = range(periodBStartRaw, periodBEndRaw);
      periodALabel = `Period A (${formatDate(periodAStartRaw)} to ${formatDate(periodAEndRaw)})`;
      periodBLabel = `Period B (${formatDate(periodBStartRaw)} to ${formatDate(periodBEndRaw)})`;
    } else {
      // Default: this month (to date) vs the whole of last month
      const { first } = monthBoundsKey(today);
      const lastMonth = monthBoundsKey(addDaysKey(first, -1));
      pA = range(first, today);
      pB = range(lastMonth.first, lastMonth.last);
      periodALabel = monthLabel(first);
      periodBLabel = monthLabel(lastMonth.first);
    }
    const { start: pAStart, end: pAEnd } = pA;
    const { start: pBStart, end: pBEnd } = pB;

    const getStatsForPeriod = async (start: Date, end: Date) => {
      const dateFilter = { $gte: start, $lte: end };

      const enquiryFilter: any = {
        createdAt: dateFilter,
        ...(isBrandFiltered ? { $and: [(targetBrandId ? { $or: [{ targetBrandId }, { targetBrand: brandRegex }] } : { targetBrand: brandRegex })] } : {}),
      };

      const admissionFilter: any = {
        $or: [
          { admissionDate: dateFilter },
          { $and: [{ admissionDate: null }, { createdAt: dateFilter }] }
        ],
        ...(isBrandFiltered ? { $and: [(targetBrandId ? { $or: [{ brandId: targetBrandId }, { brand: brandRegex }] } : { brand: brandRegex })] } : {}),
      };

      const paymentFilter: any = {
        $or: [
          { paymentDate: dateFilter },
          { $and: [{ paymentDate: null }, { createdAt: dateFilter }] }
        ],
        ...(isBrandFiltered ? { $and: [(targetBrandId ? { $or: [{ brandId: targetBrandId }, { brand: brandRegex }] } : { brand: brandRegex })] } : {}),
      };

      const expenseFilter: any = {
        expenseDate: dateFilter,
        ...(isBrandFiltered ? { $and: [(targetBrandId ? { $or: [{ brandId: targetBrandId }, { brand: brandRegex }] } : { brand: brandRegex })] } : {}),
      };

      const [leadsList, admissionsList, paymentsList, expensesList] = await Promise.all([
        Enquiry.find(enquiryFilter).select("createdAt").lean(),
        Admission.find(admissionFilter).select("createdAt admissionDate").lean(),
        Payment.find(paymentFilter).select("amountReceived createdAt paymentDate").lean(),
        Expense.find(expenseFilter).select("amount expenseDate").lean(),
      ]);

      const leadsCount = leadsList.length;
      const admissionsCount = admissionsList.length;
      const totalRevenue = paymentsList.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0);
      const totalExpenses = expensesList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      const netProfit = totalRevenue - totalExpenses;
      const conversionRate = leadsCount > 0 ? Number(((admissionsCount / leadsCount) * 100).toFixed(1)) : 0;

      return {
        startStr: formatDateStr(start),
        endStr: formatDateStr(end),
        leadsCount,
        admissionsCount,
        totalRevenue,
        totalExpenses,
        netProfit,
        conversionRate,
        leadsList,
        admissionsList,
        paymentsList,
        expensesList,
      };
    };

    const [statsA, statsB] = await Promise.all([
      getStatsForPeriod(pAStart, pAEnd),
      getStatsForPeriod(pBStart, pBEnd),
    ]);

    // Calculate Growth Deltas (% Change)
    const calcGrowth = (a: number, b: number) => {
      if (b === 0) return a > 0 ? 100 : 0;
      return Number((((a - b) / b) * 100).toFixed(1));
    };

    const deltas = {
      revenueGrowth: calcGrowth(statsA.totalRevenue, statsB.totalRevenue),
      admissionsGrowth: calcGrowth(statsA.admissionsCount, statsB.admissionsCount),
      leadsGrowth: calcGrowth(statsA.leadsCount, statsB.leadsCount),
      expensesGrowth: calcGrowth(statsA.totalExpenses, statsB.totalExpenses),
      netProfitGrowth: calcGrowth(statsA.netProfit, statsB.netProfit),
      conversionDiff: Number((statsA.conversionRate - statsB.conversionRate).toFixed(1)),
    };

    // Generate Normalized Day-by-Day Time Series Points for Side-by-Side Dual Charting
    const daysDiffA = Math.max(1, Math.ceil((pAEnd.getTime() - pAStart.getTime()) / (1000 * 3600 * 24)));
    const daysDiffB = Math.max(1, Math.ceil((pBEnd.getTime() - pBStart.getTime()) / (1000 * 3600 * 24)));
    const maxDays = Math.min(31, Math.max(daysDiffA, daysDiffB));

    const dailyComparisonSeries: any[] = [];

    for (let dayIdx = 0; dayIdx < maxDays; dayIdx++) {
      const dateAStr = addDaysKey(formatDateStr(pAStart), dayIdx);
      const dateBStr = addDaysKey(formatDateStr(pBStart), dayIdx);

      // Aggregates for Period A Day
      const leadsA = statsA.leadsList.filter(
        (l: any) => l.createdAt && formatDateStr(new Date(l.createdAt)) === dateAStr
      ).length;

      const admissionsA = statsA.admissionsList.filter(
        (a: any) => formatDateStr(a.admissionDate || a.createdAt) === dateAStr
      ).length;

      const revA = statsA.paymentsList
        .filter((p: any) => formatDateStr(p.paymentDate || p.createdAt) === dateAStr)
        .reduce((sum: number, p: any) => sum + (Number(p.amountReceived) || 0), 0);

      const expA = statsA.expensesList
        .filter((e: any) => e.expenseDate && formatDateStr(new Date(e.expenseDate)) === dateAStr)
        .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

      // Aggregates for Period B Day
      const leadsB = statsB.leadsList.filter(
        (l: any) => l.createdAt && formatDateStr(new Date(l.createdAt)) === dateBStr
      ).length;

      const admissionsB = statsB.admissionsList.filter(
        (a: any) => formatDateStr(a.admissionDate || a.createdAt) === dateBStr
      ).length;

      const revB = statsB.paymentsList
        .filter((p: any) => formatDateStr(p.paymentDate || p.createdAt) === dateBStr)
        .reduce((sum: number, p: any) => sum + (Number(p.amountReceived) || 0), 0);

      const expB = statsB.expensesList
        .filter((e: any) => e.expenseDate && formatDateStr(new Date(e.expenseDate)) === dateBStr)
        .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

      dailyComparisonSeries.push({
        dayIndex: dayIdx + 1,
        dayLabel: `Day ${dayIdx + 1}`,
        dateA: dateAStr,
        dateB: dateBStr,
        revenueA: revA,
        revenueB: revB,
        leadsA,
        leadsB,
        admissionsA,
        admissionsB,
        expensesA: expA,
        expensesB: expB,
        netProfitA: revA - expA,
        netProfitB: revB - expB,
      });
    }

    // Omit massive raw lists from JSON payload
    delete (statsA as any).leadsList;
    delete (statsA as any).admissionsList;
    delete (statsA as any).paymentsList;
    delete (statsA as any).expensesList;

    delete (statsB as any).leadsList;
    delete (statsB as any).admissionsList;
    delete (statsB as any).paymentsList;
    delete (statsB as any).expensesList;

    return NextResponse.json({
      success: true,
      data: {
        preset,
        periodA: {
          label: periodALabel,
          startDate: formatDateStr(pAStart),
          endDate: formatDateStr(pAEnd),
          ...statsA,
        },
        periodB: {
          label: periodBLabel,
          startDate: formatDateStr(pBStart),
          endDate: formatDateStr(pBEnd),
          ...statsB,
        },
        deltas,
        dailyComparisonSeries,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/admin-dashboard/comparison:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to calculate timeline comparison stats" },
      { status: 500 }
    );
  }
}
