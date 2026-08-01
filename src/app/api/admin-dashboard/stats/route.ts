import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import User from "@/models/User";
import Company from "@/models/Company";
import Brand from "@/models/Brand";
import LostLeadCounter from "@/models/LostLeadCounter";
import Payroll from "@/models/Payroll";
import Expense from "@/models/Expense";


export async function GET(req: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const firstDayOfMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

    let targetStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let targetEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let startStr = todayStr;
    let endStr = todayStr;
    
    let isFiltered = false;
    if (startDateParam && endDateParam) {
      targetStart = new Date(startDateParam);
      targetStart.setHours(0, 0, 0, 0);
      targetEnd = new Date(endDateParam);
      targetEnd.setHours(23, 59, 59, 999);
      startStr = startDateParam;
      endStr = endDateParam;
      isFiltered = true;
    }

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const globalFilter = isFiltered ? { createdAt: { $gte: targetStart, $lte: targetEnd } } : {};
    const dateRangeFilter = { $gte: targetStart, $lte: targetEnd };
    const stringDateFilter = { $gte: startStr, $lte: endStr };

    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const trendStart = isFiltered ? targetStart : thirtyDaysAgo;
    const trendEnd = isFiltered ? targetEnd : targetEnd;
    const trendStartStr = trendStart.toISOString().split("T")[0];

    // Parallel execution of all primary data queries using MongoDB Aggregations
    const [
      totalLeads, 
      convertedLeadsCount,
      newLeadsToday, 
      followUpsToday, 
      walkinsToday,
      admissionsTotal,
      admissionsToday,
      lostLeadsToday,
      pendingFeesCount,
      totalPayments,
      todayPayments,
      monthlyPayments,
      overdueAdmissions,
      pendingCalls,
      hotLeads,
      statusCountsGroup,
      sourceCountsGroup,
      thirtyDayEnquiryTrends,
      thirtyDayAdmissionTrends,
      thirtyDayFollowupTrends,
      lostLeadTrends,
      counsellors,
      admissionsList,
      counsellorEnquiryStatsGroup,
      brands,
      brandEnquiryStatsGroup,
      companies,
      missedCallsCount,
      counsellingScheduledCount,
      admissionsWaitingCount,
      recentAdmDocs,
      recentLeadDocs,
      allEnquiries,
      allPayrolls,
      allExpenses
    ] = await Promise.all([
      Enquiry.countDocuments(globalFilter),
      Enquiry.countDocuments({ ...globalFilter, $or: [{ isAdmitted: true }, { status: { $in: ["Admitted", "Admission", "Converted"] } }] }),
      Enquiry.countDocuments({ createdAt: dateRangeFilter, status: "New" }),
      Enquiry.countDocuments({ "followUps.date": stringDateFilter }),
      Enquiry.countDocuments({ createdAt: dateRangeFilter, leadSource: "Direct Walkin" }),
      Admission.countDocuments(globalFilter),
      Admission.countDocuments({ createdAt: dateRangeFilter }),
      LostLeadCounter.find({ date: { $gte: startStr, $lte: endStr } }).lean(),
      Admission.countDocuments({ ...globalFilter, remainingBalance: { $gt: 0 } }),
      Payment.find(isFiltered ? { createdAt: dateRangeFilter } : {}).select("amountReceived createdAt").lean(),
      Payment.find({ createdAt: { $gte: startOfDay, $lte: endOfDay } }).select("amountReceived").lean(),
      Payment.find(isFiltered ? { createdAt: dateRangeFilter } : { createdAt: { $gte: firstDayOfMonth, $lte: endOfDay } }).select("amountReceived").lean(),
      Admission.find({ remainingBalance: { $gt: 0 } }).select("fullName remainingBalance").lean(),
      Enquiry.countDocuments({
        followUps: {
          $elemMatch: {
            date: stringDateFilter,
            status: { $ne: "Completed" }
          }
        }
      }),
      Enquiry.countDocuments({ ...globalFilter, status: "Negotiation" }),
      
      // Status aggregation for Pipeline
      Enquiry.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),

      // Source aggregation for Sources chart
      Enquiry.aggregate([
        { $group: { _id: "$leadSource", count: { $sum: 1 } } }
      ]),

      // Trend Aggregations (using +05:30 local timezone)
      Enquiry.aggregate([
        { $match: { createdAt: { $gte: trendStart, $lte: trendEnd } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:30" } },
            count: { $sum: 1 }
          }
        }
      ]),
      Admission.aggregate([
        { $match: { createdAt: { $gte: trendStart, $lte: trendEnd } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:30" } },
            count: { $sum: 1 }
          }
        }
      ]),
      Enquiry.aggregate([
        { $unwind: "$followUps" },
        { $match: { "followUps.date": { $gte: trendStartStr, $lte: endStr } } },
        {
          $group: {
            _id: "$followUps.date",
            count: { $sum: 1 }
          }
        }
      ]),
      LostLeadCounter.find({ date: { $gte: trendStartStr, $lte: endStr } }).lean(),

      // Counsellor data
      User.find({ role: "counsellor" }).select("name").lean(),
      Admission.find().select("counsellor brand finalFee").lean(),
      Enquiry.aggregate([
        {
          $group: {
            _id: { $toLower: "$assignedCrmAdvisor" },
            totalAssigned: { $sum: 1 },
            followupsCount: {
              $sum: { $cond: [{ $gt: [{ $size: { $ifNull: ["$followUps", []] } }, 0] }, 1, 0] }
            }
          }
        }
      ]),

      // Brand data
      Brand.find().select("name").lean(),
      Enquiry.aggregate([
        {
          $group: {
            _id: { $toLower: "$targetBrand" },
            count: { $sum: 1 }
          }
        }
      ]),

      // Companies data
      Company.find().select("name annualCapacityCap collectedRevenue").lean(),

      // Work Queue counts
      Enquiry.countDocuments({ "followUps.date": { $lt: todayStr }, status: { $nin: ["Lost", "Admitted"] } }),
      Enquiry.countDocuments({ status: "Counselling Scheduled" }),
      Enquiry.countDocuments({ status: "Negotiation" }),

      // Recent Activity & Table Data
      Admission.find().select("counsellor fullName course createdAt").sort({ createdAt: -1 }).limit(3).lean(),
      Enquiry.find().select("leadSource studentFullName createdAt").sort({ createdAt: -1 }).limit(3).lean(),
      Enquiry.find().select("enquiryId studentFullName targetCourse assignedCrmAdvisor status leadPriority").sort({ createdAt: -1 }).limit(10).lean(),

      // Payroll & Expenses
      Payroll.find(isFiltered ? { paymentDate: dateRangeFilter } : {}).select("netSalary paymentStatus").lean(),
      Expense.find(isFiltered ? { expenseDate: dateRangeFilter } : {}).select("amount category").lean()
    ]);

    // 1. Process KPIs
    // 1. Process KPIs & Financial Summary
    let totalCollection = 0;
    totalPayments.forEach((p: any) => {
      totalCollection += Number(p.amountReceived || 0);
    });

    let todayCollectionSum = 0;
    todayPayments.forEach((p: any) => {
      todayCollectionSum += Number(p.amountReceived || 0);
    });

    let monthlyCollectionSum = 0;
    monthlyPayments.forEach((p: any) => {
      monthlyCollectionSum += Number(p.amountReceived || 0);
    });

    let totalOverdueAmount = 0;
    overdueAdmissions.forEach((a: any) => {
      totalOverdueAmount += Number(a.remainingBalance || 0);
    });

    let totalBilledRevenue = 0;
    admissionsList.forEach((a: any) => {
      totalBilledRevenue += Number(a.finalFee || 0);
    });
    if (totalBilledRevenue === 0) totalBilledRevenue = totalCollection;

    // Compute Payroll & Expenses Totals
    let totalPayrollSum = 0;
    allPayrolls.forEach((pr: any) => {
      if (pr.paymentStatus === "Paid") {
        totalPayrollSum += Number(pr.netSalary || 0);
      }
    });

    let totalExpensesSum = 0;
    const categoryExpenseMap: Record<string, number> = {};
    allExpenses.forEach((exp: any) => {
      const amt = Number(exp.amount || 0);
      totalExpensesSum += amt;
      const cat = exp.category || "Misc";
      categoryExpenseMap[cat] = (categoryExpenseMap[cat] || 0) + amt;
    });

    // Calculate unlinked course upgrades so totalLeads includes incoming leads + course upgrades
    const periodAdmissions = await Admission.find(globalFilter).select("mobileNumber course createdAt isUpgrade").lean();
    let unlinkedUpgradesCount = 0;
    for (const adm of periodAdmissions) {
      const isUpg = adm.isUpgrade || (await Admission.exists({
        mobileNumber: adm.mobileNumber,
        _id: { $ne: adm._id },
        createdAt: { $lt: adm.createdAt }
      }));
      if (isUpg) {
        const hasEnquiry = await Enquiry.exists({
          primaryPhoneMobile: adm.mobileNumber,
          targetCourse: adm.course
        });
        if (!hasEnquiry) {
          unlinkedUpgradesCount++;
        }
      }
    }

    const totalOutflow = totalPayrollSum + totalExpensesSum;
    const netProfitNum = totalCollection - totalOutflow;
    const profitMarginPct = totalCollection > 0 ? ((netProfitNum / totalCollection) * 100).toFixed(1) + "%" : "0%";

    const totalLeadsCalculated = Math.max(totalLeads, admissionsTotal);
    const totalConvertedCalculated = Math.max(convertedLeadsCount, admissionsTotal);

    const rawConv = totalLeadsCalculated > 0 ? (totalConvertedCalculated / totalLeadsCalculated) * 100 : 0;
    const conversionRate = Math.min(100, Math.max(0, Number(rawConv.toFixed(1)))).toFixed(1) + "%";

    const formatLakhsOrRupees = (amt: number) => {
      if (Math.abs(amt) >= 100000) return `₹${(amt / 100000).toFixed(2)} L`;
      return `₹${amt.toLocaleString("en-IN")}`;
    };

    const kpis = {
      totalLeads: totalLeadsCalculated,
      newLeadsToday,
      followUpsToday,
      walkinsToday,
      admissionsToday,
      lostLeadsToday: (Array.isArray(lostLeadsToday) ? lostLeadsToday : []).reduce((sum, item) => sum + (item.count || 0), 0),
      conversionRate,
      revenue: formatLakhsOrRupees(totalBilledRevenue),
      rawRevenue: totalBilledRevenue,
      todayCollection: `₹${todayCollectionSum.toLocaleString("en-IN")}`,
      monthlyCollection: formatLakhsOrRupees(monthlyCollectionSum),
      emiOverdueCount: overdueAdmissions.length,
      emiOverdueAmount: formatLakhsOrRupees(totalOverdueAmount),
      pendingApprovals: hotLeads,
      pendingCalls,
      hotLeads,
      totalPayroll: formatLakhsOrRupees(totalPayrollSum),
      rawPayroll: totalPayrollSum,
      totalExpenses: formatLakhsOrRupees(totalExpensesSum),
      rawExpenses: totalExpensesSum,
      totalOutflow: formatLakhsOrRupees(totalOutflow),
      rawOutflow: totalOutflow,
      netProfit: formatLakhsOrRupees(netProfitNum),
      rawNetProfit: netProfitNum,
      profitMargin: profitMarginPct,
      isProfitable: netProfitNum >= 0
    };

    // Financial Breakdown
    const financialSummary = {
      revenue: totalBilledRevenue || totalCollection,
      collections: totalCollection,
      payroll: totalPayrollSum,
      expenses: totalExpensesSum,
      outflow: totalOutflow,
      netProfit: netProfitNum,
      profitMargin: profitMarginPct,
      categoryExpenses: Object.entries(categoryExpenseMap).map(([category, amount]) => ({
        category,
        amount,
        pct: totalExpensesSum > 0 ? ((amount / totalExpensesSum) * 100).toFixed(1) + "%" : "0%"
      }))
    };

    // 2. Process Pipeline Overview (Dynamic Stage Aggregation)
    const statusMap = new Map(statusCountsGroup.map((g: any) => [g._id, g.count]));
    const standardStages = [
      { stage: "New Lead", status: "New", color: "bg-blue-500" },
      { stage: "Demo Attended", status: "Demo Attended", color: "bg-teal-500" },
      { stage: "Admitted", status: "Admitted", color: "bg-emerald-500" }
    ];

    const pipeline = standardStages.map((item) => {
      const count = (statusMap.get(item.status) as number) || 0;
      const pct = totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) + "%" : "0%";
      return { stage: item.stage, count, pct, color: item.color };
    });

    // 3. Process 30-Day Trend (Dynamic date aggregation)
    const enquiryTrendMap = new Map(thirtyDayEnquiryTrends.map((g: any) => [g._id, g.count]));
    const admissionTrendMap = new Map(thirtyDayAdmissionTrends.map((g: any) => [g._id, g.count]));
    const followupTrendMap = new Map(thirtyDayFollowupTrends.map((g: any) => [g._id, g.count]));
    const lostLeadTrendMap = new Map(lostLeadTrends.map((l: any) => [l.date, l.count]));

    const daysCount = isFiltered 
      ? Math.max(1, Math.min(31, Math.round((targetEnd.getTime() - targetStart.getTime()) / (1000 * 60 * 60 * 24))))
      : 30;

    const endDateForTrend = isFiltered ? targetEnd : now;

    const trendDays = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(endDateForTrend.getFullYear(), endDateForTrend.getMonth(), endDateForTrend.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;
      const dayLabel = `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`;

      trendDays.push({
        dateStr,
        dateLabel: dayLabel,
        newLeads: enquiryTrendMap.get(dateStr) || 0,
        admissions: admissionTrendMap.get(dateStr) || 0,
        lostLeads: lostLeadTrendMap.get(dateStr) || 0,
        followUps: followupTrendMap.get(dateStr) || 0
      });
    }

    // 4. Process Source Distribution (Normalized & Dynamic with Vibrant Colors)
    const normalizeSource = (srcRaw?: string) => {
      if (!srcRaw || !srcRaw.trim()) return "Direct Walkin";
      const s = srcRaw.toLowerCase().trim();
      if (s.includes("google")) return "Google Ads";
      if (s.includes("meta") || s.includes("facebook") || s.includes("insta")) return "Meta Ads";
      if (s.includes("walkin") || s.includes("walk-in") || s.includes("walk in")) return "Direct Walkin";
      if (s.includes("whatsapp")) return "WhatsApp";
      if (s.includes("telephonic") || s.includes("call") || s.includes("phone")) return "Call / Telephonic";
      if (s.includes("website") || s.includes("site") || s.includes("online")) return "Website";
      if (s.includes("seminar")) return "Seminar";
      if (s.includes("hoarding") || s.includes("banner")) return "Hoarding";
      if (s.includes("reference") || s.includes("referral")) return "Reference";
      if (s.includes("email")) return "Email";
      if (s.includes("paper")) return "Paper Ads";
      if (s.includes("campus")) return "Campus Visit";
      return srcRaw.trim();
    };

    const sourceColorMap: Record<string, { color: string; hex: string }> = {
      "Google Ads": { color: "bg-indigo-500", hex: "#6366f1" },
      "Meta Ads": { color: "bg-blue-500", hex: "#3b82f6" },
      "Direct Walkin": { color: "bg-emerald-500", hex: "#10b981" },
      "WhatsApp": { color: "bg-emerald-600", hex: "#059669" },
      "Call / Telephonic": { color: "bg-purple-500", hex: "#8b5cf6" },
      "Website": { color: "bg-amber-500", hex: "#f59e0b" },
      "Seminar": { color: "bg-rose-500", hex: "#f43f5e" },
      "Hoarding": { color: "bg-cyan-500", hex: "#06b6d4" },
      "Reference": { color: "bg-violet-600", hex: "#7c3aed" },
      "Email": { color: "bg-teal-500", hex: "#14b8a6" },
      "Paper Ads": { color: "bg-pink-500", hex: "#ec4899" },
      "Campus Visit": { color: "bg-fuchsia-500", hex: "#d946ef" },
      "Others": { color: "bg-sky-600", hex: "#0284c7" },
    };

    const adminSourceCountsMap: Record<string, number> = {};
    (sourceCountsGroup || []).forEach((srcGroup: any) => {
      const norm = normalizeSource(srcGroup._id);
      adminSourceCountsMap[norm] = (adminSourceCountsMap[norm] || 0) + (srcGroup.count || 0);
    });

    const enquiriesBySource = Object.entries(adminSourceCountsMap)
      .map(([label, count]) => {
        const pctNum = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
        const colorInfo = sourceColorMap[label] || { color: "bg-sky-500", hex: "#0ea5e9" };
        return {
          label,
          count,
          pct: `${pctNum.toFixed(1)}%`,
          pctNum,
          color: colorInfo.color,
          hex: colorInfo.hex
        };
      })
      .sort((a, b) => b.count - a.count);

    if (enquiriesBySource.length === 0) {
      enquiriesBySource.push({
        label: "Direct Walkin",
        count: 0,
        pct: "0.0%",
        pctNum: 0,
        color: "bg-emerald-500",
        hex: "#10b981"
      });
    }

    // 5. Process Counsellor Performance (Dynamic list merging registered counsellors and active advisors)
    const counsellorStatsMap = new Map(counsellorEnquiryStatsGroup.map((g: any) => [g._id, g]));
    
    // Combine names from User model and Enquiry/Admission data
    const registeredNames = counsellors.map((c: any) => c.name || "").filter(Boolean);
    const assignedAdvisorNames = Array.from(counsellorStatsMap.keys()).filter(Boolean);
    const admissionCounsellors = Array.from(new Set(admissionsList.map((a: any) => a.counsellor).filter(Boolean)));
    
    const allCounsellorNamesSet = new Set<string>();
    registeredNames.forEach((n: string) => allCounsellorNamesSet.add(n));
    assignedAdvisorNames.forEach((n: string) => {
      // Find matching case or add
      const match = Array.from(allCounsellorNamesSet).find((existing) => existing.toLowerCase() === n.toLowerCase());
      if (!match) allCounsellorNamesSet.add(n);
    });
    admissionCounsellors.forEach((n: string) => {
      const match = Array.from(allCounsellorNamesSet).find((existing) => existing.toLowerCase() === n.toLowerCase());
      if (!match) allCounsellorNamesSet.add(n);
    });

    const counsellorPerformance = Array.from(allCounsellorNamesSet).map((cName: string) => {
      const lowerName = cName.toLowerCase();
      const cAdmissions = admissionsList.filter((a: any) => 
        a.counsellor && typeof a.counsellor === 'string' && a.counsellor.toLowerCase() === lowerName
      );
      const admCount = cAdmissions.length;
      const revSum = cAdmissions.reduce((acc: number, cur: any) => acc + Number(cur.finalFee || 0), 0);
      
      const stats = counsellorStatsMap.get(lowerName) || { totalAssigned: 0, followupsCount: 0 };
      const totalAssignedEnquiries = stats.totalAssigned;
      const followupsCount = stats.followupsCount;

      const convRate = totalAssignedEnquiries > 0 
        ? ((admCount / totalAssignedEnquiries) * 100).toFixed(1) + "%"
        : "0%";

      return {
        name: cName,
        assigned: totalAssignedEnquiries,
        followups: followupsCount,
        admissions: admCount,
        conversion: convRate,
        rawRev: revSum
      };
    });
    counsellorPerformance.sort((a: any, b: any) => b.admissions - a.admissions || b.rawRev - a.rawRev);

    // 6. Process Brand Performance (Dynamic)
    const brandStatsMap = new Map(brandEnquiryStatsGroup.map((g: any) => [g._id, g.count]));
    const registeredBrandNames = brands.map((b: any) => b.name || "").filter(Boolean);
    const admissionBrandNames = Array.from(new Set(admissionsList.map((a: any) => a.brand).filter(Boolean)));

    const allBrandNamesSet = new Set<string>();
    registeredBrandNames.forEach((n: string) => allBrandNamesSet.add(n));
    admissionBrandNames.forEach((n: string) => {
      const match = Array.from(allBrandNamesSet).find((existing) => existing.toLowerCase() === n.toLowerCase());
      if (!match) allBrandNamesSet.add(n);
    });

    const brandPerformance = Array.from(allBrandNamesSet).map((bName: string) => {
      const lowerBName = bName.toLowerCase();
      const bAdmissions = admissionsList.filter((a: any) => 
        a.brand && typeof a.brand === 'string' && a.brand.toLowerCase() === lowerBName
      );
      const bAdmCount = bAdmissions.length;
      const bRevSum = bAdmissions.reduce((acc: number, cur: any) => acc + Number(cur.finalFee || 0), 0);
      
      const bLeadsCount = brandStatsMap.get(lowerBName) || 0;

      return {
        name: bName,
        leads: bLeadsCount,
        admissions: bAdmCount,
        revenue: `₹${(bRevSum / 100000).toFixed(2)} L`,
        achievePct: bLeadsCount > 0 ? ((bAdmCount / bLeadsCount) * 100).toFixed(1) + "%" : "0%"
      };
    });
    brandPerformance.sort((a: any, b: any) => b.admissions - a.admissions);

    // 7. Process Company Limit & Utilization (Dynamic)
    const companyUtilization = companies.map((c: any) => {
      const cap = Number(c.annualCapacityCap || 1949999);
      const collected = Number(c.collectedRevenue || 0);
      const usedPct = cap > 0 ? ((collected / cap) * 100).toFixed(1) + "%" : "0%";
      const remaining = Math.max(0, cap - collected);

      return {
        name: c.name,
        collection: `₹${(collected / 100000).toFixed(2)} L`,
        usedPct,
        remaining: `₹${(remaining / 100000).toFixed(2)} L`
      };
    });

    // 8. Process Work Queue (Dynamic)
    const workQueue = {
      followUpsDue: followUpsToday,
      missedCalls: missedCallsCount,
      counsellingScheduled: counsellingScheduledCount,
      admissionsWaiting: admissionsWaitingCount,
      feePending: pendingFeesCount
    };

    // 9. Process Recent Activity (Dynamic)
    const recentActivity: { text: string; time: string; color: string; timestamp: number }[] = [];
    
    recentAdmDocs.forEach((a: any) => {
      recentActivity.push({
        text: `${a.counsellor || 'Counsellor'} admitted ${a.fullName} to ${a.course || "Course"}`,
        time: new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        color: "bg-indigo-500",
        timestamp: new Date(a.createdAt).getTime()
      });
    });

    recentLeadDocs.forEach((e: any) => {
      recentActivity.push({
        text: `New lead from ${e.leadSource || "Direct"}: ${e.studentFullName}`,
        time: new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        color: "bg-emerald-500",
        timestamp: new Date(e.createdAt).getTime()
      });
    });

    recentActivity.sort((a, b) => b.timestamp - a.timestamp);

    // 10. Process Enquiries List (Dynamic)
    const enquiriesList = allEnquiries.map((e: any) => ({
      id: e.enquiryId || e._id.toString().substring(0, 8).toUpperCase(),
      dbId: e._id.toString(),
      student: e.studentFullName || "Unknown",
      course: e.targetCourse || "Unspecified",
      counsellor: e.assignedCrmAdvisor || "Unassigned",
      stage: e.status || "New",
      priority: e.leadPriority || "Medium"
    }));

    return NextResponse.json({
      success: true,
      data: {
        kpis,
        financialSummary,
        pipeline,
        trendDays,
        enquiriesBySource,
        counsellorPerformance,
        brandPerformance,
        companyUtilization,
        workQueue,
        recentActivity: recentActivity.slice(0, 5),
        enquiriesList
      }
    });

  } catch (error: any) {
    console.error("Error in admin-dashboard stats:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to load stats" }, { status: 500 });
  }
}
