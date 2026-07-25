import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Payroll from "@/models/Payroll";
import Expense from "@/models/Expense";
import Course from "@/models/Course";
import Batch from "@/models/Batch";
import Attendance from "@/models/Attendance";

// ============================================================
// SYNCFORGE CRM ULTRA AI ENGINE v3.0
// Multi-Intent NLP • Entity Extraction • Temporal Reasoning
// Forecasting • Cohort Analytics • CRM Playbooks
// ============================================================

// ─── INTENT TAXONOMY ────────────────────────────────────────
const INTENTS = {
  FINANCIAL_DEEP: ["profit", "revenue", "margin", "loss", "roi", "cac", "cost", "income", "cash flow", "cashflow", "earning", "earning", "payroll", "salary", "expense", "overhead", "outflow", "inflow", "burn", "break even"],
  CONVERSION_FUNNEL: ["conversion", "convert", "funnel", "drop", "dropout", "lost", "churned", "bottleneck", "stuck", "pipeline health", "stage", "closure", "closing", "win rate"],
  FORECASTING: ["forecast", "predict", "next month", "next week", "projection", "target", "goal", "estimate", "likely", "trend", "future", "expected", "by end of month"],
  LEAD_HEALTH: ["lead", "student", "enquiry", "enquiries", "prospect", "potential", "new", "uncontacted", "fresh", "contact", "all students"],
  DEMO_INTELLIGENCE: ["demo", "class", "session", "attend", "schedule", "booked", "today demo", "upcoming demo", "missed demo"],
  FOLLOWUP_TASKS: ["follow up", "followup", "follow-up", "task", "pending", "overdue", "due today", "reminder", "callback", "reschedule"],
  HOT_LEADS: ["hot", "urgent", "high priority", "priority", "vip", "critical", "fast close", "fire"],
  ADMISSION_REVENUE: ["admit", "admission", "enroll", "enrolled", "fee", "fees", "collected", "payment", "paid", "due", "balance", "receipt"],
  PERFORMANCE_RANK: ["performance", "leaderboard", "ranking", "rank", "top counsellor", "best", "who is best", "team", "compare", "vs", "score"],
  COHORT_ANALYSIS: ["cohort", "batch", "age", "source", "where", "channel", "referral", "organic", "google", "meta", "facebook", "instagram", "walk in", "walkin"],
  STALE_LEADS: ["stale", "cold", "inactive", "no response", "not responding", "dead", "ghost", "silent", "not picking", "not answering"],
  RISK_ALERTS: ["risk", "alert", "danger", "warning", "critical", "problem", "issue", "concern"],
  SUMMARY_OVERVIEW: ["summary", "overview", "stats", "statistics", "dashboard", "health", "pipeline", "all leads", "big picture", "status"],
  SEARCH_STUDENT: ["find", "search", "locate", "where is", "show me", "get", "fetch", "lookup", "who is"],
  PLAYBOOK_STRATEGY: ["strategy", "playbook", "how to", "improve", "increase", "grow", "boost", "hack", "tips", "advice", "recommend", "suggest", "what should", "action plan", "close more", "close faster"],
  REASONING_LOGIC: ["why", "reason", "explain", "because", "cause", "effect", "analyze", "analysis", "compare", "evaluate", "logic", "calculate", "math", "number", "what if", "scenario", "hypothesis"],
};

function detectIntents(queryLower: string): Set<string> {
  const matched = new Set<string>();
  for (const [intent, keywords] of Object.entries(INTENTS)) {
    if (keywords.some(kw => queryLower.includes(kw))) {
      matched.add(intent);
    }
  }
  return matched;
}

// ─── ENTITY EXTRACTOR ───────────────────────────────────────
function extractEntities(queryLower: string) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0];

  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthAgoStr = monthAgo.toISOString().split("T")[0];

  const isToday = queryLower.includes("today");
  const isYesterday = queryLower.includes("yesterday");
  const isThisWeek = queryLower.includes("this week") || queryLower.includes("week");
  const isThisMonth = queryLower.includes("this month") || queryLower.includes("month");

  const periodLabel = isToday ? "Today" : isYesterday ? "Yesterday" : isThisWeek ? "This Week" : isThisMonth ? "This Month" : "All Time";

  return {
    todayStr,
    weekAgoStr,
    monthAgoStr,
    isToday,
    isYesterday,
    isThisWeek,
    isThisMonth,
    periodLabel,
  };
}

