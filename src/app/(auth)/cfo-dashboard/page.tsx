"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";

export default function CfoDashboardPage() {
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
  };

  const monthlyTrends = dashboardData?.monthlyTrends || [];
  const categoryBreakdown = dashboardData?.categoryBreakdown || [];
  const paymentModeDistribution = dashboardData?.paymentModeDistribution || [];
  const companyFinancials = dashboardData?.companyFinancials || [];
  const recentExpenses = dashboardData?.expenses || [];

  const COLORS = ["#4f46e5", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Executive Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  💼 CFO Executive Intelligence
                </span>
                <span className="text-slate-400 text-xs font-semibold">
                  Full Brand & Company Scope
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
                Financial Master Dashboard
              </h1>
              <p className="text-slate-300 text-xs font-medium mt-1">
                Real-time Operating Cash Flow, Revenue Analytics, Expense Control & Treasury Metrics.
              </p>
            </div>

            {/* Brand & Company Filter Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1">
                  Brand Scope
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="bg-slate-800/90 text-white border border-slate-700 text-xs font-bold rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="All Brands">All Brands</option>
                  {brands.map((b: any) => (
                    <option key={b._id || b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-1">
                  Company Tag
                </label>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="bg-slate-800/90 text-white border border-slate-700 text-xs font-bold rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="All Companies">All Companies</option>
                  {companies.map((c: any) => (
                    <option key={c._id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4">
                <Link
                  href="/expenses"
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
                >
                  + Record Expense
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div className="max-w-7xl mx-auto w-full p-6 space-y-6">
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Gross Fee Revenue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Collections
                </span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 font-extrabold text-sm">
                  ₹
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">
                  ₹{summary.totalRevenue.toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
                  <span>▲ Billed Revenue</span>
                </div>
              </div>
            </div>

            {/* Card 2: Total Operational Expenses */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Expenses
                </span>
                <span className="p-2 rounded-xl bg-rose-50 text-rose-600 font-extrabold text-sm">
                  💸
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900">
                  ₹{summary.totalExpenses.toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] font-bold text-slate-500 mt-1 flex items-center justify-between">
                  <span>Var: ₹{summary.variableExpenses.toLocaleString("en-IN")}</span>
                  <span>Fix: ₹{summary.fixedExpenses.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Card 3: Net Cash Flow & Operating Margin */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Net Operating Cash Flow
                </span>
                <span className={`p-2 rounded-xl text-sm font-bold ${summary.netCashFlow >= 0 ? "bg-indigo-50 text-indigo-600" : "bg-rose-50 text-rose-600"}`}>
                  ⚖️
                </span>
              </div>
              <div className="mt-3">
                <div className={`text-2xl font-black ${summary.netCashFlow >= 0 ? "text-indigo-900" : "text-rose-600"}`}>
                  ₹{summary.netCashFlow.toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] font-bold text-indigo-600 mt-1">
                  Margin: {summary.operatingMarginPct.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Card 4: Outstanding Receivables */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Fee Receivables
                </span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-600 font-extrabold text-sm">
                  ⏳
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-amber-900">
                  ₹{summary.outstandingFees.toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] font-bold text-amber-600 mt-1">
                  Pending Student Dues
                </div>
              </div>
            </div>
          </div>

          {/* Treasury Reserve Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-950 text-white p-5 rounded-2xl border border-emerald-800/40 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                  🏦 Bank Account Net Reserves
                </span>
                <div className="text-2xl font-black text-white mt-1">
                  ₹{summary.bankReserves.toLocaleString("en-IN")}
                </div>
                <p className="text-xs text-emerald-300/80 mt-0.5">Digital & Bank Transfer Collections Net of Bank Expenses</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-800/50 flex items-center justify-center text-xl font-bold">
                🏦
              </div>
            </div>

            <div className="bg-amber-950 text-white p-5 rounded-2xl border border-amber-800/40 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">
                  💵 Physical Cash Vault Balance
                </span>
                <div className="text-2xl font-black text-white mt-1">
                  ₹{summary.cashReserves.toLocaleString("en-IN")}
                </div>
                <p className="text-xs text-amber-300/80 mt-0.5">On-Hand Cash Revenue Net of Cash Operating Disbursements</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-amber-800/50 flex items-center justify-center text-xl font-bold">
                💵
              </div>
            </div>
          </div>

          {/* Graphical Visual Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Revenue vs Expense Monthly Trend */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    📈 Revenue vs. Expense Monthly Trend
                  </h3>
                  <p className="text-xs font-medium text-slate-400">
                    Comparative timeline of collections vs. operating disbursements
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-3 h-3 rounded bg-emerald-500"></span> Fee Revenue
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-500">
                    <span className="w-3 h-3 rounded bg-rose-500"></span> Expenses
                  </span>
                </div>
              </div>

              <div className="h-64 w-full flex items-end gap-3 pt-8 pb-4 px-2 border-b border-slate-100">
                {monthlyTrends.map((t: any) => {
                  const maxVal = Math.max(...monthlyTrends.map((m: any) => Math.max(m.revenue, m.expense, 1)));
                  const revH = (t.revenue / maxVal) * 100;
                  const expH = (t.expense / maxVal) * 100;

                  return (
                    <div key={t.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                      <div className="w-full flex items-end justify-center gap-1.5 h-full">
                        {/* Revenue Bar */}
                        <div
                          className="w-1/2 bg-emerald-500 rounded-t-lg transition-all hover:opacity-90 relative"
                          style={{ height: `${Math.max(revH, 4)}%` }}
                          title={`Revenue: ₹${t.revenue.toLocaleString("en-IN")}`}
                        />
                        {/* Expense Bar */}
                        <div
                          className="w-1/2 bg-rose-500 rounded-t-lg transition-all hover:opacity-90 relative"
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

            {/* Chart 2: Category Expense Share */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-extrabold text-slate-800">
                  🍩 Expense Category Share
                </h3>
                <p className="text-xs font-medium text-slate-400">
                  Operational expenditure distribution by category
                </p>
              </div>

              {/* Visual Category List */}
              <div className="space-y-3 flex-1 flex flex-col justify-center">
                {categoryBreakdown.length === 0 ? (
                  <div className="text-xs font-semibold text-slate-400 text-center py-8">
                    No expense records recorded yet
                  </div>
                ) : (
                  categoryBreakdown.slice(0, 5).map((cat: any, idx: number) => {
                    const totalExp = summary.totalExpenses || 1;
                    const pct = Math.min(100, Math.round((cat.value / totalExp) * 100));
                    const color = COLORS[idx % COLORS.length];

                    return (
                      <div key={cat.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                            <span className="truncate max-w-[130px]">{cat.name}</span>
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
          </div>

          {/* Company Financial Performance & Payment Method Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 3: Company Tag Financial Matrix */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    🏢 Company Tag Financial Matrix
                  </h3>
                  <p className="text-xs font-medium text-slate-400">
                    Revenue & Expenses segregated by registered corporate entity
                  </p>
                </div>
                <Link
                  href="/companies"
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                >
                  Manage Companies
                </Link>
              </div>

              <div className="space-y-4">
                {companyFinancials.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 font-semibold">
                    No company tag data available
                  </div>
                ) : (
                  companyFinancials.map((comp: any) => (
                    <div key={comp.name} className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800">{comp.name}</span>
                        <span className={`text-xs font-black ${comp.net >= 0 ? "text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200" : "text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200"}`}>
                          Net: ₹{comp.net.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-600">
                        <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                          Revenue: <span className="text-emerald-600">₹{comp.revenue.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/60">
                          Expenses: <span className="text-rose-600">₹{comp.expense.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payment Mode Share & Quick Export */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 mb-1">
                  💳 Payment Method Share
                </h3>
                <p className="text-xs font-medium text-slate-400 mb-4">
                  Disbursement distribution by mode of payment
                </p>

                <div className="space-y-3">
                  {paymentModeDistribution.map((m: any) => {
                    const total = summary.totalExpenses || 1;
                    const pct = ((m.value / total) * 100).toFixed(1);
                    return (
                      <div key={m.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span>{m.name}</span>
                          <span>₹{m.value.toLocaleString("en-IN")} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
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

              {/* Export Button */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  Full Multi-Sheet Excel Financial Audit
                </span>
                <Link
                  href="/admin-dashboard/reports"
                  className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-700/20"
                >
                  📊 Download Financial Excel Report
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Operational Expenses Stream */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  📋 Recent Operational Expense Disbursements
                </h3>
                <p className="text-xs font-medium text-slate-400">
                  Latest verified expenses recorded across corporate tags
                </p>
              </div>
              <Link
                href="/expenses"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
              >
                View All Expenses →
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold">
                <thead className="bg-slate-100/70 text-slate-600 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Company Tag</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Bank</th>
                    <th className="py-3 px-4 text-right">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {recentExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-slate-400 font-semibold">
                        No expense records found.
                      </td>
                    </tr>
                  ) : (
                    recentExpenses.map((exp: any) => (
                      <tr key={exp._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString("en-IN") : "-"}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{exp.category}</td>
                        <td className="py-3 px-4">{exp.title}</td>
                        <td className="py-3 px-4">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold text-slate-700">
                            {exp.company || "Unallocated"}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-indigo-600">{exp.paymentMode}</td>
                        <td className="py-3 px-4 text-slate-500">{exp.bank || "-"}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
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
