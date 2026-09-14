"use client";

import React, { useState, useMemo } from "react";

export interface SourcePerformanceData {
  source: string;
  total: number;
  converted: number;
  pending: number;
  lost: number;
  cvr: number; // percentage (e.g. 12.5)
  cvrStr: string;
  mixPct: number; // percentage of total leads
  color: string;
}

interface SourcePerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: SourcePerformanceData[];
  totalLeads: number;
  totalConverted: number;
  overallCvrStr: string;
  activeSourceFilter?: string;
  onSelectSource?: (source: string) => void;
}

export default function SourcePerformanceModal({
  isOpen,
  onClose,
  sources,
  totalLeads,
  totalConverted,
  overallCvrStr,
  activeSourceFilter,
  onSelectSource,
}: SourcePerformanceModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"cvr" | "total" | "converted" | "name">("cvr");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  if (!isOpen) return null;

  // Filtered & Sorted sources
  const processedSources = useMemo(() => {
    let list = sources.filter((s) =>
      s.source.toLowerCase().includes(searchTerm.toLowerCase().trim())
    );

    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "cvr") {
        comparison = a.cvr - b.cvr || a.converted - b.converted;
      } else if (sortBy === "total") {
        comparison = a.total - b.total;
      } else if (sortBy === "converted") {
        comparison = a.converted - b.converted;
      } else if (sortBy === "name") {
        comparison = a.source.localeCompare(b.source);
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return list;
  }, [sources, searchTerm, sortBy, sortOrder]);

  // Top converting source
  const topConvertingSource = useMemo(() => {
    const valid = sources.filter((s) => s.total >= 1 && s.converted > 0);
    if (valid.length === 0) return null;
    return [...valid].sort((a, b) => b.cvr - a.cvr)[0];
  }, [sources]);

  // Highest volume source
  const highestVolumeSource = useMemo(() => {
    if (sources.length === 0) return null;
    return [...sources].sort((a, b) => b.total - a.total)[0];
  }, [sources]);

  const handleToggleSort = (column: "cvr" | "total" | "converted" | "name") => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-slate-50/80 via-white to-indigo-50/40">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.143 2.143L15.75 6"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Lead Source Conversion & Performance Matrix
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1 ml-10">
              Comparative analysis of acquisition channels, conversion rates, and student admissions
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-xl transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 bg-slate-50/60 border-b border-slate-100">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Channels
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-slate-900">{sources.length}</span>
              <span className="text-[11px] font-semibold text-slate-500">Sources</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{totalLeads} Total Leads</p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-2xs">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">
              Admissions Converted
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-black text-emerald-600">{totalConverted}</span>
              <span className="text-[11px] font-semibold text-emerald-700">Enrolled</span>
            </div>
            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">{overallCvrStr} Overall CVR</p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-indigo-100 shadow-2xs">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
              Top Converting Channel
            </span>
            <div className="mt-1 min-w-0">
              <span className="text-sm font-black text-slate-800 truncate block">
                {topConvertingSource ? topConvertingSource.source : "None"}
              </span>
              <span className="text-[11px] font-bold text-indigo-600">
                {topConvertingSource ? `${topConvertingSource.cvrStr} CVR (${topConvertingSource.converted}/${topConvertingSource.total})` : "0% CVR"}
              </span>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-blue-100 shadow-2xs">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
              Highest Lead Volume
            </span>
            <div className="mt-1 min-w-0">
              <span className="text-sm font-black text-slate-800 truncate block">
                {highestVolumeSource ? highestVolumeSource.source : "None"}
              </span>
              <span className="text-[11px] font-bold text-blue-600">
                {highestVolumeSource ? `${highestVolumeSource.total} Leads (${Math.round(highestVolumeSource.mixPct)}% mix)` : "0 Leads"}
              </span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <div className="relative flex-1 max-w-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search source channel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            {activeSourceFilter && onSelectSource && (
              <button
                type="button"
                onClick={() => {
                  onSelectSource("");
                  onClose();
                }}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Filtered: {activeSourceFilter}</span>
                <span className="text-xs">&times;</span>
              </button>
            )}

            <span className="text-[11px] font-semibold text-slate-400">
              Showing {processedSources.length} of {sources.length} sources
            </span>
          </div>
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th
                  onClick={() => handleToggleSort("name")}
                  className="pb-3 pr-4 cursor-pointer select-none hover:text-slate-700"
                >
                  <div className="flex items-center gap-1">
                    <span>Source Channel</span>
                    {sortBy === "name" && (
                      <span className="text-indigo-600">{sortOrder === "desc" ? "↓" : "↑"}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort("total")}
                  className="pb-3 px-3 cursor-pointer select-none hover:text-slate-700 text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Leads (Mix)</span>
                    {sortBy === "total" && (
                      <span className="text-indigo-600">{sortOrder === "desc" ? "↓" : "↑"}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort("converted")}
                  className="pb-3 px-3 cursor-pointer select-none hover:text-slate-700 text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Converted</span>
                    {sortBy === "converted" && (
                      <span className="text-indigo-600">{sortOrder === "desc" ? "↓" : "↑"}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort("cvr")}
                  className="pb-3 px-3 cursor-pointer select-none hover:text-slate-700 text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Conversion Rate</span>
                    {sortBy === "cvr" && (
                      <span className="text-indigo-600">{sortOrder === "desc" ? "↓" : "↑"}</span>
                    )}
                  </div>
                </th>
                <th className="pb-3 px-3 text-right hidden sm:table-cell">Pipeline</th>
                <th className="pb-3 px-3 text-right hidden sm:table-cell">Lost</th>
                {onSelectSource && <th className="pb-3 pl-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {processedSources.map((item) => {
                const isSelected = activeSourceFilter === item.source;
                return (
                  <tr
                    key={item.source}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isSelected ? "bg-indigo-50/50" : ""
                    }`}
                  >
                    {/* Source Name */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: item.color }}
                        ></span>
                        <span className="font-bold text-slate-800">{item.source}</span>
                        {isSelected && (
                          <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
                            Filtered
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total Leads & Mix */}
                    <td className="py-3 px-3 text-right font-semibold">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-slate-900">{item.total}</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {Math.round(item.mixPct)}% mix
                        </span>
                      </div>
                    </td>

                    {/* Converted */}
                    <td className="py-3 px-3 text-right font-bold">
                      <div className="flex flex-col items-end">
                        <span
                          className={item.converted > 0 ? "text-emerald-600 font-extrabold" : "text-slate-400"}
                        >
                          {item.converted}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Admissions
                        </span>
                      </div>
                    </td>

                    {/* Conversion Rate with Progress Bar & Tier Badge */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-black border tracking-tight ${
                            item.cvr >= 20
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : item.cvr >= 10
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : item.cvr > 0
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-400 border-slate-200"
                          }`}
                        >
                          {item.cvrStr} CVR
                        </span>
                        <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.cvr >= 20
                                ? "bg-emerald-500"
                                : item.cvr >= 10
                                ? "bg-indigo-500"
                                : item.cvr > 0
                                ? "bg-amber-500"
                                : "bg-slate-300"
                            }`}
                            style={{
                              width: `${Math.max(item.cvr > 0 ? 5 : 0, Math.min(100, item.cvr))}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* In Pipeline */}
                    <td className="py-3 px-3 text-right hidden sm:table-cell text-slate-600">
                      {item.pending}
                    </td>

                    {/* Lost */}
                    <td className="py-3 px-3 text-right hidden sm:table-cell text-rose-500 font-medium">
                      {item.lost}
                    </td>

                    {/* Action */}
                    {onSelectSource && (
                      <td className="py-3 pl-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              onSelectSource("");
                            } else {
                              onSelectSource(item.source);
                            }
                            onClose();
                          }}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                            isSelected
                              ? "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"
                              : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200"
                          }`}
                        >
                          {isSelected ? "Clear" : "Filter"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}

              {processedSources.length === 0 && (
                <tr>
                  <td
                    colSpan={onSelectSource ? 7 : 6}
                    className="py-8 text-center text-slate-400 font-medium"
                  >
                    No lead sources found matching &quot;{searchTerm}&quot;
                  </td>
                </tr>
              )}
            </tbody>

            {/* Totals Row */}
            {sources.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/50 font-black text-xs text-slate-800">
                  <td className="py-3 pr-4">Total ({sources.length} Channels)</td>
                  <td className="py-3 px-3 text-right">{totalLeads} (100%)</td>
                  <td className="py-3 px-3 text-right text-emerald-600 font-black">
                    {totalConverted}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-xs font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-md border border-emerald-300">
                      {overallCvrStr} Avg
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right hidden sm:table-cell">
                    {sources.reduce((acc, s) => acc + s.pending, 0)}
                  </td>
                  <td className="py-3 px-3 text-right hidden sm:table-cell text-rose-600">
                    {sources.reduce((acc, s) => acc + s.lost, 0)}
                  </td>
                  {onSelectSource && <td></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-slate-600">
              Formula: Conversion Rate (CVR) = (Admissions Converted / Total Leads from Source) × 100
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-bold text-xs bg-slate-800 text-white hover:bg-slate-900 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
