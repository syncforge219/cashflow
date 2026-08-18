import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Expense from "@/models/Expense";
import Payroll from "@/models/Payroll";
import Brand from "@/models/Brand";

export interface BrandWeekMetric {
  weekNumber: number;
  weekLabel: string;
  dateRange: string;
  leads: number;
  admissions: number;
  collections: number;
  revenue: number;
  conversionRate: number;
  velocityStatus: string;
}

export interface BrandMonthlyPerformance {
  brandName: string;
  brandCode: string;
  brandInitials: string;
  logoUrl?: string;

  // Month-To-Date (MTD) Performance
  mtdLeads: number;
  mtdAdmissions: number;
  mtdCollections: number;
  mtdRevenue: number;
  mtdConversionRate: number;

  // Week-Wise Breakdown (Weeks 1 to 5)
  weeks: BrandWeekMetric[];
  monthTotals: {
    leads: number;
    admissions: number;
    collections: number;
    revenue: number;
    conversionRate: number;
    weeklyAvgLeads: number;
    weeklyAvgAdmissions: number;
    weeklyAvgCollections: number;
    weeklyAvgRevenue: number;
  };

  // Comparison with Last Month (MoM)
  lastMonth: {
    monthName: string;
    leads: number;
    admissions: number;
    collections: number;
    revenue: number;
    conversionRate: number;
    leadsGrowthPct: number;
    admissionsGrowthPct: number;
    collectionsGrowthPct: number;
    revenueGrowthPct: number;
  };

  // Comparison with Last Quarter (QoQ)
  lastQuarter: {
    quarterName: string;
    totalLeads: number;
    totalAdmissions: number;
    totalCollections: number;
    totalRevenue: number;
    monthlyAvgCollections: number;
    monthlyAvgRevenue: number;
    quarterlyGrowthPct: number;
  };

  // Profit / Loss Assessment for the Brand
  financialPnL: {
    thisMonthCollections: number;
    totalInflowCollections: number;
    totalAdmissionValue: number;
    totalAllocatedExpenses: number;
    totalAllocatedPayroll: number;
    totalOutflow: number;
    netProfitOrLoss: number;
    isProfit: boolean;
    marginPct: number;
    statusLabel: "PROFIT" | "LOSS" | "BREAK-EVEN";

    // Last Month Comparison for Collections & Profit/Loss
    lastMonthName: string;
    lastMonthCollections: number;
    collectionsGrowthDiff: number;
    collectionsGrowthPct: number;
    lastMonthAllocatedExpenses: number;
    lastMonthAllocatedPayroll: number;
    lastMonthTotalOutflow: number;
    lastMonthNetProfitOrLoss: number;
    lastMonthIsProfit: boolean;
    lastMonthMarginPct: number;
    profitGrowthDiff: number;
    profitGrowthPct: number;
  };
}

export interface MonthlyBiReportData {
  monthStr: string;
  dateStr: string;
  generatedAtStr: string;
  brandMonthlyReports: BrandMonthlyPerformance[];

  // Executive Overall MTD Summary
  executiveSummary: {
    totalRevenue: { value: number; prevValue: number; changePct: number };
    totalCollections: { value: number; prevValue: number; changePct: number };
    totalLeads: { value: number; prevValue: number; changePct: number };
    admissions: { value: number; prevValue: number; changePct: number };
    conversionRate: { value: number; prevValue: number; changePct: number };
    totalExpenses: { value: number; prevValue: number; changePct: number };
    totalPayroll: { value: number; prevValue: number; changePct: number };
    netProfitOrLoss: { value: number; isProfit: boolean; marginPct: number };
  };
}

