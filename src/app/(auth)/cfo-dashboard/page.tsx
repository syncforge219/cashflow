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

// Helper to format values nicely above vertical bars (e.g. ₹3.38L, ₹90k, ₹0)
function formatCompactRupees(val: number) {
  if (!val || val === 0) return "₹0";
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
  return `₹${val}`;
}

// --- CUSTOM ZERO-DEPENDENCY VECTOR GRAPH RENDERERS WITH TOP VALUE LABELS ---

// 1. SVG PIE CHART COMPONENT
function SvgPieChart({
  data,
  size = 210,
  onHover,
  onLeave,
}: {
  data: { name: string; value: number; color: string }[];
  size?: number;
  onHover: (item: TooltipItem, e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0) || 1;
  let accumulatedAngle = 0;

  const slices = data.map((d) => {
    const angle = (Math.max(0, d.value) / total) * 360;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle += angle;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);
    const radius = size / 2 - 10;
    const center = size / 2;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData =
      angle >= 359.9
        ? `M ${center - radius}, ${center} A ${radius},${radius} 0 1,0 ${center + radius},${center} A ${radius},${radius} 0 1,0 ${center - radius},${center}`
        : `M ${center},${center} L ${x1},${y1} A ${radius},${radius} 0 ${largeArcFlag},1 ${x2},${y2} Z`;

    return { ...d, pathData, pct: ((d.value / total) * 100).toFixed(1) };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-md">
        {slices.map((slice, idx) => (
          <path
            key={idx}
            d={slice.pathData}
            fill={slice.color}
            className="transition-all duration-200 hover:opacity-80 hover:scale-105 transform origin-center cursor-pointer"
            onMouseEnter={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "SHARE" }, e)}
            onMouseMove={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "SHARE" }, e)}
            onMouseLeave={onLeave}
          />
        ))}
      </svg>
    </div>
  );
}

// 2. SVG DONUT GRAPH COMPONENT WITH CENTRAL SUMMARY STAT
function SvgDonutChart({
  data,
  size = 210,
  innerRadiusRatio = 0.65,
  onHover,
  onLeave,
}: {
  data: { name: string; value: number; color: string }[];
  size?: number;
  innerRadiusRatio?: number;
  onHover: (item: TooltipItem, e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0) || 1;
  let accumulatedAngle = 0;

  const radius = size / 2 - 10;
  const innerRadius = radius * innerRadiusRatio;
  const center = size / 2;

  const slices = data.map((d) => {
    const angle = (Math.max(0, d.value) / total) * 360;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle += angle;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1Out = center + radius * Math.cos(startRad);
    const y1Out = center + radius * Math.sin(startRad);
    const x2Out = center + radius * Math.cos(endRad);
    const y2Out = center + radius * Math.sin(endRad);

    const x1In = center + innerRadius * Math.cos(endRad);
    const y1In = center + innerRadius * Math.sin(endRad);
    const x2In = center + innerRadius * Math.cos(startRad);
    const y2In = center + innerRadius * Math.sin(startRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData =
      angle >= 359.9
        ? `M ${center - radius}, ${center} A ${radius},${radius} 0 1,0 ${center + radius},${center} A ${radius},${radius} 0 1,0 ${center - radius},${center}`
        : `M ${x1Out},${y1Out} A ${radius},${radius} 0 ${largeArcFlag},1 ${x2Out},${y2Out} L ${x1In},${y1In} A ${innerRadius},${innerRadius} 0 ${largeArcFlag},0 ${x2In},${y2In} Z`;

    return { ...d, pathData, pct: ((d.value / total) * 100).toFixed(1) };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-md">
          {slices.map((slice, idx) => (
            <path
              key={idx}
              d={slice.pathData}
              fill={slice.color}
              className="transition-all duration-200 hover:opacity-80 hover:scale-105 transform origin-center cursor-pointer"
              onMouseEnter={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "ALLOCATION" }, e)}
              onMouseMove={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "ALLOCATION" }, e)}
              onMouseLeave={onLeave}
            />
          ))}
        </svg>
        <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL</span>
          <span className="text-sm font-black text-indigo-600">₹{(total / 100000).toFixed(1)}L</span>
        </div>
      </div>
    </div>
  );
}

