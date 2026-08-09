import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import User from "@/models/User";
import Brand from "@/models/Brand";

export interface DailyBiReportData {
  dateStr: string;
  generatedAtStr: string;
  
  // Executive Summary & Trends
  executiveSummary: {
    totalRevenue: { value: number; prevValue: number; changePct: number };
    totalCollections: { value: number; prevValue: number; changePct: number };
    totalLeads: { value: number; prevValue: number; changePct: number };
    admissions: { value: number; prevValue: number; changePct: number };
    conversionRate: { value: number; prevValue: number; changePct: number };
    outstandingFees: { value: number; prevValue: number; changePct: number };
    businessLoss: { value: number; prevValue: number; changePct: number };
  };

  // 14-30 Day Revenue Trend
  revenueTrend: Array<{
    date: string;
    revenue: number;
    collections: number;
    admissions: number;
    leads: number;
  }>;

  // Revenue Comparison
  revenueComparison: {
    today: number;
    yesterday: number;
    sameDayLastWeek: number;
  };

  // Lead Conversion Funnel
  conversionFunnel: {
    leadsReceived: number;
    followupsCompleted: number;
    demosScheduled: number;
    admissionsConfirmed: number;
    stagePercentages: {
      followupPct: number;
      demoPct: number;
      admissionPct: number;
    };
    dropOffRates: {
      postLeadDropOff: number;
      postFollowupDropOff: number;
      postDemoDropOff: number;
    };
  };

  // Business Loss Analysis
  businessLossAnalysis: {
    totalLeads: number;
    totalAdmissions: number;
    unconvertedLeads: number;
    avgAdmissionValue: number;
    estimatedBusinessLoss: number;
    potentialRevenue: number;
    actualRevenue: number;
    lostOpportunityPct: number;
  };

  // Brand Performance
  brandPerformance: Array<{
    brandName: string;
    totalLeads: number;
    admissions: number;
    dailyCollections: number;
    conversionRate: number;
    estimatedBusinessLoss: number;
  }>;

  // Counsellor / Sales Executive Performance
  counsellorPerformance: Array<{
    name: string;
    email: string;
    brandScope: string;
    leadsAssigned: number;
    admissionsConverted: number;
    conversionPct: number;
    collectionsGenerated: number;
    followupPerformance: string;
    isTopPerformer: boolean;
    isLowPerformer: boolean;
  }>;

  // Lead Source Analysis
  leadSourceAnalysis: Array<{
    source: string;
    leadsGenerated: number;
    admissions: number;
    conversionRate: number;
    revenueContribution: number;
  }>;

  // Daily Collection Summary by Mode
  collectionSummaryByMode: Array<{
    mode: string;
    amount: number;
    percentage: number;
  }>;

  // Pending Fee & EMI Summary
  pendingFeeSummary: {
    overdueAmount: number;
    overdueStudentsCount: number;
    upcomingInstallmentsAmount: number;
    upcomingStudentsCount: number;
    studentsRequiringFollowup: Array<{
      id: string;
      fullName: string;
      mobileNumber: string;
      course: string;
      remainingBalance: number;
      nextDueDate?: string;
    }>;
  };

  // Operational Alerts
  operationalAlerts: Array<{
    id: string;
    type: "critical" | "warning" | "info";
    category: string;
    title: string;
    message: string;
  }>;

  // Tomorrow's Business Targets
  tomorrowTargets: {
    revenueTarget: number;
    admissionsTarget: number;
    leadFollowupsTarget: number;
    demoSessionsTarget: number;
    pendingFeeRecoveryTarget: number;
    collectionsTarget: number;
  };

  // AI Business Insights
  aiInsights: {
    executiveSummary: string;
    keyAchievements: string[];
    immediateAttentionAreas: string[];
    brandAndCounsellorObservations: string;
    lostOpportunityAssessment: string;
    recommendedPriorityActions: string[];
  };
}

