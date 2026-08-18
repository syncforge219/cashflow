import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import User from "@/models/User";
import Brand from "@/models/Brand";

export interface BrandConvertedAdmission {
  admissionId: string;
  studentName: string;
  courseName: string;
  leadRegistrationDate: string;
  admissionDate: string;
  turnaroundDays: string;
  totalCourseFee: number;
  amountReceivedToday: number;
  paymentMode: string;
  counsellor: string;
}

export interface BrandDayMetric {
  date: string;
  dayName: string;
  leads: number;
  walkins: number;
  admissions: number;
  collections: number;
  revenue: number;
  conversionRate: number;
}

export interface BrandDailyPerformance {
  brandName: string;
  brandCode: string;
  brandInitials: string;
  logoUrl?: string;
  todayLeads: number;
  todayWalkins: number;
  todayAdmissions: number;
  todayCollections: number;
  todayAdmissionRevenue: number;
  todayFollowups: number;
  conversionRate: number;
  last7Days: BrandDayMetric[];
  sevenDaysTotals: {
    leads: number;
    walkins: number;
    admissions: number;
    collections: number;
    revenue: number;
    conversionRate: number;
  };
  todayAdmissionsList: BrandConvertedAdmission[];
}

export interface DailyBiReportData {
  dateStr: string;
  generatedAtStr: string;
  
  // Brand-Divided Daily Reports
  brandDailyReports: BrandDailyPerformance[];

  // Executive Summary & Trends
  executiveSummary: {
    totalRevenue: { value: number; prevValue: number; changePct: number };
    totalCollections: { value: number; prevValue: number; changePct: number };
    totalLeads: { value: number; prevValue: number; changePct: number };
    admissions: { value: number; prevValue: number; changePct: number };
    conversionRate: { value: number; prevValue: number; changePct: number };
    outstandingFees: { value: number; prevValue: number; changePct: number };
    businessLoss: { value: number; prevValue: number; changePct: number };
    totalFollowupsDone: { value: number; prevValue: number; changePct: number };
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
    followupsDone: number;
    conversionRate: number;
    estimatedBusinessLoss: number;
  }>;