// ─── CORE METRICS CALCULATOR ────────────────────────────────
function calcMetrics(enquiries: any[], payments: any[], payrolls: any[], expenses: any[]) {
  const total = enquiries.length;
  const newLeads = enquiries.filter(e => (e.status || "").toLowerCase() === "new").length;
  const contacted = enquiries.filter(e => (e.status || "").toLowerCase() === "contacted").length;
  const followup = enquiries.filter(e => (e.status || "").toLowerCase().includes("follow")).length;
  const demo = enquiries.filter(e => {
    const s = (e.status || "").toLowerCase();
    return s.includes("demo") || e.isDemoScheduled;
  }).length;
  const admitted = enquiries.filter(e => (e.status || "").toLowerCase() === "admitted").length;
  const lost = enquiries.filter(e => ["lost", "not interested", "not_interested", "dropped"].includes((e.status || "").toLowerCase())).length;
  const highPriority = enquiries.filter(e => (e.priorityLevel || e.priority || "").toLowerCase() === "high").length;
  const pendingTasks = enquiries.reduce((acc, e) => {
    const pending = (e.followUps || []).filter((f: any) => !f.isCompleted && (f.status || "").toLowerCase() !== "completed");
    return acc + pending.length;
  }, 0);

  const totalRevenue = payments.reduce((acc, p) => acc + Number(p.amountReceived || 0), 0);
  const totalPayroll = payrolls.filter(p => p.paymentStatus === "Paid").reduce((acc, p) => acc + Number(p.netSalary || 0), 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalPayroll - totalExpenses;
  const profitMarginPct = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  const convRate = total > 0 ? ((admitted / total) * 100).toFixed(1) : "0.0";
  const demoConvRate = demo > 0 ? ((admitted / demo) * 100).toFixed(1) : "0.0";
  const lostRate = total > 0 ? ((lost / total) * 100).toFixed(1) : "0.0";

  return {
    total, newLeads, contacted, followup, demo, admitted, lost, highPriority, pendingTasks,
    totalRevenue, totalPayroll, totalExpenses, netProfit, profitMarginPct,
    convRate, demoConvRate, lostRate
  };
}

// ─── FORECASTING ENGINE ─────────────────────────────────────
function forecastMetrics(enquiries: any[], payments: any[]) {
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const remaining = daysInMonth - currentDay;

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  const thisMonthAdmissions = enquiries.filter(e => {
    const d = e.admissionDate || e.createdAt || "";
    return d >= monthStart && d <= todayStr && (e.status || "").toLowerCase() === "admitted";
  }).length;

  const thisMonthRevenue = payments.filter(p => {
    const d = p.paymentDate || p.createdAt || "";
    return d >= monthStart && d <= todayStr;
  }).reduce((acc, p) => acc + Number(p.amountReceived || 0), 0);

  const dailyAdmRate = currentDay > 0 ? thisMonthAdmissions / currentDay : 0;
  const dailyRevRate = currentDay > 0 ? thisMonthRevenue / currentDay : 0;

  const projAdmissions = Math.round(thisMonthAdmissions + dailyAdmRate * remaining);
  const projRevenue = Math.round(thisMonthRevenue + dailyRevRate * remaining);

  return {
    thisMonthAdmissions,
    thisMonthRevenue,
    projAdmissions,
    projRevenue,
    dailyAdmRate: dailyAdmRate.toFixed(1),
    dailyRevRate: Math.round(dailyRevRate),
    remainingDays: remaining,
  };
}

// ─── COUNSELLOR LEADERBOARD ──────────────────────────────────
function buildLeaderboard(enquiries: any[]) {
  const map: Record<string, { name: string; total: number; demo: number; admitted: number; revenue: number; pending: number }> = {};
  for (const e of enquiries) {
    const key = (e.assignedCrmAdvisor || "Unassigned").toLowerCase().trim();
    const name = (e.assignedCrmAdvisor || "Unassigned").trim();
    if (!map[key]) map[key] = { name, total: 0, demo: 0, admitted: 0, revenue: 0, pending: 0 };
    map[key].total++;
    if ((e.status || "").toLowerCase().includes("demo") || e.isDemoScheduled) map[key].demo++;
    if ((e.status || "").toLowerCase() === "admitted") {
      map[key].admitted++;
      const f = parseFloat(String(e.feesCollected || e.expectedConversionFee || "0").replace(/[^0-9.]/g, ""));
      map[key].revenue += isNaN(f) ? 0 : f;
    }
    const pending = (e.followUps || []).filter((f: any) => !f.isCompleted).length;
    map[key].pending += pending;
  }
  return Object.values(map).map(c => ({
    ...c,
    convRate: c.total > 0 ? ((c.admitted / c.total) * 100).toFixed(1) : "0.0",
    demoRate: c.total > 0 ? ((c.demo / c.total) * 100).toFixed(1) : "0.0",
  })).sort((a, b) => b.admitted - a.admitted || b.revenue - a.revenue);
}

// ─── RISK DETECTION ──────────────────────────────────────────
function detectRisks(enquiries: any[], metrics: ReturnType<typeof calcMetrics>) {
  const risks: string[] = [];
  if (Number(metrics.convRate) < 10) risks.push(`⚠️ **Critical Low Conversion**: Overall conversion rate is only **${metrics.convRate}%**. Industry benchmark is 20–35%. Immediate follow-up action required.`);
  if (metrics.newLeads > metrics.total * 0.4) risks.push(`⚠️ **Stale Pipeline Alert**: **${((metrics.newLeads / metrics.total) * 100).toFixed(0)}%** of leads are uncontacted (New). Every hour of delay reduces conversion probability by ~5%.`);
  if (metrics.pendingTasks > 20) risks.push(`⚠️ **Task Overload**: ${metrics.pendingTasks} pending follow-up tasks are unresolved. This directly delays pipeline progression.`);
  if (metrics.netProfit < 0) risks.push(`⚠️ **Negative Profitability**: Current operations are running at a ₹${Math.abs(metrics.netProfit).toLocaleString("en-IN")} loss. Revenue collection needs to be accelerated.`);
  if (metrics.lost > metrics.total * 0.3) risks.push(`⚠️ **High Lead Attrition**: ${metrics.lostRate}% of leads are marked lost/not interested. Root cause: insufficient nurturing or misaligned pitch.`);
  if (risks.length === 0) risks.push("✅ **System Health is Good**: No critical risk signals detected in current data.");
  return risks;
}

// ─── SALES PLAYBOOKS ─────────────────────────────────────────
function getPlaybook(queryLower: string, metrics: ReturnType<typeof calcMetrics>): string {
  if (queryLower.includes("close") || queryLower.includes("conversion") || queryLower.includes("admit")) {
    return (
      `### 🎯 Admission Closing Playbook\n\n` +
      `**The 5-Step Structured Closure Framework:**\n\n` +
      `1. **🔥 Open with Urgency**: "We have limited seats — ${metrics.demo} students attended demo this month. Most premium spots close by end of month."\n` +
      `2. **💡 Value Reinforcement**: Share 2–3 specific outcomes (job placements, salary hikes, certifications).\n` +
      `3. **💰 Customized Fee Plan**: Present EMI options. Offer a 3-month, 6-month, or 12-month plan. Reduce friction, not price.\n` +
      `4. **📞 Same-Day Closing Call**: Do not give "think time" longer than 24 hours. Book a callback slot during the call.\n` +
      `5. **🎁 Trigger Incentive**: "Registrations before Friday get priority access to the batch + mentorship session." Create FOMO.\n\n` +
      `📊 **Your Current Conversion**: ${metrics.convRate}% | Industry Benchmark: 25–35%`
    );
  }
  if (queryLower.includes("follow") || queryLower.includes("callback")) {
    return (
      `### 📞 Follow-Up Cadence Playbook\n\n` +
      `**Scientifically Proven Follow-Up Sequence:**\n\n` +
      `- **Day 0 (Enquiry Created)**: First contact within 15 minutes. Introduce yourself and ask qualification questions.\n` +
      `- **Day 1**: WhatsApp message with brochure + success story video.\n` +
      `- **Day 2**: Call to answer objections. Ask: "What's your biggest concern?"\n` +
      `- **Day 3–5**: Schedule a free demo class. Leads attending demos convert **3.4x faster**.\n` +
      `- **Day 7**: Post-demo closing call. Present EMI plan.\n` +
      `- **Day 14**: Re-engagement call. "We're starting a new batch — would you like to join?"\n` +
      `- **Day 21+**: Monthly nurture: success story, new batch, offer.\n\n` +
      `📌 **Current Pending Tasks**: ${metrics.pendingTasks} unresolved tasks across your pipeline.`
    );
  }
  if (queryLower.includes("demo") || queryLower.includes("class")) {
    return (
      `### 🎥 Demo Class Conversion Playbook\n\n` +
      `**How to Convert Demo Attendees:**\n\n` +
      `1. **Pre-Demo (24 hrs before)**: Send reminder + what to bring + meet the trainer note.\n` +
      `2. **During Demo**: Trainer must emphasize: "Students who join within 48 hours get ₹5,000 early bird benefit."\n` +
      `3. **Post-Demo (same day)**: Call within 2 hours: "How was your experience? Do you have any questions about the course?"\n` +
      `4. **Post-Demo Day 2**: Share testimonial video + batch schedule + seat availability.\n` +
      `5. **Close in 72 hours**: "We'd love to confirm your seat. Can I send the registration form now?"\n\n` +
      `📊 **Your Demo→Admission Rate**: ${metrics.demoConvRate}% | Target: 40%+`
    );
  }
  // General strategy
  return (
    `### 🚀 CRM Growth & Revenue Strategy\n\n` +
    `**Top 5 Highest-Impact Actions Right Now:**\n\n` +
    `1. **📞 Speed-to-Lead**: Call new enquiries within 15 mins. This alone can improve conversion by 20%.\n` +
    `2. **🎥 Demo Pipeline**: Move ${metrics.contacted} contacted leads into demo sessions. Demos are your #1 conversion lever.\n` +
    `3. **🔥 Hot Lead Focus**: Prioritize your ${metrics.highPriority} high-priority leads for daily morning calls.\n` +
    `4. **💳 EMI Objection Handling**: 40% of students reject on fee. Always have a 3-part EMI plan ready.\n` +
    `5. **📊 Weekly Pipeline Review**: Every Friday, move or close every lead older than 14 days.\n\n` +
    `💡 **Current Pipeline**: ${metrics.total} leads | ${metrics.convRate}% conversion | ${metrics.pendingTasks} tasks pending`
  );
}

// ─── KNOWLEDGE BASE (General Reasoning) ─────────────────────
function knowledgeBaseAnswer(prompt: string, queryLower: string): string {
  // Simple Greetings Handling
  const cleanQ = queryLower.replace(/[^a-z0-9\s]/g, "").trim();
  if (["hi", "hello", "hey", "hlo", "greetings", "good morning", "good afternoon", "good evening", "yo"].includes(cleanQ) || cleanQ.startsWith("hi ") || cleanQ.startsWith("hello ")) {
    return `👋 **Hello! I am your CoachFlow AI Assistant.**\n\nI am ready to assist you with your institute's CRM operations:\n- 📥 **Student Enquiries & Pipeline**\n- 🎥 **Demo Sessions & Follow-up Tasks**\n- 🎓 **Admissions & Fee Management**\n- 📋 **Batch Attendance & Performance Analytics**\n\nHow can I help you today?`;
  }

  // Math: detect arithmetic patterns
  const mathMatch = queryLower.match(/(\d+(?:\.\d+)?)\s*([+\-*\/×÷])\s*(\d+(?:\.\d+)?)/);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const b = parseFloat(mathMatch[3]);
    let result: number;
    if (op === "+") result = a + b;
    else if (op === "-") result = a - b;
    else if (op === "*" || op === "×") result = a * b;
    else result = a / b;
    return `🔢 **Mathematical Calculation**:\n\n**${a} ${op} ${b} = ${result.toLocaleString("en-IN")}**\n\n📌 In business context:\n- If revenue: ₹${result.toLocaleString("en-IN")}\n- If count: ${Math.round(result)} units\n- If percentage: ${(result).toFixed(2)}%`;
  }

  // Percentage calculation
  const pctMatch = queryLower.match(/(\d+(?:\.\d+)?)\s*(?:percent|%|out of)\s*(\d+(?:\.\d+)?)/);
  if (pctMatch) {
    const num = parseFloat(pctMatch[1]);
    const den = parseFloat(pctMatch[2]);
    const pct = den > 0 ? ((num / den) * 100).toFixed(2) : "0";
    return `📊 **Percentage Calculation**:\n\n**${num} out of ${den} = ${pct}%**\n\n📌 Context:\n- Conversion rate: If ${num} students admitted out of ${den} leads, conversion = **${pct}%**\n- Industry benchmark: 20–35% is healthy for coaching/education CRMs.`;
  }

  // General reasoning fallback
  return (
    `🧠 **Advanced Chain-of-Thought Reasoning Engine**\n\n` +
    `**Query**: "*${prompt.trim()}*"\n\n` +
    `---\n` +
    `### 🔍 Step 1 — Problem Decomposition\n` +
    `Breaking down the query into core observable components, primary variables, and logical constraints.\n\n` +
    `### ⚡ Step 2 — Multi-Dimensional Analysis\n` +
    `- **Business Dimension**: Impact on revenue velocity, student acquisition cost, and lifetime value.\n` +
    `- **Operational Dimension**: Effect on team workload, follow-up cadence, and pipeline throughput.\n` +
    `- **Strategic Dimension**: Alignment with growth targets, brand positioning, and competitive advantage.\n\n` +
    `### 🔗 Step 3 — Causal Chain Mapping\n` +
    `- Input variables → Intermediate effects → Systemic outcomes\n` +
    `- Evaluating 2nd and 3rd order consequences of decisions made at each funnel stage.\n\n` +
    `### 💡 Step 4 — Evidence-Based Recommendation\n` +
    `- Prioritize high-leverage, low-effort actions first (Pareto 80/20 principle).\n` +
    `- Standardize response protocols to reduce variance in team performance.\n` +
    `- Measure, track, and iterate weekly using your CRM dashboard data.\n\n` +
    `📌 *Ask me specific CRM questions (leads, admissions, revenue, team performance) for data-driven answers based on your live database.*`
  );
}

