"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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
  const recentPayments = dashboardData?.payments || [];

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
                  <span>Variable: ₹{summary.variableExpenses.toLocaleString("en-IN")}</span>
                  <span>Fixed: ₹{summary.fixedExpenses.toLocaleString("en-IN")}</span>
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
            {/* Chart 1: Revenue vs Expense Monthly Trend (2 Cols) */}
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
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
                  Last 6 Months
                </span>
              </div>

              <div className="h-72 w-full">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400 animate-pulse">
                    Loading trend analytics...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyTrends}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 600 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, ""]}
                        contentStyle={{ borderRadius: "12px", fontSize: "12px", fontWeight: "bold" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px", fontWeight: "bold" }} />
                      <Area type="monotone" dataKey="revenue" name="Fee Revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="expense" name="Expenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorExp)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Category Expense Allocation (1 Col) */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col">
              <div className="mb-4">
                <h3 className="text-base font-extrabold text-slate-800">
                  🍩 Expense Category Share
                </h3>
                <p className="text-xs font-medium text-slate-400">
                  Operational expenditure distribution by category
                </p>
              </div>

              <div className="h-56 w-full flex items-center justify-center">
                {loading ? (
                  <div className="text-xs font-bold text-slate-400 animate-pulse">
                    Loading categories...
                  </div>
                ) : categoryBreakdown.length === 0 ? (
                  <div className="text-xs font-semibold text-slate-400">No expense records</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {categoryBreakdown.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Amount"]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Category Legend List */}
              <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {categoryBreakdown.slice(0, 5).map((cat: any, idx: number) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-slate-700 truncate max-w-[120px]">{cat.name}</span>
                    </div>
                    <span className="font-bold text-slate-900">₹{cat.value.toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Company Financial Performance & Payment Mode Share */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 3: Company Tag Financial Matrix */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    🏢 Company Tag Financial Breakdown
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

              <div className="h-64 w-full">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-xs font-bold text-slate-400 animate-pulse">
                    Loading company metrics...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={companyFinancials}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, ""]} />
                      <Legend wrapperStyle={{ fontSize: "12px", fontWeight: "bold" }} />
                      <Bar dataKey="revenue" name="Revenue Billed" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="expense" name="Expenses Billed" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Payment Mode Share & Quick Export */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 mb-1">
                  💳 Payment Method Distribution
                </h3>
                <p className="text-xs font-medium text-slate-400 mb-4">
                  Payment modes utilized for operational expenditures
                </p>

                <div className="space-y-3">
                  {paymentModeDistribution.map((m: any, idx: number) => {
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
