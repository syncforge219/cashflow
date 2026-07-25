"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function WelcomePage() {
  const [activeTab, setActiveTab] = useState<"allocation" | "crm" | "financials" | "ai" | "academics">("allocation");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const featureTabs = [
    {
      id: "allocation",
      label: "🏢 Multi-Brand & GST Engine",
      icon: "🏢",
      badge: "Automated Allocation",
      title: "Intelligent Multi-Brand & Legal Entity Allocation Engine",
      desc: "Manage multiple brands and legal company entities under one roof. CoachFlow automatically tracks the ₹19.5 Lakh annual capacity threshold for every registered company and routes incoming payments dynamically.",
      bullets: [
        "Automatic non-cash payment routing based on company GST capacity caps",
        "Multi-brand data segregation with strict brand scope access controls",
        "Instant branded PDF payment receipts and tax invoice generation",
        "Reverse legal entity mapping across parent brands and child franchises"
      ],
      previewStats: [
        { label: "Active Brands", val: "8 Brands" },
        { label: "Legal Companies", val: "12 Entities" },
        { label: "Allocation Speed", val: "< 50ms" },
      ]
    },
    {
      id: "crm",
      label: "🎯 Sales Executive CRM",
      icon: "🎯",
      badge: "WhatsApp Automation",
      title: "Sales Executive CRM & MSG91 WhatsApp Automation",
      desc: "Empower your sales executives with a high-velocity lead management system. Schedule student demos, track follow-ups, and automate WhatsApp EMI reminders via MSG91 integration.",
      bullets: [
        "Strict lead search exclusively by Student Name and Student Phone Number",
        "One-click demo scheduling directly from active prospect enquiry cards",
        "Automated WhatsApp fee reminders for overdue EMI installments",
        "Auto-closing enquiry pipeline upon admission conversion"
      ],
      previewStats: [
        { label: "Lead Conversion", val: "68.4%" },
        { label: "Demos Booked", val: "1,420+" },
        { label: "WhatsApp Sent", val: "15.8k" },
      ]
    },
    {
      id: "financials",
      label: "💰 Expenses & Payroll",
      icon: "💰",
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
      label: "🤖 CashFlow AI Assistant",
      icon: "🤖",
      badge: "24/7 Intelligence",
      title: "CashFlow AI Assistant & Executive Command Center",
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
      label: "🎓 Academic & Batches",
      icon: "🎓",
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
      title: "1. Multi-Company Revenue Allocation Engine",
      badge: "Tax & GST Automation",
      icon: "⚡",
      color: "border-indigo-200 bg-indigo-50/40 text-indigo-700",
      description: "Automate complex tax compliance and multi-entity accounting without manual intervention.",
      points: [
        "Automatic GST Cap Detection: System monitors legal entities approaching the ₹19.5 Lakh annual GST turnover cap.",
        "Brand-Linked Company Dropdowns: Expense and payroll modules dynamically load ONLY companies linked to the selected Brand.",
        "Cash vs Non-Cash Split: Cash payments bypass GST caps automatically while UPI, Bank Transfer, and Card payments route to active companies.",
        "Instant Tax PDF Generator: Generates branded receipts containing CGST, SGST, IGST tax breakdown and HSN/SAC codes."
      ]
    },
    {
      title: "2. Sales Executive Lead Velocity & WhatsApp CRM",
      badge: "High-Velocity Sales",
      icon: "🎯",
      color: "border-purple-200 bg-purple-50/40 text-purple-700",
      description: "Empower your Sales Executives (formerly Counsellors) with targeted tools to close enquiries faster.",
      points: [
        "Privacy-First Search Engine: Restricts lead lookups strictly to Student Name and Student Mobile Number.",
        "Built-in Demo Booking Suite: Schedule, reschedule, and log student demo classes directly from prospect cards.",
        "Auto-Closing Enquiry Pipeline: Enquiries automatically transition to 'Admitted' status when an admission is created.",
        "MSG91 WhatsApp EMI Reminders: Automatically triggers personalized WhatsApp fee reminder alerts for upcoming installment dates."
      ]
    },
    {
      title: "3. Dual-Tagged Expense Management & Payroll",
      badge: "Financial Governance",
      icon: "💰",
      color: "border-emerald-200 bg-emerald-50/40 text-emerald-700",
      description: "Maintain complete fiscal transparency across all operational branches and sub-brands.",
      points: [
        "Dual Brand & Company Tagging: Categorize operational costs (Rent, Utilities, Ads, Software) under specific brand-linked legal entities.",
        "Employee Salary Payouts: Track monthly payroll payouts for Centre Heads, Sales Executives, Teachers, and Staff.",
        "Custom Date & Category Filtering: Instantly slice expense logs by month, brand, company tag, or expense category.",
        "Master Excel Report Exporter: Export formatted Excel workbooks containing Super Master Reports, Leads Registers, and Scorecards."
      ]
    },
    {
      title: "4. Floating CashFlow AI Executive Assistant",
      badge: "Natural Language AI",
      icon: "🤖",
      color: "border-blue-200 bg-blue-50/40 text-blue-700",
      description: "Get immediate answers about revenue, lead conversion rates, and staff performance using natural language.",
      points: [
        "Omnipresent AI Widget: Floating Assistant icon accessible on every dashboard screen for instant queries.",
        "Strict Role & Scope Enforcement: AI respects user access levels—Centre Heads only see data from their authorized Brand Scope.",
        "Pipeline Sentiment & Forecasting: Analyzes lead activity logs to predict monthly admission closures and fee collections.",
        "Automated Executive Summaries: Generates daily briefings summarizing lead conversions, demos conducted, and overdue follow-ups."
      ]
    },
    {
      title: "5. Course Catalog, Batch Rostering & Attendance",
      badge: "Academic Suite",
      icon: "🎓",
      color: "border-amber-200 bg-amber-50/40 text-amber-700",
      description: "Streamline academic operations from curriculum configuration to daily student attendance registers.",
      points: [
        "Flexible Course Catalog: Configure 6-Month, 12-Month, or custom duration programs with standardized fee structures.",
        "Batch Capacity & Time Slots: Create Morning, Afternoon, and Evening batches linked to specific course offerings.",
        "Faculty Subject Mapping: Assign Teachers to specific subjects and track class delivery logs in real time.",
        "Cross-Module Student Search: Instantly locate student profiles across admissions, enquiries, and batch rosters."
      ]
    },
    {
      title: "6. Role-Based Access Control (RBAC) & Brand Isolation",
      badge: "Enterprise Security",
      icon: "🔒",
      color: "border-rose-200 bg-rose-50/40 text-rose-700",
      description: "Protect sensitive corporate data with strict multi-tenant authorization and role-based permissions.",
      points: [
        "Super Admin Portal: Complete governance over user accounts, legal entity capacity limits, and master configuration.",
        "Centre Head Portal (formerly Brand Manager): Brand-scoped analytics, active staff management, and regional performance scorecards.",
        "Sales Executive Portal: Personalized workspace for lead follow-ups, demo scheduling, and fee collection.",
        "Teacher Portal: Digital attendance registers, class rosters, and subject delivery tracking."
      ]
    }
  ];

  const faqs = [
    {
      q: "How does the Automatic Company Allocation Engine work?",
      a: "When an admission payment is recorded, CoachFlow's intelligent engine checks the annual revenue collected by registered legal companies. If a company is near its ₹19.5 Lakh annual GST threshold, the system automatically allocates the payment to the next available company associated with the brand."
    },
    {
      q: "Can Centre Heads see data from other brands?",
      a: "No. CoachFlow enforces strict Brand Scope locking. A Centre Head assigned to a specific brand will only see leads, admissions, financial records, and analytics relevant to their authorized brand scope."
    },
    {
      q: "How does the MSG91 WhatsApp integration function?",
      a: "CoachFlow connects directly with MSG91 API templates. When a student's EMI payment date passes, the system automatically dispatches personalized WhatsApp reminders to both the student and the assigned Sales Executive."
    },
    {
      q: "Can financial reports be exported to Excel?",
      a: "Yes! CoachFlow includes a built-in Master Report generator powered by ExcelJS. You can download Super Master Reports, Leads Registers, Sales Executive Scorecards, and Centre Head Analytics in formatted `.xlsx` spreadsheets with a single click."
    }
  ];

  const portals = [
    {
      role: "Super Admin Portal",
      badge: "Full Governance",
      desc: "Complete system control, legal entity capacity caps, company allocation engine, user management, and Master Excel exports.",
      icon: "⚡",
      color: "border-indigo-200 bg-indigo-50/50 text-indigo-700"
    },
    {
      role: "Centre Head Portal",
      badge: "Brand Scope",
      desc: "Brand performance scorecards, active staff analytics, brand-locked enquiry review, and revenue utilization tracking.",
      icon: "🏢",
      color: "border-purple-200 bg-purple-50/50 text-purple-700"
    },
    {
      role: "Sales Executive Portal",
      badge: "Lead Velocity",
      desc: "Personal lead pipeline, 1-click demo scheduling, automated WhatsApp EMI reminders, and instant fee receipt generation.",
      icon: "🎯",
      color: "border-emerald-200 bg-emerald-50/50 text-emerald-700"
    },
    {
      role: "Teacher Portal",
      badge: "Academics",
      desc: "Assigned batch schedules, subject rosters, student registers, and daily digital class attendance tracking.",
      icon: "🎓",
      color: "border-amber-200 bg-amber-50/50 text-amber-700"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-500 selection:text-white flex flex-col justify-between overflow-x-hidden">
      {/* Background Soft Glow Orbs */}
      <div className="fixed -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-indigo-200/40 blur-[140px] pointer-events-none -z-10"></div>
      <div className="fixed -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-purple-200/40 blur-[140px] pointer-events-none -z-10"></div>
      <div className="fixed top-1/3 right-10 h-[450px] w-[450px] rounded-full bg-blue-200/30 blur-[130px] pointer-events-none -z-10"></div>

      {/* Top Announcement Bar */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-900 text-white text-[11px] font-semibold py-2 px-4 text-center flex items-center justify-center gap-2 shadow-xs">
        <span className="bg-indigo-500 text-white px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider">v3.2 Update</span>
        <span>🎉 Multi-Brand Legal Allocation Engine, MSG91 WhatsApp Integration & AI Assistant are live!</span>
        <Link href="/login" className="underline font-bold text-indigo-200 hover:text-white ml-1">Sign In &rarr;</Link>
      </div>

      {/* Sticky Header Navbar */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-6 lg:px-12 py-3.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-md shadow-indigo-600/20 text-white font-extrabold text-base tracking-tight font-sans">
            CF
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight text-slate-800 font-sans leading-none">
              CoachFlow
            </span>
            <span className="text-[10px] font-bold text-indigo-600 tracking-widest uppercase mt-0.5">
              Enterprise ERP & CRM
            </span>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-slate-600">
          <a href="#features" className="hover:text-indigo-600 transition-colors">Interactive Modules</a>
          <a href="#deep-features" className="hover:text-indigo-600 transition-colors">Detailed Specs</a>
          <a href="#portals" className="hover:text-indigo-600 transition-colors">Portals</a>
          <a href="#faqs" className="hover:text-indigo-600 transition-colors">FAQs</a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-indigo-600 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 transition-all active:scale-[0.98]"
          >
            Access Portal &rarr;
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1">
        
        {/* HERO SECTION */}
        <section className="max-w-6xl mx-auto px-6 lg:px-12 pt-16 pb-20 text-center flex flex-col items-center">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-extrabold mb-6 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-indigo-600 animate-ping"></span>
            <span>The Complete ERP & CRM OS for Educational Franchises</span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl leading-tight sm:leading-tight">
            Scale Multi-Brand Institutes with <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">Zero Friction</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-sm sm:text-base font-medium text-slate-500 max-w-2xl leading-relaxed">
            Eliminate operational silos. Manage multi-company GST capacity caps, sales executive pipelines, automated WhatsApp EMI reminders, staff payroll, and live revenue reporting under one secure roof.
          </p>

          {/* Hero CTA Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="px-8 py-4 text-xs sm:text-sm font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/35 transition-all active:scale-[0.99] flex items-center gap-2"
            >
              <span>Launch Admin Portal</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <a
              href="#deep-features"
              className="px-8 py-4 text-xs sm:text-sm font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 rounded-2xl shadow-xs transition-all flex items-center gap-2"
            >
              <span>View All 6 Feature Specifications &rarr;</span>
            </a>
          </div>

          {/* Live Preview UI Card */}
          <div className="mt-14 w-full max-w-5xl bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-300/40 text-left relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-400"></span>
                <span className="h-3 w-3 rounded-full bg-amber-400"></span>
                <span className="h-3 w-3 rounded-full bg-emerald-400"></span>
                <span className="ml-2 text-xs font-bold text-slate-400">CoachFlow Live Executive Dashboard Preview</span>
              </div>
              <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                ● Live Database Sync
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Revenue</p>
                <p className="text-xl font-extrabold text-indigo-600 mt-1">₹48,50,000</p>
                <p className="text-[10px] font-semibold text-emerald-600 mt-1">↑ +18.4% vs last month</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confirmed Admissions</p>
                <p className="text-xl font-extrabold text-slate-800 mt-1">1,240 Students</p>
                <p className="text-[10px] font-semibold text-indigo-600 mt-1">Across 8 Brands</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Conversion Ratio</p>
                <p className="text-xl font-extrabold text-purple-600 mt-1">68.4%</p>
                <p className="text-[10px] font-semibold text-purple-600 mt-1">Sales Executive Velocity</p>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auto Allocation</p>
                <p className="text-xl font-extrabold text-emerald-600 mt-1">Active (Cap ₹19.5L)</p>
                <p className="text-[10px] font-semibold text-slate-500 mt-1">12 Companies Connected</p>
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl p-4 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-sm">
                  🤖
                </div>
                <div>
                  <p className="text-xs font-bold text-white">CashFlow AI Intelligence Bar</p>
                  <p className="text-[11px] text-slate-400">"All GST thresholds healthy. Sales Executives converted 42 new admissions today."</p>
                </div>
              </div>
              <Link href="/login" className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-extrabold rounded-xl shrink-0 transition-colors">
                Try AI Assistant &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* METRICS & ROI BAR */}
        <section id="metrics" className="bg-white border-y border-slate-200/80 py-12 px-6 lg:px-12">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-extrabold text-indigo-600 tracking-tight">99.9%</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">System Reliability</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-purple-600 tracking-tight">₹50M+</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Revenue Streamlined</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">100%</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">GST & Tax Compliance</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-rose-600 tracking-tight">&lt; 50ms</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Company Allocation</p>
            </div>
          </div>
        </section>

        {/* INTERACTIVE FEATURE SHOWCASE */}
        <section id="features" className="max-w-6xl mx-auto px-6 lg:px-12 py-20">
          <div className="text-center mb-12">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              Interactive Feature Demonstrator
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
              Built for Modern Multi-Brand Education Ecosystems
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-2 max-w-xl mx-auto">
              Select a module below to inspect CoachFlow&apos;s capabilities.
            </p>
          </div>

          {/* Tab Selection Navigation */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar pb-4 mb-8">
            {featureTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shrink-0 cursor-pointer border ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                    : "bg-white text-slate-600 border-slate-200/90 hover:bg-slate-100"
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
              <div className="bg-white border border-slate-200/90 rounded-3xl p-8 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-5">
                  <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border border-indigo-100">
                    {current.badge}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    {current.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                    {current.desc}
                  </p>

                  <div className="space-y-2.5 pt-2">
                    {current.bullets.map((b, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs font-semibold text-slate-700">
                        <span className="text-emerald-500 font-extrabold mt-0.5">✓</span>
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4">
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      <span>Try This Module in Portal</span>
                      <span>&rarr;</span>
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-slate-50 border border-slate-200/80 rounded-2xl p-6 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                    Module Performance Stats
                  </h4>
                  {current.previewStats.map((st, i) => (
                    <div key={i} className="flex items-center justify-between bg-white border border-slate-200/60 rounded-xl p-3.5 shadow-2xs">
                      <span className="text-xs font-semibold text-slate-600">{st.label}</span>
                      <span className="text-sm font-extrabold text-indigo-600">{st.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </section>

        {/* DEEP FEATURE SPECIFICATIONS GRID */}
        <section id="deep-features" className="bg-white border-y border-slate-200/80 py-20 px-6 lg:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                Complete Architecture Breakdown
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
                All Enterprise Features Explored in Detail
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-2 max-w-xl mx-auto">
                Explore the technical capabilities and automated workflows powering CoachFlow ERP.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {deepFeatureGrid.map((feat, idx) => (
                <div key={idx} className="bg-slate-50/70 border border-slate-200/80 rounded-3xl p-6 hover:shadow-xl hover:border-indigo-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-3xl">{feat.icon}</span>
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${feat.color}`}>
                        {feat.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900 mb-2">{feat.title}</h3>
                    <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed">{feat.description}</p>
                    
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
                      className="block w-full text-center py-2.5 bg-white hover:bg-indigo-600 hover:text-white text-slate-800 text-xs font-extrabold rounded-xl border border-slate-200 shadow-2xs transition-all"
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
        <section id="portals" className="bg-slate-100/70 border-b border-slate-200/80 py-20 px-6 lg:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-600 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
                Role-Based Workspaces
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
                Tailored Gateways for Every Team Member
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-2 max-w-lg mx-auto">
                Granular security and customized tools designed for specific organizational roles.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {portals.map((p, i) => (
                <div key={i} className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs hover:shadow-lg transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl">{p.icon}</span>
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${p.color}`}>
                        {p.badge}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-slate-800">{p.role}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                      {p.desc}
                    </p>
                  </div>
                  <div className="pt-6">
                    <Link
                      href="/login"
                      className="block w-full text-center py-2.5 bg-slate-50 hover:bg-indigo-600 hover:text-white text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all"
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
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between text-left cursor-pointer"
                  >
                    <span className="text-sm font-extrabold text-slate-800">{faq.q}</span>
                    <span className="text-indigo-600 font-extrabold text-base ml-2">{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <p className="mt-3 text-xs text-slate-500 font-medium leading-relaxed border-t border-slate-100 pt-3">
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
          <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-900 text-white rounded-3xl p-8 sm:p-12 shadow-2xl text-center relative overflow-hidden">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl"></div>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight relative z-10">
              Transform Your Institute Operations Today
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-indigo-200 max-w-xl mx-auto font-medium relative z-10">
              Join leading multi-brand educational organizations already managing admissions, revenue, and payroll effortlessly.
            </p>
            <div className="mt-8 flex justify-center relative z-10">
              <Link
                href="/login"
                className="px-8 py-4 bg-white text-indigo-950 hover:bg-slate-100 font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg transition-all active:scale-[0.99]"
              >
                Sign In to Enterprise Workspace &rarr;
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200/80 py-8 px-6 lg:px-12 text-center text-xs font-semibold text-slate-400">
        <div className="flex flex-col sm:flex-row items-center justify-between max-w-6xl mx-auto gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-indigo-600 text-white font-extrabold text-[10px] flex items-center justify-center">CF</div>
            <span className="text-slate-700 font-extrabold">CoachFlow ERP Suite</span>
          </div>
          <p>© {new Date().getFullYear()} CoachFlow Technologies. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-indigo-600 transition-colors">Portal Login</Link>
            <span>•</span>
            <span className="text-slate-400">v3.2.0 Production</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
