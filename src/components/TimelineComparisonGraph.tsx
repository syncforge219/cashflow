"use client";

import React, { useState, useEffect, useMemo } from "react";

interface TimelineComparisonGraphProps {
  selectedBrand?: string;
}

export default function TimelineComparisonGraph({ selectedBrand }: TimelineComparisonGraphProps) {
  const [preset, setPreset] = useState<string>("this_month_vs_last_month");
  const [periodAStart, setPeriodAStart] = useState<string>("");
  const [periodAEnd, setPeriodAEnd] = useState<string>("");
  const [periodBStart, setPeriodBStart] = useState<string>("");
  const [periodBEnd, setPeriodBEnd] = useState<string>("");

  const [activeMetric, setActiveMetric] = useState<"revenue" | "admissions" | "leads" | "expenses" | "netProfit">("leads");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  const [comparisonData, setComparisonData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Hover state for interactive dual chart points
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const fetchComparisonStats = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("preset", preset);
      if (selectedBrand && selectedBrand !== "All Brands" && selectedBrand !== "All") {
        params.append("brand", selectedBrand);
      }
      if (preset === "custom" && periodAStart && periodAEnd && periodBStart && periodBEnd) {
        params.append("periodA_start", periodAStart);
        params.append("periodA_end", periodAEnd);
        params.append("periodB_start", periodBStart);
        params.append("periodB_end", periodBEnd);
      }

      const res = await fetch(`/api/admin-dashboard/comparison?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setComparisonData(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch comparison stats:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchComparisonStats();
  }, [preset, selectedBrand]);

  const handleApplyCustomComparison = (e: React.FormEvent) => {
    e.preventDefault();
    if (preset === "custom") {
      fetchComparisonStats();
    }
  };

  // Format currency or simple numbers
  const fmtCurrency = (v: number) => {
    if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)} K`;
    return `₹${v.toLocaleString("en-IN")}`;
  };

  const pA = comparisonData?.periodA || {};
  const pB = comparisonData?.periodB || {};
  const deltas = comparisonData?.deltas || {};
  const series = comparisonData?.dailyComparisonSeries || [];

  // Metric specifics
  const metricConfig = useMemo(() => {
    if (activeMetric === "revenue") {
      return {
        title: "Revenue & Collections (₹)",
        valA: pA.totalRevenue || 0,
        valB: pB.totalRevenue || 0,
        growth: deltas.revenueGrowth || 0,
        fmt: (v: number) => fmtCurrency(v),
        keyA: "revenueA",
        keyB: "revenueB",
        colorA: "#059669", // Emerald
        colorB: "#6366f1", // Indigo
        isCurrency: true,
      };
    } else if (activeMetric === "admissions") {
      return {
        title: "Admissions Confirmed",
        valA: pA.admissionsCount || 0,
        valB: pB.admissionsCount || 0,
        growth: deltas.admissionsGrowth || 0,
        fmt: (v: number) => `${v} Students`,
        keyA: "admissionsA",
        keyB: "admissionsB",
        colorA: "#06b6d4", // Cyan
        colorB: "#8b5cf6", // Purple
        isCurrency: false,
      };
    } else if (activeMetric === "leads") {
      return {
        title: "Total Leads Received",
        valA: pA.leadsCount || 0,
        valB: pB.leadsCount || 0,
        growth: deltas.leadsGrowth || 0,
        fmt: (v: number) => `${v} Leads`,
        keyA: "leadsA",
        keyB: "leadsB",
        colorA: "#3b82f6", // Blue
        colorB: "#f59e0b", // Amber
        isCurrency: false,
      };
    } else if (activeMetric === "expenses") {
      return {
        title: "Operational Expenses (₹)",
        valA: pA.totalExpenses || 0,
        valB: pB.totalExpenses || 0,
        growth: deltas.expensesGrowth || 0,
        fmt: (v: number) => fmtCurrency(v),
        keyA: "expensesA",
        keyB: "expensesB",
        colorA: "#f43f5e", // Rose
        colorB: "#eab308", // Yellow
        isCurrency: true,
      };
    } else {
      return {
        title: "Net Profit (₹)",
        valA: pA.netProfit || 0,
        valB: pB.netProfit || 0,
        growth: deltas.netProfitGrowth || 0,
        fmt: (v: number) => fmtCurrency(v),
        keyA: "netProfitA",
        keyB: "netProfitB",
        colorA: "#10b981", // Emerald
        colorB: "#64748b", // Slate
        isCurrency: true,
      };
    }
  }, [activeMetric, pA, pB, deltas]);

  // Max value for dual chart scaling
  const maxSeriesVal = useMemo(() => {
    if (!series || series.length === 0) return 5;
    let max = 0;
    series.forEach((s: any) => {
      const vA = Number(s[metricConfig.keyA]) || 0;
      const vB = Number(s[metricConfig.keyB]) || 0;
      if (vA > max) max = vA;
      if (vB > max) max = vB;
    });
    return max > 0 ? max : 5;
  }, [series, metricConfig]);

  // SVG Line paths generation
  const linePaths = useMemo(() => {
    if (!series || series.length === 0) return { pathA: "", pathB: "" };
    const width = 600;
    const height = 180;
    const count = series.length;
    const step = count > 1 ? width / (count - 1) : width;

    const pointsA = series.map((s: any, idx: number) => {
      const vA = Number(s[metricConfig.keyA]) || 0;
      const x = idx * step;
      const y = height - (vA / maxSeriesVal) * (height - 20);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pointsB = series.map((s: any, idx: number) => {
      const vB = Number(s[metricConfig.keyB]) || 0;
      const x = idx * step;
      const y = height - (vB / maxSeriesVal) * (height - 20);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return {
      pathA: pointsA.length > 0 ? `M ${pointsA.join(" L ")}` : "",
      pathB: pointsB.length > 0 ? `M ${pointsB.join(" L ")}` : "",
    };
  }, [series, metricConfig, maxSeriesVal]);

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm space-y-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Floating Tooltip */}
      {hoveredPoint && (
        <div
          className="fixed z-50 pointer-events-none bg-slate-900/95 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 backdrop-blur-md transform -translate-x-1/2 -translate-y-full transition-all duration-100"
          style={{ left: tooltipPos.x, top: tooltipPos.y - 12 }}
        >
          <div className="text-[10px] font-black text-indigo-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span>📅 {hoveredPoint.dayLabel}</span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-400 font-extrabold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                {pA.label || "Timeline A"} ({hoveredPoint.dateA}):
              </span>
              <span className="font-black text-white ml-2">
                {metricConfig.fmt(Number(hoveredPoint[metricConfig.keyA]) || 0)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-indigo-400 font-extrabold flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
                {pB.label || "Timeline B"} ({hoveredPoint.dateB}):
              </span>
              <span className="font-black text-white ml-2">
                {metricConfig.fmt(Number(hoveredPoint[metricConfig.keyB]) || 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER & PRESET TOOLBAR ──────────────────────────────────────── */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 mb-1">
            <span>⚡ Dual-Timeline Performance Comparison</span>
          </div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Period vs Period Comparative Analytics</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Compare growth, collections, admissions and operational velocity between two timelines
          </p>
        </div>

        {/* Timeline Presets Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200">
          {[
            { id: "this_month_vs_last_month", label: "Month vs Last Month" },
            { id: "this_week_vs_last_week", label: "Week vs Last Week" },
            { id: "today_vs_yesterday", label: "Today vs Yesterday" },
            { id: "this_quarter_vs_last_quarter", label: "Quarter vs Last Quarter" },
            { id: "custom", label: "🎯 Custom Timelines" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                preset === p.id
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                  : "text-slate-600 hover:bg-slate-200/60"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CUSTOM TIMELINES INPUT FORM ─────────────────────────────────── */}
      {preset === "custom" && (
        <form
          onSubmit={handleApplyCustomComparison}
          className="p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3"
        >
          <div className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <span>🎯</span> Define Custom Period A & Period B Date Ranges
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <span className="text-[11px] font-black text-emerald-700 uppercase flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Timeline A (Primary Period):
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={periodAStart}
                  onChange={(e) => setPeriodAStart(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none"
                />
                <span className="text-slate-400 font-bold text-xs">to</span>
                <input
                  type="date"
                  value={periodAEnd}
                  onChange={(e) => setPeriodAEnd(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <span className="text-[11px] font-black text-indigo-700 uppercase flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Timeline B (Comparison Period):
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={periodBStart}
                  onChange={(e) => setPeriodBStart(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none"
                />
                <span className="text-slate-400 font-bold text-xs">to</span>
                <input
                  type="date"
                  value={periodBEnd}
                  onChange={(e) => setPeriodBEnd(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all"
            >
              Apply Custom Comparison
            </button>
          </div>
        </form>
      )}

      {/* ── METRIC SELECTION TABS & SCORECARD GRID ───────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "leads", label: "📥 Total Leads" },
              { id: "revenue", label: "💰 Revenue / Collections" },
              { id: "admissions", label: "🎓 Admissions" },
              { id: "expenses", label: "💸 Expenses & Overhead" },
              { id: "netProfit", label: "📈 Net Profit" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveMetric(m.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  activeMetric === m.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20"
                    : "bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Chart View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setChartType("bar")}
              className={`px-3 py-1 rounded-lg transition-all ${
                chartType === "bar" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              📊 Dual Bars
            </button>
            <button
              type="button"
              onClick={() => setChartType("line")}
              className={`px-3 py-1 rounded-lg transition-all ${
                chartType === "line" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              📈 Line Overlay
            </button>
          </div>
        </div>

        {/* Dual-Timeline KPI Scorecards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Timeline A Scorecard */}
          <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white border border-emerald-200/80 rounded-2xl p-4 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                Timeline A (Primary)
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {pA.startDate || "Current"}
              </span>
            </div>
            <div className="text-xs font-bold text-slate-500 mt-1 truncate">{pA.label || "Primary Period"}</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {metricConfig.fmt(metricConfig.valA)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              {pA.admissionsCount || 0} Adm | {pA.leadsCount || 0} Leads | {pA.conversionRate || 0}% Conv
            </div>
          </div>

          {/* Timeline B Scorecard */}
          <div className="bg-gradient-to-br from-indigo-50/80 via-purple-50/40 to-white border border-indigo-200/80 rounded-2xl p-4 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wider">
                Timeline B (Comparison)
              </span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                {pB.startDate || "Previous"}
              </span>
            </div>
            <div className="text-xs font-bold text-slate-500 mt-1 truncate">{pB.label || "Comparison Period"}</div>
            <div className="text-2xl font-black text-indigo-700 mt-1">
              {metricConfig.fmt(metricConfig.valB)}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              {pB.admissionsCount || 0} Adm | {pB.leadsCount || 0} Leads | {pB.conversionRate || 0}% Conv
            </div>
          </div>

          {/* Variance / Growth Scorecard */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md relative overflow-hidden flex flex-col justify-between border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Period Variance / Growth
              </span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  metricConfig.growth >= 0
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}
              >
                {metricConfig.growth >= 0 ? "Growth ↑" : "Decline ↓"}
              </span>
            </div>

            <div>
              <div className="text-2xl font-black text-white mt-1">
                {metricConfig.growth >= 0 ? `+${metricConfig.growth}%` : `${metricConfig.growth}%`}
              </div>
              <div className="text-xs font-semibold text-slate-300 mt-0.5">
                Delta: {metricConfig.fmt(Math.abs(metricConfig.valA - metricConfig.valB))}
              </div>
            </div>

            <div className="text-[10px] text-slate-400 font-medium border-t border-slate-800/80 pt-1.5 mt-2">
              Timeline A vs Timeline B Variance Rate
            </div>
          </div>
        </div>
      </div>

      {/* ── DUAL-SERIES COMPARISON VISUAL GRAPH ─────────────────────────── */}
      <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span>📊</span> Dual-Timeline {metricConfig.title} Day-by-Day Normalized Chart
          </h3>

          <div className="flex items-center gap-4 text-xs font-extrabold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block shadow-xs" />
              <span className="text-slate-700">{pA.label || "Timeline A"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-indigo-500 inline-block shadow-xs" />
              <span className="text-slate-700">{pB.label || "Timeline B"}</span>
            </div>
          </div>
        </div>

        {/* Dual Bar / Line SVG Chart Canvas Container */}
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-semibold animate-pulse">
            Loading timeline comparison analytics...
          </div>
        ) : series.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400 font-semibold">
            No daily comparison records available for selected timelines
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-full overflow-x-auto custom-scrollbar pt-2 pb-2">
              <div className="min-w-[700px] flex items-stretch">
                {/* Y-Axis Label Column Gutter (Prevents Text Overlapping Bars) */}
                <div className="w-24 shrink-0 h-60 flex flex-col justify-between items-end pr-3 border-r border-slate-200/80 text-[10px] font-extrabold text-slate-400 py-1">
                  {[1.0, 0.75, 0.5, 0.25, 0].map((step, idx) => (
                    <span key={idx} className="truncate max-w-full">
                      {metricConfig.isCurrency
                        ? fmtCurrency(Math.round(maxSeriesVal * step))
                        : `${Math.round(maxSeriesVal * step)}`}
                    </span>
                  ))}
                </div>

                {/* Main Graph Plotting Canvas */}
                <div className="flex-1 h-60 relative flex items-end justify-between gap-2 pl-4 pr-4 border-b border-slate-200/80">
                  {/* Horizontal Gridlines */}
                  {[0.25, 0.5, 0.75, 1.0].map((step, idx) => (
                    <div
                      key={idx}
                      className="absolute left-0 right-0 border-b border-slate-200/40 pointer-events-none"
                      style={{ bottom: `${step * 100}%` }}
                    />
                  ))}

                  {/* Rendering Mode A: Dual Bar Chart */}
                  {chartType === "bar" &&
                    series.map((item: any, idx: number) => {
                      const valA = Number(item[metricConfig.keyA]) || 0;
                      const valB = Number(item[metricConfig.keyB]) || 0;

                      const heightA = valA > 0 ? Math.max(6, Math.round((valA / maxSeriesVal) * 190)) : 0;
                      const heightB = valB > 0 ? Math.max(6, Math.round((valB / maxSeriesVal) * 190)) : 0;

                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center justify-end group h-full relative cursor-pointer"
                          onMouseEnter={(e) => {
                            setHoveredPoint(item);
                            setTooltipPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseMove={(e) => {
                            setHoveredPoint(item);
                            setTooltipPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseLeave={() => setHoveredPoint(null)}
                        >
                          <div className="flex items-end gap-1 w-full justify-center">
                            {/* Timeline A Bar */}
                            <div
                              className="w-1/2 max-w-[14px] rounded-t-md transition-all duration-300 group-hover:brightness-110 shadow-xs"
                              style={{
                                height: `${heightA}px`,
                                backgroundColor: metricConfig.colorA,
                              }}
                            />

                            {/* Timeline B Bar */}
                            <div
                              className="w-1/2 max-w-[14px] rounded-t-md transition-all duration-300 opacity-85 group-hover:opacity-100 group-hover:brightness-110 shadow-xs"
                              style={{
                                height: `${heightB}px`,
                                backgroundColor: metricConfig.colorB,
                              }}
                            />
                          </div>

                          <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-900 mt-2 truncate">
                            D{item.dayIndex}
                          </span>
                        </div>
                      );
                    })}

                  {/* Rendering Mode B: Line Overlay Chart */}
                  {chartType === "line" && (
                    <div className="absolute inset-0 pt-4 pb-6 px-4">
                      <svg width="100%" height="100%" viewBox="0 0 600 180" preserveAspectRatio="none" className="overflow-visible">
                        <path d={linePaths.pathB} fill="none" stroke={metricConfig.colorB} strokeWidth="3" strokeDasharray="4 4" className="opacity-75" />
                        <path d={linePaths.pathA} fill="none" stroke={metricConfig.colorA} strokeWidth="3.5" className="drop-shadow-xs" />
                      </svg>
                      <div className="absolute inset-0 flex items-end justify-between">
                        {series.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex-1 flex flex-col items-center justify-end group h-full cursor-pointer"
                            onMouseEnter={(e) => {
                              setHoveredPoint(item);
                              setTooltipPos({ x: e.clientX, y: e.clientY });
                            }}
                            onMouseMove={(e) => {
                              setHoveredPoint(item);
                              setTooltipPos({ x: e.clientX, y: e.clientY });
                            }}
                            onMouseLeave={() => setHoveredPoint(null)}
                          >
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-900 mt-2">
                              D{item.dayIndex}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold px-2">
              <span>Normalized Day 1 of Period</span>
              <span>Normalized Day {series.length} of Period</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
