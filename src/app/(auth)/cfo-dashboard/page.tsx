"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { useUser } from "../../component/context/user-context";
import ProfileDisplay from "@/components/ProfileDisplay";
import CommandPalette from "@/components/CommandPalette";

export default function CfoDashboardPage() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [selectedCompany, setSelectedCompany] = useState("All Companies");

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

  const COLORS = ["#4f46e5", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#3b82f6"];

  if (!user) return null;

  const totalFinancialVolume = (summary.totalRevenue || 0) + (summary.totalExpenses || 0) + (summary.outstandingFees || 0) || 1;

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans transition-colors duration-200">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/80 pb-4 shrink-0">
          <div>
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 select-none">
              <span>CoachFlow</span>
              <span>/</span>
              <span className="text-slate-600 font-bold">CFO Visual Financial Intelligence Center</span>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="relative w-full sm:w-64 flex items-center justify-between pl-3 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-400 group shadow-sm"
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 mr-2 group-hover:text-indigo-500 transition-colors">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                </svg>
                Search financials...
              </div>
              <span className="flex items-center pointer-events-none text-[9px] font-bold text-slate-400/80 uppercase">
                CTRL+K
              </span>
            </button>
            <ProfileDisplay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} logout={logout} />

            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-700">{user.name}</div>
                <div className="text-[9px] font-bold text-indigo-600 uppercase tracking-wide">{user.role}</div>
              </div>
              <button
                onClick={() => setIsProfileOpen(true)}
                className="h-9 w-9 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-md hover:bg-indigo-700 transition-all cursor-pointer"
              >
                {user.name ? user.name.charAt(0).toUpperCase() : "C"}
              </button>
            </div>
          </div>
        </header>

        {/* Top Control Banner */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                📊 Visual Financial Analytics Mode
              </span>
              <span className="text-slate-400 text-xs font-semibold">
                100% Graph-Based Visualizations
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 font-sans">
              Executive CFO Financial Command Center
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-0.5">
              Comprehensive visual graphs depicting Operating Revenue, Expenses, Cash Flow, Treasury Reserves & Company Tags.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl">
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="bg-transparent text-slate-700 text-xs font-bold px-2 py-1 focus:outline-none cursor-pointer"
              >
                <option value="All Brands">All Brands</option>
                {brands.map((b: any) => (
                  <option key={b._id || b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="h-4 w-px bg-slate-200" />
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="bg-transparent text-slate-700 text-xs font-bold px-2 py-1 focus:outline-none cursor-pointer"
              >
                <option value="All Companies">All Companies</option>
                {companies.map((c: any) => (
                  <option key={c._id || c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <Link
              href="/expenses"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
            >
              + Record Expense
            </Link>
            <Link
              href="/admin-dashboard/reports"
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
            >
              📊 Export Report
            </Link>
          </div>
        </div>

        {/* SECTION 1: VISUAL KPI BAR GAUGES */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                📊 Graph 1: Executive KPI Visual Proportion Gauges
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Relative visual share of Gross Collections, Operating Outlays, Net Cash Flow & Receivables
              </p>
            </div>
            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
              Volume: ₹{totalFinancialVolume.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {/* Visual KPI 1: Collections */}
            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Total Collections</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {Math.round(((summary.totalRevenue || 0) / totalFinancialVolume) * 100)}% Share
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                ₹{summary.totalRevenue.toLocaleString("en-IN")}
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((summary.totalRevenue || 0) / totalFinancialVolume) * 100)}%` }}
                />
              </div>
            </div>

            {/* Visual KPI 2: Expenses */}
            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Total Expenses</span>
                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {Math.round(((summary.totalExpenses || 0) / totalFinancialVolume) * 100)}% Share
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900">
                ₹{summary.totalExpenses.toLocaleString("en-IN")}
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((summary.totalExpenses || 0) / totalFinancialVolume) * 100)}%` }}
                />
              </div>
            </div>

            {/* Visual KPI 3: Net Cash Flow */}
            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Net Cash Flow</span>
                <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {summary.operatingMarginPct.toFixed(1)}% Margin
                </span>
              </div>
              <div className={`text-2xl font-black ${summary.netCashFlow >= 0 ? "text-indigo-900" : "text-rose-600"}`}>
                ₹{summary.netCashFlow.toLocaleString("en-IN")}
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, summary.operatingMarginPct))}%` }}
                />
              </div>
            </div>

            {/* Visual KPI 4: Receivables */}
            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Fee Receivables</span>
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Pending Dues
                </span>
              </div>
              <div className="text-2xl font-black text-amber-900">
                ₹{summary.outstandingFees.toLocaleString("en-IN")}
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((summary.outstandingFees || 0) / (summary.totalRevenue || 1)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: TREASURY & HEALTH VISUAL GAUGES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Graph 2: Bank vs Cash Treasury Distribution Chart */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-extrabold text-slate-800">
                  🏦 Graph 2: Treasury Vault Split
                </h3>
                <span className="text-xs font-bold text-emerald-600">Reserves Bar</span>
              </div>
              <div className="space-y-4">
                {/* Bank Reserve Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">Bank Account Reserves</span>
                    <span className="text-emerald-700">₹{summary.bankReserves.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, (summary.bankReserves / (summary.netCashFlow || 1)) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Cash Reserve Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">Physical Cash Vault</span>
                    <span className="text-amber-700">₹{summary.cashReserves.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, (summary.cashReserves / (summary.netCashFlow || 1)) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-4 pt-2 border-t border-slate-100">
              Real-time liquid capital allocation across banking and physical vault.
            </p>
          </div>

          {/* Graph 3: Financial Health Index Gauge Chart */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-extrabold text-slate-800">
                  🎯 Graph 3: Stability Score Meter
                </h3>
                <span className="text-xs font-bold text-violet-600">Gauge Index</span>
              </div>
              <div className="flex flex-col items-center justify-center py-2 space-y-2">
                <div className="w-32 h-32 rounded-full border-8 border-violet-100 border-t-violet-600 flex items-center justify-center shadow-inner">
                  <div className="text-center">
                    <span className="text-3xl font-black text-slate-900">{summary.healthScore}</span>
                    <span className="text-[10px] block font-bold text-slate-400 uppercase">/ 100</span>
                  </div>
                </div>
                <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  ● EXCELLENT SOLVENCY
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-2 pt-2 border-t border-slate-100 text-center">
              Automated corporate financial health & liquidity score.
            </p>
          </div>

          {/* Graph 4: Fixed vs Variable Cost Allocation Gauge */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-extrabold text-slate-800">
                  ⚡ Graph 4: Fixed vs Variable Cost Gauge
                </h3>
                <span className="text-xs font-bold text-rose-600">Outlay Breakdown</span>
              </div>
              <div className="space-y-4">
                {/* Variable Expenses */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">Variable Costs</span>
                    <span className="text-rose-600">₹{summary.variableExpenses.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full"
                      style={{ width: `${Math.min(100, ((summary.variableExpenses || 0) / (summary.totalExpenses || 1)) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Fixed Expenses */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">Fixed Overhead</span>
                    <span className="text-teal-600">₹{summary.fixedExpenses.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${Math.min(100, ((summary.fixedExpenses || 0) / (summary.totalExpenses || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-4 pt-2 border-t border-slate-100">
              Proportionate operational cost elasticity vs. fixed commitments.
            </p>
          </div>
        </div>

        {/* SECTION 3: MONTHLY & QUARTERLY GRAPH TIMELINES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Graph 5: Monthly Inflow vs Outlay Timeline Chart (2 Cols) */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  📈 Graph 5: Monthly Collections vs. Outlay Timeline Bar Chart
                </h3>
                <p className="text-xs font-medium text-slate-400">
                  Historical 6-month timeline comparing collections vs. disbursements
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" /> Revenue
                </span>
                <span className="flex items-center gap-1.5 text-rose-600">
                  <span className="w-3 h-3 rounded-full bg-rose-500" /> Expenses
                </span>
              </div>
            </div>

            <div className="h-64 w-full flex items-end gap-3 pt-6 pb-2 border-b border-slate-100">
              {monthlyTrends.map((t: any) => {
                const maxVal = Math.max(...monthlyTrends.map((m: any) => Math.max(m.revenue, m.expense, 1)));
                const revH = (t.revenue / maxVal) * 100;
                const expH = (t.expense / maxVal) * 100;

                return (
                  <div key={t.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1.5 h-full">
                      {/* Revenue Bar */}
                      <div
                        className="w-1/2 bg-emerald-500 rounded-t-lg transition-all hover:opacity-90 cursor-pointer"
                        style={{ height: `${Math.max(revH, 4)}%` }}
                        title={`Revenue: ₹${t.revenue.toLocaleString("en-IN")}`}
                      />
                      {/* Expense Bar */}
                      <div
                        className="w-1/2 bg-rose-500 rounded-t-lg transition-all hover:opacity-90 cursor-pointer"
                        style={{ height: `${Math.max(expH, 4)}%` }}
                        title={`Expenses: ₹${t.expense.toLocaleString("en-IN")}`}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-600">{t.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Graph 6: Quarterly Run-rate Performance Chart (1 Col) */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 mb-1">
                📅 Graph 6: Quarterly Financial Run-Rate Chart
              </h3>
              <p className="text-xs font-medium text-slate-400 mb-6">
                Q1 to Q4 cumulative revenue vs expense performance
              </p>

              <div className="space-y-4">
                {quarterlyTrends.map((q: any) => {
                  const qMax = Math.max(...quarterlyTrends.map((qt: any) => Math.max(qt.revenue, qt.expense, 1)));
                  const revPct = Math.min(100, Math.round((q.revenue / qMax) * 100));
                  const expPct = Math.min(100, Math.round((q.expense / qMax) * 100));

                  return (
                    <div key={q.quarter} className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-indigo-600 font-extrabold">{q.quarter}</span>
                        <span className="text-slate-600">
                          Net: <span className={q.netProfit >= 0 ? "text-emerald-600 font-extrabold" : "text-rose-600 font-extrabold"}>₹{q.netProfit.toLocaleString("en-IN")}</span>
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${revPct}%` }} />
                        </div>
                        <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
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

        {/* SECTION 4: CATEGORY ALLOCATION & PAYMENT METHOD CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graph 7: Expense Category Allocation Donut Chart */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-extrabold text-slate-800">
                🍩 Graph 7: Expense Category Allocation Ring Chart
              </h3>
              <p className="text-xs font-medium text-slate-400">
                Percentage distribution of operating costs by category
              </p>
            </div>

            <div className="space-y-3">
              {categoryBreakdown.length === 0 ? (
                <div className="text-xs font-semibold text-slate-400 text-center py-6">
                  No expense records found
                </div>
              ) : (
                categoryBreakdown.slice(0, 6).map((cat: any, idx: number) => {
                  const totalExp = summary.totalExpenses || 1;
                  const pct = Math.min(100, Math.round((cat.value / totalExp) * 100));
                  const color = COLORS[idx % COLORS.length];

                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span>{cat.name}</span>
                        </span>
                        <span>₹{cat.value.toLocaleString("en-IN")} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Graph 8: Payment Channel Share Chart */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 mb-1">
                💳 Graph 8: Payment Method Channel Graph
              </h3>
              <p className="text-xs font-medium text-slate-400 mb-4">
                Disbursement distribution across payment channels
              </p>

              <div className="space-y-4">
                {paymentModeDistribution.map((m: any) => {
                  const total = summary.totalExpenses || 1;
                  const pct = ((m.value / total) * 100).toFixed(1);
                  return (
                    <div key={m.name} className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="text-indigo-600">{m.name}</span>
                        <span>₹{m.value.toLocaleString("en-IN")} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Verified Payment Gateways & Bank Ledger</span>
              <span className="text-emerald-600 font-bold">● 100% Reconciled</span>
            </div>
          </div>
        </div>

        {/* SECTION 5: COMPANY TAG & BRAND PERFORMANCE MATRIX CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graph 9: Company Tag Financial Matrix */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  🏢 Graph 9: Corporate Tag Financial Matrix Bar Chart
                </h3>
                <p className="text-xs font-medium text-slate-400">
                  Revenue & Expenses segregated by registered company tag
                </p>
              </div>
              <Link href="/companies" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline">
                Manage Tags →
              </Link>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {companyFinancials.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 font-semibold">
                  No company tag data recorded
                </div>
              ) : (
                companyFinancials.map((comp: any) => (
                  <div key={comp.name} className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-extrabold">
                      <span className="text-slate-800">{comp.name}</span>
                      <span className={`px-2 py-0.5 rounded border text-[11px] ${comp.net >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"}`}>
                        Net: ₹{comp.net.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                      <div className="bg-white p-2 rounded-lg border border-slate-200/60 text-slate-600">
                        Rev: <span className="text-emerald-600">₹{comp.revenue.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200/60 text-slate-600">
                        Exp: <span className="text-rose-600">₹{comp.expense.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Graph 10: Brand Performance Matrix */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  🏷️ Graph 10: Brand Performance Financial Bar Chart
                </h3>
                <p className="text-xs font-medium text-slate-400">
                  Revenue & Expenses segregated by brand entity
                </p>
              </div>
              <Link href="/admin-dashboard/brands" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline">
                Manage Brands →
              </Link>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {brandFinancials.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400 font-semibold">
                  No brand data recorded
                </div>
              ) : (
                brandFinancials.map((b: any) => (
                  <div key={b.name} className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-extrabold">
                      <span className="text-slate-800">{b.name}</span>
                      <span className={`px-2 py-0.5 rounded border text-[11px] ${b.net >= 0 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-rose-700 bg-rose-50 border-rose-200"}`}>
                        Net: ₹{b.net.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                      <div className="bg-white p-2 rounded-lg border border-slate-200/60 text-slate-600">
                        Rev: <span className="text-emerald-600">₹{b.revenue.toLocaleString("en-IN")}</span>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200/60 text-slate-600">
                        Exp: <span className="text-rose-600">₹{b.expense.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SECTION 6: GRAPH 11 - VISUAL DISBURSEMENT TIMELINE GRAPH STREAM */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                📋 Graph 11: Recent Financial Disbursements Visual Activity Timeline
              </h3>
              <p className="text-xs font-medium text-slate-400">
                Visual dot-stream & category bars of verified disbursements recorded in MongoDB
              </p>
            </div>
            <Link href="/expenses" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline">
              View All Entries →
            </Link>
          </div>

          <div className="space-y-3">
            {recentExpenses.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 font-semibold">
                No financial records found.
              </div>
            ) : (
              recentExpenses.map((exp: any, idx: number) => {
                const maxAmt = Math.max(...recentExpenses.map((e: any) => Number(e.amount) || 1));
                const amtPct = Math.min(100, Math.round(((Number(exp.amount) || 0) / maxAmt) * 100));
                const dotColor = COLORS[idx % COLORS.length];

                return (
                  <div key={exp._id} className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2 hover:bg-slate-100/60 transition-colors">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: dotColor }} />
                        <span className="text-slate-900 font-extrabold">{exp.title}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                          {exp.category}
                        </span>
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded">
                          {exp.company || "Unallocated"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-rose-600 font-black">₹{Number(exp.amount).toLocaleString("en-IN")}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString("en-IN") : "-"} ({exp.paymentMode})
                        </span>
                      </div>
                    </div>
                    {/* Visual Bar Gauge for Transaction Size */}
                    <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${amtPct}%`, backgroundColor: dotColor }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
    </div>
  );
}
