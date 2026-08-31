"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function WelcomePage() {
  const [activeTab, setActiveTab] = useState<"student360" | "allocation" | "crm" | "financials" | "ai" | "academics">("student360");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const featureTabs = [
    {
      id: "student360",
      label: "Student 360 & Down Payment",
      badge: "360° Management",
      title: "Comprehensive Student 360 Hub & Flexible Down Payment Engine",
      desc: "Get an end-to-end 360-degree view of every enrolled student. Edit custom EMI dates, manage down payments, track payment receipts, and execute full cascading cleanups across all linked modules.",
      bullets: [
        "Interactive 360° student drawer & modal for Admins, Brand Managers, and Centre Heads",
        "Custom EMI schedule editor: modify due dates & installment amounts dynamically with live balance math",
        "Registration vs Downpayment split: automatic fee balancing, custom dates, and down payment collection mode",
        "1-Click Cascading Deletion: automatically reconciles payments, tasks, attendance, company revenue caps, and enquiry statuses"
      ],
      previewStats: [
        { label: "Profile Visibility", val: "360° Realtime" },
        { label: "EMI Customization", val: "Live Flex" },
        { label: "Cascading Cleanup", val: "100% Automated" },
      ]
    },
    {
      id: "allocation",
      label: "Multi-Brand & GST Engine",
      badge: "Automated Allocation",
      title: "Intelligent Multi-Brand & Legal Entity Allocation Engine",
      desc: "Manage multiple brands and legal company entities under one roof. Lead2Ledger automatically tracks the ₹19.5 Lakh annual capacity threshold for every registered company and routes incoming payments dynamically.",
      bullets: [
        "Automatic non-cash payment routing based on company GST capacity caps",
        "Multi-brand data segregation with strict brand scope access controls",
        "Instant branded PDF payment receipts and tax invoice generation",
        "Reverse legal entity mapping across parent brands and child franchises"
      ],
      previewStats: [
        { label: "Active Brands", val: "8+ Brands" },
        { label: "Legal Companies", val: "12 Entities" },
        { label: "Routing Latency", val: "< 45ms" },
      ]
    },
    {
      id: "crm",
      label: "Sales Executive CRM",
      badge: "WhatsApp Automation",
      title: "Sales Executive CRM & MSG91 WhatsApp Automation",
      desc: "Empower your sales executives with a high-velocity lead management system. Schedule student demos, track follow-ups, and automate WhatsApp EMI reminders via MSG91 integration.",
      bullets: [
        "Strict lead search exclusively by Student Name and Student Phone Number",
        "One-click demo scheduling directly from active prospect enquiry cards",
        "Automated WhatsApp fee reminders for overdue EMI installments",
        "Auto-closing enquiry pipeline and automatic lead creation on direct admissions"
      ],
      previewStats: [
        { label: "Lead Conversion", val: "68.4%" },
        { label: "Demos Booked", val: "1,420+" },
        { label: "WhatsApp Sent", val: "15.8k" },
      ]
    },
    {
      id: "financials",
      label: "Expenses & Payroll",
      badge: "Financial Control",
      title: "Brand-Tagged Expense Management & Staff Payroll",
      desc: "Keep your operational expenses and employee salary payouts organized with dual Brand and Company tagging. Filter expenses dynamically and generate Master Excel scorecards.",
      bullets: [
        "Dynamic Brand and Company dropdown tagging for every expense item",
        "Monthly staff salary payout recording with recurring payment support",
        "Filter financial records by Brand, Company, Category, and Date Range",
        "Comprehensive Excel report export for Master Financial Audits"
      ],
      previewStats: [
        { label: "Revenue Tracked", val: "₹4.8 Cr+" },
        { label: "Expenses Logged", val: "₹1.2 Cr" },
        { label: "Monthly Payroll", val: "100% On-Time" },
      ]
    },
    {
      id: "ai",
      label: "Lead2Ledger AI Assistant",
      badge: "24/7 Intelligence",
      title: "Lead2Ledger AI Assistant & Executive Command Center",
      desc: "Ask questions in plain English to inspect lead pipelines, conversion rates, and revenue collection. The AI assistant respects user brand scopes and enforces role-based security.",
      bullets: [
        "Draggable floating AI window accessible across all portal screens",
        "Role-scoped natural language query processing for instant answers",
        "Automated lead sentiment analysis and daily performance summaries",
        "Instant calculation of counsellor collection targets and conversion ratios"
      ],
      previewStats: [
        { label: "Query Accuracy", val: "99.4%" },
        { label: "Response Time", val: "Instant" },
        { label: "Scope Security", val: "100% Locked" },
      ]
    },
    {
      id: "academics",
      label: "Academic & Batches",
      badge: "Full Operations",
      title: "Course Catalog, Batch Scheduling & Attendance",
      desc: "Organize academic offerings with structured course catalogs, morning & evening batch schedules, teacher subject assignments, and interactive attendance tracking registers.",
      bullets: [
        "Unified Student Search Center across Admissions & Prospect Enquiries",
        "Custom batch creation and course duration configuration",
        "Teacher subject mapping and live class attendance tracking",
        "Instant student enrollment profile drawer with complete fee ledger"
      ],
      previewStats: [
        { label: "Courses Managed", val: "45+ Programs" },
        { label: "Active Batches", val: "120+ Batches" },
        { label: "Attendance Rate", val: "94.2%" },
      ]
    }
  ];

  const deepFeatureGrid = [
    {
      title: "Student 360 Hub & Down Payment Engine",
      badge: "Complete 360° Control",
      color: "border-teal-200 bg-teal-50/60 text-teal-700",
      description: "Complete student lifecycle management with flexible fee structures, live EMI customization, and single-click cascading cleanup.",
      points: [
        "360-Degree Profile Modal: Inspect personal info, payment history, custom EMI schedule, SOP tasks, and attendance registers in one view.",
        "Custom EMI Date & Amount Editor: Tailor installment dates and amounts to match student payment preferences effortlessly.",
        "Registration & Down Payment Split: Separate upfront registration fees from down payments with custom scheduled dates and dedicated collection mode.",
        "Cascading Deletion Engine: Deleting a student record automatically cleans up associated payment receipts, tasks, attendance registers, company revenue caps, and enquiry statuses."
      ]
    },
    {
      title: "Multi-Company Revenue Allocation Engine",
      badge: "Tax & GST Automation",
      color: "border-indigo-200 bg-indigo-50/60 text-indigo-700",
      description: "Automate complex tax compliance and multi-entity accounting without manual intervention.",
      points: [
        "Automatic GST Cap Detection: System monitors legal entities approaching the ₹19.5 Lakh annual GST turnover cap.",
        "Brand-Linked Company Dropdowns: Expense and payroll modules dynamically load ONLY companies linked to the selected Brand.",
        "Cash vs Non-Cash Split: Cash payments bypass GST caps automatically while UPI, Bank Transfer, and Card payments route to active companies.",
        "Instant Tax PDF Generator: Generates branded receipts containing CGST, SGST, IGST tax breakdown and HSN/SAC codes."
      ]
    },
    {
      title: "Sales Executive Lead Velocity & WhatsApp CRM",
      badge: "High-Velocity Sales",
      color: "border-purple-200 bg-purple-50/60 text-purple-700",
      description: "Empower your Sales Executives (formerly Counsellors) with targeted tools to close enquiries faster.",
      points: [
        "Privacy-First Search Engine: Restricts lead lookups strictly to Student Name and Student Mobile Number.",
        "Built-in Demo Booking Suite: Schedule, reschedule, and log student demo classes directly from prospect cards.",
        "Auto-Closing & Direct Admission Sync: Enquiries transition to 'Admitted' automatically, while direct admissions auto-create matching leads.",
        "MSG91 WhatsApp EMI Reminders: Automatically triggers personalized WhatsApp fee reminder alerts for upcoming installment dates."
      ]
    },
    {
      title: "Dual-Tagged Expense Management & Payroll",
      badge: "Financial Governance",
      color: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
      description: "Maintain complete fiscal transparency across all operational branches and sub-brands.",
      points: [
        "Dual Brand & Company Tagging: Categorize operational costs (Rent, Utilities, Ads, Software) under specific brand-linked legal entities.",
        "Employee Salary Payouts: Track monthly payroll payouts for Centre Heads, Sales Executives, Teachers, and Staff.",
        "Custom Date & Category Filtering: Instantly slice expense logs by month, brand, company tag, or expense category.",
        "Master Excel Report Exporter: Export formatted Excel workbooks containing Super Master Reports, Leads Registers, and Scorecards."
      ]
    },
    {
      title: "Floating Lead2Ledger AI Executive Assistant",
      badge: "Natural Language AI",
      color: "border-blue-200 bg-blue-50/60 text-blue-700",
      description: "Get immediate answers about revenue, lead conversion rates, and staff performance using natural language.",
      points: [
        "Omnipresent AI Widget: Floating Assistant icon accessible on every dashboard screen for instant queries.",
        "Strict Role & Scope Enforcement: AI respects user access levels—Centre Heads only see data from their authorized Brand Scope.",
        "Pipeline Sentiment & Forecasting: Analyzes lead activity logs to predict monthly admission closures and fee collections.",
        "Automated Executive Summaries: Generates daily briefings summarizing lead conversions, demos conducted, and overdue follow-ups."
      ]
    },
    {
      title: "Course Catalog, Batch Rostering & Attendance",
      badge: "Academic Operations",
      color: "border-amber-200 bg-amber-50/60 text-amber-700",
      description: "Streamline academic operations from curriculum configuration to daily student attendance registers.",
      points: [
        "Flexible Course Catalog: Configure 6-Month, 12-Month, or custom duration programs with standardized fee structures.",
        "Batch Capacity & Time Slots: Create Morning, Afternoon, and Evening batches linked to specific course offerings.",
        "Faculty Subject Mapping: Assign Teachers to specific subjects and track class delivery logs in real time.",
        "Cross-Module Student Search: Instantly locate student profiles across admissions, enquiries, and batch rosters."
      ]
    }
  ];

  const faqs = [
    {
      q: "How does the Automatic Company Allocation Engine work?",
      a: "When an admission payment is recorded, Lead2Ledger's intelligent engine checks the annual revenue collected by registered legal companies. If a company approaches its ₹19.5 Lakh annual GST threshold, the system automatically allocates the payment to the next available company associated with the brand."
    },
    {
      q: "Can Centre Heads see data from other brands?",
      a: "No. Lead2Ledger enforces strict Brand Scope locking. A Centre Head assigned to a specific brand will only see leads, admissions, financial records, and analytics relevant to their authorized brand scope."
    },
    {
      q: "How does the MSG91 WhatsApp integration function?",
      a: "Lead2Ledger connects directly with MSG91 API templates. When a student's EMI payment date arrives or lapses, the system automatically dispatches personalized WhatsApp reminders to both the student and the assigned Sales Executive."
    },
    {
      q: "Can financial reports be exported to Excel?",
      a: "Yes! Lead2Ledger includes a built-in Master Report generator powered by ExcelJS. You can download Super Master Reports, Leads Registers, Sales Executive Scorecards, and Centre Head Analytics in formatted .xlsx spreadsheets with a single click."
    }
  ];

  const portals = [
    {
      role: "Super Admin Portal",
      badge: "Full Governance",
      desc: "Complete system control, legal entity capacity caps, company allocation engine, user management, and Master Excel exports.",
      color: "border-indigo-200 bg-indigo-50/60 text-indigo-700"
    },
    {
      role: "Centre Head Portal",
      badge: "Brand Scope",
      desc: "Brand performance scorecards, active staff analytics, brand-locked enquiry review, and revenue utilization tracking.",
      color: "border-purple-200 bg-purple-50/60 text-purple-700"
    },
    {
      role: "Sales Executive Portal",
      badge: "Lead Velocity",
      desc: "Personal lead pipeline, 1-click demo scheduling, automated WhatsApp EMI reminders, and instant fee receipt generation.",
      color: "border-emerald-200 bg-emerald-50/60 text-emerald-700"
    },
    {
      role: "Teacher Portal",
      badge: "Academics",
      desc: "Assigned batch schedules, subject rosters, student registers, and daily digital class attendance tracking.",
      color: "border-amber-200 bg-amber-50/60 text-amber-700"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white flex flex-col justify-between overflow-x-hidden relative">
      {/* Ambient Mesh Background Accents */}
      <div className="fixed -top-40 -left-40 h-[650px] w-[650px] rounded-full bg-indigo-300/25 blur-[140px] pointer-events-none -z-10 animate-pulse-glow" />
      <div className="fixed -bottom-40 -right-40 h-[650px] w-[650px] rounded-full bg-purple-300/25 blur-[140px] pointer-events-none -z-10 animate-pulse-glow" style={{ animationDelay: "2.5s" }} />
      <div className="fixed top-1/3 right-10 h-[480px] w-[480px] rounded-full bg-emerald-200/20 blur-[130px] pointer-events-none -z-10" />

      {/* Top Banner Announcement */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 text-white text-xs font-semibold py-2.5 px-4 text-center flex items-center justify-center gap-2 border-b border-indigo-900/40">
        <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-xs">
          Enterprise v4.0
        </span>
        <span className="text-slate-200">
          Student 360 Hub, Down Payment Engine & Cascading Cleanup are live!
        </span>
        <Link href="/login" className="underline font-bold text-indigo-300 hover:text-white ml-1 transition-colors">
          Sign In &rarr;
        </Link>
      </div>

      {/* Sticky Header Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-6 lg:px-12 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 shadow-md shadow-indigo-600/25 text-white font-extrabold text-base tracking-tight font-heading">
            L2L
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-extrabold tracking-tight text-slate-900 font-heading leading-none">
              Lead<span className="text-indigo-600">2</span>Ledger
            </span>
            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase mt-0.5">
              CRM & Financial Intelligence
            </span>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-slate-600">
          <a href="#features" className="hover:text-indigo-600 transition-colors">Interactive Modules</a>
          <a href="#deep-features" className="hover:text-indigo-600 transition-colors">Architecture</a>
          <a href="#portals" className="hover:text-indigo-600 transition-colors">Workspaces</a>
          <a href="#faqs" className="hover:text-indigo-600 transition-colors">FAQs</a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/signup"
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-indigo-600 transition-colors"
          >
            Create Account
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/35 transition-all active:scale-[0.98]"
          >
            Access Portal &rarr;
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="max-w-6xl mx-auto px-6 lg:px-12 pt-16 pb-20 text-center flex flex-col items-center">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-50/90 border border-indigo-100/90 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-extrabold mb-6 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
            <span>The Unified CRM & Financial Intelligence OS for Multi-Brand Institutes</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl leading-tight sm:leading-tight font-heading">
            Scale Multi-Brand Admissions with{" "}
            <span className="gradient-text">Complete Precision</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-sm sm:text-base font-medium text-slate-600 max-w-2xl leading-relaxed">
            Eliminate operational friction. Manage multi-company GST capacity thresholds, sales executive lead pipelines, automated WhatsApp EMI reminders, staff payroll, and live daily BI scorecards under one roof.
          </p>

          {/* Hero CTA Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="px-8 py-4 text-xs sm:text-sm font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 transition-all active:scale-[0.99] flex items-center gap-2"
            >
              <span>Launch Enterprise Portal</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <a
              href="#deep-features"
              className="px-8 py-4 text-xs sm:text-sm font-bold bg-white/90 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-2xl shadow-xs transition-all flex items-center gap-2"
            >
              <span>View System Specs &rarr;</span>
            </a>
          </div>

          {/* Live Preview UI Card */}
          <div className="mt-14 w-full max-w-5xl glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl text-left relative overflow-hidden border border-slate-200/90">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs font-bold text-slate-500">Lead2Ledger Executive Dashboard Live Preview</span>
              </div>
              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/80 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Database Sync
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Revenue</p>
                <p className="text-2xl font-extrabold text-indigo-600 mt-1 font-heading">₹48,50,000</p>
                <p className="text-[10px] font-semibold text-emerald-600 mt-1">↑ +18.4% vs last month</p>
              </div>
              <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Confirmed Admissions</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1 font-heading">1,240 Students</p>
                <p className="text-[10px] font-semibold text-indigo-600 mt-1">Across 8 Brands</p>
              </div>
              <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Conversion Velocity</p>
                <p className="text-2xl font-extrabold text-purple-600 mt-1 font-heading">68.4%</p>
                <p className="text-[10px] font-semibold text-purple-600 mt-1">Top Sales Ratio</p>
              </div>
              <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">GST Allocation</p>
                <p className="text-2xl font-extrabold text-emerald-600 mt-1 font-heading">Cap ₹19.5L</p>
                <p className="text-[10px] font-semibold text-slate-500 mt-1">12 Entities Protected</p>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl p-4 text-white flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-base shadow-md">
                  ✨
                </div>
                <div>
                  <p className="text-xs font-bold text-white font-heading">Lead2Ledger AI Intelligence Engine</p>
                  <p className="text-[11px] text-slate-300">All company tax thresholds healthy. 42 new admissions processed today.</p>
                </div>
              </div>
              <Link href="/login" className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-extrabold rounded-xl shrink-0 transition-colors shadow-md shadow-indigo-500/20">
                Launch AI Assistant &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* METRICS & ROI BAR */}
        <section id="metrics" className="bg-white/80 border-y border-slate-200/80 py-12 px-6 lg:px-12 backdrop-blur-md">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-indigo-600 tracking-tight font-heading">99.9%</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Platform Uptime</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-purple-600 tracking-tight font-heading">₹50M+</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Revenue Streamlined</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-emerald-600 tracking-tight font-heading">100%</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">GST Cap Compliance</p>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-extrabold text-rose-600 tracking-tight font-heading">&lt; 45ms</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Routing Latency</p>
            </div>
          </div>
        </section>

        {/* INTERACTIVE FEATURE SHOWCASE */}
        <section id="features" className="max-w-6xl mx-auto px-6 lg:px-12 py-20">
          <div className="text-center mb-12">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              Interactive Feature Demonstrator
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3 font-heading">
              Engineered for High-Growth Multi-Brand Institutes
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-2 max-w-xl mx-auto">
              Select a module below to inspect Lead2Ledger&apos;s specialized capabilities.
            </p>
          </div>

          {/* Tab Selection Navigation */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-full px-2 pb-4 mb-8">
            {featureTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 cursor-pointer border ${activeTab === tab.id
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/25"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content Display */}
          {(() => {
            const current = featureTabs.find((t) => t.id === activeTab)!;
            return (
              <div className="glass-panel border border-slate-200/90 rounded-3xl p-8 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-5">
                  <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border border-indigo-100">
                    {current.badge}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
                    {current.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                    {current.desc}
                  </p>

                  <div className="space-y-3 pt-2">
                    {current.bullets.map((b, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs font-semibold text-slate-700">
                        <span className="text-emerald-600 font-extrabold mt-0.5">✓</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4">
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-slate-900/10"
                    >
                      <span>Explore {current.label}</span>
                      <span>&rarr;</span>
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-slate-50/90 border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-inner">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 font-heading">
                    Live Performance Benchmarks
                  </h4>
                  {current.previewStats.map((st, i) => (
                    <div key={i} className="flex items-center justify-between bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-xs">
                      <span className="text-xs font-semibold text-slate-600">{st.label}</span>
                      <span className="text-sm font-extrabold text-indigo-600 font-heading">{st.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>

        {/* DEEP FEATURE SPECIFICATIONS GRID */}
        <section id="deep-features" className="bg-white/90 border-y border-slate-200/80 py-20 px-6 lg:px-12 backdrop-blur-md">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                Complete Architecture Breakdown
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3 font-heading">
                All Enterprise Features Explored in Detail
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-2 max-w-xl mx-auto">
                Explore the technical capabilities and automated workflows powering Lead2Ledger CRM.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {deepFeatureGrid.map((feat, idx) => (
                <div key={idx} className="glass-card rounded-3xl p-6 flex flex-col justify-between border border-slate-200/80">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${feat.color}`}>
                        {feat.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 mb-2 font-heading">{feat.title}</h3>
                    <p className="text-xs text-slate-600 font-medium mb-4 leading-relaxed">{feat.description}</p>

                    <div className="space-y-2 border-t border-slate-200/80 pt-4">
                      {feat.points.map((pt, pIdx) => (
                        <div key={pIdx} className="flex items-start gap-2 text-[11px] font-medium text-slate-700 leading-normal">
                          <span className="text-indigo-600 font-extrabold mt-0.5">•</span>
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6">
                    <Link
                      href="/login"
                      className="block w-full text-center py-2.5 bg-slate-50 hover:bg-indigo-600 hover:text-white text-slate-800 text-xs font-extrabold rounded-xl border border-slate-200 shadow-xs transition-all"
                    >
                      Access Feature &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ROLE PORTALS GATEWAY */}
        <section id="portals" className="bg-slate-100/60 border-b border-slate-200/80 py-20 px-6 lg:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-600 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
                Role-Based Workspaces
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3 font-heading">
                Tailored Gateways for Every Team Member
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-2 max-w-lg mx-auto">
                Granular security and customized tools designed for specific organizational roles.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {portals.map((p, i) => (
                <div key={i} className="glass-card rounded-3xl p-6 flex flex-col justify-between border border-slate-200/90">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${p.color}`}>
                        {p.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 font-heading">{p.role}</h3>
                    <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                  <div className="pt-6">
                    <Link
                      href="/login"
                      className="block w-full text-center py-2.5 bg-slate-50 hover:bg-indigo-600 hover:text-white text-slate-800 text-xs font-bold rounded-xl border border-slate-200 transition-all"
                    >
                      Login to {p.role.split(" ")[0]} &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQS SECTION */}
        <section id="faqs" className="max-w-4xl mx-auto px-6 lg:px-12 py-20">
          <div className="text-center mb-12">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              Got Questions?
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3 font-heading">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between text-left cursor-pointer"
                  >
                    <span className="text-sm font-extrabold text-slate-900 font-heading">{faq.q}</span>
                    <span className="text-indigo-600 font-extrabold text-lg ml-2">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-xs text-slate-600 font-medium leading-relaxed border-t border-slate-100 pt-3">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* GRAND CTA BANNER */}
        <section className="max-w-5xl mx-auto px-6 lg:px-12 mb-20">
          <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 text-white rounded-3xl p-8 sm:p-12 shadow-2xl text-center relative overflow-hidden border border-indigo-900/50">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight relative z-10 font-heading">
              Transform Your Institute Operations Today
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-indigo-200 max-w-xl mx-auto font-medium relative z-10">
              Join leading educational organizations managing admissions, multi-company revenue, and staff payroll with zero friction.
            </p>
            <div className="mt-8 flex justify-center relative z-10">
              <Link
                href="/login"
                className="px-8 py-4 bg-white text-indigo-950 hover:bg-slate-100 font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg transition-all active:scale-[0.99]"
              >
                Sign In to Enterprise Portal &rarr;
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-white/90 border-t border-slate-200/80 py-8 px-6 lg:px-12 text-center text-xs font-semibold text-slate-500">
        <div className="flex flex-col sm:flex-row items-center justify-between max-w-6xl mx-auto gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-indigo-600 text-white font-extrabold text-[10px] flex items-center justify-center font-heading">L2L</div>
            <span className="text-slate-900 font-extrabold font-heading">Lead2Ledger CRM Suite</span>
          </div>
          <p>© {new Date().getFullYear()} Lead2Ledger Technologies. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-indigo-600 transition-colors">Portal Login</Link>
            <span>•</span>
            <span className="text-slate-500">v4.0 Enterprise Edition</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
