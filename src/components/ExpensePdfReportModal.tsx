"use client";

import React, { useRef } from "react";

interface ExpenseRecord {
  _id: string;
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  paymentMode: string;
  brand?: string;
  company?: string;
  bank?: string;
  expenseType?: "variable" | "fixed";
  recordedBy?: string;
  isRecurring?: boolean;
  remarks?: string;
}

interface ExpensePdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: ExpenseRecord[];
  filters: {
    category: string;
    brand: string;
    company: string;
    datePreset: string;
    startDate: string;
    endDate: string;
    searchQuery: string;
  };
}

export default function ExpensePdfReportModal({
  isOpen,
  onClose,
  expenses,
  filters,
}: ExpensePdfReportModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // ── 1. Calculate Financial Summaries & KPIs ──────────────────────────
  const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalCount = expenses.length;

  const variableExpenses = expenses.filter(
    (e) => (e.expenseType || "variable").toLowerCase() === "variable"
  );
  const fixedExpenses = expenses.filter(
    (e) => (e.expenseType || "").toLowerCase() === "fixed"
  );

  const variableTotal = variableExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const fixedTotal = fixedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const cashExpenses = expenses.filter(
    (e) => (e.paymentMode || "").toLowerCase() === "cash"
  );
  const cashTotal = cashExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const bankTotal = Math.max(0, totalAmount - cashTotal);

  // ── 2. Insight Graph Data Computations ──────────────────────────────

  // Graph 1: Category Breakdown (Top 7 Categories)
  const categoryMap: Record<string, { amount: number; count: number }> = {};
  expenses.forEach((e) => {
    const cat = e.category || "Misc";
    if (!categoryMap[cat]) categoryMap[cat] = { amount: 0, count: 0 };
    categoryMap[cat].amount += Number(e.amount) || 0;
    categoryMap[cat].count += 1;
  });

  const sortedCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 7);

  const maxCategoryAmt = Math.max(...sortedCategories.map((c) => c[1].amount), 1);

  // Graph 2: Payment Mode Distribution
  const paymentMap: Record<string, number> = {};
  expenses.forEach((e) => {
    const mode = e.paymentMode || "Cash";
    paymentMap[mode] = (paymentMap[mode] || 0) + (Number(e.amount) || 0);
  });

  const paymentColors: Record<string, string> = {
    Cash: "#f59e0b",
    UPI: "#10b981",
    "Bank Transfer": "#3b82f6",
    NEFT: "#6366f1",
    RTGS: "#8b5cf6",
    Cheque: "#ec4899",
    "Credit Card": "#06b6d4",
  };

  const paymentModes = Object.entries(paymentMap).sort((a, b) => b[1] - a[1]);

  // Graph 4: Brand Allocation Breakdown
  const brandMap: Record<string, number> = {};
  expenses.forEach((e) => {
    const b = e.brand && e.brand !== "All Brands" ? e.brand : "Unassigned Brand";
    brandMap[b] = (brandMap[b] || 0) + (Number(e.amount) || 0);
  });

  const brandBreakdown = Object.entries(brandMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxBrandAmt = Math.max(...brandBreakdown.map((b) => b[1]), 1);

  // ── 3. Print Action Handler ──────────────────────────────────────────
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // ── 4. Server API PDF Download Handler ─────────────────────────────
  const handleDownloadApiPdf = () => {
    const params = new URLSearchParams();
    if (filters.category && filters.category !== "All") params.append("category", filters.category);
    if (filters.brand && filters.brand !== "All Brands" && filters.brand !== "All") params.append("brand", filters.brand);
    if (filters.company && filters.company !== "All Companies" && filters.company !== "All") params.append("company", filters.company);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    if (filters.searchQuery) params.append("search", filters.searchQuery);

    const url = `/api/expenses/pdf?${params.toString()}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      {/* CSS @media print layout for pixel-perfect PDF export */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #expense-pdf-print-area,
          #expense-pdf-print-area * {
            visibility: visible !important;
          }
          #expense-pdf-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Controls Header (no-print) */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between no-print shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-indigo-600 flex items-center justify-center font-black text-sm shadow-md">
              📄
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Operational Expense Intelligence PDF Report</h2>
              <p className="text-xs text-slate-400 font-medium">Preview, print, or download visual executive report</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231a1.125 1.125 0 01-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.085 48.085 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.085 48.085 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.656" />
              </svg>
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={handleDownloadApiPdf}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>Download PDF File</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer text-sm font-bold ml-2"
              title="Close Modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable PDF Content Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-50/50 space-y-6" id="expense-pdf-print-area" ref={printRef}>
          {/* ── REPORT COVER & BRAND BANNER ──────────────────────────────── */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/30 mb-2">
                <span>CoachFlow ERP</span>
                <span>•</span>
                <span>Financial Intelligence Suite</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">OPERATIONAL EXPENSE EXECUTIVE REPORT</h1>
              <p className="text-xs text-slate-300 font-medium mt-1">Comprehensive Operational Expenditure Scorecard & Audit Trail</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15 text-right shrink-0 min-w-[200px]">
              <div className="text-[10px] font-bold text-slate-300 uppercase">REPORT METADATA</div>
              <div className="text-xs font-black text-emerald-400 mt-0.5">
                Generated: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
              <div className="text-[11px] font-semibold text-slate-200 mt-0.5">
                Filter: <span className="text-indigo-200 font-bold">{filters.brand || "All Brands"}</span> | <span className="text-indigo-200 font-bold">{filters.category || "All Categories"}</span>
              </div>
            </div>
          </div>

          {/* ── KPI SCORECARD GRID ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Operational Spend</span>
              <div className="text-xl font-black text-rose-600 mt-1">₹{totalAmount.toLocaleString("en-IN")}</div>
              <div className="text-[10px] font-bold text-slate-400 mt-1">{totalCount} Total Billed Vouchers</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Variable Expenses</span>
              <div className="text-xl font-black text-purple-600 mt-1">₹{variableTotal.toLocaleString("en-IN")}</div>
              <div className="text-[10px] font-bold text-slate-400 mt-1">
                {totalAmount > 0 ? ((variableTotal / totalAmount) * 100).toFixed(1) : 0}% Share of Total
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fixed Expenses</span>
              <div className="text-xl font-black text-indigo-600 mt-1">₹{fixedTotal.toLocaleString("en-IN")}</div>
              <div className="text-[10px] font-bold text-slate-400 mt-1">
                {totalAmount > 0 ? ((fixedTotal / totalAmount) * 100).toFixed(1) : 0}% Share of Total
              </div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Digital vs Cash Ratio</span>
              <div className="text-xl font-black text-emerald-600 mt-1">
                {totalAmount > 0 ? ((bankTotal / totalAmount) * 100).toFixed(0) : 0}% Bank
              </div>
              <div className="text-[10px] font-bold text-slate-400 mt-1">
                Cash Payouts: ₹{cashTotal.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {/* ── MULTIPLE INSIGHT GRAPHS SECTION ──────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                Financial Insight Analytics & Breakdown Charts
              </h3>
              <span className="text-[11px] font-bold text-slate-400">Multi-Dimensional Analysis</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* GRAPH 1: Top Category Spend Allocation */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📊</span> Graph 1: Category Spend Breakdown
                  </h4>
                  <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    Top {sortedCategories.length} Categories
                  </span>
                </div>

                <div className="space-y-2.5 pt-1">
                  {sortedCategories.map(([cat, data], idx) => {
                    const pct = totalAmount > 0 ? ((data.amount / totalAmount) * 100).toFixed(1) : "0.0";
                    const widthPct = Math.max(8, Math.round((data.amount / maxCategoryAmt) * 100));
                    const colors = [
                      "from-indigo-600 to-indigo-400",
                      "from-rose-600 to-rose-400",
                      "from-purple-600 to-purple-400",
                      "from-emerald-600 to-emerald-400",
                      "from-amber-600 to-amber-400",
                      "from-blue-600 to-blue-400",
                      "from-pink-600 to-pink-400",
                    ];
                    const grad = colors[idx % colors.length];

                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span className="truncate max-w-[170px]">{cat}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-semibold text-[10px]">{pct}%</span>
                            <span className="text-slate-900 font-extrabold">₹{data.amount.toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
                          <div
                            className={`bg-gradient-to-r ${grad} h-full rounded-full transition-all`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* GRAPH 2: Payment Mode Breakdown */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>💳</span> Graph 2: Payment Mode Distribution
                  </h4>
                  <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {paymentModes.length} Modes Active
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  {paymentModes.map(([mode, amt]) => {
                    const pct = totalAmount > 0 ? ((amt / totalAmount) * 100).toFixed(1) : "0.0";
                    const color = paymentColors[mode] || "#64748b";

                    return (
                      <div key={mode} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-xs font-bold text-slate-800">{mode}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-slate-900">₹{amt.toLocaleString("en-IN")}</div>
                          <div className="text-[10px] font-bold text-slate-400">{pct}% Share</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* GRAPH 3: Variable vs Fixed Nature Comparison */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚖️</span> Graph 3: Variable vs. Fixed Expenses
                  </h4>
                  <span className="text-[10px] font-extrabold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
                    Cost Nature Breakdown
                  </span>
                </div>

                <div className="pt-2 space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-purple-700">Variable Expenses</span>
                      <span className="text-slate-900 font-extrabold">₹{variableTotal.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-pink-500 h-full rounded-full"
                        style={{ width: `${totalAmount > 0 ? (variableTotal / totalAmount) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold">Includes materials, conveyance, ad recharges & operational variance</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-indigo-700">Fixed Expenses</span>
                      <span className="text-slate-900 font-extrabold">₹{fixedTotal.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-600 to-blue-500 h-full rounded-full"
                        style={{ width: `${totalAmount > 0 ? (fixedTotal / totalAmount) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold">Includes salaries, office rent, loans & subscriptions</p>
                  </div>
                </div>
              </div>

              {/* GRAPH 4: Brand & Company Allocation */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🏢</span> Graph 4: Brand Tag Allocation
                  </h4>
                  <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    Top Tagged Brands
                  </span>
                </div>

                <div className="space-y-2.5 pt-1">
                  {brandBreakdown.map(([brandName, amt]) => {
                    const widthPct = Math.max(10, Math.round((amt / maxBrandAmt) * 100));
                    return (
                      <div key={brandName} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span className="truncate max-w-[170px]">{brandName}</span>
                          <span className="text-slate-900 font-extrabold">₹{amt.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full rounded-full"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── EXPENSE DETAILED REGISTER TABLE ──────────────────────────── */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  📋 Expense Detailed Transaction Register
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Audit-ready register of vouchers</p>
              </div>
              <span className="text-xs font-extrabold bg-slate-100 text-slate-700 px-3 py-1 rounded-lg">
                {totalCount} Total Entries
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-extrabold uppercase tracking-wider">
                    <th className="py-2.5 px-3 rounded-l-lg text-center">S.No</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Title / Description</th>
                    <th className="py-2.5 px-3 text-right">Debit Amount</th>
                    <th className="py-2.5 px-3">Payment Mode</th>
                    <th className="py-2.5 px-3">Brand Tag</th>
                    <th className="py-2.5 px-3">Company</th>
                    <th className="py-2.5 px-3 rounded-r-lg">Nature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-400">
                        No expense records found.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp, idx) => (
                      <tr key={exp._id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                        <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-900">
                          {exp.expenseDate
                            ? new Date(exp.expenseDate).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border border-rose-100">
                            {exp.category || "Misc"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{exp.title}</td>
                        <td className="py-2.5 px-3 text-right font-black text-rose-600 whitespace-nowrap">
                          ₹{(Number(exp.amount) || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-600 whitespace-nowrap">{exp.paymentMode || "Cash"}</td>
                        <td className="py-2.5 px-3 text-slate-600">{exp.brand || "-"}</td>
                        <td className="py-2.5 px-3 text-slate-600">{exp.company || "-"}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                              exp.expenseType === "fixed"
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {exp.expenseType || "variable"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-900">
                    <td colSpan={4} className="py-3 px-4 rounded-l-lg uppercase tracking-wider">
                      GRAND TOTAL OPERATIONAL EXPENDITURE
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400 text-sm">
                      ₹{totalAmount.toLocaleString("en-IN")}
                    </td>
                    <td colSpan={4} className="py-3 px-3 rounded-r-lg text-right text-[11px] font-normal text-slate-300">
                      {totalCount} Transactions Audited
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ── FOOTER STAMP & SIGNATURE AREA ────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 pt-4 text-[10px] text-slate-400 font-semibold gap-2">
            <div>CoachFlow ERP Financial Reporting Suite • Confidential Internal Audit Report</div>
            <div>Authorized Financial Controller Stamp & Signature</div>
          </div>
        </div>
      </div>
    </div>
  );
}
