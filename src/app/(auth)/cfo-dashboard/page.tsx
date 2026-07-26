"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { useUser } from "../../component/context/user-context";
import ProfileDisplay from "@/components/ProfileDisplay";
import CommandPalette from "@/components/CommandPalette";

interface TooltipItem {
  name: string;
  value: number;
  pct?: number | string;
  category?: string;
}

// Helper to format values nicely above line graph nodes (e.g. ₹3.4L, ₹90k, ₹0)
function formatCompactRupees(val: number) {
  if (!val || val === 0) return "₹0";
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
  return `₹${val}`;
}

// --- UNIVERSAL SVG LINE GRAPH RENDERER FOR 100% LINE GRAPH DASHBOARD ---

function SvgLineGraph({
  data,
  width = 700,
  height = 240,
  color1 = "#10b981",
  color2 = "#ef4444",
  label1 = "Money In",
  label2 = "Money Out",
  rotateLabels = false,
  onHover,
  onLeave,
}: {
  data: { label: string; line1: number; line2?: number }[];
  width?: number;
  height?: number;
  color1?: string;
  color2?: string;
  label1?: string;
  label2?: string;
  rotateLabels?: boolean;
  onHover: (item: TooltipItem, e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => Math.max(d.line1 || 0, d.line2 || 0, 1)));
  const paddingLeft = 40;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = rotateLabels ? 70 : 35;

  const graphWidth = width - paddingLeft - paddingRight;
  const graphHeight = height - paddingTop - paddingBottom;

  const points1 = data.map((d, i) => {
    const x = paddingLeft + (i / Math.max(1, data.length - 1)) * graphWidth;
    const y = height - paddingBottom - ((d.line1 || 0) / maxVal) * graphHeight;
    return { x, y, val: d.line1, label: d.label };
  });

  const points2 = data.map((d, i) => {
    const x = paddingLeft + (i / Math.max(1, data.length - 1)) * graphWidth;
    const y = height - paddingBottom - ((d.line2 || 0) / maxVal) * graphHeight;
    return { x, y, val: d.line2, label: d.label };
  });

  const path1 = points1.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x},${p.y}`, "");
  const path2 = points2.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x},${p.y}`, "");

  const area1 = `${path1} L ${points1[points1.length - 1].x},${height - paddingBottom} L ${points1[0].x},${height - paddingBottom} Z`;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex items-center gap-4 text-xs font-bold mb-3">
        <span className="flex items-center gap-1.5 cursor-pointer" style={{ color: color1 }}>
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color1 }} /> {label1}
        </span>
        {data[0]?.line2 !== undefined && (
          <span className="flex items-center gap-1.5 cursor-pointer" style={{ color: color2 }}>
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color2 }} /> {label2}
          </span>
        )}
      </div>

      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Subtle Horizontal Grid Lines */}
        {[0.2, 0.5, 0.8].map((ratio, idx) => (
          <line
            key={idx}
            x1={paddingLeft}
            y1={height - paddingBottom - ratio * graphHeight}
            x2={width - paddingRight}
            y2={height - paddingBottom - ratio * graphHeight}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
          />
        ))}

        {/* Straight Baseline Origin Line */}
        <line
          x1={paddingLeft - 10}
          y1={height - paddingBottom}
          x2={width - paddingRight + 10}
          y2={height - paddingBottom}
          stroke="#94a3b8"
          strokeWidth="2"
        />

        {/* Line 1 Area Gradient */}
        <defs>
          <linearGradient id={`lineGrad-${label1.replace(/\s+/g, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color1} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color1} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <path d={area1} fill={`url(#lineGrad-${label1.replace(/\s+/g, "")})`} />
        <path d={path1} fill="none" stroke={color1} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

        {data[0]?.line2 !== undefined && (
          <path d={path2} fill="none" stroke={color2} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 3" />
        )}

        {/* Line 1 Points */}
        {points1.map((p, i) => (
          <g key={`p1-${i}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r="6"
              fill={color1}
              className="transition-all hover:r-8 hover:opacity-80 cursor-pointer drop-shadow-sm"
              onMouseEnter={(e) => onHover({ name: `${p.label} (${label1})`, value: p.val, category: "LINE DATA" }, e)}
              onMouseMove={(e) => onHover({ name: `${p.label} (${label1})`, value: p.val, category: "LINE DATA" }, e)}
              onMouseLeave={onLeave}
            />
            {p.val > 0 && (
              <text x={p.x} y={p.y - 10} textAnchor="middle" fill={color1} fontSize="9" fontWeight="900">
                {formatCompactRupees(p.val)}
              </text>
            )}
          </g>
        ))}

        {/* Line 2 Points */}
        {data[0]?.line2 !== undefined &&
          points2.map((p, i) => (
            <g key={`p2-${i}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r="6"
                fill={color2}
                className="transition-all hover:r-8 hover:opacity-80 cursor-pointer drop-shadow-sm"
                onMouseEnter={(e) => onHover({ name: `${p.label} (${label2})`, value: p.val || 0, category: "LINE DATA" }, e)}
                onMouseMove={(e) => onHover({ name: `${p.label} (${label2})`, value: p.val || 0, category: "LINE DATA" }, e)}
                onMouseLeave={onLeave}
              />
              {(p.val || 0) > 0 && (
                <text x={p.x} y={p.y + 16} textAnchor="middle" fill={color2} fontSize="9" fontWeight="900">
                  {formatCompactRupees(p.val || 0)}
                </text>
              )}
            </g>
          ))}

        {/* X Axis Labels (Rotated for long names, horizontal for short labels) */}
        {data.map((d, i) => {
          const x = paddingLeft + (i / Math.max(1, data.length - 1)) * graphWidth;
          const y = height - paddingBottom + 16;
          return rotateLabels ? (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="end"
              fill="#334155"
              fontSize="10"
              fontWeight="800"
              transform={`rotate(-35, ${x}, ${y})`}
            >
              {d.label}
            </text>
          ) : (
            <text key={i} x={x} y={y} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// --- MAIN CFO DASHBOARD PAGE ---

export default function CfoDashboardPage() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [selectedCompany, setSelectedCompany] = useState("All Companies");

  // Floating Hover Tooltip State
  const [hoveredTooltip, setHoveredTooltip] = useState<TooltipItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleHover = (item: TooltipItem, e: React.MouseEvent) => {
    setHoveredTooltip(item);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleLeave = () => {
    setHoveredTooltip(null);
  };

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
  const quarterlyTrends = dashboardData?.quarterlyTrends || [];
  const categoryBreakdown = dashboardData?.categoryBreakdown || [];
  const paymentModeDistribution = dashboardData?.paymentModeDistribution || [];
  const companyFinancials = dashboardData?.companyFinancials || [];
  const brandFinancials = dashboardData?.brandFinancials || [];
  const recentExpenses = dashboardData?.expenses || [];

  if (!user) return null;

  // 10 Line Graph Datasets
  const monthlyLineData = (monthlyTrends || []).map((t: any) => ({
    label: t.month,
    line1: t.revenue,
    line2: t.expense,
  }));

  const summaryLineData = [
    { label: "Money In", line1: summary.totalRevenue || 0 },
    { label: "Money Out", line1: summary.totalExpenses || 0 },
    { label: "Pending Fees", line1: summary.outstandingFees || 0 },
    { label: "Savings Left", line1: Math.max(0, summary.netCashFlow) },
  ];

  const treasuryLineData = [
    { label: "Bank Balance", line1: summary.bankReserves || 0 },
    { label: "Cash Balance", line1: summary.cashReserves || 0 },
  ];

  const quarterlyLineData = (quarterlyTrends || []).map((q: any) => ({
    label: q.quarter,
    line1: q.revenue,
    line2: q.expense,
  }));

  const categoryLineData = (categoryBreakdown || []).map((c: any) => ({
    label: c.name,
    line1: c.value,
  }));

  const companyLineData = (companyFinancials || []).map((c: any) => ({
    label: c.name,
    line1: c.revenue,
    line2: c.expense,
  }));

  const brandLineData = (brandFinancials || []).map((b: any) => ({
    label: b.name,
    line1: b.revenue,
    line2: b.expense,
  }));

  const paymentLineData = (paymentModeDistribution || []).map((m: any) => ({
    label: m.name,
    line1: m.value,
  }));

  const overheadLineData = [
    { label: "Variable Expenses", line1: summary.variableExpenses || 0 },
    { label: "Fixed Overhead", line1: summary.fixedExpenses || 0 },
  ];

  const transactionLineData = (recentExpenses || []).slice(0, 7).map((e: any, idx: number) => ({
    label: `Ex ${idx + 1}`,
    line1: Number(e.amount) || 0,
  }));

  const totalKpiVolume = (summary.totalRevenue || 0) + (summary.totalExpenses || 0) + (summary.outstandingFees || 0) || 1;

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans transition-colors duration-200 relative">
      <Sidebar />

      {/* FLOATING HOVER TOOLTIP */}
      {hoveredTooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-slate-900/95 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-2xl border border-slate-700 backdrop-blur-md transform -translate-x-1/2 -translate-y-full transition-all duration-100"
          style={{ left: tooltipPos.x, top: tooltipPos.y - 12 }}
        >
          <div className="text-[10px] text-indigo-300 font-extrabold uppercase mb-0.5">{hoveredTooltip.category || "DETAILS"}</div>
          <div className="text-sm font-black text-white">{hoveredTooltip.name}</div>
          <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-slate-800 text-[11px]">
            <span className="text-emerald-400 font-extrabold">Amount: ₹{Number(hoveredTooltip.value).toLocaleString("en-IN")}</span>
            {hoveredTooltip.pct !== undefined && (
              <span className="text-slate-300 font-bold bg-slate-800 px-1.5 py-0.5 rounded">
                Share: {hoveredTooltip.pct}%
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/80 pb-4 shrink-0">
          <div>
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 select-none">
              <span>CoachFlow</span>
              <span>/</span>
              <span className="text-slate-600 font-bold">CFO Line Graphs Financial Center</span>
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
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                📈 100% LINE GRAPH VISUALIZATION
              </span>
              <span className="text-slate-400 text-xs font-semibold">
                Pure line graphs with node value badges + numbers tables
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 font-sans">
              CFO Line Graph Financial Dashboard
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-0.5">
              Clean vector line graphs displaying Money In, Money Out, Savings, Company & Brand Trends with exact data tables.
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
              + Add Expense
            </Link>
            <Link
              href="/admin-dashboard/reports"
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
            >
              📊 Export Report
            </Link>
          </div>
        </div>

        {/* 1. MONTHLY MONEY IN VS MONEY OUT LINE GRAPH & TABLE */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                📈 1. Monthly Money In vs Money Out Line Graph
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Line plot comparing total fee collections (Money In) and total expenses (Money Out) each month
              </p>
            </div>
            <span className="text-xs font-extrabold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
              6 Month Trend
            </span>
          </div>

          <SvgLineGraph
            data={monthlyLineData}
            width={700}
            height={240}
            color1="#10b981"
            color2="#ef4444"
            label1="Money In (Collections)"
            label2="Money Out (Expenses)"
            onHover={handleHover}
            onLeave={handleLeave}
          />

          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>📋 Monthly Numbers Table</span>
              <span className="text-[10px] text-slate-400 font-semibold">6 Months</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold border border-slate-200/60 rounded-xl overflow-hidden shadow-xs">
                <thead className="bg-slate-100/80 text-slate-600 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Month</th>
                    <th className="py-2.5 px-4">Money In (Collections)</th>
                    <th className="py-2.5 px-4">Money Out (Expenses)</th>
                    <th className="py-2.5 px-4 text-right">Net Savings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {monthlyTrends.map((t: any) => (
                    <tr key={t.month} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{t.month}</td>
                      <td className="py-2.5 px-4 font-bold text-emerald-600">₹{t.revenue.toLocaleString("en-IN")}</td>
                      <td className="py-2.5 px-4 font-bold text-rose-600">₹{t.expense.toLocaleString("en-IN")}</td>
                      <td className={`py-2.5 px-4 text-right font-black ${t.netProfit >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                        ₹{t.netProfit.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 2 & 3. SUMMARY LINE GRAPH & TREASURY LINE GRAPH WITH TABLES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 2. OVERALL FINANCE SUMMARY LINE GRAPH & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">📈 2. Finance Summary Line Graph</h3>
                  <p className="text-xs text-slate-400 font-medium">Line plot of Money In, Expenses, Pending Fees & Savings</p>
                </div>
              </div>

              <SvgLineGraph
                data={summaryLineData}
                width={360}
                height={220}
                color1="#4f46e5"
                label1="Finance Volume"
                onHover={handleHover}
                onLeave={handleLeave}
              />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">📋 Summary Numbers Table</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold border border-slate-200/60 rounded-xl overflow-hidden shadow-xs">
                  <thead className="bg-slate-100/80 text-slate-600 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Amount (₹)</th>
                      <th className="py-2.5 px-3 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {summaryLineData.map((d) => {
                      const pct = ((d.line1 / totalKpiVolume) * 100).toFixed(1);
                      return (
                        <tr key={d.label} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{d.label}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">₹{d.line1.toLocaleString("en-IN")}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-indigo-600">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3. BANK VS CASH LINE GRAPH & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">📈 3. Bank vs Cash Line Graph</h3>
                  <p className="text-xs text-slate-400 font-medium">Line plot comparing Bank Account Reserves and Cash Vault</p>
                </div>
              </div>

              <SvgLineGraph
                data={treasuryLineData}
                width={360}
                height={220}
                color1="#10b981"
                label1="Reserve Level"
                onHover={handleHover}
                onLeave={handleLeave}
              />
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">📋 Treasury Numbers Table</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold border border-slate-200/60 rounded-xl overflow-hidden shadow-xs">
                  <thead className="bg-slate-100/80 text-slate-600 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Account Type</th>
                      <th className="py-2.5 px-3">Balance (₹)</th>
                      <th className="py-2.5 px-3 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {treasuryLineData.map((d) => {
                      const totTreasury = Math.max(1, summary.bankReserves + summary.cashReserves);
                      const pct = ((d.line1 / totTreasury) * 100).toFixed(1);
                      return (
                        <tr key={d.label} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{d.label}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">₹{d.line1.toLocaleString("en-IN")}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-emerald-600">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 4 & 5. QUARTERLY LINE GRAPH & CATEGORY LINE GRAPH WITH TABLES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 4. QUARTERLY PERFORMANCE LINE GRAPH & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">📈 4. Quarterly Performance Line Graph</h3>
              <p className="text-xs text-slate-400 font-medium">Line plot comparing Q1, Q2, Q3, and Q4 Money In vs Money Out</p>
            </div>

            <SvgLineGraph
              data={quarterlyLineData}
              width={360}
              height={220}
              color1="#4f46e5"
              color2="#ef4444"
              label1="Money In"
              label2="Money Out"
              onHover={handleHover}
              onLeave={handleLeave}
            />

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">📋 Quarterly Numbers Table</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold border border-slate-200/60 rounded-xl overflow-hidden shadow-xs">
                  <thead className="bg-slate-100/80 text-slate-600 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Quarter</th>
                      <th className="py-2.5 px-3">Money In (₹)</th>
                      <th className="py-2.5 px-3">Money Out (₹)</th>
                      <th className="py-2.5 px-3 text-right">Net Savings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {quarterlyTrends.map((q: any) => (
                      <tr key={q.quarter} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{q.quarter}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600">₹{q.revenue.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 px-3 font-bold text-rose-600">₹{q.expense.toLocaleString("en-IN")}</td>
                        <td className={`py-2.5 px-3 text-right font-black ${q.netProfit >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                          ₹{q.netProfit.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 5. EXPENSE CATEGORY LINE GRAPH & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">📈 5. Where Expenses Go (Category Line Graph)</h3>
              <p className="text-xs text-slate-400 font-medium">Category trend line of operational expenditures</p>
            </div>

            {categoryLineData.length === 0 ? (
              <div className="py-12 text-xs font-semibold text-slate-400 text-center">No expense records found</div>
            ) : (
              <SvgLineGraph
                data={categoryLineData}
                width={360}
                height={220}
                color1="#f43f5e"
                label1="Category Expense"
                onHover={handleHover}
                onLeave={handleLeave}
              />
            )}

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">📋 Category Numbers Table</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold border border-slate-200/60 rounded-xl overflow-hidden shadow-xs">
                  <thead className="bg-slate-100/80 text-slate-600 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Category Name</th>
                      <th className="py-2.5 px-3">Spent Amount (₹)</th>
                      <th className="py-2.5 px-3 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {categoryBreakdown.map((c: any) => {
                      const totalExp = summary.totalExpenses || 1;
                      const pct = ((c.value / totalExp) * 100).toFixed(1);
                      return (
                        <tr key={c.name} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{c.name}</td>
                          <td className="py-2.5 px-3 font-bold text-rose-600">₹{c.value.toLocaleString("en-IN")}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-slate-700">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 6 & 7. COMPANY & BRAND LINE GRAPHS WITH STRAIGHT BASELINE & ROTATED FULL UNTRUNCATED NAMES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 6. COMPANY TAG LINE GRAPH & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">📈 6. Company-wise Income & Expense Line Graph</h3>
                <p className="text-xs text-slate-400 font-medium">Line plot comparing Money In vs Money Out per company tag</p>
              </div>
              <Link href="/companies" className="text-xs font-bold text-indigo-600 hover:underline">Manage Companies →</Link>
            </div>

            {companyLineData.length === 0 ? (
              <div className="py-12 text-xs font-semibold text-slate-400 text-center">No company data</div>
            ) : (
              <SvgLineGraph
                data={companyLineData}
                width={360}
                height={280}
                color1="#10b981"
                color2="#f43f5e"
                label1="Money In"
                label2="Money Out"
                rotateLabels={true}
                onHover={handleHover}
                onLeave={handleLeave}
              />
            )}

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>📋 Company Numbers Table</span>
                <span className="text-[10px] text-slate-400 font-semibold">{companyFinancials.length} Registered Companies</span>
              </h4>
              <div className="overflow-x-auto max-h-56 overflow-y-auto rounded-xl border border-slate-200/60 shadow-xs">
                <table className="w-full text-left text-xs font-semibold">
                  <thead className="bg-slate-100/90 text-slate-600 uppercase text-[10px] sticky top-0 bg-slate-100 border-b border-slate-200/80">
                    <tr>
                      <th className="py-2.5 px-3">Company Name</th>
                      <th className="py-2.5 px-3">Income (₹)</th>
                      <th className="py-2.5 px-3">Expense (₹)</th>
                      <th className="py-2.5 px-3 text-right">Net (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                    {companyFinancials.map((comp: any) => (
                      <tr key={comp.name} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{comp.name}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600">₹{comp.revenue.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 px-3 font-bold text-rose-600">₹{comp.expense.toLocaleString("en-IN")}</td>
                        <td className={`py-2.5 px-3 text-right font-black ${comp.net >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                          ₹{comp.net.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 7. BRAND LINE GRAPH & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">📈 7. Brand-wise Income & Expense Line Graph</h3>
                <p className="text-xs text-slate-400 font-medium">Line plot comparing Money In vs Money Out per brand entity</p>
              </div>
              <Link href="/admin-dashboard/brands" className="text-xs font-bold text-indigo-600 hover:underline">Manage Brands →</Link>
            </div>

            {brandLineData.length === 0 ? (
              <div className="py-12 text-xs font-semibold text-slate-400 text-center">No brand data</div>
            ) : (
              <SvgLineGraph
                data={brandLineData}
                width={360}
                height={280}
                color1="#8b5cf6"
                color2="#f59e0b"
                label1="Money In"
                label2="Money Out"
                rotateLabels={true}
                onHover={handleHover}
                onLeave={handleLeave}
              />
            )}

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>📋 Brand Numbers Table</span>
                <span className="text-[10px] text-slate-400 font-semibold">{brandFinancials.length} Registered Brands</span>
              </h4>
              <div className="overflow-x-auto max-h-56 overflow-y-auto rounded-xl border border-slate-200/60 shadow-xs">
                <table className="w-full text-left text-xs font-semibold">
                  <thead className="bg-slate-100/90 text-slate-600 uppercase text-[10px] sticky top-0 bg-slate-100 border-b border-slate-200/80">
                    <tr>
                      <th className="py-2.5 px-3">Brand Name</th>
                      <th className="py-2.5 px-3">Income (₹)</th>
                      <th className="py-2.5 px-3">Expense (₹)</th>
                      <th className="py-2.5 px-3 text-right">Net (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                    {brandFinancials.map((b: any) => (
                      <tr key={b.name} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{b.name}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600">₹{b.revenue.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 px-3 font-bold text-rose-600">₹{b.expense.toLocaleString("en-IN")}</td>
                        <td className={`py-2.5 px-3 text-right font-black ${b.net >= 0 ? "text-indigo-600" : "text-rose-600"}`}>
                          ₹{b.net.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 8 & 9. PAYMENT LINE GRAPH & OVERHEAD LINE GRAPH WITH TABLES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 8. PAYMENT MODES LINE GRAPH & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">📈 8. Payment Modes Line Graph</h3>
              <p className="text-xs text-slate-400 font-medium">Expense disbursements line plot by payment channel</p>
            </div>

            {paymentLineData.length === 0 ? (
              <div className="py-12 text-xs font-semibold text-slate-400 text-center">No payment mode data</div>
            ) : (
              <SvgLineGraph
                data={paymentLineData}
                width={360}
                height={220}
                color1="#0284c7"
                label1="Payment Mode Spent"
                onHover={handleHover}
                onLeave={handleLeave}
              />
            )}

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">📋 Payment Mode Numbers Table</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold border border-slate-200/60 rounded-xl overflow-hidden shadow-xs">
                  <thead className="bg-slate-100/80 text-slate-600 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Mode</th>
                      <th className="py-2.5 px-3">Spent Amount (₹)</th>
                      <th className="py-2.5 px-3 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paymentModeDistribution.map((m: any) => {
                      const tot = summary.totalExpenses || 1;
                      const pct = ((m.value / tot) * 100).toFixed(1);
                      return (
                        <tr key={m.name} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{m.name}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">₹{m.value.toLocaleString("en-IN")}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-indigo-600">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 9. OVERHEAD TYPES LINE GRAPH & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">📈 9. Fixed vs Variable Expenses Line Graph</h3>
              <p className="text-xs text-slate-400 font-medium">Line plot of variable operating costs vs fixed overhead</p>
            </div>

            <SvgLineGraph
              data={overheadLineData}
              width={360}
              height={220}
              color1="#0d9488"
              label1="Expense Type Spent"
              onHover={handleHover}
              onLeave={handleLeave}
            />

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">📋 Expense Type Numbers Table</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-semibold border border-slate-200/60 rounded-xl overflow-hidden shadow-xs">
                  <thead className="bg-slate-100/80 text-slate-600 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Cost Type</th>
                      <th className="py-2.5 px-3">Spent Amount (₹)</th>
                      <th className="py-2.5 px-3 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {overheadLineData.map((d) => {
                      const tot = Math.max(1, summary.totalExpenses);
                      const pct = ((d.line1 / tot) * 100).toFixed(1);
                      return (
                        <tr key={d.label} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold text-slate-900">{d.label}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">₹{d.line1.toLocaleString("en-IN")}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-teal-600">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 10. RECENT DISBURSEMENTS TABLE & TREND LINE */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">📈 10. Recent Expenses Stream Line Graph</h3>
              <p className="text-xs text-slate-400 font-medium">Line plot of latest verified expense disbursements in MongoDB</p>
            </div>
            <Link href="/expenses" className="text-xs font-bold text-indigo-600 hover:underline">View All Expenses →</Link>
          </div>

          <SvgLineGraph
            data={transactionLineData}
            width={700}
            height={200}
            color1="#6366f1"
            label1="Disbursement Amount Line"
            onHover={handleHover}
            onLeave={handleLeave}
          />

          <div className="overflow-x-auto rounded-xl border border-slate-200/60 shadow-xs">
            <table className="w-full text-left text-xs font-semibold">
              <thead className="bg-slate-100/90 text-slate-600 uppercase text-[10px] border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Expense Name</th>
                  <th className="py-3 px-4">Company Tag</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Bank</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                {recentExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-slate-400 font-semibold">No expense records found.</td>
                  </tr>
                ) : (
                  recentExpenses.map((exp: any) => (
                    <tr key={exp._id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-500">
                        {exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString("en-IN") : "-"}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-800">{exp.category}</td>
                      <td className="py-2.5 px-4">{exp.title}</td>
                      <td className="py-2.5 px-4">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold text-slate-700">
                          {exp.company || "Unallocated"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-indigo-600">{exp.paymentMode}</td>
                      <td className="py-2.5 px-4 text-slate-500">{exp.bank || "-"}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-rose-600">
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

      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
    </div>
  );
}