export async function getMonthlyBiReportData(targetDate?: Date): Promise<MonthlyBiReportData> {
  await dbConnect();

  const now = targetDate || new Date();

  // 1. Calculate Date Boundaries
  // Current Month MTD: 1st of month to now (or end of month)
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed (0 = Jan, 7 = Aug)

  const mtdStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0);
  const mtdEnd = new Date(now);
  mtdEnd.setHours(23, 59, 59, 999);

  // Full Current Month End (for total month days)
  const monthDaysCount = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Last Full Month: 1st of prev month to last day of prev month
  const lastMonthStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
  const lastMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
  const lastMonthName = lastMonthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  // Last Quarter Calculation:
  // Quarters: Q1 (Jan-Mar: 0-2), Q2 (Apr-Jun: 3-5), Q3 (Jul-Sep: 6-8), Q4 (Oct-Dec: 9-11)
  const currentQuarterIdx = Math.floor(currentMonth / 3);
  let lastQuarterStartMonth = (currentQuarterIdx - 1) * 3;
  let lastQuarterYear = currentYear;
  if (lastQuarterStartMonth < 0) {
    lastQuarterStartMonth = 9;
    lastQuarterYear = currentYear - 1;
  }
  const lastQuarterStart = new Date(lastQuarterYear, lastQuarterStartMonth, 1, 0, 0, 0, 0);
  const lastQuarterEnd = new Date(lastQuarterYear, lastQuarterStartMonth + 3, 0, 23, 59, 59, 999);
  const lastQuarterName = `Q${((lastQuarterStartMonth / 3) + 1)} ${lastQuarterYear} (${lastQuarterStart.toLocaleDateString("en-IN", { month: "short" })} - ${lastQuarterEnd.toLocaleDateString("en-IN", { month: "short" })})`;

  // 2. Fetch Datasets
  const [
    allEnquiries,
    allAdmissions,
    allPayments,
    allExpenses,
    allPayrolls,
    allBrands,
  ] = await Promise.all([
    Enquiry.find({}).lean(),
    Admission.find({}).lean(),
    Payment.find({}).lean(),
    Expense.find({}).lean(),
    Payroll.find({}).lean(),
    Brand.find({}).lean(),
  ]);

  // 3. Helper Functions
  const sumAmount = (arr: any[], key = "amountReceived") =>
    arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);

  const getPctChange = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Number((((current - prev) / prev) * 100).toFixed(1));
  };

  const cleanName = (nm?: string) => {
    if (!nm) return "";
    return String(nm).toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  };

  // Admission lookup map for attributing payments
  const admissionMap = new Map<string, any>();
  allAdmissions.forEach((a: any) => {
    if (a._id) admissionMap.set(a._id.toString(), a);
    const sName = cleanName(a.fullName || a.studentName);
    if (sName) admissionMap.set(sName, a);
  });

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

  // 4. Extract Registered Brands
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

  if (registeredBrandList.length === 0) {
    [...allAdmissions, ...allPayments, ...allEnquiries].forEach((item: any) => {
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

  if (registeredBrandList.length === 0) {
    ["CADD MANTRA", "DESIGN GATEWAY", "DIGIFOOTPRINTS"].forEach((bName) => {
      registeredBrandList.push({
        name: bName,
        code: bName.replace(/[^A-Z0-9]/g, "_"),
        logoUrl: "",
      });
    });
  }

  // 5. Build 5 Week Windows for the Current Month
  interface WeekDef {
    weekNumber: number;
    startDay: number;
    endDay: number;
    startDate: Date;
    endDate: Date;
    label: string;
    dateRange: string;
  }

  const monthShortName = mtdStart.toLocaleDateString("en-IN", { month: "short" });
  const weekDefs: WeekDef[] = [
    {
      weekNumber: 1,
      startDay: 1,
      endDay: 7,
      startDate: new Date(currentYear, currentMonth, 1, 0, 0, 0, 0),
      endDate: new Date(currentYear, currentMonth, 7, 23, 59, 59, 999),
      label: `Week 1 (01-07 ${monthShortName})`,
      dateRange: `01 ${monthShortName} – 07 ${monthShortName}`,
    },
    {
      weekNumber: 2,
      startDay: 8,
      endDay: 14,
      startDate: new Date(currentYear, currentMonth, 8, 0, 0, 0, 0),
      endDate: new Date(currentYear, currentMonth, 14, 23, 59, 59, 999),
      label: `Week 2 (08-14 ${monthShortName})`,
      dateRange: `08 ${monthShortName} – 14 ${monthShortName}`,
    },
    {
      weekNumber: 3,
      startDay: 15,
      endDay: 21,
      startDate: new Date(currentYear, currentMonth, 15, 0, 0, 0, 0),
      endDate: new Date(currentYear, currentMonth, 21, 23, 59, 59, 999),
      label: `Week 3 (15-21 ${monthShortName})`,
      dateRange: `15 ${monthShortName} – 21 ${monthShortName}`,
    },
    {
      weekNumber: 4,
      startDay: 22,
      endDay: 28,
      startDate: new Date(currentYear, currentMonth, 22, 0, 0, 0, 0),
      endDate: new Date(currentYear, currentMonth, 28, 23, 59, 59, 999),
      label: `Week 4 (22-28 ${monthShortName})`,
      dateRange: `22 ${monthShortName} – 28 ${monthShortName}`,
    },
    {
      weekNumber: 5,
      startDay: 29,
      endDay: monthDaysCount,
      startDate: new Date(currentYear, currentMonth, 29, 0, 0, 0, 0),
      endDate: new Date(currentYear, currentMonth, monthDaysCount, 23, 59, 59, 999),
      label: `Week 5 (29-${monthDaysCount} ${monthShortName})`,
      dateRange: `29 ${monthShortName} – ${monthDaysCount} ${monthShortName}`,
    },
  ];

  // 6. Pre-calculate MTD Expenses & Payroll
  const mtdExpenses = allExpenses.filter((e: any) => {
    const dt = new Date(e.expenseDate || e.createdAt);
    return !isNaN(dt.getTime()) && dt >= mtdStart && dt <= mtdEnd;
  });

  const mtdPayrolls = allPayrolls.filter((p: any) => {
    const dt = new Date(p.paymentDate || p.createdAt);
    const monthMatch = p.month ? p.month.includes(String(currentMonth + 1).padStart(2, "0")) : false;
    return (dt >= mtdStart && dt <= mtdEnd) || monthMatch;
  });

  const brandCount = Math.max(1, registeredBrandList.length);

  // 7. Generate Brand Monthly Performance
  let overallMtdRevenue = 0;
  let overallMtdCollections = 0;
  let overallMtdLeads = 0;
  let overallMtdAdmissions = 0;
  let overallMtdExpenses = sumAmount(mtdExpenses, "amount");
  let overallMtdPayroll = sumAmount(mtdPayrolls, "netSalary");

  const brandMonthlyReports: BrandMonthlyPerformance[] = registeredBrandList.map((bObj) => {
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

    // MTD Datasets for Brand
    const bMtdLeads = allEnquiries.filter((e: any) => {
      const dt = new Date(e.createdAt || e.date);
      return !isNaN(dt.getTime()) && dt >= mtdStart && dt <= mtdEnd && isBrandMatch(e.targetBrand || e.brand);
    });

    const bMtdAdmissions = allAdmissions.filter((a: any) => {
      const dt = new Date(a.admissionDate || a.createdAt);
      return !isNaN(dt.getTime()) && dt >= mtdStart && dt <= mtdEnd && isBrandMatch(a.brand);
    });

    const bMtdPayments = allPayments.filter((p: any) => {
      const dt = new Date(p.paymentDate || p.createdAt);
      return !isNaN(dt.getTime()) && dt >= mtdStart && dt <= mtdEnd && isBrandMatch(getPaymentBrand(p));
    });

    const bMtdLeadsCount = bMtdLeads.length;
    const bMtdAdmissionsCount = bMtdAdmissions.length;
    const bMtdCollections = sumAmount(bMtdPayments);
    const bMtdRevenue = bMtdAdmissions.reduce((acc, a: any) => acc + (Number(a.totalCourseFee || a.finalFee || a.courseFee) || 0), 0);
    const bMtdConvRate = bMtdLeadsCount > 0 ? Number(((bMtdAdmissionsCount / bMtdLeadsCount) * 100).toFixed(1)) : (bMtdAdmissionsCount > 0 ? 100 : 0);

    overallMtdRevenue += bMtdRevenue;
    overallMtdCollections += bMtdCollections;
    overallMtdLeads += bMtdLeadsCount;
    overallMtdAdmissions += bMtdAdmissionsCount;

    // ── Week-Wise Breakdown (Weeks 1 to 5) ──
    const weeks: BrandWeekMetric[] = weekDefs.map((wDef) => {
      const wLeads = allEnquiries.filter((e: any) => {
        const dt = new Date(e.createdAt || e.date);
        return !isNaN(dt.getTime()) && dt >= wDef.startDate && dt <= wDef.endDate && isBrandMatch(e.targetBrand || e.brand);
      });

      const wAdmissions = allAdmissions.filter((a: any) => {
        const dt = new Date(a.admissionDate || a.createdAt);
        return !isNaN(dt.getTime()) && dt >= wDef.startDate && dt <= wDef.endDate && isBrandMatch(a.brand);
      });

      const wPayments = allPayments.filter((p: any) => {
        const dt = new Date(p.paymentDate || p.createdAt);
        return !isNaN(dt.getTime()) && dt >= wDef.startDate && dt <= wDef.endDate && isBrandMatch(getPaymentBrand(p));
      });

      const wLCount = wLeads.length;
      const wACount = wAdmissions.length;
      const wColl = sumAmount(wPayments);
      const wRev = wAdmissions.reduce((acc, a: any) => acc + (Number(a.totalCourseFee || a.finalFee || a.courseFee) || 0), 0);
      const wConv = wLCount > 0 ? Number(((wACount / wLCount) * 100).toFixed(1)) : (wACount > 0 ? 100 : 0);

      let velocityStatus = "Steady";
      if (wACount >= 3 || wColl >= 50000) velocityStatus = "High Velocity";
      else if (wACount >= 1 || wColl >= 20000) velocityStatus = "Active Pace";
      else if (wLCount > 0) velocityStatus = "Pipeline Building";
      else velocityStatus = "Low Activity";

      return {
        weekNumber: wDef.weekNumber,
        weekLabel: wDef.label,
        dateRange: wDef.dateRange,
        leads: wLCount,
        admissions: wACount,
        collections: wColl,
        revenue: wRev,
        conversionRate: wConv,
        velocityStatus,
      };
    });

    // ── Comparison with Last Month ──
    const bLastMonthLeads = allEnquiries.filter((e: any) => {
      const dt = new Date(e.createdAt || e.date);
      return !isNaN(dt.getTime()) && dt >= lastMonthStart && dt <= lastMonthEnd && isBrandMatch(e.targetBrand || e.brand);
    });

    const bLastMonthAdmissions = allAdmissions.filter((a: any) => {
      const dt = new Date(a.admissionDate || a.createdAt);
      return !isNaN(dt.getTime()) && dt >= lastMonthStart && dt <= lastMonthEnd && isBrandMatch(a.brand);
    });

    const bLastMonthPayments = allPayments.filter((p: any) => {
      const dt = new Date(p.paymentDate || p.createdAt);
      return !isNaN(dt.getTime()) && dt >= lastMonthStart && dt <= lastMonthEnd && isBrandMatch(getPaymentBrand(p));
    });

    const bLastMonthLCount = bLastMonthLeads.length;
    const bLastMonthACount = bLastMonthAdmissions.length;
    const bLastMonthColl = sumAmount(bLastMonthPayments);
    const bLastMonthRev = bLastMonthAdmissions.reduce((acc, a: any) => acc + (Number(a.totalCourseFee || a.finalFee || a.courseFee) || 0), 0);
    const bLastMonthConv = bLastMonthLCount > 0 ? Number(((bLastMonthACount / bLastMonthLCount) * 100).toFixed(1)) : (bLastMonthACount > 0 ? 100 : 0);

    const lastMonthComparison = {
      monthName: lastMonthName,
      leads: bLastMonthLCount,
      admissions: bLastMonthACount,
      collections: bLastMonthColl,
      revenue: bLastMonthRev,
      conversionRate: bLastMonthConv,
      leadsGrowthPct: getPctChange(bMtdLeadsCount, bLastMonthLCount),
      admissionsGrowthPct: getPctChange(bMtdAdmissionsCount, bLastMonthACount),
      collectionsGrowthPct: getPctChange(bMtdCollections, bLastMonthColl),
      revenueGrowthPct: getPctChange(bMtdRevenue, bLastMonthRev),
    };

    // ── Comparison with Last Quarter ──
    const bLastQuarterLeads = allEnquiries.filter((e: any) => {
      const dt = new Date(e.createdAt || e.date);
      return !isNaN(dt.getTime()) && dt >= lastQuarterStart && dt <= lastQuarterEnd && isBrandMatch(e.targetBrand || e.brand);
    });

    const bLastQuarterAdmissions = allAdmissions.filter((a: any) => {
      const dt = new Date(a.admissionDate || a.createdAt);
      return !isNaN(dt.getTime()) && dt >= lastQuarterStart && dt <= lastQuarterEnd && isBrandMatch(a.brand);
    });

    const bLastQuarterPayments = allPayments.filter((p: any) => {
      const dt = new Date(p.paymentDate || p.createdAt);
      return !isNaN(dt.getTime()) && dt >= lastQuarterStart && dt <= lastQuarterEnd && isBrandMatch(getPaymentBrand(p));
    });

    const bLastQuarterLCount = bLastQuarterLeads.length;
    const bLastQuarterACount = bLastQuarterAdmissions.length;
    const bLastQuarterColl = sumAmount(bLastQuarterPayments);
    const bLastQuarterRev = bLastQuarterAdmissions.reduce((acc, a: any) => acc + (Number(a.totalCourseFee || a.finalFee || a.courseFee) || 0), 0);
    const bLastQuarterMonthlyAvgColl = Math.round(bLastQuarterColl / 3);
    const bLastQuarterMonthlyAvgRev = Math.round(bLastQuarterRev / 3);

    const lastQuarterComparison = {
      quarterName: lastQuarterName,
      totalLeads: bLastQuarterLCount,
      totalAdmissions: bLastQuarterACount,
      totalCollections: bLastQuarterColl,
      totalRevenue: bLastQuarterRev,
      monthlyAvgCollections: bLastQuarterMonthlyAvgColl,
      monthlyAvgRevenue: bLastQuarterMonthlyAvgRev,
      quarterlyGrowthPct: getPctChange(bMtdCollections, bLastQuarterMonthlyAvgColl),
    };

    // ── Financial P&L Calculation for Brand ──
    // Attribute specific brand expenses + share of general expenses
    const brandDirectExpenses = mtdExpenses
      .filter((e: any) => isBrandMatch(e.brand))
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

    const generalExpenses = mtdExpenses
      .filter((e: any) => !e.brand || e.brand === "All Brands" || e.brand === "All Companies")
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

    const allocatedExpenses = Math.round(brandDirectExpenses + generalExpenses / brandCount);

    const brandDirectPayroll = mtdPayrolls
      .filter((p: any) => isBrandMatch(p.brand))
      .reduce((sum: number, p: any) => sum + (Number(p.netSalary) || 0), 0);

    const generalPayroll = mtdPayrolls
      .filter((p: any) => !p.brand || p.brand === "All Brands" || p.brand === "All Companies")
      .reduce((sum: number, p: any) => sum + (Number(p.netSalary) || 0), 0);

    const allocatedPayroll = Math.round(brandDirectPayroll + generalPayroll / brandCount);
    const totalOutflow = allocatedExpenses + allocatedPayroll;
    const netProfitOrLoss = bMtdCollections - totalOutflow;
    const isProfit = netProfitOrLoss >= 0;
    const marginPct = bMtdCollections > 0
      ? Number(((netProfitOrLoss / bMtdCollections) * 100).toFixed(1))
      : (isProfit ? 0 : -100);

    // Last Month Expenses & Payroll for Brand P&L Comparison
    const lastMonthExpensesList = allExpenses.filter((e: any) => {
      const dt = new Date(e.expenseDate || e.createdAt);
      return !isNaN(dt.getTime()) && dt >= lastMonthStart && dt <= lastMonthEnd;
    });

    const lastMonthPayrollsList = allPayrolls.filter((p: any) => {
      const dt = new Date(p.paymentDate || p.createdAt);
      const prevMonthStr = String(lastMonthStart.getMonth() + 1).padStart(2, "0");
      const monthMatch = p.month ? p.month.includes(prevMonthStr) : false;
      return (dt >= lastMonthStart && dt <= lastMonthEnd) || monthMatch;
    });

    const lmDirectExpenses = lastMonthExpensesList
      .filter((e: any) => isBrandMatch(e.brand))
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const lmGeneralExpenses = lastMonthExpensesList
      .filter((e: any) => !e.brand || e.brand === "All Brands" || e.brand === "All Companies")
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const lmAllocatedExpenses = Math.round(lmDirectExpenses + lmGeneralExpenses / brandCount);

    const lmDirectPayroll = lastMonthPayrollsList
      .filter((p: any) => isBrandMatch(p.brand))
      .reduce((sum: number, p: any) => sum + (Number(p.netSalary) || 0), 0);
    const lmGeneralPayroll = lastMonthPayrollsList
      .filter((p: any) => !p.brand || p.brand === "All Brands" || p.brand === "All Companies")
      .reduce((sum: number, p: any) => sum + (Number(p.netSalary) || 0), 0);
    const lmAllocatedPayroll = Math.round(lmDirectPayroll + lmGeneralPayroll / brandCount);

    const lmTotalOutflow = lmAllocatedExpenses + lmAllocatedPayroll;
    const lmNetProfitOrLoss = bLastMonthColl - lmTotalOutflow;
    const lmIsProfit = lmNetProfitOrLoss >= 0;
    const lmMarginPct = bLastMonthColl > 0
      ? Number(((lmNetProfitOrLoss / bLastMonthColl) * 100).toFixed(1))
      : (lmIsProfit ? 0 : -100);

    const collectionsGrowthDiff = bMtdCollections - bLastMonthColl;
    const collectionsGrowthPct = getPctChange(bMtdCollections, bLastMonthColl);
    const profitGrowthDiff = netProfitOrLoss - lmNetProfitOrLoss;
    const profitGrowthPct = getPctChange(netProfitOrLoss, lmNetProfitOrLoss);

    const statusLabel: "PROFIT" | "LOSS" | "BREAK-EVEN" =
      netProfitOrLoss > 0 ? "PROFIT" : netProfitOrLoss < 0 ? "LOSS" : "BREAK-EVEN";

    return {
      brandName: bName,
      brandCode: bCode,
      brandInitials: bInitials,
      logoUrl: bObj.logoUrl,
      mtdLeads: bMtdLeadsCount,
      mtdAdmissions: bMtdAdmissionsCount,
      mtdCollections: bMtdCollections,
      mtdRevenue: bMtdRevenue,
      mtdConversionRate: bMtdConvRate,
      weeks,
      monthTotals: {
        leads: bMtdLeadsCount,
        admissions: bMtdAdmissionsCount,
        collections: bMtdCollections,
        revenue: bMtdRevenue,
        conversionRate: bMtdConvRate,
        weeklyAvgLeads: Number((bMtdLeadsCount / 5).toFixed(1)),
        weeklyAvgAdmissions: Number((bMtdAdmissionsCount / 5).toFixed(1)),
        weeklyAvgCollections: Math.round(bMtdCollections / 5),
        weeklyAvgRevenue: Math.round(bMtdRevenue / 5),
      },
      lastMonth: lastMonthComparison,
      lastQuarter: lastQuarterComparison,
      financialPnL: {
        thisMonthCollections: bMtdCollections,
        totalInflowCollections: bMtdCollections,
        totalAdmissionValue: bMtdRevenue,
        totalAllocatedExpenses: allocatedExpenses,
        totalAllocatedPayroll: allocatedPayroll,
        totalOutflow,
        netProfitOrLoss,
        isProfit,
        marginPct,
        statusLabel,
        lastMonthName,
        lastMonthCollections: bLastMonthColl,
        collectionsGrowthDiff,
        collectionsGrowthPct,
        lastMonthAllocatedExpenses: lmAllocatedExpenses,
        lastMonthAllocatedPayroll: lmAllocatedPayroll,
        lastMonthTotalOutflow: lmTotalOutflow,
        lastMonthNetProfitOrLoss: lmNetProfitOrLoss,
        lastMonthIsProfit: lmIsProfit,
        lastMonthMarginPct: lmMarginPct,
        profitGrowthDiff,
        profitGrowthPct,
      },
    };
  });

  const totalOutflowOverall = overallMtdExpenses + overallMtdPayroll;
  const overallNetPnL = overallMtdCollections - totalOutflowOverall;
  const overallMargin = overallMtdCollections > 0 ? Number(((overallNetPnL / overallMtdCollections) * 100).toFixed(1)) : 0;

  const monthStr = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const generatedAtStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  const overallConvRate = overallMtdLeads > 0 ? Number(((overallMtdAdmissions / overallMtdLeads) * 100).toFixed(1)) : 0;

  return {
    monthStr,
    dateStr,
    generatedAtStr,
    brandMonthlyReports,
    executiveSummary: {
      totalRevenue: { value: overallMtdRevenue, prevValue: 0, changePct: 0 },
      totalCollections: { value: overallMtdCollections, prevValue: 0, changePct: 0 },
      totalLeads: { value: overallMtdLeads, prevValue: 0, changePct: 0 },
      admissions: { value: overallMtdAdmissions, prevValue: 0, changePct: 0 },
      conversionRate: { value: overallConvRate, prevValue: 0, changePct: 0 },
      totalExpenses: { value: overallMtdExpenses, prevValue: 0, changePct: 0 },
      totalPayroll: { value: overallMtdPayroll, prevValue: 0, changePct: 0 },
      netProfitOrLoss: { value: overallNetPnL, isProfit: overallNetPnL >= 0, marginPct: overallMargin },
    },
  };
}
