import { generateDailyReportPdfBuffer } from "../src/lib/pdfGenerator";
import { DailyBiReportData } from "../src/lib/dailyBiService";
import * as fs from "fs";
import * as path from "path";

const mockStats: DailyBiReportData = {
  dateStr: "14 Aug 2026",
  generatedAtStr: "06:40 am",
  executiveSummary: {
    totalRevenue: { value: 10200, prevValue: 0, changePct: 100 },
    totalCollections: { value: 10200, prevValue: 0, changePct: 100 },
    totalLeads: { value: 6, prevValue: 7, changePct: -14.3 },
    admissions: { value: 1, prevValue: 0, changePct: 100 },
    conversionRate: { value: 16.7, prevValue: 0, changePct: 100 },
    outstandingFees: { value: 3531000, prevValue: 3531000, changePct: 0 },
    businessLoss: { value: 422559, prevValue: 500000, changePct: -15.5 },
    totalFollowupsDone: { value: 12, prevValue: 10, changePct: 20 },
  },
  revenueTrend: [],
  revenueComparison: { today: 10200, yesterday: 0, sameDayLastWeek: 120000 },
  conversionFunnel: {
    leadsReceived: 6,
    followupsCompleted: 12,
    demosScheduled: 2,
    admissionsConfirmed: 1,
    stagePercentages: { followupPct: 100, demoPct: 33.3, admissionPct: 16.7 },
    dropOffRates: { postLeadDropOff: 0, postFollowupDropOff: 66.7, postDemoDropOff: 50 },
  },
  businessLossAnalysis: {
    totalLeads: 6,
    totalAdmissions: 1,
    unconvertedLeads: 5,
    avgAdmissionValue: 25000,
    estimatedBusinessLoss: 125000,
    potentialRevenue: 135200,
    actualRevenue: 10200,
    lostOpportunityPct: 92.5,
  },
  brandPerformance: [
    {
      brandName: "CADD MANTRA",
      totalLeads: 5,
      admissions: 1,
      dailyCollections: 10200,
      followupsDone: 8,
      conversionRate: 20.0,
      estimatedBusinessLoss: 100000,
    },
    {
      brandName: "DESIGN GATEWAY",
      totalLeads: 1,
      admissions: 0,
      dailyCollections: 0,
      followupsDone: 4,
      conversionRate: 0.0,
      estimatedBusinessLoss: 25000,
    },
  ],
  counsellorPerformance: [
    {
      name: "Anjali Yadav",
      email: "anjali@example.com",
      brandScope: "CADD MANTRA",
      leadsAssigned: 4,
      followupsDone: 8,
      admissionsConverted: 1,
      conversionPct: 25.0,
      collectionsGenerated: 10200,
      followupPerformance: "Top Performer",
      isTopPerformer: true,
      isLowPerformer: false,
    },
    {
      name: "Sahej Sharma",
      email: "sahej@example.com",
      brandScope: "DESIGN GATEWAY",
      leadsAssigned: 2,
      followupsDone: 4,
      admissionsConverted: 0,
      conversionPct: 0.0,
      collectionsGenerated: 0,
      followupPerformance: "Active",
      isTopPerformer: false,
      isLowPerformer: false,
    },
  ],
  leadSourceAnalysis: [
    { source: "Facebook", leadsGenerated: 5, admissions: 1, conversionRate: 20, revenueContribution: 10200 },
    { source: "Google Ads", leadsGenerated: 1, admissions: 0, conversionRate: 0, revenueContribution: 0 },
  ],
  collectionSummaryByMode: [
    { mode: "UPI", amount: 10200, percentage: 100 },
    { mode: "Bank Transfer", amount: 0, percentage: 0 },
    { mode: "Cash", amount: 0, percentage: 0 },
    { mode: "Credit/Debit Card", amount: 0, percentage: 0 },
  ],
  pendingFeeSummary: {
    overdueAmount: 475000,
    overdueStudentsCount: 4,
    upcomingInstallmentsAmount: 120000,
    upcomingStudentsCount: 5,
    studentsRequiringFollowup: [
      { id: "1", fullName: "RICHA TIWARI", course: "MBA in Interior", mobileNumber: "8957267071", remainingBalance: 270000, nextDueDate: "06/08/2026" },
      { id: "2", fullName: "Ritika mishra", course: "Diploma in Fashion", mobileNumber: "8858115540", remainingBalance: 135000, nextDueDate: "13/08/2026" },
      { id: "3", fullName: "Tauqeer khan", course: "Master Diploma in CAD", mobileNumber: "9793055611", remainingBalance: 65000, nextDueDate: "13/08/2026" },
      { id: "4", fullName: "Amresh gupta", course: "Certificate in Design", mobileNumber: "6306510920", remainingBalance: 5000, nextDueDate: "11/08/2026" },
    ],
  },
  operationalAlerts: [],
  tomorrowTargets: {
    revenueTarget: 12240,
    collectionsTarget: 12750,
    admissionsTarget: 3,
    leadFollowupsTarget: 15,
    demoSessionsTarget: 5,
    pendingFeeRecoveryTarget: 50000,
  },
  aiInsights: {
    executiveSummary: "Today's operations generated Rs.10,200 in collections across 1 new admissions from 6 total leads.",
    keyAchievements: ["Generated Rs.10,200 in total collections today.", "Successfully enrolled 1 new student admission."],
    immediateAttentionAreas: [],
    brandAndCounsellorObservations: "",
    lostOpportunityAssessment: "",
    recommendedPriorityActions: ["Target Rs.12,750 in daily collections tomorrow.", "Schedule at least 5 demo sessions with active prospect leads."],
  },
};

const pdfBuffer = generateDailyReportPdfBuffer(mockStats);
console.log("Generated PDF Buffer size:", pdfBuffer.length);

const outPath = path.join(__dirname, "test-daily-report.pdf");
fs.writeFileSync(outPath, pdfBuffer);
console.log("Saved test PDF to:", outPath);