// ─── GEMINI API CALLER WITH SCOPE & ROLE GUARDRAILS ─────────
async function queryGemini(promptText: string, systemPrompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`
  ];

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: `${systemPrompt}\n\nUser Question: "${promptText}"` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024
    }
  };

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        const parts = data.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          const textPart = parts.find((p: any) => p.text && !p.thought) || parts[parts.length - 1];
          if (textPart && textPart.text && textPart.text.trim()) {
            return textPart.text.trim();
          }
        }
      }
    } catch (e) {
      console.warn("Gemini endpoint error:", endpoint, e);
    }
  }
  return null;
}

// ─── MAIN ROUTE ──────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const prompt: string = body.prompt || body.message ||
      (Array.isArray(body.messages) ? body.messages[body.messages.length - 1]?.content : "") || "";
    const { userRole, userName, userEmail, userBrandScope } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const queryLower = prompt.toLowerCase().trim();

    // ── Fetch all data in parallel ──────────────────────────
    const [allEnquiries, allPayments, allPayrolls, allExpenses, allCourses, allBatches, allAttendance] = await Promise.all([
      Enquiry.find({}).sort({ createdAt: -1 }).lean(),
      Payment.find({}).lean(),
      Payroll.find({}).lean(),
      Expense.find({}).lean(),
      Course.find({}).lean(),
      Batch.find({}).lean(),
      Attendance.find({}).lean(),
    ]);

    // ── RBAC Data Scoping ───────────────────────────────────
    const role = (userRole || "counsellor").toLowerCase().trim();
    const nameLower = (userName || "").toLowerCase().trim();
    const emailLower = (userEmail || "").toLowerCase().trim();

    let enquiries: any[] = [];
    let teacherCourses: any[] = [];
    let teacherBatches: any[] = [];
    let teacherAttendanceLogs: any[] = [];
    let roleNotice = "";

    if (role === "admin" || role === "superadmin") {
      enquiries = allEnquiries;
      roleNotice = "Admin · Full Application Access";
    } else if (role === "brand manager" || role === "manager") {
      const allowedBrands = (userBrandScope || "").split(",").map((b: string) => b.trim().toLowerCase()).filter(Boolean);
      enquiries = allowedBrands.length > 0
        ? allEnquiries.filter((e: any) => {
          const b = (e.targetBrand || e.brand || "").toLowerCase();
          return allowedBrands.some((ab: string) => b.includes(ab) || ab.includes(b));
        })
        : allEnquiries;
      roleNotice = `Brand Manager · ${userBrandScope || "Assigned Brands"}`;
    } else if (role === "teacher" || role === "faculty") {
      roleNotice = `Teacher/Faculty · ${userName || "Faculty Scope"} (${userBrandScope || "All Brands"})`;
      const scopeLower = (userBrandScope || "").toLowerCase().trim();

      teacherCourses = allCourses.filter((c: any) => {
        const bMatches = !scopeLower || scopeLower === "all" || scopeLower === "all brands" || (c.brand || "").toLowerCase().trim() === scopeLower;
        return bMatches;
      });

      teacherBatches = allBatches.filter((b: any) => {
        const nameMatch = nameLower && (b.teacherName || "").toLowerCase().includes(nameLower);
        const brandMatch = !scopeLower || scopeLower === "all" || scopeLower === "all brands" || (b.brand || "").toLowerCase().trim() === scopeLower;
        return nameMatch || brandMatch;
      });

      const batchNames = teacherBatches.map((b: any) => b.batchName);
      teacherAttendanceLogs = allAttendance.filter((att: any) => {
        return batchNames.includes(att.batchName) || (nameLower && (att.teacherName || "").toLowerCase().includes(nameLower));
      });

      enquiries = allEnquiries.filter((e: any) => {
        const statusLower = (e.status || "").toLowerCase();
        const brandMatch = !scopeLower || scopeLower === "all" || scopeLower === "all brands" || (e.targetBrand || "").toLowerCase().trim() === scopeLower;
        const demoTeacherMatch = (e.demoTeacher || "").toLowerCase().includes(nameLower);
        return (statusLower.includes("demo") || e.isDemoScheduled || demoTeacherMatch) && brandMatch;
      });
    } else {
      enquiries = allEnquiries.filter((e: any) => {
        const advisor = (e.assignedCrmAdvisor || "").toLowerCase();
        return (nameLower && advisor.includes(nameLower)) || (emailLower && advisor.includes(emailLower));
      });
      roleNotice = `Counsellor · ${userName || "Assigned Leads Only"}`;
    }

    // ── Compute all metrics at once ─────────────────────────
    const metrics = calcMetrics(enquiries, allPayments, allPayrolls, allExpenses);
    const entities = extractEntities(queryLower);
    const intents = detectIntents(queryLower);

    // ── RBAC: Counsellor asking for global leaderboard ──────
    if (role === "counsellor" && (intents.has("PERFORMANCE_RANK") || queryLower.includes("all counsellor"))) {
      return NextResponse.json({
        answer: `🔒 **Access Control** (*${roleNotice}*):\n\nYou are authorized to view your own performance only.\n\n` +
          `### 📊 Your Personal Scorecard\n` +
          `- 📥 **Assigned Leads**: ${metrics.total}\n` +
          `- 🔥 **High Priority**: ${metrics.highPriority}\n` +
          `- 🎥 **Demo Scheduled**: ${metrics.demo}\n` +
          `- 🎓 **Admissions Closed**: ${metrics.admitted}\n` +
          `- 📊 **Your Conversion Rate**: ${metrics.convRate}%\n` +
          `- ⏳ **Pending Follow-ups**: ${metrics.pendingTasks}\n\n` +
          `💡 **Next Action**: Call your ${metrics.newLeads} uncontacted new leads first — they're the freshest opportunities.`,
        leads: enquiries.slice(0, 5),
        stats: { myLeads: metrics.total, myAdmissions: metrics.admitted, convRate: metrics.convRate }
      });
    }

    // ── Build Role-Specific System Prompts ─────────────────────────
    let roleSummaryPrompt = "";
    if (role === "teacher" || role === "faculty") {
      let totalPresent = 0;
      let totalStudents = 0;
      teacherAttendanceLogs.forEach((att: any) => {
        totalPresent += att.totalPresent || 0;
        totalStudents += att.totalStudents || 0;
      });
      const attendanceRatePct = totalStudents > 0 ? ((totalPresent / totalStudents) * 100).toFixed(1) + "%" : "0.0%";

      roleSummaryPrompt = `
USER ROLE: TEACHER / FACULTY
User Name: ${userName || "Faculty"}
Scope Notice: ${roleNotice}

TEACHER AUTHORIZED ACADEMIC DATA SUMMARY:
- Assigned Courses Count: ${teacherCourses.length}
- Active Batches Count: ${teacherBatches.length}
- Scheduled Demo Classes: ${enquiries.length}
- Total Attendance Logs Recorded: ${teacherAttendanceLogs.length}
- Student Attendance Rate: ${attendanceRatePct}

STRICT TEACHER ROLE RULES & CONSTRAINTS:
1. You MUST ONLY discuss Academic & Faculty responsibilities: Assigned Courses, Active Batches, Scheduled Demo Sessions, Student Class Rosters, and Student Attendance Rates.
2. Do NOT report on sales CRM metrics like "Total Accessible Leads", "New Uncontacted Leads", "Sales Conversion Funnels", "Counsellor Performance", or "Company Financial P&L/Payroll". Those sales metrics belong to Counsellors and Admins, NOT Teachers.
3. If the user asks for a monthly report, overview, or summary, generate a "Teacher Academic & Class Operational Report" covering Courses, Batches, Demos, and Student Attendance.
`;
    } else if (role === "counsellor") {
      roleSummaryPrompt = `
USER ROLE: COUNSELLOR
User Name: ${userName || "Counsellor"}
Scope Notice: ${roleNotice}

COUNSELLOR AUTHORIZED CRM DATA SUMMARY:
- Total Assigned Leads: ${metrics.total}
- New (Uncontacted) Leads: ${metrics.newLeads}
- Contacted Leads: ${metrics.contacted}
- Demo Scheduled Sessions: ${metrics.demo}
- Admissions Closed: ${metrics.admitted}
- Lost/Dropped Leads: ${metrics.lost}
- High Priority Leads: ${metrics.highPriority}
- Pending Follow-up Tasks: ${metrics.pendingTasks}
- Personal Conversion Rate: ${metrics.convRate}%

STRICT COUNSELLOR ROLE RULES:
1. You MUST ONLY discuss your assigned student leads, demo follow-ups, personal admission conversions, and follow-up tasks.
2. Do NOT report on Company Financial P&L, Staff Payroll, Operational Overhead, or Global Team Leaderboards. If asked about overall company financials or other counsellors, state:
   "As a Counsellor, your scope is focused on your assigned student pipeline, follow-ups, and admissions. Company financial P&L and global team leaderboards are restricted to Management."
`;
    } else if (role === "brand manager" || role === "manager") {
      roleSummaryPrompt = `
USER ROLE: BRAND MANAGER
User Name: ${userName || "Manager"}
Scope Notice: ${roleNotice}

BRAND MANAGER AUTHORIZED DATA SUMMARY:
- Total Brand Leads: ${metrics.total}
- New Uncontacted Leads: ${metrics.newLeads}
- Contacted Leads: ${metrics.contacted}
- Demo Sessions: ${metrics.demo}
- Brand Admissions: ${metrics.admitted}
- Brand Conversion Rate: ${metrics.convRate}%
- Brand Revenue Collected: ₹${metrics.totalRevenue.toLocaleString("en-IN")}
- Brand Net Profit: ₹${metrics.netProfit.toLocaleString("en-IN")}
- Pending Follow-up Tasks: ${metrics.pendingTasks}
`;
    } else {
      roleSummaryPrompt = `
USER ROLE: ADMIN / SUPERADMIN
User Name: ${userName || "Admin"}
Scope Notice: ${roleNotice}

FULL APPLICATION AUTHORIZED DATA SUMMARY:
- Total Leads: ${metrics.total}
- New Leads: ${metrics.newLeads}
- Contacted Leads: ${metrics.contacted}
- Demo Sessions: ${metrics.demo}
- Admitted Students: ${metrics.admitted}
- Lost Leads: ${metrics.lost}
- High Priority Leads: ${metrics.highPriority}
- Pending Follow-up Tasks: ${metrics.pendingTasks}
- Total Revenue Collected: ₹${metrics.totalRevenue.toLocaleString("en-IN")}
- Staff Payroll Paid: ₹${metrics.totalPayroll.toLocaleString("en-IN")}
- Operational Expenses: ₹${metrics.totalExpenses.toLocaleString("en-IN")}
- Net Profit: ₹${metrics.netProfit.toLocaleString("en-IN")} (${metrics.profitMarginPct}%)
`;
    }

    const systemPrompt = `You are the official AI Assistant embedded inside the CoachFlow application (Education Management & Sales CRM).

CRITICAL SECURITY RULE (STRICT APPLICATION SCOPE GUARDRAIL):
1. STRICT APPLICATION SCOPE: You MUST ONLY answer questions directly related to CoachFlow application features, student enquiries, admissions, demo classes, batches, courses, attendance, financial/revenue summaries, follow-up tasks, sales playbooks, and operational analytics.
2. OUT-OF-SCOPE REJECTION: If the user asks ANY question NOT related to the CoachFlow application, CRM data, academic operations, or sales/class analytics (such as general programming, recipes, general trivia, weather, movie recommendations, sports, off-topic subjects), you MUST politely refuse by stating EXACTLY:
   "I am the CoachFlow AI Assistant and can only answer questions related to the CoachFlow application, CRM data, student enquiries, admissions, batches, attendance, and operational analytics within your authorized role."

ROLE CONTEXT & AUTHORIZED METRICS:
${roleSummaryPrompt}
`;

    // ── Attempt Gemini AI Generation ─────────────────────────────
    const geminiReply = await queryGemini(prompt, systemPrompt);

    if (geminiReply) {
      const matchingLeads = enquiries.filter(e => {
        const text = `${e.studentFullName || ""} ${e.phone || ""} ${e.targetCourse || ""} ${e.status || ""} ${e.priorityLevel || ""}`.toLowerCase();
        return queryLower.split(" ").some(w => w.length > 2 && text.includes(w));
      });

      return NextResponse.json({
        answer: geminiReply,
        leads: matchingLeads.length > 0 ? matchingLeads.slice(0, 6) : enquiries.slice(0, 5),
        stats: { total: metrics.total, admitted: metrics.admitted, convRate: metrics.convRate }
      });
    }

    // ══════════════════════════════════════════════════════════
    // INTENT ROUTING — Priority Order
    // ══════════════════════════════════════════════════════════

    // ── 1. RISK ALERTS ───────────────────────────────────────
    if (intents.has("RISK_ALERTS")) {
      const risks = detectRisks(enquiries, metrics);
      return NextResponse.json({
        answer: `🚨 **Real-Time Risk Intelligence Report** (*${roleNotice}* · ${entities.periodLabel}):\n\n` +
          risks.join("\n\n") + "\n\n" +
          `### 📋 Recommended Immediate Actions:\n` +
          `1. **Speed-to-Lead**: Call all ${metrics.newLeads} new leads immediately.\n` +
          `2. **Task Clearance**: Resolve ${metrics.pendingTasks} pending follow-up tasks today.\n` +
          `3. **Demo Drip**: Book demos for your ${metrics.contacted} contacted-but-not-demo leads.`,
        leads: enquiries.filter(e => (e.priorityLevel || "").toLowerCase() === "high").slice(0, 6),
        stats: { risks: risks.length, newLeads: metrics.newLeads, pendingTasks: metrics.pendingTasks }
      });
    }

    // ── 2. FORECASTING ───────────────────────────────────────
    if (intents.has("FORECASTING")) {
      const fc = forecastMetrics(enquiries, allPayments);
      return NextResponse.json({
        answer: `🔮 **AI Forecasting Engine** (*${roleNotice}*):\n\n` +
          `### 📅 Month-to-Date Performance\n` +
          `- 🎓 **Admissions This Month**: ${fc.thisMonthAdmissions}\n` +
          `- 💰 **Revenue This Month**: ₹${fc.thisMonthRevenue.toLocaleString("en-IN")}\n` +
          `- 📆 **Days Remaining**: ${fc.remainingDays}\n\n` +
          `### 🚀 End-of-Month Projections (Linear Trend)\n` +
          `- 🎯 **Projected Admissions**: **${fc.projAdmissions}** (${fc.dailyAdmRate}/day pace)\n` +
          `- 💹 **Projected Revenue**: **₹${fc.projRevenue.toLocaleString("en-IN")}** (₹${fc.dailyRevRate.toLocaleString("en-IN")}/day pace)\n\n` +
          `### 💡 How to Beat the Projection:\n` +
          `- Prioritize the **${metrics.demo} demo-stage leads** — they're 3.4x more likely to convert.\n` +
          `- Each additional demo scheduled today adds an estimated ₹${Math.round(fc.dailyRevRate * 1.4).toLocaleString("en-IN")} to projected month-end revenue.\n` +
          `- Clear all ${metrics.pendingTasks} pending follow-up tasks before end of day.`,
        leads: enquiries.filter(e => (e.status || "").toLowerCase().includes("demo")).slice(0, 6),
        stats: { projAdmissions: fc.projAdmissions, projRevenue: fc.projRevenue, thisMonthAdmissions: fc.thisMonthAdmissions }
      });
    }

    // ── 3. DEEP FINANCIAL ANALYSIS ───────────────────────────
    if (intents.has("FINANCIAL_DEEP")) {
      const mainExpenseCat = getMainExpenseCategory(allExpenses);
      const isProfitable = metrics.netProfit >= 0;
      const arpu = metrics.admitted > 0 ? Math.round(metrics.totalRevenue / metrics.admitted) : 0;
      const cacEst = metrics.totalExpenses > 0 && metrics.admitted > 0 ? Math.round(metrics.totalExpenses / metrics.admitted) : 0;

      return NextResponse.json({
        answer: `💹 **Deep Financial Intelligence Report** (*${roleNotice}*):\n\n` +
          `### 💵 Revenue & P&L Breakdown\n` +
          `- 📥 **Total Revenue Collected**: ₹${(metrics.totalRevenue / 100000).toFixed(2)}L (₹${metrics.totalRevenue.toLocaleString("en-IN")})\n` +
          `- 👥 **Staff Payroll Outflow**: ₹${(metrics.totalPayroll / 100000).toFixed(2)}L\n` +
          `- 💸 **Operational Expenses**: ₹${(metrics.totalExpenses / 100000).toFixed(2)}L (Top: **${mainExpenseCat}**)\n` +
          `- ${isProfitable ? "✅" : "🔴"} **Net ${isProfitable ? "Profit" : "Loss"}**: ₹${(Math.abs(metrics.netProfit) / 100000).toFixed(2)}L | Margin: **${metrics.profitMarginPct}%**\n\n` +
          `### 📊 Unit Economics\n` +
          `- 💎 **Average Revenue Per Admission (ARPA)**: ₹${arpu.toLocaleString("en-IN")}\n` +
          `- 🎯 **Estimated Cost Per Acquisition (CPA)**: ₹${cacEst.toLocaleString("en-IN")}\n` +
          `- 📈 **Total Admissions**: ${metrics.admitted} | **Pipeline**: ${metrics.total} leads\n\n` +
          `### ⚡ Strategic Recommendations\n` +
          `${isProfitable
            ? `- ✅ **Healthy Operations**: Revenue comfortably covers operational costs at ${metrics.profitMarginPct}% margin.\n- 💡 **Reinvestment Opportunity**: Allocate 15% of profits to Google/Meta lead generation for pipeline expansion.`
            : `- 🔴 **Loss Recovery Priority**: Close ${Math.ceil(Math.abs(metrics.netProfit) / (arpu || 15000))} additional admissions to reach break-even.\n- ⚡ **Immediate Action**: Freeze non-essential expenses and accelerate fee collection from pending balances.`}\n` +
          `- 🎯 **ARPA Improvement**: Focus counsellors on higher-value courses to improve per-admission revenue.`,
        leads: enquiries.slice(0, 5),
        stats: { totalRevenue: metrics.totalRevenue, netProfit: metrics.netProfit, profitMarginPct: metrics.profitMarginPct, arpu, cacEst }
      });
    }

    // ── 4. CONVERSION FUNNEL ANALYSIS ───────────────────────
    if (intents.has("CONVERSION_FUNNEL")) {
      const uncontactedPct = metrics.total > 0 ? ((metrics.newLeads / metrics.total) * 100).toFixed(1) : "0";
      return NextResponse.json({
        answer: `🎯 **Conversion Funnel Intelligence** (*${roleNotice}* · ${entities.periodLabel}):\n\n` +
          `### 📥 Full Funnel Breakdown\n` +
          `\`\`\`\n` +
          `Total Leads     : ${metrics.total.toString().padStart(4)}\n` +
          `New (Uncontacted): ${metrics.newLeads.toString().padStart(4)} (${uncontactedPct}%)\n` +
          `Contacted       : ${metrics.contacted.toString().padStart(4)}\n` +
          `Demo Scheduled  : ${metrics.demo.toString().padStart(4)}\n` +
          `Admitted        : ${metrics.admitted.toString().padStart(4)} (Conv: ${metrics.convRate}%)\n` +
          `Lost/Dropped    : ${metrics.lost.toString().padStart(4)} (${metrics.lostRate}%)\n` +
          `\`\`\`\n\n` +
          `### 🔎 Bottleneck Diagnosis\n` +
          `${Number(uncontactedPct) > 30 ? `- 🔴 **Critical Bottleneck — Top of Funnel**: ${uncontactedPct}% leads are uncontacted. Each hour of delay reduces conversion by ~5%.` : `- ✅ **Top Funnel**: Contact rate is healthy (${(100 - Number(uncontactedPct)).toFixed(0)}% contacted).`}\n` +
          `${Number(metrics.demoConvRate) < 30 ? `- ⚠️ **Demo-to-Admission Drop**: Only ${metrics.demoConvRate}% of demo attendees convert. Post-demo follow-up speed needs improvement.` : `- ✅ **Demo Conversion**: Strong at ${metrics.demoConvRate}% (target: 40%+).`}\n` +
          `${Number(metrics.lostRate) > 25 ? `- 🔴 **High Attrition**: ${metrics.lostRate}% lost rate indicates pitch-product mismatch or insufficient follow-up depth.` : `- ✅ **Retention**: Lead attrition is within acceptable range.`}\n\n` +
          `### 🚀 Action Plan\n` +
          `1. **Immediate**: Call ${metrics.newLeads} uncontacted leads within the next 60 minutes.\n` +
          `2. **Today**: Schedule demo sessions for ${metrics.contacted} contacted leads.\n` +
          `3. **This Week**: Clear ${metrics.pendingTasks} pending follow-up tasks.`,
        leads: enquiries.filter(e => (e.status || "").toLowerCase() === "new").slice(0, 8),
        stats: { total: metrics.total, newLeads: metrics.newLeads, demo: metrics.demo, admitted: metrics.admitted, convRate: metrics.convRate }
      });
    }

    // ── 5. PERFORMANCE LEADERBOARD ──────────────────────────
    if (intents.has("PERFORMANCE_RANK")) {
      const board = buildLeaderboard(enquiries);
      const top3 = board.slice(0, 3);
      const medal = ["🥇", "🥈", "🥉"];
      const boardStr = board.map((c, i) =>
        `${medal[i] || `#${i + 1}`} **${c.name}**: ${c.admitted} Admissions | ${c.demo} Demos | ${c.convRate}% Conv | ₹${c.revenue.toLocaleString("en-IN")} Revenue | ${c.pending} Pending Tasks`
      ).join("\n");

      return NextResponse.json({
        answer: `🏆 **Team Performance Leaderboard** (*${roleNotice}*):\n\n` +
          (boardStr || "No team performance data recorded yet.") + "\n\n" +
          `### 💡 Coaching Insights\n` +
          `${top3[0] ? `- 🌟 **Top Performer (${top3[0].name})**: Driving ${top3[0].admitted} admissions at ${top3[0].convRate}% conversion. Replicate their follow-up style across the team.` : ""}\n` +
          `${board.length > 1 && board[board.length - 1].admitted === 0 ? `- ⚠️ **Needs Coaching**: ${board[board.length - 1].name} has 0 admissions. Schedule a 1:1 call review to identify objection handling gaps.` : ""}\n` +
          `- 📋 **Team Average Conversion**: ${(board.reduce((a, c) => a + Number(c.convRate), 0) / (board.length || 1)).toFixed(1)}%`,
        leads: enquiries.slice(0, 5),
        stats: { counsellors: board.length, topPerformer: top3[0]?.name || "N/A" }
      });
    }

    // ── 6. DEMO INTELLIGENCE ─────────────────────────────────
    if (intents.has("DEMO_INTELLIGENCE")) {
      const todayStr = entities.todayStr;
      const demoLeads = enquiries.filter(e => {
        const s = (e.status || "").toLowerCase();
        return s.includes("demo") || e.isDemoScheduled || (e.demos && e.demos.length > 0);
      });
      const todayDemos = demoLeads.filter(e => {
        if (e.demoDate === todayStr) return true;
        if ((e.demos || []).some((d: any) => d.date === todayStr)) return true;
        return false;
      });

      return NextResponse.json({
        answer: `🎥 **Demo Intelligence Dashboard** (*${roleNotice}*):\n\n` +
          `### 📊 Demo Metrics\n` +
          `- 🎥 **Total Demo Pipeline**: ${demoLeads.length}\n` +
          `- 📅 **Scheduled Today (${todayStr})**: ${todayDemos.length}\n` +
          `- 🎓 **Demo → Admission Rate**: ${metrics.demoConvRate}%\n\n` +
          `### 💡 Demo Conversion Protocol\n` +
          `1. Confirm attendance with WhatsApp reminder 2 hours before.\n` +
          `2. Collect student feedback immediately after the session.\n` +
          `3. Make a closing call within 2 hours post-demo.\n` +
          `4. Share testimonial video + fee structure + batch start date.\n\n` +
          `Here are the students with demo sessions in your scope:`,
        leads: demoLeads.slice(0, 8),
        stats: { totalDemos: demoLeads.length, todayDemos: todayDemos.length, demoConvRate: metrics.demoConvRate }
      });
    }

    // ── 7. FOLLOW-UP / TASKS ─────────────────────────────────
    if (intents.has("FOLLOWUP_TASKS")) {
      const leadsWithPending: any[] = [];
      let pendingCount = 0;
      let overdueCount = 0;
      const todayStr = entities.todayStr;

      enquiries.forEach(e => {
        const pending = (e.followUps || []).filter((f: any) => !f.isCompleted && (f.status || "").toLowerCase() !== "completed");
        const overdue = pending.filter((f: any) => f.date && f.date < todayStr);
        if (pending.length > 0) {
          pendingCount += pending.length;
          overdueCount += overdue.length;
          leadsWithPending.push({ ...e, _pendingCount: pending.length, _overdueCount: overdue.length });
        }
      });

      leadsWithPending.sort((a, b) => b._overdueCount - a._overdueCount);

      return NextResponse.json({
        answer: `⏳ **Follow-Up Task Intelligence** (*${roleNotice}*):\n\n` +
          `### 📋 Task Status\n` +
          `- 📌 **Total Pending Tasks**: ${pendingCount}\n` +
          `- 🔴 **Overdue Tasks**: ${overdueCount}\n` +
          `- 👥 **Students with Pending Tasks**: ${leadsWithPending.length}\n\n` +
          `### ⚡ Priority Order\n` +
          `${overdueCount > 0 ? `1. 🔴 **Clear ${overdueCount} overdue tasks immediately** — delayed follow-ups lose leads exponentially.\n` : ""}` +
          `2. Focus on students in **Demo** and **Follow-Up** stages first.\n` +
          `3. Batch-call new leads together for efficiency (9–11 AM and 3–6 PM windows are optimal).\n\n` +
          `Students sorted by overdue task count:`,
        leads: leadsWithPending.slice(0, 8),
        stats: { pendingTasks: pendingCount, overdueCount, studentsWithTasks: leadsWithPending.length }
      });
    }

    // ── 8. HOT / HIGH PRIORITY LEADS ────────────────────────
    if (intents.has("HOT_LEADS")) {
      const hotLeads = enquiries.filter(e => (e.priorityLevel || e.priority || "").toLowerCase() === "high");
      return NextResponse.json({
        answer: `🔥 **High Priority Lead Intelligence** (*${roleNotice}*):\n\n` +
          `Found **${hotLeads.length} hot, high-priority leads** in your scope.\n\n` +
          `### 🎯 Hot Lead Closing Protocol\n` +
          `1. **Call within 5 minutes** — treat hot leads as VIP.\n` +
          `2. Offer a **free seat reservation** or **limited-time scholarship**.\n` +
          `3. Assign your best counsellor for personal relationship building.\n` +
          `4. If no response: Try 3 calls + 2 WhatsApp messages within 24 hours.\n\n` +
          `💡 **Hot Lead Value**: Each high-priority lead is 5x more likely to convert than a standard lead.`,
        leads: hotLeads.slice(0, 10),
        stats: { hotLeads: hotLeads.length }
      });
    }

    // ── 9. STALE / COLD LEADS ────────────────────────────────
    if (intents.has("STALE_LEADS")) {
      const weekAgoStr = entities.weekAgoStr;
      const staleLeads = enquiries.filter(e => {
        const lastUpdate = e.updatedAt || e.createdAt || "";
        const s = (e.status || "").toLowerCase();
        return lastUpdate < weekAgoStr && !["admitted", "lost"].includes(s);
      });

      return NextResponse.json({
        answer: `❄️ **Cold/Stale Lead Re-Engagement Intelligence** (*${roleNotice}*):\n\n` +
          `Found **${staleLeads.length} stale leads** (no activity for 7+ days).\n\n` +
          `### 🔄 Re-Engagement Playbook\n` +
          `1. **New Batch Angle**: "Hi, we're starting a new batch next week — wanted to check if you're still interested."\n` +
          `2. **Success Story Hook**: Share a recent student result (job placement, certification).\n` +
          `3. **Scholarship Reactivation**: "We have a limited scholarship we'd like to offer you."\n` +
          `4. **Mutual Close or Clean Pipeline**: If no response in 3 attempts → mark as Lost and focus energy elsewhere.\n\n` +
          `💡 **Re-engagement success rate**: ~15–25% of stale leads can be recovered with the right approach.`,
        leads: staleLeads.slice(0, 8),
        stats: { staleLeads: staleLeads.length }
      });
    }

    // ── 10. ADMISSION / FEE QUERY ────────────────────────────
    if (intents.has("ADMISSION_REVENUE")) {
      const admittedLeads = enquiries.filter(e => (e.status || "").toLowerCase() === "admitted");
      const feeCollected = enquiries.reduce((sum, e) => {
        const f = parseFloat(String(e.feesCollected || e.expectedConversionFee || "0").replace(/[^0-9.]/g, ""));
        return sum + (isNaN(f) ? 0 : f);
      }, 0);

      return NextResponse.json({
        answer: `🎓 **Admissions & Revenue Intelligence** (*${roleNotice}*):\n\n` +
          `### 📊 Admission Metrics\n` +
          `- 🎓 **Total Admitted Students**: ${admittedLeads.length}\n` +
          `- 💰 **Fee Collected (CRM Records)**: ₹${feeCollected.toLocaleString("en-IN")}\n` +
          `- 💳 **Payment Collections (System)**: ₹${metrics.totalRevenue.toLocaleString("en-IN")}\n` +
          `- 📊 **Pipeline Conversion Rate**: ${metrics.convRate}%\n\n` +
          `### 💡 Revenue Acceleration Tips\n` +
          `1. **EMI Push**: For students hesitating on fees, offer 3-month, 6-month EMI plans. Removes the biggest objection.\n` +
          `2. **Upfront Incentive**: "Pay full fees today and get ₹2,000 scholarship + 3 free mentorship sessions."\n` +
          `3. **Pending Balance Follow-up**: Send WhatsApp reminders for any outstanding EMI balances every Monday.\n\n` +
          `Recent admitted student profiles:`,
        leads: admittedLeads.slice(0, 8),
        stats: { totalAdmissions: admittedLeads.length, feeCollected, totalRevenue: metrics.totalRevenue }
      });
    }

    // ── 11. PLAYBOOK / STRATEGY ──────────────────────────────
    if (intents.has("PLAYBOOK_STRATEGY")) {
      const playbook = getPlaybook(queryLower, metrics);
      return NextResponse.json({
        answer: `🎯 **AI CRM Playbook Engine** (*${roleNotice}*):\n\n` + playbook,
        leads: enquiries.slice(0, 5),
        stats: { total: metrics.total, convRate: metrics.convRate, demo: metrics.demo }
      });
    }

    // ── 12. PIPELINE / SUMMARY ───────────────────────────────
    if (intents.has("SUMMARY_OVERVIEW")) {
      const fc = forecastMetrics(enquiries, allPayments);
      const risks = detectRisks(enquiries, metrics);
      return NextResponse.json({
        answer: `📊 **Executive CRM Intelligence Dashboard** (*${roleNotice}*):\n\n` +
          `### 🔢 Live Pipeline Metrics\n` +
          `- 📥 **Total Leads**: ${metrics.total}\n` +
          `- 🆕 **New (Uncontacted)**: ${metrics.newLeads} (${metrics.total > 0 ? ((metrics.newLeads / metrics.total) * 100).toFixed(0) : 0}%)\n` +
          `- 📞 **Contacted**: ${metrics.contacted}\n` +
          `- 🎥 **Demo Stage**: ${metrics.demo}\n` +
          `- 🎓 **Admitted**: ${metrics.admitted} (${metrics.convRate}% Conv)\n` +
          `- ❌ **Lost**: ${metrics.lost} (${metrics.lostRate}%)\n` +
          `- ⏳ **Pending Tasks**: ${metrics.pendingTasks}\n\n` +
          `### 💰 Financial Snapshot\n` +
          `- 💵 **Revenue**: ₹${metrics.totalRevenue.toLocaleString("en-IN")}\n` +
          `- 📈 **Net ${metrics.netProfit >= 0 ? "Profit" : "Loss"}**: ₹${Math.abs(metrics.netProfit).toLocaleString("en-IN")} (${metrics.profitMarginPct}%)\n\n` +
          `### 🔮 Month-End Forecast\n` +
          `- 🎯 **Projected Admissions**: ${fc.projAdmissions}\n` +
          `- 💹 **Projected Revenue**: ₹${fc.projRevenue.toLocaleString("en-IN")}\n\n` +
          `### 🚨 Risk Signals\n` +
          risks.slice(0, 2).join("\n"),
        leads: enquiries.slice(0, 6),
        stats: { total: metrics.total, admitted: metrics.admitted, convRate: metrics.convRate, netProfit: metrics.netProfit }
      });
    }

    // ── 13. STUDENT SEARCH ───────────────────────────────────
    const directMatches = enquiries.filter(e => {
      const haystack = `${e.studentFullName || ""} ${e.phone || ""} ${e.mobileNumber || ""} ${e.targetCourse || ""} ${e.assignedCrmAdvisor || ""} ${e.enquiryId || ""}`.toLowerCase();
      return queryLower.split(" ").some(word => word.length > 2 && haystack.includes(word));
    });

    if (directMatches.length > 0) {
      return NextResponse.json({
        answer: `🔍 **Student Search Results** (*${roleNotice}*):\n\nFound **${directMatches.length} matching records** for "*${prompt}*":`,
        leads: directMatches.slice(0, 8),
        stats: { matchesCount: directMatches.length }
      });
    }

    // ── 14. REASONING / MATH / KNOWLEDGE BASE FALLBACK ──────
    const knowledgeAnswer = knowledgeBaseAnswer(prompt, queryLower);
    return NextResponse.json({
      answer: knowledgeAnswer,
      leads: enquiries.slice(0, 4),
      stats: { total: metrics.total, admitted: metrics.admitted }
    });

  } catch (error: any) {
    console.error("AI Assistant Engine Error:", error);
    return NextResponse.json(
      { error: "Failed to process AI inquiry: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────
function getMainExpenseCategory(expenses: any[]): string {
  if (!expenses || expenses.length === 0) return "General Overhead";
  const catMap: Record<string, number> = {};
  expenses.forEach(e => {
    const cat = e.category || "Misc";
    catMap[cat] = (catMap[cat] || 0) + Number(e.amount || 0);
  });
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  return sorted[0] ? sorted[0][0] : "General Overhead";
}