  // Counsellor / Sales Executive Performance
  counsellorPerformance: Array<{
    name: string;
    email: string;
    brandScope: string;
    leadsAssigned: number;
    followupsDone: number;
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

  const isDateToday = (d: any) => {
    if (!d) return false;
    const dt = new Date(d);
    return !isNaN(dt.getTime()) && dt >= todayStart && dt <= todayEnd;
  };

  const isStringDateToday = (s: string) => {
    if (!s) return false;
    const sClean = s.trim();
    const dt = new Date(sClean);
    if (!isNaN(dt.getTime()) && dt >= todayStart && dt <= todayEnd) return true;
    const todayLocalStr = now.toLocaleDateString("en-IN");
    const todayIsoStr = now.toISOString().split("T")[0];
    return sClean === todayLocalStr || sClean === todayIsoStr || sClean.includes(todayIsoStr);
  };

  // Find all followups done today across all enquiries
  let totalFollowupsTodayCount = 0;
  allEnquiries.forEach((e: any) => {
    let leadFollowupDoneToday = false;
    if (Array.isArray(e.followUps)) {
      e.followUps.forEach((f: any) => {
        if (isDateToday(f.completedAt) || isDateToday(f.createdAt) || isStringDateToday(f.date)) {
          totalFollowupsTodayCount++;
          leadFollowupDoneToday = true;
        }
      });
    }
    if (!leadFollowupDoneToday) {
      if (isDateToday(e.updatedAt) && (e.status === "Follow-up" || e.status === "In Progress" || e.followUpNotes)) {
        totalFollowupsTodayCount++;
      }
    }
  });

  if (totalFollowupsTodayCount === 0) {
    totalFollowupsTodayCount = todayLeads.filter((e: any) => e.nextFollowUpDate || e.remarks || e.status === "Follow-up" || e.status === "In Progress").length;
  }

  const executiveSummary = {
    totalRevenue: { value: todayRevenue, prevValue: yesterdayRevenue, changePct: getPctChange(todayRevenue, yesterdayRevenue) },
    totalCollections: { value: todayColl, prevValue: yesterdayColl, changePct: getPctChange(todayColl, yesterdayColl) },
    totalLeads: { value: todayLeadsCount, prevValue: yesterdayLeadsCount, changePct: getPctChange(todayLeadsCount, yesterdayLeadsCount) },
    admissions: { value: todayAdmissionsCount, prevValue: yesterdayAdmissionsCount, changePct: getPctChange(todayAdmissionsCount, yesterdayAdmissionsCount) },
    conversionRate: { value: Number(todayConvRate.toFixed(1)), prevValue: Number(yesterdayConvRate.toFixed(1)), changePct: getPctChange(todayConvRate, yesterdayConvRate) },
    outstandingFees: { value: totalOutstandingFees, prevValue: totalOutstandingFees, changePct: 0 },
    businessLoss: { value: todayBusinessLoss, prevValue: yesterdayBusinessLoss, changePct: getPctChange(todayBusinessLoss, yesterdayBusinessLoss) },
    totalFollowupsDone: { value: totalFollowupsTodayCount, prevValue: totalFollowupsTodayCount, changePct: 0 },
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
  const followupsCompleted = totalFollowupsTodayCount;
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

  // 5. Brand Performance Breakdown & Comprehensive Brand Daily Reports
  const registeredBrandList: Array<{ name: string; code?: string; logoUrl?: string }> = [];
  const registeredBrandSet = new Set<string>();

  allBrands.forEach((b: any) => {
    const name = (b.name || "").trim();
    if (name && !registeredBrandSet.has(name.toLowerCase())) {
      registeredBrandSet.add(name.toLowerCase());
      registeredBrandList.push({
        name,
        code: b.code || name.replace(/[^A-Z0-9]/g, "_"),
        logoUrl: b.logoUrl || "",
      });
    }
  });

  // If no brands registered in DB yet, gather unique active brand names from today's admissions/payments/leads
  if (registeredBrandList.length === 0) {
    [...todayAdmissions, ...todayPayments, ...todayLeads].forEach((item: any) => {
      const bName = (item.brand || item.targetBrand || "").trim();
      if (bName && !registeredBrandSet.has(bName.toLowerCase())) {
        registeredBrandSet.add(bName.toLowerCase());
        registeredBrandList.push({
          name: bName,
          code: bName.replace(/[^A-Z0-9]/g, "_"),
          logoUrl: "",
        });
      }
    });
  }

  // If still empty, supply default standard operational brands
  if (registeredBrandList.length === 0) {
    ["CADD MANTRA", "DESIGN GATEWAY", "DIGIFOOTPRINTS"].forEach((bName) => {
      registeredBrandList.push({
        name: bName,
        code: bName.replace(/[^A-Z0-9]/g, "_"),
        logoUrl: "",
      });
    });
  }

  // Create lookup maps for fast enquiry and admission matching
  const enquiryByIdMap = new Map<string, any>();
  const enquiryByPhoneMap = new Map<string, any>();
  const enquiryByNameMap = new Map<string, any>();

  const cleanPhone = (ph?: string) => {
    if (!ph) return "";
    const digits = String(ph).replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  };

  const cleanName = (nm?: string) => {
    if (!nm) return "";
    return String(nm).toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  };

  allEnquiries.forEach((e: any) => {
    if (e._id) enquiryByIdMap.set(e._id.toString(), e);
    if (e.enquiryId) enquiryByIdMap.set(String(e.enquiryId).trim().toUpperCase(), e);

    const ph = cleanPhone(e.primaryPhoneMobile || e.phone || e.mobileNumber || e.parentsPhoneNumber);
    if (ph && !enquiryByPhoneMap.has(ph)) {
      enquiryByPhoneMap.set(ph, e);
    }

    const nm = cleanName(e.studentFullName || e.fullName || e.studentName);
    if (nm && !enquiryByNameMap.has(nm)) {
      enquiryByNameMap.set(nm, e);
    }
  });

  const isWalkinLead = (e: any): boolean => {
    if (!e) return false;
    const src = String(e.leadSource || "").toLowerCase().trim();
    if (
      src.includes("walkin") ||
      src.includes("walk-in") ||
      src.includes("walk in") ||
      src.includes("direct") ||
      src.includes("campus visit") ||
      src.includes("center visit") ||
      src.includes("centre visit")
    ) {
      return true;
    }
    if (Array.isArray(e.followUps)) {
      for (const f of e.followUps) {
        const contactType = String(f?.typeOfContact || "").toLowerCase();
        if (contactType.includes("walkin") || contactType.includes("walk-in") || contactType.includes("visit")) {
          return true;
        }
      }
    }
    return false;
  };

  // Pre-fetch all payments for 7-day trend calculation
  const allPaymentsForTrend = await Payment.find({}).lean();

  const getPaymentBrand = (p: any): string => {
    if (p.brand && String(p.brand).trim()) return String(p.brand).trim();
    if (p.admissionId) {
      const adm = admissionMap.get(p.admissionId.toString());
      if (adm && adm.brand) return String(adm.brand).trim();
    }
    if (p.studentName) {
      const adm = admissionMap.get(cleanName(p.studentName));
      if (adm && adm.brand) return String(adm.brand).trim();
    }
    return "";
  };

  const brandDailyReports: BrandDailyPerformance[] = registeredBrandList.map((bObj) => {
    const bName = bObj.name.toUpperCase().trim();
    const bNameLower = bName.toLowerCase();
    const bCode = bObj.code || bName.replace(/[^A-Z0-9]/g, "_");
    const bInitials = bName
      .split(/\s+/)
      .map((w: string) => w[0])
      .filter(Boolean)
      .join("")
      .toUpperCase()
      .slice(0, 3) || bName.slice(0, 2).toUpperCase();

    const isBrandMatch = (target?: string) => {
      if (!target) return false;
      const tLower = target.toLowerCase().trim();
      return tLower === bNameLower || tLower.includes(bNameLower) || bNameLower.includes(tLower);
    };

    const bTodayLeads = todayLeads.filter((e: any) => isBrandMatch(e.targetBrand || e.brand));
    const bTodayWalkins = bTodayLeads.filter(isWalkinLead).length;
    const bTodayAdmissions = todayAdmissions.filter((a: any) => isBrandMatch(a.brand));
    const bTodayPayments = todayPayments.filter((p: any) => isBrandMatch(getPaymentBrand(p)));

    const bTodayLeadsCount = bTodayLeads.length;
    const bTodayAdmissionsCount = bTodayAdmissions.length;
    const bTodayCollections = sumAmount(bTodayPayments);
    const bTodayAdmissionRevenue = bTodayAdmissions.reduce((acc, a: any) => acc + (Number(a.totalCourseFee || a.finalFee || a.courseFee) || 0), 0);

    let bFollowups = 0;
    allEnquiries.forEach((e: any) => {
      if (isBrandMatch(e.targetBrand || e.brand)) {
        if (Array.isArray(e.followUps)) {
          e.followUps.forEach((f: any) => {
            if (isDateToday(f.completedAt) || isDateToday(f.createdAt) || isStringDateToday(f.date)) {
              bFollowups++;
            }
          });
        }
      }
    });
    if (bFollowups === 0) {
      bFollowups = bTodayLeads.filter((e: any) => e.nextFollowUpDate || e.remarks || e.status === "Follow-up" || e.status === "In Progress").length;
    }

    const bConversionRate = bTodayLeadsCount > 0 ? Number(((bTodayAdmissionsCount / bTodayLeadsCount) * 100).toFixed(1)) : (bTodayAdmissionsCount > 0 ? 100 : 0);

    // Build 7-Day Performance History (Day 6 ago -> Day 0 Today)
    const last7Days: BrandDayMetric[] = [];
    let tot7Leads = 0;
    let tot7Walkins = 0;
    let tot7Admissions = 0;
    let tot7Collections = 0;
    let tot7Revenue = 0;

    for (let i = 6; i >= 0; i--) {
      const dStart = new Date(todayStart);
      dStart.setDate(dStart.getDate() - i);
      const dEnd = new Date(todayEnd);
      dEnd.setDate(dEnd.getDate() - i);

      const dayName = dStart.toLocaleDateString("en-IN", { weekday: "short" });
      const dayDateStr = i === 0
        ? `${dStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} (Today)`
        : dStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

      const dLeads = allEnquiries.filter((e: any) => {
        const dt = new Date(e.createdAt || e.date);
        return !isNaN(dt.getTime()) && dt >= dStart && dt <= dEnd && isBrandMatch(e.targetBrand || e.brand);
      });
      const dWalkins = dLeads.filter(isWalkinLead).length;

      const dAdmissions = allAdmissions.filter((a: any) => {
        const dt = new Date(a.admissionDate || a.createdAt);
        return !isNaN(dt.getTime()) && dt >= dStart && dt <= dEnd && isBrandMatch(a.brand);
      });

      const dPayments = allPaymentsForTrend.filter((p: any) => {
        const dt = new Date(p.paymentDate || p.createdAt);
        return !isNaN(dt.getTime()) && dt >= dStart && dt <= dEnd && isBrandMatch(getPaymentBrand(p));
      });

      const dLeadsCount = dLeads.length;
      const dAdmCount = dAdmissions.length;
      const dColl = sumAmount(dPayments);
      const dRev = dAdmissions.reduce((acc, a: any) => acc + (Number(a.totalCourseFee || a.finalFee || a.courseFee) || 0), 0);
      const dConv = dLeadsCount > 0 ? Number(((dAdmCount / dLeadsCount) * 100).toFixed(1)) : (dAdmCount > 0 ? 100 : 0);

      tot7Leads += dLeadsCount;
      tot7Walkins += dWalkins;
      tot7Admissions += dAdmCount;
      tot7Collections += dColl;
      tot7Revenue += dRev;

      last7Days.push({
        date: dayDateStr,
        dayName,
        leads: dLeadsCount,
        walkins: dWalkins,
        admissions: dAdmCount,
        collections: dColl,
        revenue: dRev,
        conversionRate: dConv,
      });
    }

    const tot7Conv = tot7Leads > 0 ? Number(((tot7Admissions / tot7Leads) * 100).toFixed(1)) : (tot7Admissions > 0 ? 100 : 0);

    // Build Converted Admissions List for Today
    const todayAdmissionsList: BrandConvertedAdmission[] = bTodayAdmissions.map((a: any) => {
      let matchedEnquiry: any = null;
      if (a.enquiryId) {
        matchedEnquiry = enquiryByIdMap.get(String(a.enquiryId).trim().toUpperCase()) || enquiryByIdMap.get(String(a.enquiryId));
      }
      if (!matchedEnquiry) {
        const ph = cleanPhone(a.mobileNumber || a.primaryPhoneMobile);
        if (ph) matchedEnquiry = enquiryByPhoneMap.get(ph);
      }
      if (!matchedEnquiry) {
        const nm = cleanName(a.fullName);
        if (nm) matchedEnquiry = enquiryByNameMap.get(nm);
      }

      const admDateObj = new Date(a.admissionDate || a.createdAt || now);
      const admDateStr = !isNaN(admDateObj.getTime())
        ? admDateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : "Today";

      let leadRegDateStr = "";
      let turnaroundDays = "Same Day";

      if (matchedEnquiry) {
        const leadDateObj = new Date(matchedEnquiry.createdAt || matchedEnquiry.date || a.createdAt);
        if (!isNaN(leadDateObj.getTime())) {
          leadRegDateStr = leadDateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
          const diffMs = Math.max(0, admDateObj.getTime() - leadDateObj.getTime());
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays === 0) {
            turnaroundDays = "Same Day (0d)";
          } else {
            turnaroundDays = `${diffDays} Day${diffDays > 1 ? "s" : ""}`;
          }
        } else {
          leadRegDateStr = "Direct Entry";
        }
      } else {
        leadRegDateStr = isWalkinLead(a) ? "Direct Walkin" : "Direct On-Spot";
      }

      const courseName = a.course || (Array.isArray(a.courses) && a.courses[0]) || (Array.isArray(a.targetCourses) && a.targetCourses[0]) || "General Program";
      const totalFee = Number(a.totalCourseFee || a.finalFee || a.courseFee || 0);
      const amountReceivedToday = Number(a.amountReceivedToday || a.registrationAmount || a.downpaymentAmount || a.paidAmount || 0);

      return {
        admissionId: a.admissionId || "ADM-LIVE",
        studentName: a.fullName || a.studentFullName || "Student",
        courseName,
        leadRegistrationDate: leadRegDateStr,
        admissionDate: admDateStr,
        turnaroundDays,
        totalCourseFee: totalFee,
        amountReceivedToday,
        paymentMode: a.paymentMode || "Online",
        counsellor: a.counsellor || a.assignedCrmAdvisor || a.recordedBy || "Sales Advisor",
      };
    });

    return {
      brandName: bName,
      brandCode: bCode,
      brandInitials: bInitials,
      logoUrl: bObj.logoUrl,
      todayLeads: bTodayLeadsCount,
      todayWalkins: bTodayWalkins,
      todayAdmissions: bTodayAdmissionsCount,
      todayCollections: bTodayCollections,
      todayAdmissionRevenue: bTodayAdmissionRevenue,
      todayFollowups: bFollowups,
      conversionRate: bConversionRate,
      last7Days,
      sevenDaysTotals: {
        leads: tot7Leads,
        walkins: tot7Walkins,
        admissions: tot7Admissions,
        collections: tot7Collections,
        revenue: tot7Revenue,
        conversionRate: tot7Conv,
      },
      todayAdmissionsList,
    };
  });

  const brandPerformance = brandDailyReports.map((b) => ({
    brandName: b.brandName,
    totalLeads: b.todayLeads,
    admissions: b.todayAdmissions,
    dailyCollections: b.todayCollections,
    followupsDone: b.todayFollowups,
    conversionRate: b.conversionRate,
    estimatedBusinessLoss: Math.max(0, b.todayLeads - b.todayAdmissions) * avgAdmissionVal,
  }));

  // 6. Counsellor / Sales Executive / Centre Head Performance Dashboard
  const salesRoleSet = new Set([
    "counsellor",
    "sales executive",
    "sales-executive",
    "centre head",
    "centre-head",
    "center head",
    "center-head",
    "brand manager",
    "brand-manager",
    "branch manager",
    "manager",
  ]);

  // Collect all users who have sales/counsellor/centre head role OR who have actions recorded today
  const activeAdvisorNames = new Set<string>();
  todayLeads.forEach((e: any) => {
    const adv = (e.assignedCrmAdvisor || "").trim();
    if (adv) activeAdvisorNames.add(adv.toLowerCase());
  });
  todayAdmissions.forEach((a: any) => {
    const adv = (a.counsellor || a.assignedCrmAdvisor || a.recordedBy || a.createdBy || "").trim();
    if (adv) activeAdvisorNames.add(adv.toLowerCase());
  });
  todayPayments.forEach((p: any) => {
    const adv = (p.recordedBy || p.counsellor || "").trim();
    if (adv) activeAdvisorNames.add(adv.toLowerCase());
  });

  const salesExecs = allUsers.filter((u: any) => {
    const roleLower = (u.role || "").toLowerCase().trim();
    const nameLower = (u.name || "").toLowerCase().trim();
    const emailLower = (u.email || "").toLowerCase().trim();
    return salesRoleSet.has(roleLower) || activeAdvisorNames.has(nameLower) || activeAdvisorNames.has(emailLower);
  });

  // Create admission mapping for attributing payments to counsellors / centre heads
  const admissionMap = new Map<string, any>();
  allAdmissions.forEach((a: any) => {
    if (a._id) admissionMap.set(a._id.toString(), a);
    const sName = (a.fullName || a.studentName || "").toLowerCase().trim();
    if (sName) admissionMap.set(sName, a);
  });

  const rawCounsellorStats = salesExecs.map((exec: any) => {
    const name = exec.name || "Sales Exec";
    const email = exec.email || "";
    const nameLower = name.toLowerCase().trim();
    const emailLower = email.toLowerCase().trim();
    const brandScope = exec.brandScope || "All";

    const isMatch = (val?: string) => {
      if (!val) return false;
      const vLower = val.toLowerCase().trim();
      return vLower === nameLower || vLower === emailLower;
    };

    const cLeads = todayLeads.filter((e: any) => isMatch(e.assignedCrmAdvisor));
    const cAdmissions = todayAdmissions.filter((a: any) => isMatch(a.counsellor) || isMatch(a.assignedCrmAdvisor) || isMatch(a.recordedBy) || isMatch(a.createdBy));
    const cPayments = todayPayments.filter((p: any) => {
      if (isMatch(p.recordedBy) || isMatch(p.counsellor)) return true;
      if (p.admissionId) {
        const adm = admissionMap.get(p.admissionId.toString());
        if (adm) {
          return isMatch(adm.counsellor) || isMatch(adm.assignedCrmAdvisor) || isMatch(adm.createdBy);
        }
      }
      if (p.studentName) {
        const adm = admissionMap.get(p.studentName.toLowerCase().trim());
        if (adm) {
          return isMatch(adm.counsellor) || isMatch(adm.assignedCrmAdvisor) || isMatch(adm.createdBy);
        }
      }
      return false;
    });

    let cFollowups = 0;
    allEnquiries.forEach((e: any) => {
      const isAssigned = isMatch(e.assignedCrmAdvisor);
      let followedToday = false;
      if (Array.isArray(e.followUps)) {
        e.followUps.forEach((f: any) => {
          if (isDateToday(f.completedAt) || isDateToday(f.createdAt) || isStringDateToday(f.date)) {
            if (isMatch(f.assignedTo) || isMatch(f.plannedBy) || isAssigned) {
              cFollowups++;
              followedToday = true;
            }
          }
        });
      }
      if (!followedToday && isAssigned) {
        if (isDateToday(e.updatedAt) && (e.status === "Follow-up" || e.status === "In Progress" || e.followUpNotes)) {
          cFollowups++;
        }
      }
    });
    if (cFollowups === 0) {
      cFollowups = cLeads.filter((e: any) => e.nextFollowUpDate || e.remarks || e.status === "Follow-up" || e.status === "In Progress").length;
    }

    const leadsAssigned = cLeads.length;
    const admissionsConverted = cAdmissions.length;
    const conversionPct = leadsAssigned > 0 ? Number(((admissionsConverted / leadsAssigned) * 100).toFixed(1)) : (admissionsConverted > 0 ? 100 : 0);
    const collectionsGenerated = sumAmount(cPayments);

    let followupPerformance = "Active";
    if (conversionPct >= 40 && admissionsConverted > 0) followupPerformance = "Top Performer";
    else if (conversionPct >= 20 || admissionsConverted > 0) followupPerformance = "Good";
    else if (leadsAssigned > 2 && admissionsConverted === 0) followupPerformance = "Needs Followup";

    return {
      name,
      email,
      brandScope,
      leadsAssigned,
      followupsDone: cFollowups,
      admissionsConverted,
      conversionPct,
      collectionsGenerated,
      followupPerformance,
      isTopPerformer: false,
      isLowPerformer: false
    };
  });

  // Sort & Flag Top and Low Performers
  rawCounsellorStats.sort((a, b) => b.admissionsConverted - a.admissionsConverted || b.collectionsGenerated - a.collectionsGenerated || b.leadsAssigned - a.leadsAssigned);
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
    brandDailyReports,
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
