"use client";

import React, { useState, useEffect } from "react";

interface DashboardFilterProps {
  onFilterChange: (startDate: string | null, endDate: string | null, label: string) => void;
  currentLabel: string;
  selectedBrand?: string;
  onBrandChange?: (brand: string) => void;
  brandsList?: string[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function DashboardFilter({
  onFilterChange,
  currentLabel,
  selectedBrand,
  onBrandChange,
  brandsList
}: DashboardFilterProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  const [activeTab, setActiveTab] = useState<"today" | "weekly" | "monthly" | "yearly" | "custom" | null>(
    currentLabel === "Today" ? "today" : 
    currentLabel === "Custom Range" ? "custom" :
    currentLabel === "Overall" ? null : "monthly"
  );
  
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedWeek, setSelectedWeek] = useState(1); // 1-5
  
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const years = [];
  for (let y = 2026; y <= Math.max(currentYear, 2026); y++) {
    years.push(y);
  }

  const formatDateStr = (dateObj: Date) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Update dates whenever selected dropdowns change, but only if they are the active tab
  useEffect(() => {
    if (activeTab === "yearly") {
      const start = new Date(selectedYear, 0, 1);
      const end = new Date(selectedYear, 11, 31, 23, 59, 59);
      onFilterChange(formatDateStr(start), formatDateStr(end), `Year: ${selectedYear}`);
    } else if (activeTab === "monthly") {
      const start = new Date(selectedYear, selectedMonth, 1);
      const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
      onFilterChange(formatDateStr(start), formatDateStr(end), `${MONTHS[selectedMonth]} ${selectedYear}`);
    } else if (activeTab === "weekly") {
      const startDay = (selectedWeek - 1) * 7 + 1;
      const endDay = Math.min(selectedWeek * 7, new Date(selectedYear, selectedMonth + 1, 0).getDate());
      const start = new Date(selectedYear, selectedMonth, startDay);
      const end = new Date(selectedYear, selectedMonth, endDay, 23, 59, 59);
      onFilterChange(formatDateStr(start), formatDateStr(end), `Week ${selectedWeek}, ${MONTHS[selectedMonth]} ${selectedYear}`);
    }
  }, [selectedYear, selectedMonth, selectedWeek, activeTab]);

  const handleTabClick = (tab: "today" | "weekly" | "monthly" | "yearly" | "custom") => {
    setActiveTab(tab);
    if (tab === "today") {
      const start = new Date();
      const end = new Date();
      onFilterChange(formatDateStr(start), formatDateStr(end), "Today");
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd) {
      onFilterChange(customStart, customEnd, "Custom Range");
    }
  };

  const handleClear = () => {
    setActiveTab(null);
    setCustomStart("");
    setCustomEnd("");
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
    setSelectedWeek(1);
    onFilterChange(null, null, "Overall");
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200/60 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="text-sm font-bold text-slate-700 whitespace-nowrap">Filter By:</span>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleTabClick("today")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeTab === "today" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Today
          </button>
          <button
            onClick={handleClear}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeTab === null || currentLabel === "Overall" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            All Time
          </button>
          <select
            value={activeTab === "weekly" ? selectedWeek : "weekly"}
            onChange={(e) => {
              setSelectedWeek(Number(e.target.value));
              setActiveTab("weekly");
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer outline-none ${activeTab === "weekly" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', textAlign: 'center' }}
          >
            <option value="weekly" disabled hidden>Weekly</option>
            {[1, 2, 3, 4, 5].map(w => (
              <option key={w} value={w} className="bg-white text-slate-700">Week {w}</option>
            ))}
          </select>

          <select
            value={activeTab === "monthly" || activeTab === "weekly" ? selectedMonth : "monthly"}
            onChange={(e) => {
              setSelectedMonth(Number(e.target.value));
              setActiveTab("monthly");
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer outline-none ${activeTab === "monthly" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', textAlign: 'center' }}
          >
            <option value="monthly" disabled hidden>Monthly</option>
            {MONTHS.map((m, i) => (
              <option key={i} value={i} className="bg-white text-slate-700">{m}</option>
            ))}
          </select>

          <select
            value={(activeTab === "yearly" || activeTab === "monthly" || activeTab === "weekly") ? selectedYear : "yearly"}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setActiveTab("yearly");
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer outline-none ${activeTab === "yearly" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', textAlign: 'center' }}
          >
            <option value="yearly" disabled hidden>Yearly</option>
            {years.map(y => (
              <option key={y} value={y} className="bg-white text-slate-700">{y}</option>
            ))}
          </select>
          <button
            onClick={() => handleTabClick("custom")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeTab === "custom" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            Custom
          </button>
        </div>

        {activeTab === "custom" && (
          <div className="flex flex-wrap items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-3">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="text-xs px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium text-slate-700"
            />
            <span className="text-slate-400 text-xs font-semibold">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="text-xs px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium text-slate-700"
            />
            <button
              onClick={handleCustomApply}
              disabled={!customStart || !customEnd}
              className="px-3 py-1.5 text-xs font-bold bg-slate-800 text-white rounded-md disabled:opacity-50 hover:bg-slate-700 transition-colors"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {onBrandChange && (
        <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-4 mt-1 md:mt-0">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Brand:</span>
          <select
            value={selectedBrand || "All Brands"}
            onChange={(e) => onBrandChange(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer outline-none shadow-xs"
          >
            <option value="All Brands">All Brands</option>
            {brandsList?.map((brand) => (
              <option key={brand} value={brand} className="bg-white text-slate-800 font-semibold">
                {brand}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
