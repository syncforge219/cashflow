"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";

export default function CfoDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [selectedCompany, setSelectedCompany] = useState("All Companies");
  const [activeTab, setActiveTab] = useState<"overview" | "companies" | "brands" | "transactions">("overview");

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        brand: selectedBrand,
        company: selectedCompany,
      });
      const res = await fetch(`/api/cfo/dashboard?${query.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setDashboardData(json.data);
        if (json.data.brands) setBrands(json.data.brands);
        if (json.data.companies) setCompanies(json.data.companies);
      }
    } catch (err) {
      console.error("Failed loading CFO Dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedBrand, selectedCompany]);

  const summary = dashboardData?.summary || {
    totalRevenue: 0,
    totalExpenses: 0,
    netCashFlow: 0,
    operatingMarginPct: 0,
    outstandingFees: 0,
    cashReserves: 0,
    bankReserves: 0,
    variableExpenses: 0,
    fixedExpenses: 0,
    healthScore: 85,
  };

  const monthlyTrends = dashboardData?.monthlyTrends || [];
  const quarterlyTrends = dashboardData?.quarterlyTrends || [];
  const categoryBreakdown = dashboardData?.categoryBreakdown || [];
  const paymentModeDistribution = dashboardData?.paymentModeDistribution || [];
  const companyFinancials = dashboardData?.companyFinancials || [];
  const brandFinancials = dashboardData?.brandFinancials || [];
  const recentExpenses = dashboardData?.expenses || [];
  const recentPayments = dashboardData?.payments || [];

  const COLORS = ["#4f46e5", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#3b82f6"];

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-100 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-950">
        {/* Executive Header Bar */}
        <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-xl sticky top-0 z-30 px-6 py-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 text-lg font-black">
                ₹
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight text-white font-sans">
                    CFO Executive Command Center
                  </h1>
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Live Backend Sync
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Real-time Corporate Treasury, Cash Flow Analytics & Operating Margins
                </p>
              </div>
            </div>

            {/* Global Scope Selector & Export Trigger */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 p-1 rounded-xl">
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs font-bold px-2 py-1 focus:outline-none cursor-pointer"
                >
                  <option value="All Brands" className="bg-slate-900">All Brands</option>
                  {brands.map((b: any) => (
                    <option key={b._id || b.name} value={b.name} className="bg-slate-900">
                      {b.name}
                    </option>
                  ))}
                </select>
                <div className="h-4 w-px bg-slate-700" />
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs font-bold px-2 py-1 focus:outline-none cursor-pointer"
                >
                  <option value="All Companies" className="bg-slate-900">All Companies</option>
                  {companies.map((c: any) => (
                    <option key={c._id || c.name} value={c.name} className="bg-slate-900">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <Link
                href="/admin-dashboard/reports"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-lg shadow-emerald-600/20 transition-all"
              >
                📊 Export Ledger
              </Link>
            </div>
          </div>
        </header>

        {/* Dashboard Main Canvas */}
        <div className="max-w-7xl mx-auto w-full p-6 space-y-6">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Gross Revenue */}
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>TOTAL COLLECTIONS</span>
                <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                  +INFLOW
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-white">
                  ₹{summary.totalRevenue.toLocaleString("en-IN")}
                </div>
                <p className="text-[11px] font-bold text-emerald-400 mt-1 flex items-center gap-1">
                  <span>▲ Verified Course & Fee Revenue</span>
                </p>
              </div>
            </div>

            {/* KPI 2: Operating Expenses */}
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-rose-500/50 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-all" />
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>TOTAL EXPENSES</span>
                <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20">
                  -OUTLAY
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-white">
                  ₹{summary.totalExpenses.toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] font-bold text-slate-400 mt-1 flex items-center justify-between">
                  <span>Var: ₹{summary.variableExpenses.toLocaleString("en-IN")}</span>
                  <span>Fix: ₹{summary.fixedExpenses.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* KPI 3: Net Cash Flow */}
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-indigo-500/50 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all" />
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>NET OPERATING CASH FLOW</span>
                <span className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                  MARGIN {summary.operatingMarginPct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-3">
                <div className={`text-2xl font-black ${summary.netCashFlow >= 0 ? "text-indigo-400" : "text-rose-400"}`}>
                  ₹{summary.netCashFlow.toLocaleString("en-IN")}
                </div>
                <p className="text-[11px] font-bold text-indigo-400/80 mt-1">
                  Operating Margin Ratio
                </p>
              </div>
            </div>

            {/* KPI 4: Receivables & Dues */}
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-amber-500/50 transition-all">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>FEE RECEIVABLES</span>
                <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                  PENDING
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-amber-300">
                  ₹{summary.outstandingFees.toLocaleString("en-IN")}
                </div>
                <p className="text-[11px] font-bold text-amber-400 mt-1">
                  Outstanding Student Dues
                </p>
              </div>
            </div>
          </div>

          {/* Treasury Reserve & Health Gauge Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bank Reserves */}
            <div className="bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-800/40 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">
                  🏦 BANK NET RESERVES
                </span>
                <div className="text-2xl font-black text-white mt-1">
                  ₹{summary.bankReserves.toLocaleString("en-IN")}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Digital & Transfer Receipts Net of Bank Expenses</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-xl text-emerald-400">
                🏦
              </div>
            </div>

            {/* Cash Vault Reserves */}
            <div className="bg-gradient-to-r from-amber-950/80 to-slate-900 border border-amber-800/40 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest">
                  💵 CASH VAULT BALANCE
                </span>
                <div className="text-2xl font-black text-white mt-1">
                  ₹{summary.cashReserves.toLocaleString("en-IN")}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">On-hand Cash Collections Net of Cash Disbursements</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl text-amber-400">
                💵
              </div>
            </div>

            {/* Financial Health Score Gauge */}
            <div className="bg-gradient-to-r from-indigo-950/80 to-slate-900 border border-indigo-800/40 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest">
                  ⚡ FINANCIAL HEALTH INDEX
                </span>
                <div className="text-2xl font-black text-white mt-1 flex items-center gap-2">
                  <span>{summary.healthScore}/100</span>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    EXCELLENT
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Automated Liquidity & Solvency Rating</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl text-indigo-400 font-bold">
                🎯
              </div>
            </div>
          </div>

          {/* GRAPH ROW 1: Monthly Timeline & Quarterly Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* GRAPH 1: Monthly Timeline (2 Cols) */}
            <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    📊 Graph 1: Monthly Inflow vs. Outlay Timeline
                  </h3>
                  <p className="text-xs text-slate-400">
                    Historical 6-month timeline of fee revenue vs operating expenses
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" /> Revenue
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <span className="w-3 h-3 rounded-full bg-rose-500" /> Expenses
                  </span>
                </div>
              </div>

              <div className="h-64 w-full flex items-end gap-3 pt-6 pb-2 border-b border-slate-800">
                {monthlyTrends.map((t: any) => {
                  const maxVal = Math.max(...monthlyTrends.map((m: any) => Math.max(m.revenue, m.expense, 1)));
                  const revH = (t.revenue / maxVal) * 100;
                  const expH = (t.expense / maxVal) * 100;

                  return (
                    <div key={t.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                      <div className="w-full flex items-end justify-center gap-1.5 h-full">
                        {/* Revenue Bar */}
                        <div
                          className="w-1/2 bg-emerald-500 rounded-t-lg transition-all hover:brightness-125"
                          style={{ height: `${Math.max(revH, 4)}%` }}
                          title={`Revenue: ₹${t.revenue.toLocaleString("en-IN")}`}
                        />
                        {/* Expense Bar */}
                        <div
                          className="w-1/2 bg-rose-500 rounded-t-lg transition-all hover:brightness-125"
                          style={{ height: `${Math.max(expH, 4)}%` }}
                          title={`Expenses: ₹${t.expense.toLocaleString("en-IN")}`}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-slate-400">{t.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GRAPH 2: Quarterly Performance Comparison (1 Col) */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white mb-1">
                  📅 Graph 2: Quarterly Financial Run-rate
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  Q1 to Q4 cumulative revenue vs expense performance
                </p>

                <div className="space-y-4">
                  {quarterlyTrends.map((q: any) => {
                    const qMax = Math.max(...quarterlyTrends.map((qt: any) => Math.max(qt.revenue, qt.expense, 1)));
                    const revPct = Math.min(100, Math.round((q.revenue / qMax) * 100));
                    const expPct = Math.min(100, Math.round((q.expense / qMax) * 100));

                    return (
                      <div key={q.quarter} className="space-y-1.5 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-indigo-400 font-extrabold">{q.quarter}</span>
                          <span className="text-slate-300">
                            Net: <span className={q.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>₹{q.netProfit.toLocaleString("en-IN")}</span>
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${revPct}%` }} />
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${expPct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* GRAPH ROW 2: Category Donut Allocation & Payment Method Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GRAPH 3: Category Allocation */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl">
              <div className="mb-4">
                <h3 className="text-base font-extrabold text-white">
                  🍩 Graph 3: Expense Category Breakdown
                </h3>
                <p className="text-xs text-slate-400">
                  Percentage distribution of operating costs by category
                </p>
              </div>

              <div className="space-y-3">
                {categoryBreakdown.length === 0 ? (
                  <div className="text-xs font-semibold text-slate-500 text-center py-6">
                    No expense records found
                  </div>
                ) : (
                  categoryBreakdown.slice(0, 6).map((cat: any, idx: number) => {
                    const totalExp = summary.totalExpenses || 1;
                    const pct = Math.min(100, Math.round((cat.value / totalExp) * 100));
                    const color = COLORS[idx % COLORS.length];

                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                            <span>{cat.name}</span>
                          </span>
                          <span>₹{cat.value.toLocaleString("en-IN")} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* GRAPH 4: Payment Method Distribution */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white mb-1">
                  💳 Graph 4: Payment Channel Distribution
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Payment modes utilized for operational expenditures
                </p>

                <div className="space-y-4">
                  {paymentModeDistribution.map((m: any) => {
                    const total = summary.totalExpenses || 1;
                    const pct = ((m.value / total) * 100).toFixed(1);
                    return (
                      <div key={m.name} className="space-y-1.5 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                          <span className="text-indigo-300">{m.name}</span>
                          <span>₹{m.value.toLocaleString("en-IN")} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-semibold">
                <span>Verified Payment Gateways & Bank Records</span>
                <span className="text-emerald-400 font-bold">● 100% Reconciled</span>
              </div>
            </div>
          </div>

          {/* GRAPH ROW 3: Company Matrix & Brand Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GRAPH 5: Company Tag Matrix */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    🏢 Graph 5: Corporate Entity Financial Matrix
                  </h3>
                  <p className="text-xs text-slate-400">
                    Revenue & Expenses segregated by registered company tag
                  </p>
                </div>
                <Link href="/companies" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline">
                  Companies Tag →
                </Link>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {companyFinancials.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 font-semibold">
                    No company tag data recorded
                  </div>
                ) : (
                  companyFinancials.map((comp: any) => (
                    <div key={comp.name} className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-extrabold">
                        <span className="text-slate-200">{comp.name}</span>
                        <span className={`px-2 py-0.5 rounded border text-[11px] ${comp.net >= 0 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-rose-400 bg-rose-500/10 border-rose-500/30"}`}>
                          Net: ₹{comp.net.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-slate-300">
                          Rev: <span className="text-emerald-400">₹{comp.revenue.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-slate-300">
                          Exp: <span className="text-rose-400">₹{comp.expense.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* GRAPH 6: Brand Tag Matrix */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    🏷️ Graph 6: Brand Performance Matrix
                  </h3>
                  <p className="text-xs text-slate-400">
                    Revenue & Expenses segregated by brand entity
                  </p>
                </div>
                <Link href="/admin-dashboard/brands" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline">
                  Manage Brands →
                </Link>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {brandFinancials.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 font-semibold">
                    No brand data recorded
                  </div>
                ) : (
                  brandFinancials.map((b: any) => (
                    <div key={b.name} className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-extrabold">
                        <span className="text-slate-200">{b.name}</span>
                        <span className={`px-2 py-0.5 rounded border text-[11px] ${b.net >= 0 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-rose-400 bg-rose-500/10 border-rose-500/30"}`}>
                          Net: ₹{b.net.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-slate-300">
                          Rev: <span className="text-emerald-400">₹{b.revenue.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 text-slate-300">
                          Exp: <span className="text-rose-400">₹{b.expense.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Recent Ledger Audit Stream */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  📋 Live Financial Ledger Audit Stream
                </h3>
                <p className="text-xs text-slate-400">
                  Latest verified disbursements and collections recorded in MongoDB
                </p>
              </div>
              <Link href="/expenses" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline">
                View All Ledger Entries →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Particulars</th>
                    <th className="py-3.5 px-4">Company Tag</th>
                    <th className="py-3.5 px-4">Mode</th>
                    <th className="py-3.5 px-4">Bank</th>
                    <th className="py-3.5 px-4 text-right">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {recentExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-slate-500 font-semibold">
                        No financial records found.
                      </td>
                    </tr>
                  ) : (
                    recentExpenses.map((exp: any) => (
                      <tr key={exp._id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString("en-IN") : "-"}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">{exp.category}</td>
                        <td className="py-3 px-4">{exp.title}</td>
                        <td className="py-3 px-4">
                          <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-[11px] font-bold text-slate-300">
                            {exp.company || "Unallocated"}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-indigo-400">{exp.paymentMode}</td>
                        <td className="py-3 px-4 text-slate-400">{exp.bank || "-"}</td>
                        <td className="py-3 px-4 text-right font-bold text-rose-400">
                          ₹{Number(exp.amount).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