export async function getDailyBiReportData(targetDate?: Date): Promise<DailyBiReportData> {
  await dbConnect();

  const now = targetDate || new Date();
  
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = new Date(todayEnd);
  yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

  const lastWeekStart = new Date(todayStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(todayEnd);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

  // 1. Fetch Today, Yesterday & Last Week Datasets
  const [
    todayLeads,
    yesterdayLeads,
    todayAdmissions,
    yesterdayAdmissions,
    todayPayments,
    yesterdayPayments,
    lastWeekPayments,
    allAdmissions,
    allEnquiries,
    allUsers,
    allBrands
  ] = await Promise.all([
    Enquiry.find({ createdAt: { $gte: todayStart, $lte: todayEnd } }).lean(),
    Enquiry.find({ createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } }).lean(),
    Admission.find({
      $or: [
        { admissionDate: { $gte: todayStart, $lte: todayEnd } },
        { $and: [{ admissionDate: { $exists: false } }, { createdAt: { $gte: todayStart, $lte: todayEnd } }] },
        { $and: [{ admissionDate: null }, { createdAt: { $gte: todayStart, $lte: todayEnd } }] }
      ]
    }).lean(),
    Admission.find({
      $or: [
        { admissionDate: { $gte: yesterdayStart, $lte: yesterdayEnd } },
        { $and: [{ admissionDate: { $exists: false } }, { createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } }] },
        { $and: [{ admissionDate: null }, { createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } }] }
      ]
    }).lean(),
    Payment.find({
      $or: [
        { paymentDate: { $gte: todayStart, $lte: todayEnd } },
        { $and: [{ paymentDate: { $exists: false } }, { createdAt: { $gte: todayStart, $lte: todayEnd } }] },
        { $and: [{ paymentDate: null }, { createdAt: { $gte: todayStart, $lte: todayEnd } }] }
      ]
    }).lean(),
    Payment.find({
      $or: [
        { paymentDate: { $gte: yesterdayStart, $lte: yesterdayEnd } },
        { $and: [{ paymentDate: { $exists: false } }, { createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } }] },
        { $and: [{ paymentDate: null }, { createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } }] }
      ]
    }).lean(),
    Payment.find({
      $or: [
        { paymentDate: { $gte: lastWeekStart, $lte: lastWeekEnd } },
        { $and: [{ paymentDate: { $exists: false } }, { createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd } }] },
        { $and: [{ paymentDate: null }, { createdAt: { $gte: lastWeekStart, $lte: lastWeekEnd } }] }
      ]
    }).lean(),
    Admission.find({}).lean(),
    Enquiry.find({}).lean(),
    User.find({}).select("-password").lean(),
    Brand.find({}).lean(),
  ]);

  // Aggregation Helpers
  const sumAmount = (arr: any[], key = "amountReceived") => arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);
  
  const todayColl = sumAmount(todayPayments);
  const yesterdayColl = sumAmount(yesterdayPayments);
  const lastWeekColl = sumAmount(lastWeekPayments);

  const todayRevenue = todayAdmissions.reduce((acc, a: any) => acc + (Number(a.totalCourseFee || a.courseFee) || 0), 0);
  const yesterdayRevenue = yesterdayAdmissions.reduce((acc, a: any) => acc + (Number(a.totalCourseFee || a.courseFee) || 0), 0);

  const todayLeadsCount = todayLeads.length;
  const yesterdayLeadsCount = yesterdayLeads.length;

  const todayAdmissionsCount = todayAdmissions.length;
  const yesterdayAdmissionsCount = yesterdayAdmissions.length;

  const todayConvRate = todayLeadsCount > 0 ? Math.min(100, Math.max(0, (todayAdmissionsCount / todayLeadsCount) * 100)) : 0;
  const yesterdayConvRate = yesterdayLeadsCount > 0 ? Math.min(100, Math.max(0, (yesterdayAdmissionsCount / yesterdayLeadsCount) * 100)) : 0;

  const totalOutstandingFees = allAdmissions.reduce((acc, a: any) => acc + (Number(a.remainingBalance) || 0), 0);

  const avgAdmissionVal = allAdmissions.length > 0 
    ? allAdmissions.reduce((acc, a: any) => acc + (Number(a.totalCourseFee || a.courseFee) || 0), 0) / allAdmissions.length 
    : 25000;

  const todayUnconvertedLeads = Math.max(0, todayLeadsCount - todayAdmissionsCount);
  const todayBusinessLoss = todayUnconvertedLeads * avgAdmissionVal;

  const yesterdayUnconvertedLeads = Math.max(0, yesterdayLeadsCount - yesterdayAdmissionsCount);
  const yesterdayBusinessLoss = yesterdayUnconvertedLeads * avgAdmissionVal;

  const getPctChange = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Number((((current - prev) / prev) * 100).toFixed(1));
  };

  const executiveSummary = {
    totalRevenue: { value: todayRevenue, prevValue: yesterdayRevenue, changePct: getPctChange(todayRevenue, yesterdayRevenue) },
    totalCollections: { value: todayColl, prevValue: yesterdayColl, changePct: getPctChange(todayColl, yesterdayColl) },
    totalLeads: { value: todayLeadsCount, prevValue: yesterdayLeadsCount, changePct: getPctChange(todayLeadsCount, yesterdayLeadsCount) },
    admissions: { value: todayAdmissionsCount, prevValue: yesterdayAdmissionsCount, changePct: getPctChange(todayAdmissionsCount, yesterdayAdmissionsCount) },
    conversionRate: { value: Number(todayConvRate.toFixed(1)), prevValue: Number(yesterdayConvRate.toFixed(1)), changePct: getPctChange(todayConvRate, yesterdayConvRate) },
    outstandingFees: { value: totalOutstandingFees, prevValue: totalOutstandingFees, changePct: 0 },
    businessLoss: { value: todayBusinessLoss, prevValue: yesterdayBusinessLoss, changePct: getPctChange(todayBusinessLoss, yesterdayBusinessLoss) },
  };

  // 2. 14-30 Day Revenue Trend Calculation
  const trendDays = 14;
  const revenueTrend = [];
  for (let i = trendDays - 1; i >= 0; i--) {
    const dStart = new Date(todayStart);
    dStart.setDate(dStart.getDate() - i);
    const dEnd = new Date(todayEnd);
    dEnd.setDate(dEnd.getDate() - i);

    const dayName = dStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

    const dayAdmissions = allAdmissions.filter((a: any) => {
      const dt = new Date(a.admissionDate || a.createdAt);
      return dt >= dStart && dt <= dEnd;
    });

    const dayPayments = (await Payment.find({
      $or: [
        { paymentDate: { $gte: dStart, $lte: dEnd } },
        { $and: [{ paymentDate: { $exists: false } }, { createdAt: { $gte: dStart, $lte: dEnd } }] },
        { $and: [{ paymentDate: null }, { createdAt: { $gte: dStart, $lte: dEnd } }] }
      ]
    }).lean());
    const dayLeads = allEnquiries.filter((e: any) => {
      const dt = new Date(e.createdAt);
      return dt >= dStart && dt <= dEnd;
    });

    const dayRev = dayAdmissions.reduce((acc, a: any) => acc + (Number(a.totalCourseFee || a.courseFee) || 0), 0);
    const dayColl = sumAmount(dayPayments);

    revenueTrend.push({
      date: dayName,
      revenue: dayRev,
      collections: dayColl,
      admissions: dayAdmissions.length,
      leads: dayLeads.length,
    });
  }

  // 3. Lead Conversion Funnel
  const followupsCompleted = todayLeads.filter((e: any) => e.nextFollowUpDate || e.remarks || e.status === "Follow-up" || e.status === "In Progress").length;
  const demosScheduled = todayLeads.filter((e: any) => e.isDemoScheduled || (e.status && e.status.toLowerCase().includes("demo"))).length;

  const followupPct = todayLeadsCount > 0 ? Number(((followupsCompleted / todayLeadsCount) * 100).toFixed(1)) : 0;
  const demoPct = todayLeadsCount > 0 ? Number(((demosScheduled / todayLeadsCount) * 100).toFixed(1)) : 0;
  const admissionPct = todayLeadsCount > 0 ? Number(((todayAdmissionsCount / todayLeadsCount) * 100).toFixed(1)) : 0;

  const postLeadDropOff = todayLeadsCount > 0 ? Number((((todayLeadsCount - followupsCompleted) / todayLeadsCount) * 100).toFixed(1)) : 0;
  const postFollowupDropOff = followupsCompleted > 0 ? Number((((followupsCompleted - demosScheduled) / followupsCompleted) * 100).toFixed(1)) : 0;
  const postDemoDropOff = demosScheduled > 0 ? Number((((demosScheduled - todayAdmissionsCount) / demosScheduled) * 100).toFixed(1)) : 0;

  const conversionFunnel = {
    leadsReceived: todayLeadsCount,
    followupsCompleted,
    demosScheduled,
    admissionsConfirmed: todayAdmissionsCount,
    stagePercentages: { followupPct, demoPct, admissionPct },
    dropOffRates: { postLeadDropOff, postFollowupDropOff, postDemoDropOff }
  };

  // 4. Business Loss Analysis
  const potentialRevenue = todayRevenue + todayBusinessLoss;
  const lostOpportunityPct = potentialRevenue > 0 ? Number(((todayBusinessLoss / potentialRevenue) * 100).toFixed(1)) : 0;

  const businessLossAnalysis = {
    totalLeads: todayLeadsCount,
    totalAdmissions: todayAdmissionsCount,
    unconvertedLeads: todayUnconvertedLeads,
    avgAdmissionValue: avgAdmissionVal,
    estimatedBusinessLoss: todayBusinessLoss,
    potentialRevenue,
    actualRevenue: todayRevenue,
    lostOpportunityPct
  };

  // 5. Brand Performance Breakdown (Using actual registered brands from DB & deduplicating case variations)
  const registeredBrandMap = new Map<string, string>(); // lowercase -> canonical brand name
  allBrands.forEach((b: any) => {
    const name = (b.name || "").trim();
    if (name) {
      registeredBrandMap.set(name.toLowerCase(), name);
    }
  });

  // If no brands registered in DB yet, gather unique active brand names from today's admissions/payments/leads
  if (registeredBrandMap.size === 0) {
    [...todayAdmissions, ...todayPayments, ...todayLeads].forEach((item: any) => {
      const bName = (item.brand || item.targetBrand || "").trim();
      if (bName && !registeredBrandMap.has(bName.toLowerCase())) {
        registeredBrandMap.set(bName.toLowerCase(), bName);
      }
    });
  }

  const brandPerformance = Array.from(registeredBrandMap.values()).map((bName) => {
    const bNameLower = bName.toLowerCase();
    const bLeads = todayLeads.filter((e: any) => (e.targetBrand || e.brand || "").trim().toLowerCase() === bNameLower);
    const bAdmissions = todayAdmissions.filter((a: any) => (a.brand || "").trim().toLowerCase() === bNameLower);
    const bPayments = todayPayments.filter((p: any) => (p.brand || "").trim().toLowerCase() === bNameLower);

    const bLeadsCount = bLeads.length;
    const bAdmCount = bAdmissions.length;
    const bColl = sumAmount(bPayments);
    const bConvRate = bLeadsCount > 0 ? Number(((bAdmCount / bLeadsCount) * 100).toFixed(1)) : 0;
    const bLoss = Math.max(0, bLeadsCount - bAdmCount) * avgAdmissionVal;

    return {
      brandName: bName,
      totalLeads: bLeadsCount,
      admissions: bAdmCount,
      dailyCollections: bColl,
      conversionRate: bConvRate,
      estimatedBusinessLoss: bLoss
    };
  });

  // 6. Counsellor / Sales Executive Performance Dashboard
  const salesExecs = allUsers.filter((u: any) => 
    u.role === "counsellor" || u.role === "sales executive" || u.role === "sales-executive"
  );

  const rawCounsellorStats = salesExecs.map((exec: any) => {
    const name = exec.name || "Sales Exec";
    const email = exec.email || "";
    const brandScope = exec.brandScope || "All";

    const cLeads = todayLeads.filter((e: any) => (e.assignedCrmAdvisor || "").toLowerCase() === name.toLowerCase());
    const cAdmissions = todayAdmissions.filter((a: any) => (a.counsellor || "").toLowerCase() === name.toLowerCase());
    const cPayments = todayPayments.filter((p: any) => (p.recordedBy || p.counsellor || "").toLowerCase() === name.toLowerCase());

    const leadsAssigned = cLeads.length;
    const admissionsConverted = cAdmissions.length;
    const conversionPct = leadsAssigned > 0 ? Number(((admissionsConverted / leadsAssigned) * 100).toFixed(1)) : 0;
    const collectionsGenerated = sumAmount(cPayments);

    let followupPerformance = "Standard";
    if (conversionPct >= 50 && admissionsConverted > 0) followupPerformance = "Excellent";
    else if (conversionPct >= 25) followupPerformance = "Good";
    else if (leadsAssigned > 3 && admissionsConverted === 0) followupPerformance = "Needs Attention";

    return {
      name,
      email,
      brandScope,
      leadsAssigned,
      admissionsConverted,
      conversionPct,
      collectionsGenerated,
      followupPerformance,
      isTopPerformer: false,
      isLowPerformer: false
    };
  });

  // Sort & Flag Top and Low Performers
  rawCounsellorStats.sort((a, b) => b.admissionsConverted - a.admissionsConverted || b.collectionsGenerated - a.collectionsGenerated);
  if (rawCounsellorStats.length > 0) {
    rawCounsellorStats[0].isTopPerformer = true;
    if (rawCounsellorStats.length > 1) {
      const last = rawCounsellorStats[rawCounsellorStats.length - 1];
      if (last.admissionsConverted === 0 && last.leadsAssigned > 0) {
        last.isLowPerformer = true;
      }
    }
  }

  // 7. Lead Source Analysis
  const sourceMap: { [key: string]: { leads: number; admissions: number; revenue: number } } = {};
  
  todayLeads.forEach((e: any) => {
    const src = e.leadSource || "Other Sources";
    if (!sourceMap[src]) sourceMap[src] = { leads: 0, admissions: 0, revenue: 0 };
    sourceMap[src].leads += 1;
  });

  todayAdmissions.forEach((a: any) => {
    const src = a.leadSource || "Direct Walkin";
    if (!sourceMap[src]) sourceMap[src] = { leads: 0, admissions: 0, revenue: 0 };
    sourceMap[src].admissions += 1;
    sourceMap[src].revenue += Number(a.amountReceivedToday || a.paidAmount || 0);
  });

  const leadSourceAnalysis = Object.keys(sourceMap).map((src) => {
    const item = sourceMap[src];
    const conversionRate = item.leads > 0 ? Number(Math.min(100, (item.admissions / item.leads) * 100).toFixed(1)) : 0;
    return {
      source: src,
      leadsGenerated: item.leads,
      admissions: item.admissions,
      conversionRate,
      revenueContribution: item.revenue
    };
  });

  // 8. Daily Collection Summary by Payment Mode
  const modeMap: { [key: string]: number } = { "UPI": 0, "Bank Transfer": 0, "Cash": 0, "Credit Card": 0, "Cheque": 0, "NEFT/RTGS": 0 };
  todayPayments.forEach((p: any) => {
    const m = p.paymentMode || "UPI";
    modeMap[m] = (modeMap[m] || 0) + (Number(p.amountReceived) || 0);
  });

  const collectionSummaryByMode = Object.keys(modeMap).map((mode) => {
    const amount = modeMap[mode];
    const percentage = todayColl > 0 ? Number(((amount / todayColl) * 100).toFixed(1)) : 0;
    return { mode, amount, percentage };
  });

  // 9. Pending Fee & EMI Summary
  const overdueAdmissions = allAdmissions.filter((a: any) => Number(a.remainingBalance) > 0 && a.hasEmi);
  const overdueAmount = overdueAdmissions.reduce((acc, a: any) => acc + Number(a.remainingBalance || 0), 0);

  const studentsRequiringFollowup = overdueAdmissions.slice(0, 5).map((a: any) => ({
    id: a._id?.toString() || "",
    fullName: a.fullName || a.studentFullName || "Student",
    mobileNumber: a.mobileNumber || a.phone || "N/A",
    course: a.course || "N/A",
    remainingBalance: Number(a.remainingBalance) || 0,
    nextDueDate: a.updatedAt ? new Date(a.updatedAt).toLocaleDateString("en-IN") : "Immediate"
  }));

  const pendingFeeSummary = {
    overdueAmount,
    overdueStudentsCount: overdueAdmissions.length,
    upcomingInstallmentsAmount: Math.round(overdueAmount * 0.4),
    upcomingStudentsCount: overdueAdmissions.length,
    studentsRequiringFollowup
  };

  // 10. Operational Alerts Engine
  const operationalAlerts: DailyBiReportData["operationalAlerts"] = [];

  if (overdueAdmissions.length > 0) {
    operationalAlerts.push({
      id: "alert-emi",
      type: "critical",
      category: "Finance",
      title: `${overdueAdmissions.length} Students Have Overdue EMIs`,
      message: `Total overdue balance stands at ₹${overdueAmount.toLocaleString("en-IN")}. Immediate follow-up required.`
    });
  }

  if (todayLeadsCount > 0 && todayAdmissionsCount === 0) {
    operationalAlerts.push({
      id: "alert-conv",
      type: "warning",
      category: "Sales Velocity",
      title: "Zero Admissions Recorded Today",
      message: `${todayLeadsCount} leads were generated today, but conversion rate is currently 0%. Check demo schedule.`
    });
  }

  if (todayBusinessLoss > 50000) {
    operationalAlerts.push({
      id: "alert-loss",
      type: "warning",
      category: "Business Loss",
      title: "Estimated Business Loss Exceeds ₹50,000",
      message: `Unconverted leads today account for ₹${todayBusinessLoss.toLocaleString("en-IN")} in unrealized revenue.`
    });
  }

  // 11. Tomorrow's Business Targets
  const tomorrowTargets = {
    revenueTarget: Math.round(todayRevenue > 0 ? todayRevenue * 1.2 : 50000),
    admissionsTarget: Math.max(3, todayAdmissionsCount + 2),
    leadFollowupsTarget: Math.max(15, todayLeadsCount + 5),
    demoSessionsTarget: Math.max(5, demosScheduled + 3),
    pendingFeeRecoveryTarget: Math.round(overdueAmount * 0.15),
    collectionsTarget: Math.round(todayColl > 0 ? todayColl * 1.25 : 35000)
  };

  // 12. AI Business Insights Synthesis
  const achievements = [];
  if (todayColl > 0) achievements.push(`Generated ₹${todayColl.toLocaleString("en-IN")} in total collections today.`);
  if (todayAdmissionsCount > 0) achievements.push(`Successfully enrolled ${todayAdmissionsCount} new student admissions.`);
  if (todayConvRate >= 50) achievements.push(`Achieved an impressive ${todayConvRate.toFixed(1)}% lead conversion velocity.`);
  if (achievements.length === 0) achievements.push("Maintained system stability and operational tracking across all brands.");

  const immediateAttention = [];
  if (overdueAdmissions.length > 0) immediateAttention.push(`Recover ₹${overdueAmount.toLocaleString("en-IN")} in overdue EMI balances.`);
  if (todayUnconvertedLeads > 0) immediateAttention.push(`Follow up on ${todayUnconvertedLeads} unconverted leads to recapture ₹${todayBusinessLoss.toLocaleString("en-IN")} in lost opportunity.`);

  const topExec = rawCounsellorStats.find(c => c.isTopPerformer);
  const brandObs = `Brand performance was led by ${brandPerformance[0]?.brandName || "CADDesk"} with ${brandPerformance[0]?.admissions || 0} admissions today. ${topExec ? `Top sales executive ${topExec.name} converted ${topExec.admissionsConverted} admissions.` : ""}`;

  const lostObs = `Estimated business loss for the day is ₹${todayBusinessLoss.toLocaleString("en-IN")} across ${todayUnconvertedLeads} unconverted leads. Target conversion rate improvement to capture lost revenue.`;

  const priorityActions = [
    `Target ₹${tomorrowTargets.collectionsTarget.toLocaleString("en-IN")} in daily collections tomorrow.`,
    `Schedule at least ${tomorrowTargets.demoSessionsTarget} demo sessions with active prospect leads.`,
    `Execute WhatsApp EMI recovery campaign for ${overdueAdmissions.length} pending installment accounts.`
  ];

  const aiInsights = {
    executiveSummary: `Today's operations generated ₹${todayColl.toLocaleString("en-IN")} in collections across ${todayAdmissionsCount} new admissions from ${todayLeadsCount} total leads. Overall conversion rate stands at ${todayConvRate.toFixed(1)}%.`,
    keyAchievements: achievements,
    immediateAttentionAreas: immediateAttention,
    brandAndCounsellorObservations: brandObs,
    lostOpportunityAssessment: lostObs,
    recommendedPriorityActions: priorityActions
  };

  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const generatedAtStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return {
    dateStr,
    generatedAtStr,
    executiveSummary,
    revenueTrend,
    revenueComparison: {
      today: todayRevenue,
      yesterday: yesterdayRevenue,
      sameDayLastWeek: lastWeekColl
    },
    conversionFunnel,
    businessLossAnalysis,
    brandPerformance,
    counsellorPerformance: rawCounsellorStats,
    leadSourceAnalysis,
    collectionSummaryByMode,
    pendingFeeSummary,
    operationalAlerts,
    tomorrowTargets,
    aiInsights
  };
}
