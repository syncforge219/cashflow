import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Expense from "@/models/Expense";

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

    const now = new Date();

    let pAStart: Date;
    let pAEnd: Date;
    let pBStart: Date;
    let pBEnd: Date;

    let periodALabel = "Period A";
    let periodBLabel = "Period B";

    const formatDateStr = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "today_vs_yesterday") {
      pAStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      pAEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      pBStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      pBEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);

      periodALabel = "Today (" + formatDateStr(pAStart) + ")";
      periodBLabel = "Yesterday (" + formatDateStr(pBStart) + ")";
    } else if (preset === "this_week_vs_last_week") {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const mondayThisWeek = new Date(now);
      mondayThisWeek.setDate(now.getDate() - diffToMonday);

      pAStart = new Date(mondayThisWeek.getFullYear(), mondayThisWeek.getMonth(), mondayThisWeek.getDate(), 0, 0, 0, 0);
      pAEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const mondayLastWeek = new Date(mondayThisWeek);
      mondayLastWeek.setDate(mondayThisWeek.getDate() - 7);
      const sundayLastWeek = new Date(mondayThisWeek);
      sundayLastWeek.setDate(mondayThisWeek.getDate() - 1);

      pBStart = new Date(mondayLastWeek.getFullYear(), mondayLastWeek.getMonth(), mondayLastWeek.getDate(), 0, 0, 0, 0);
      pBEnd = new Date(sundayLastWeek.getFullYear(), sundayLastWeek.getMonth(), sundayLastWeek.getDate(), 23, 59, 59, 999);

      periodALabel = "This Week";
      periodBLabel = "Last Week";
    } else if (preset === "this_quarter_vs_last_quarter") {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const qStartMonth = currentQuarter * 3;

      pAStart = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0, 0);
      pAEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      pBStart = new Date(now.getFullYear(), qStartMonth - 3, 1, 0, 0, 0, 0);
      pBEnd = new Date(now.getFullYear(), qStartMonth, 0, 23, 59, 59, 999);

      periodALabel = `Q${currentQuarter + 1} ${now.getFullYear()}`;
      periodBLabel = `Q${currentQuarter === 0 ? 4 : currentQuarter} ${currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear()}`;
    } else if (preset === "custom" && periodAStartRaw && periodAEndRaw && periodBStartRaw && periodBEndRaw) {
      pAStart = new Date(periodAStartRaw + "T00:00:00");
      pAEnd = new Date(periodAEndRaw + "T23:59:59");
      pBStart = new Date(periodBStartRaw + "T00:00:00");
      pBEnd = new Date(periodBEndRaw + "T23:59:59");

      periodALabel = `Period A (${periodAStartRaw} to ${periodAEndRaw})`;
      periodBLabel = `Period B (${periodBStartRaw} to ${periodBEndRaw})`;
    } else {
      // Default: this_month_vs_last_month
      pAStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      pAEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      pBStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      pBEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      periodALabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
      const lastMonthIdx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      periodBLabel = `${MONTHS[lastMonthIdx]} ${lastMonthYear}`;
    }

    const getStatsForPeriod = async (start: Date, end: Date) => {
      const dateFilter = { $gte: start, $lte: end };

      const enquiryFilter: any = {
        createdAt: dateFilter,
        ...(brandRegex ? { targetBrand: brandRegex } : {}),
      };

      const admissionFilter: any = {
        createdAt: dateFilter,
        ...(brandRegex ? { brand: brandRegex } : {}),
      };

      const paymentFilter: any = {
        createdAt: dateFilter,
        ...(brandRegex ? { brand: brandRegex } : {}),
      };

      const expenseFilter: any = {
        expenseDate: dateFilter,
        ...(brandRegex ? { brand: brandRegex } : {}),
      };

      const [leadsList, admissionsList, paymentsList, expensesList] = await Promise.all([
        Enquiry.find(enquiryFilter).select("createdAt").lean(),
        Admission.find(admissionFilter).select("createdAt").lean(),
        Payment.find(paymentFilter).select("amountReceived createdAt").lean(),
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
      const dateA = new Date(pAStart);
      dateA.setDate(pAStart.getDate() + dayIdx);
      const dateAStr = formatDateStr(dateA);

      const dateB = new Date(pBStart);
      dateB.setDate(pBStart.getDate() + dayIdx);
      const dateBStr = formatDateStr(dateB);

      // Aggregates for Period A Day
      const leadsA = statsA.leadsList.filter(
        (l: any) => l.createdAt && formatDateStr(new Date(l.createdAt)) === dateAStr
      ).length;

      const admissionsA = statsA.admissionsList.filter(
        (a: any) => a.createdAt && formatDateStr(new Date(a.createdAt)) === dateAStr
      ).length;

      const revA = statsA.paymentsList
        .filter((p: any) => p.createdAt && formatDateStr(new Date(p.createdAt)) === dateAStr)
        .reduce((sum: number, p: any) => sum + (Number(p.amountReceived) || 0), 0);

      const expA = statsA.expensesList
        .filter((e: any) => e.expenseDate && formatDateStr(new Date(e.expenseDate)) === dateAStr)
        .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

      // Aggregates for Period B Day
      const leadsB = statsB.leadsList.filter(
        (l: any) => l.createdAt && formatDateStr(new Date(l.createdAt)) === dateBStr
      ).length;

      const admissionsB = statsB.admissionsList.filter(
        (a: any) => a.createdAt && formatDateStr(new Date(a.createdAt)) === dateBStr
      ).length;

      const revB = statsB.paymentsList
        .filter((p: any) => p.createdAt && formatDateStr(new Date(p.createdAt)) === dateBStr)
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