// 3. SVG LINE GRAPH COMPONENT
function SvgLineGraph({
  data,
  width = 700,
  height = 230,
  color1 = "#10b981",
  color2 = "#ef4444",
  label1 = "Money In",
  label2 = "Money Out",
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
  onHover: (item: TooltipItem, e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => Math.max(d.line1 || 0, d.line2 || 0, 1)));
  const padding = 35;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  const points1 = data.map((d, i) => {
    const x = padding + (i / Math.max(1, data.length - 1)) * graphWidth;
    const y = height - padding - ((d.line1 || 0) / maxVal) * graphHeight;
    return { x, y, val: d.line1, label: d.label };
  });

  const points2 = data.map((d, i) => {
    const x = padding + (i / Math.max(1, data.length - 1)) * graphWidth;
    const y = height - padding - ((d.line2 || 0) / maxVal) * graphHeight;
    return { x, y, val: d.line2, label: d.label };
  });

  const path1 = points1.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x},${p.y}`, "");
  const path2 = points2.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x},${p.y}`, "");

  const area1 = `${path1} L ${points1[points1.length - 1].x},${height - padding} L ${points1[0].x},${height - padding} Z`;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex items-center gap-4 text-xs font-bold mb-3">
        <span className="flex items-center gap-1.5 cursor-pointer" style={{ color: color1 }}>
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color1 }} /> {label1}
        </span>
        {label2 && (
          <span className="flex items-center gap-1.5 cursor-pointer" style={{ color: color2 }}>
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color2 }} /> {label2}
          </span>
        )}
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {[0.2, 0.5, 0.8].map((ratio, idx) => (
          <line
            key={idx}
            x1={padding}
            y1={height - padding - ratio * graphHeight}
            x2={width - padding}
            y2={height - padding - ratio * graphHeight}
            stroke="#e2e8f0"
            strokeDasharray="4 4"
          />
        ))}

        <defs>
          <linearGradient id="lineGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color1} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color1} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <path d={area1} fill="url(#lineGrad1)" />
        <path d={path1} fill="none" stroke={color1} strokeWidth="3.5" strokeLinecap="round" />
        {data[0]?.line2 !== undefined && (
          <path d={path2} fill="none" stroke={color2} strokeWidth="3.5" strokeLinecap="round" strokeDasharray="6 3" />
        )}

        {points1.map((p, i) => (
          <g key={`p1-${i}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r="6"
              fill={color1}
              className="transition-all hover:r-8 hover:opacity-80 cursor-pointer drop-shadow-sm"
              onMouseEnter={(e) => onHover({ name: `${p.label} (${label1})`, value: p.val, category: "TIMELINE" }, e)}
              onMouseMove={(e) => onHover({ name: `${p.label} (${label1})`, value: p.val, category: "TIMELINE" }, e)}
              onMouseLeave={onLeave}
            />
            {p.val > 0 && (
              <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#059669" fontSize="9" fontWeight="900">
                {formatCompactRupees(p.val)}
              </text>
            )}
          </g>
        ))}

        {data[0]?.line2 !== undefined &&
          points2.map((p, i) => (
            <g key={`p2-${i}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r="6"
                fill={color2}
                className="transition-all hover:r-8 hover:opacity-80 cursor-pointer drop-shadow-sm"
                onMouseEnter={(e) => onHover({ name: `${p.label} (${label2})`, value: p.val || 0, category: "TIMELINE" }, e)}
                onMouseMove={(e) => onHover({ name: `${p.label} (${label2})`, value: p.val || 0, category: "TIMELINE" }, e)}
                onMouseLeave={onLeave}
              />
              {(p.val || 0) > 0 && (
                <text x={p.x} y={p.y + 16} textAnchor="middle" fill="#dc2626" fontSize="9" fontWeight="900">
                  {formatCompactRupees(p.val || 0)}
                </text>
              )}
            </g>
          ))}

        {data.map((d, i) => {
          const x = padding + (i / Math.max(1, data.length - 1)) * graphWidth;
          return (
            <text key={i} x={x} y={height - 8} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="bold">
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// 4. ELEGANT VERTICAL BAR GRAPH WITH COMPACT NUMBERS DISPLAYED DIRECTLY ON TOP OF EVERY BAR
function SvgBarGraph({
  data,
  height = 250,
  color1 = "#10b981",
  color2 = "#ef4444",
  label1 = "Money In",
  label2 = "Money Out",
  onHover,
  onLeave,
}: {
  data: { label: string; bar1: number; bar2?: number }[];
  height?: number;
  color1?: string;
  color2?: string;
  label1?: string;
  label2?: string;
  onHover: (item: TooltipItem, e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => Math.max(d.bar1 || 0, d.bar2 || 0, 1)));

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex items-center gap-4 text-xs font-bold mb-3">
        <span className="flex items-center gap-1.5" style={{ color: color1 }}>
          <span className="w-3 h-3 rounded-md" style={{ backgroundColor: color1 }} /> {label1}
        </span>
        {label2 && (
          <span className="flex items-center gap-1.5" style={{ color: color2 }}>
            <span className="w-3 h-3 rounded-md" style={{ backgroundColor: color2 }} /> {label2}
          </span>
        )}
      </div>

      <div className="w-full flex items-end justify-around gap-2 border-b border-slate-200/80 pt-8 pb-3 px-2 overflow-x-auto min-h-[240px] relative" style={{ height: `${height}px` }}>
        {/* Background Subtle Grid Lines */}
        <div className="absolute inset-x-2 top-8 bottom-8 flex flex-col justify-between pointer-events-none opacity-40">
          <div className="border-b border-dashed border-slate-200 w-full" />
          <div className="border-b border-dashed border-slate-200 w-full" />
          <div className="border-b border-dashed border-slate-200 w-full" />
        </div>

        {data.map((item, idx) => {
          const h1 = Math.max(5, Math.round(((item.bar1 || 0) / maxVal) * 100));
          const h2 = item.bar2 !== undefined ? Math.max(5, Math.round(((item.bar2 || 0) / maxVal) * 100)) : null;

          const shortLabel = item.label.length > 18 ? item.label.substring(0, 16) + "..." : item.label;

          return (
            <div key={idx} className="flex-1 min-w-[70px] max-w-[130px] flex flex-col items-center justify-end h-full group relative z-10">
              <div className="w-full flex items-end justify-center gap-1.5 h-full">
                {/* Bar 1: Money In */}
                <div className="w-1/2 flex flex-col items-center justify-end h-full">
                  <span className="text-[9px] font-black text-emerald-600 mb-1 opacity-90 group-hover:opacity-100 transition-opacity">
                    {formatCompactRupees(item.bar1)}
                  </span>
                  <div
                    className="w-full rounded-t-lg transition-all duration-200 hover:opacity-80 cursor-pointer shadow-sm"
                    style={{ height: `${h1}%`, backgroundColor: color1 }}
                    onMouseEnter={(e) => onHover({ name: `${item.label} (${label1})`, value: item.bar1, category: "MONEY IN" }, e)}
                    onMouseMove={(e) => onHover({ name: `${item.label} (${label1})`, value: item.bar1, category: "MONEY IN" }, e)}
                    onMouseLeave={onLeave}
                  />
                </div>

                {/* Bar 2: Money Out */}
                {h2 !== null && (
                  <div className="w-1/2 flex flex-col items-center justify-end h-full">
                    <span className="text-[9px] font-black text-rose-600 mb-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      {formatCompactRupees(item.bar2 || 0)}
                    </span>
                    <div
                      className="w-full rounded-t-lg transition-all duration-200 hover:opacity-80 cursor-pointer shadow-sm"
                      style={{ height: `${h2}%`, backgroundColor: color2 }}
                      onMouseEnter={(e) => onHover({ name: `${item.label} (${label2})`, value: item.bar2 || 0, category: "MONEY OUT" }, e)}
                      onMouseMove={(e) => onHover({ name: `${item.label} (${label2})`, value: item.bar2 || 0, category: "MONEY OUT" }, e)}
                      onMouseLeave={onLeave}
                    />
                  </div>
                )}
              </div>
              <span
                className="text-[10px] font-bold text-slate-700 mt-2 text-center line-clamp-2 max-w-full px-0.5 leading-tight group-hover:text-indigo-600 transition-colors"
                title={item.label}
              >
                {shortLabel}
              </span>
            </div>
          );
        })}
      </div>
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

  const COLORS = ["#4f46e5", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#3b82f6"];

  if (!user) return null;

  // Datasets
  const kpiDonutData = [
    { name: "Money In (Collections)", value: summary.totalRevenue || 1, color: "#10b981" },
    { name: "Money Out (Expenses)", value: summary.totalExpenses || 1, color: "#ef4444" },
    { name: "Pending Fees", value: summary.outstandingFees || 1, color: "#f59e0b" },
    { name: "Savings Left", value: Math.max(0, summary.netCashFlow), color: "#4f46e5" },
  ];

  const treasuryPieData = [
    { name: "Bank Balance", value: Math.max(1, summary.bankReserves), color: "#10b981" },
    { name: "Cash Balance", value: Math.max(1, summary.cashReserves), color: "#f59e0b" },
  ];

  const categoryDonutData = (categoryBreakdown || []).slice(0, 6).map((c: any, idx: number) => ({
    name: c.name,
    value: c.value,
    color: COLORS[idx % COLORS.length],
  }));

  const paymentPieData = (paymentModeDistribution || []).map((m: any, idx: number) => ({
    name: m.name,
    value: m.value,
    color: COLORS[idx % COLORS.length],
  }));

  const overheadPieData = [
    { name: "Variable Expenses", value: Math.max(1, summary.variableExpenses), color: "#06b6d4" },
    { name: "Fixed Overhead", value: Math.max(1, summary.fixedExpenses), color: "#14b8a6" },
  ];

  const monthlyLineData = (monthlyTrends || []).map((t: any) => ({
    label: t.month,
    line1: t.revenue,
    line2: t.expense,
  }));

  const transactionLineData = (recentExpenses || []).slice(0, 7).map((e: any, idx: number) => ({
    label: `Ex ${idx + 1}`,
    line1: Number(e.amount) || 0,
  }));

  const quarterlyBarData = (quarterlyTrends || []).map((q: any) => ({
    label: q.quarter,
    bar1: q.revenue,
    bar2: q.expense,
  }));

  const companyBarData = (companyFinancials || []).map((c: any) => ({
    label: c.name,
    bar1: c.revenue,
    bar2: c.expense,
  }));

  const brandBarData = (brandFinancials || []).map((b: any) => ({
    label: b.name,
    bar1: b.revenue,
    bar2: b.expense,
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
              <span className="text-slate-600 font-bold">CFO Financial Overview</span>
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
                📊 PREMIUM BAR CHARTS & DATA TABLES
              </span>
              <span className="text-slate-400 text-xs font-semibold">
                Direct rupee value badges on all bars + exact numbers tables
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 font-sans">
              CFO Executive Financial Command Center
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-0.5">
              Clear visual graphs showing Money In, Money Out, Savings, Company Income & Expense Tables.
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
                📈 1. Monthly Money In vs Money Out
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Line graph comparing total fee collections (Money In) and total expenses (Money Out) each month
              </p>
            </div>
            <span className="text-xs font-extrabold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
              6 Month Trend
            </span>
          </div>

          <SvgLineGraph
            data={monthlyLineData}
            width={700}
            height={230}
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

        {/* 2 & 3. SUMMARY DONUT & TREASURY PIE WITH TABLES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 2. OVERALL FINANCE SUMMARY DONUT & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">🍩 2. Finance Summary Breakdown</h3>
                  <p className="text-xs text-slate-400 font-medium">Overall share of Money In, Expenses, Pending Fees & Savings</p>
                </div>
              </div>

              <SvgDonutChart data={kpiDonutData} size={210} onHover={handleHover} onLeave={handleLeave} />
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
                    {kpiDonutData.map((d) => {
                      const pct = ((d.value / totalKpiVolume) * 100).toFixed(1);
                      return (
                        <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="truncate">{d.name}</span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">₹{d.value.toLocaleString("en-IN")}</td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-indigo-600">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3. BANK VS CASH PIE & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">🥧 3. Bank Balance vs Cash Balance</h3>
                  <p className="text-xs text-slate-400 font-medium">Distribution between Bank Account Reserves and Cash Vault</p>
                </div>
              </div>

              <SvgPieChart data={treasuryPieData} size={210} onHover={handleHover} onLeave={handleLeave} />
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
                    {treasuryPieData.map((d) => {
                      const totTreasury = Math.max(1, summary.bankReserves + summary.cashReserves);
                      const pct = ((d.value / totTreasury) * 100).toFixed(1);
                      return (
                        <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="truncate">{d.name}</span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">₹{d.value.toLocaleString("en-IN")}</td>
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

        {/* 4 & 5. QUARTERLY BARS & CATEGORY DONUT WITH TABLES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 4. QUARTERLY PERFORMANCE BARS & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">📊 4. Quarterly Performance</h3>
              <p className="text-xs text-slate-400 font-medium">Comparison across Q1, Q2, Q3, and Q4 periods</p>
            </div>

            <SvgBarGraph
              data={quarterlyBarData}
              height={230}
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

          {/* 5. EXPENSE CATEGORY DONUT & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">🍩 5. Where Expenses Go (Categories)</h3>
              <p className="text-xs text-slate-400 font-medium">Category breakdown of operational expenditures</p>
            </div>

            {categoryDonutData.length === 0 ? (
              <div className="py-12 text-xs font-semibold text-slate-400 text-center">No expense records found</div>
            ) : (
              <SvgDonutChart data={categoryDonutData} size={210} onHover={handleHover} onLeave={handleLeave} />
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
                    {categoryBreakdown.map((c: any, idx: number) => {
                      const totalExp = summary.totalExpenses || 1;
                      const pct = ((c.value / totalExp) * 100).toFixed(1);
                      return (
                        <tr key={c.name} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            <span>{c.name}</span>
                          </td>
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

        {/* 6 & 7. COMPANY & BRAND VERTICAL BAR GRAPHS WITH TOP RUPEE VALUE BADGES AND TABLES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 6. COMPANY TAG VERTICAL BARS & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">📊 6. Company-wise Income & Expense Bar Graph</h3>
                <p className="text-xs text-slate-400 font-medium">Vertical bars with rupee value badges directly on top of each bar</p>
              </div>
              <Link href="/companies" className="text-xs font-bold text-indigo-600 hover:underline">Manage Companies →</Link>
            </div>

            {companyBarData.length === 0 ? (
              <div className="py-12 text-xs font-semibold text-slate-400 text-center">No company data</div>
            ) : (
              <SvgBarGraph
                data={companyBarData}
                height={250}
                color1="#10b981"
                color2="#f43f5e"
                label1="Money In"
                label2="Money Out"
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

          {/* 7. BRAND VERTICAL BARS & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">📊 7. Brand-wise Income & Expense Bar Graph</h3>
                <p className="text-xs text-slate-400 font-medium">Vertical bars with rupee value badges directly on top of each bar</p>
              </div>
              <Link href="/admin-dashboard/brands" className="text-xs font-bold text-indigo-600 hover:underline">Manage Brands →</Link>
            </div>

            {brandBarData.length === 0 ? (
              <div className="py-12 text-xs font-semibold text-slate-400 text-center">No brand data</div>
            ) : (
              <SvgBarGraph
                data={brandBarData}
                height={250}
                color1="#8b5cf6"
                color2="#f59e0b"
                label1="Money In"
                label2="Money Out"
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

        {/* 8 & 9. PAYMENT PIE & OVERHEAD PIE WITH TABLES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 8. PAYMENT MODES PIE & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">💳 8. Payment Modes (Cash, UPI, Bank)</h3>
              <p className="text-xs text-slate-400 font-medium">Expense disbursements by payment method</p>
            </div>

            {paymentPieData.length === 0 ? (
              <div className="py-12 text-xs font-semibold text-slate-400 text-center">No payment mode data</div>
            ) : (
              <SvgPieChart data={paymentPieData} size={190} onHover={handleHover} onLeave={handleLeave} />
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
                    {paymentModeDistribution.map((m: any, idx: number) => {
                      const tot = summary.totalExpenses || 1;
                      const pct = ((m.value / tot) * 100).toFixed(1);
                      return (
                        <tr key={m.name} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            <span>{m.name}</span>
                          </td>
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

          {/* 9. OVERHEAD TYPES PIE & TABLE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-800">⚡ 9. Fixed vs Variable Expenses</h3>
              <p className="text-xs text-slate-400 font-medium">Proportion of variable operating costs vs fixed overhead</p>
            </div>

            <SvgPieChart data={overheadPieData} size={190} onHover={handleHover} onLeave={handleLeave} />

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
                    {overheadPieData.map((d) => {
                      const tot = Math.max(1, summary.totalExpenses);
                      const pct = ((d.value / tot) * 100).toFixed(1);
                      return (
                        <tr key={d.name} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-bold flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                            <span>{d.name}</span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">₹{d.value.toLocaleString("en-IN")}</td>
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
              <h3 className="text-base font-extrabold text-slate-800">📋 10. Recent Expenses List</h3>
              <p className="text-xs text-slate-400 font-medium">Detailed list of latest verified expense disbursements in MongoDB</p>
            </div>
            <Link href="/expenses" className="text-xs font-bold text-indigo-600 hover:underline">View All Expenses →</Link>
          </div>

          <SvgLineGraph
            data={transactionLineData}
            width={700}
            height={190}
            color1="#6366f1"
            label1="Expense Amount Trend Line"
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
