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

// --- CUSTOM ZERO-DEPENDENCY SVG GRAPH RENDERERS WITH HOVER TOOLTIPS ---

// 1. SVG PIE CHART COMPONENT
function SvgPieChart({
  data,
  size = 200,
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
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
        {slices.map((slice, idx) => (
          <path
            key={idx}
            d={slice.pathData}
            fill={slice.color}
            className="transition-all duration-200 hover:opacity-75 hover:scale-105 transform origin-center cursor-pointer"
            onMouseEnter={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "PIE SHARE" }, e)}
            onMouseMove={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "PIE SHARE" }, e)}
            onMouseLeave={onLeave}
          />
        ))}
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-3 max-w-full">
        {slices.map((slice, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer hover:text-indigo-600 transition-colors"
            onMouseEnter={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "PIE SHARE" }, e)}
            onMouseMove={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "PIE SHARE" }, e)}
            onMouseLeave={onLeave}
          >
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }} />
            <span>{slice.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 2. SVG DONUT GRAPH COMPONENT
function SvgDonutChart({
  data,
  size = 200,
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
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
          {slices.map((slice, idx) => (
            <path
              key={idx}
              d={slice.pathData}
              fill={slice.color}
              className="transition-all duration-200 hover:opacity-75 hover:scale-105 transform origin-center cursor-pointer"
              onMouseEnter={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "DONUT ALLOCATION" }, e)}
              onMouseMove={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "DONUT ALLOCATION" }, e)}
              onMouseLeave={onLeave}
            />
          ))}
        </svg>
        <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-xs font-black text-slate-800 uppercase tracking-widest">CFO</span>
          <span className="text-[10px] font-extrabold text-indigo-600">RING</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 max-w-full">
        {slices.map((slice, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer hover:text-indigo-600 transition-colors"
            onMouseEnter={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "DONUT ALLOCATION" }, e)}
            onMouseMove={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "DONUT ALLOCATION" }, e)}
            onMouseLeave={onLeave}
          >
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }} />
            <span>{slice.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. SVG LINE GRAPH COMPONENT
function SvgLineGraph({
  data,
  width = 700,
  height = 220,
  color1 = "#10b981",
  color2 = "#ef4444",
  label1 = "Collections",
  label2 = "Disbursements",
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
  const padding = 30;
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
      <div className="flex items-center gap-4 text-xs font-bold mb-2">
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

        {/* Data points */}
        {points1.map((p, i) => (
          <circle
            key={`p1-${i}`}
            cx={p.x}
            cy={p.y}
            r="6"
            fill={color1}
            className="transition-all hover:r-8 hover:opacity-80 cursor-pointer"
            onMouseEnter={(e) => onHover({ name: `${p.label} (${label1})`, value: p.val, category: "TIMELINE POINT" }, e)}
            onMouseMove={(e) => onHover({ name: `${p.label} (${label1})`, value: p.val, category: "TIMELINE POINT" }, e)}
            onMouseLeave={onLeave}
          />
        ))}
        {data[0]?.line2 !== undefined &&
          points2.map((p, i) => (
            <circle
              key={`p2-${i}`}
              cx={p.x}
              cy={p.y}
              r="6"
              fill={color2}
              className="transition-all hover:r-8 hover:opacity-80 cursor-pointer"
              onMouseEnter={(e) => onHover({ name: `${p.label} (${label2})`, value: p.val || 0, category: "TIMELINE POINT" }, e)}
              onMouseMove={(e) => onHover({ name: `${p.label} (${label2})`, value: p.val || 0, category: "TIMELINE POINT" }, e)}
              onMouseLeave={onLeave}
            />
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

// 4. SVG BAR GRAPH COMPONENT
function SvgBarGraph({
  data,
  height = 220,
  color1 = "#4f46e5",
  color2 = "#f43f5e",
  label1 = "Revenue",
  label2 = "Expense",
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

      <div className="w-full flex items-end gap-3 border-b border-slate-200/80 pt-4 pb-2 px-2" style={{ height: `${height}px` }}>
        {data.map((item, idx) => {
          const h1 = Math.max(4, Math.round(((item.bar1 || 0) / maxVal) * 100));
          const h2 = item.bar2 !== undefined ? Math.max(4, Math.round(((item.bar2 || 0) / maxVal) * 100)) : null;

          return (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group">
              <div className="w-full flex items-end justify-center gap-1.5 h-full">
                <div
                  className="w-1/2 rounded-t-lg transition-all hover:opacity-75 cursor-pointer"
                  style={{ height: `${h1}%`, backgroundColor: color1 }}
                  onMouseEnter={(e) => onHover({ name: `${item.label} (${label1})`, value: item.bar1, category: "BAR VALUE" }, e)}
                  onMouseMove={(e) => onHover({ name: `${item.label} (${label1})`, value: item.bar1, category: "BAR VALUE" }, e)}
                  onMouseLeave={onLeave}
                />
                {h2 !== null && (
                  <div
                    className="w-1/2 rounded-t-lg transition-all hover:opacity-75 cursor-pointer"
                    style={{ height: `${h2}%`, backgroundColor: color2 }}
                    onMouseEnter={(e) => onHover({ name: `${item.label} (${label2})`, value: item.bar2 || 0, category: "BAR VALUE" }, e)}
                    onMouseMove={(e) => onHover({ name: `${item.label} (${label2})`, value: item.bar2 || 0, category: "BAR VALUE" }, e)}
                    onMouseLeave={onLeave}
                  />
                )}
              </div>
              <span className="text-[10px] font-bold text-slate-600 mt-2 truncate max-w-full">{item.label}</span>
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

  // Pie / Donut Chart Datasets
  const kpiDonutData = [
    { name: "Gross Fee Revenue", value: summary.totalRevenue || 1, color: "#10b981" },
    { name: "Operational Disbursements", value: summary.totalExpenses || 1, color: "#ef4444" },
    { name: "Outstanding Dues", value: summary.outstandingFees || 1, color: "#f59e0b" },
    { name: "Net Operating Reserves", value: Math.max(0, summary.netCashFlow), color: "#4f46e5" },
  ];

  const treasuryPieData = [
    { name: "Bank Account Net Reserves", value: Math.max(1, summary.bankReserves), color: "#10b981" },
    { name: "Physical Cash Vault Balance", value: Math.max(1, summary.cashReserves), color: "#f59e0b" },
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
    { name: "Variable Operating Costs", value: Math.max(1, summary.variableExpenses), color: "#06b6d4" },
    { name: "Fixed Commitments", value: Math.max(1, summary.fixedExpenses), color: "#14b8a6" },
  ];

  // Line Graph Datasets
  const monthlyLineData = (monthlyTrends || []).map((t: any) => ({
    label: t.month,
    line1: t.revenue,
    line2: t.expense,
  }));

  const transactionLineData = (recentExpenses || []).slice(0, 7).map((e: any, idx: number) => ({
    label: `T${idx + 1}`,
    line1: Number(e.amount) || 0,
  }));

  // Bar Graph Datasets
  const quarterlyBarData = (quarterlyTrends || []).map((q: any) => ({
    label: q.quarter,
    bar1: q.revenue,
    bar2: q.expense,
  }));

  const companyBarData = (companyFinancials || []).slice(0, 5).map((c: any) => ({
    label: c.name,
    bar1: c.revenue,
    bar2: c.expense,
  }));

  const brandBarData = (brandFinancials || []).slice(0, 5).map((b: any) => ({
    label: b.name,
    bar1: b.revenue,
    bar2: b.expense,
  }));

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans transition-colors duration-200 relative">
      <Sidebar />

      {/* DYNAMIC FLOATING HOVER TOOLTIP POPUP */}
      {hoveredTooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-slate-900/95 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-2xl border border-slate-700 backdrop-blur-md transform -translate-x-1/2 -translate-y-full transition-all duration-100"
          style={{ left: tooltipPos.x, top: tooltipPos.y - 12 }}
        >
          <div className="flex items-center gap-1.5 text-indigo-300 font-extrabold uppercase text-[10px] tracking-wider mb-0.5">
            <span>{hoveredTooltip.category || "FINANCIAL DETAILS"}</span>
          </div>
          <div className="text-sm font-black text-white">{hoveredTooltip.name}</div>
          <div className="flex items-center justify-between gap-4 mt-1.5 pt-1.5 border-t border-slate-800 text-[11px]">
            <span className="text-emerald-400 font-extrabold">Amount: ₹{Number(hoveredTooltip.value).toLocaleString("en-IN")}</span>
            {hoveredTooltip.pct !== undefined && (
              <span className="text-slate-300 font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
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
              <span className="text-slate-600 font-bold">CFO Visual Graphs Center (Hover Tooltips Enabled)</span>
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
                🎨 PURE GRAPHICAL CFO VISUALIZATION
              </span>
              <span className="text-slate-400 text-xs font-semibold">
                Hover over any slice, bar, or curve to inspect exact financial amounts
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 font-sans">
              Financial Master Visual Dashboard
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

        {/* GRAPH 1: LINE GRAPH - MONTHLY CASH FLOW TREND */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                📈 Monthly Cash Flow Trend (Fee Collections vs Operating Expenses)
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Smooth vector line plot comparing monthly fee collections vs operating disbursements
              </p>
            </div>
            <span className="text-xs font-extrabold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
              6 Month Timeline
            </span>
          </div>

          <SvgLineGraph
            data={monthlyLineData}
            width={700}
            height={220}
            color1="#10b981"
            color2="#ef4444"
            label1="Fee Collections Line"
            label2="Operating Expenses Line"
            onHover={handleHover}
            onLeave={handleLeave}
          />
        </div>

        {/* GRAPH 2 & 3: DONUT & PIE CHARTS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GRAPH 2: DONUT GRAPH - EXECUTIVE CAPITAL ALLOCATION */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-800">
                🍩 Executive Financial Capital Allocation Ring
              </h3>
              <span className="text-xs font-bold text-indigo-600">KPI Ring</span>
            </div>
            <SvgDonutChart data={kpiDonutData} size={220} onHover={handleHover} onLeave={handleLeave} />
          </div>

          {/* GRAPH 3: PIE CHART - TREASURY RESERVES DISTRIBUTION */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-800">
                🥧 Treasury Reserves Distribution (Bank Accounts vs Physical Vault)
              </h3>
              <span className="text-xs font-bold text-emerald-600">Vault Pie</span>
            </div>
            <SvgPieChart data={treasuryPieData} size={220} onHover={handleHover} onLeave={handleLeave} />
          </div>
        </div>

        {/* GRAPH 4 & 5: QUARTERLY & CATEGORY CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GRAPH 4: BAR GRAPH - QUARTERLY FINANCIAL PERFORMANCE */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  📊 Quarterly Revenue & Outlay Run-Rate Comparison
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Grouped comparative bars for Q1 to Q4 cumulative inflows vs outlays
                </p>
              </div>
            </div>
            <SvgBarGraph
              data={quarterlyBarData}
              height={220}
              color1="#4f46e5"
              color2="#ef4444"
              label1="Quarterly Revenue"
              label2="Quarterly Expense"
              onHover={handleHover}
              onLeave={handleLeave}
            />
          </div>

          {/* GRAPH 5: DONUT GRAPH - EXPENSE CATEGORY ALLOCATION */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-800">
                🍩 Operational Expenditure Allocation by Category
              </h3>
              <span className="text-xs font-bold text-rose-600">Category Donut</span>
            </div>
            {categoryDonutData.length === 0 ? (
              <div className="py-12 text-xs font-semibold text-slate-400">No expense records found</div>
            ) : (
              <SvgDonutChart data={categoryDonutData} size={220} onHover={handleHover} onLeave={handleLeave} />
            )}
          </div>
        </div>

        {/* GRAPH 6 & 7: COMPANY & BRAND BAR GRAPHS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GRAPH 6: BAR GRAPH - CORPORATE ENTITY TAG MATRIX */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  🏢 Corporate Entity Financial Matrix (Revenue vs Expenses)
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Comparative bars for registered corporate entities
                </p>
              </div>
            </div>
            {companyBarData.length === 0 ? (
              <div className="py-12 text-xs font-semibold text-slate-400 text-center">No company tag data</div>
            ) : (
              <SvgBarGraph
                data={companyBarData}
                height={220}
                color1="#10b981"
                color2="#f43f5e"
                label1="Company Inflow"
                label2="Company Outlay"
                onHover={handleHover}
                onLeave={handleLeave}
              />
            )}
          </div>

          {/* GRAPH 7: BAR GRAPH - BRAND PERFORMANCE MATRIX */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  🏷️ Brand Entity Financial Performance Comparison
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Comparative bars for registered brand entities
                </p>
              </div>
            </div>
            {brandBarData.length === 0 ? (
              <div className="py-12 text-xs font-semibold text-slate-400 text-center">No brand data</div>
            ) : (
              <SvgBarGraph
                data={brandBarData}
                height={220}
                color1="#8b5cf6"
                color2="#f59e0b"
                label1="Brand Inflow"
                label2="Brand Outlay"
                onHover={handleHover}
                onLeave={handleLeave}
              />
            )}
          </div>
        </div>

        {/* GRAPH 8 & 9: PAYMENT PIE & OVERHEAD PIE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GRAPH 8: PIE CHART - PAYMENT METHOD DISTRIBUTION */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-800">
                💳 Payment Channel Disbursement Distribution
              </h3>
              <span className="text-xs font-bold text-sky-600">Channel Pie</span>
            </div>
            {paymentPieData.length === 0 ? (
              <div className="py-12 text-xs font-semibold text-slate-400">No payment data</div>
            ) : (
              <SvgPieChart data={paymentPieData} size={210} onHover={handleHover} onLeave={handleLeave} />
            )}
          </div>

          {/* GRAPH 9: PIE CHART - FIXED VS VARIABLE OVERHEAD */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-slate-800">
                ⚡ Operational Cost Structure (Variable vs Fixed Overhead)
              </h3>
              <span className="text-xs font-bold text-teal-600">Cost Pie</span>
            </div>
            <SvgPieChart data={overheadPieData} size={210} onHover={handleHover} onLeave={handleLeave} />
          </div>
        </div>

        {/* GRAPH 10: LINE GRAPH - RECENT DISBURSEMENT VELOCITY STREAM */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-800">
                📋 Disbursement Velocity Stream
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Sequential velocity line curve of recent verified disbursements recorded in MongoDB
              </p>
            </div>
            <Link href="/expenses" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline">
              View All Entries →
            </Link>
          </div>

          <SvgLineGraph
            data={transactionLineData}
            width={700}
            height={200}
            color1="#6366f1"
            label1="Transaction Disbursement Size Line"
            onHover={handleHover}
            onLeave={handleLeave}
          />
        </div>
      </div>

      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
    </div>
  );
}
