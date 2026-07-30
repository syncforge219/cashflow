"use client";

import React, { useState, useEffect } from "react";

interface FollowupPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FollowupPerformanceModal({
  isOpen,
  onClose,
}: FollowupPerformanceModalProps) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState("All Brands");

  useEffect(() => {
    if (!isOpen) return;

    const fetchReport = async () => {
      setIsLoading(true);
      try {
        const url = `/api/reports/followup-performance${selectedBrand !== "All Brands" ? `?brand=${encodeURIComponent(selectedBrand)}` : ""}`;
        const res = await fetch(url);
        const json = await res.json();
        if (res.ok && json.success) {
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load followup performance report:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [isOpen, selectedBrand]);

  if (!isOpen) return null;

  const summary = data?.summary || {};
  const breakdown = data?.counsellorBreakdown || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-lg shadow-md">
              📊
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                Follow-up & CRM Performance Analytics
              </h2>
              <p className="text-xs text-slate-400">
                Analyze completion rates, average response times, overdue metrics, and advisor conversion performance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
            <span>Filter Brand:</span>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold outline-none cursor-pointer shadow-xs"
            >
              <option value="All Brands">All Brands</option>
              <option value="Cadd Mantra">Cadd Mantra</option>
              <option value="Design Gateway">Design Gateway</option>
            </select>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="py-20 text-center font-bold text-slate-400 animate-pulse">
              Calculating real-time follow-up performance analytics...
            </div>
          ) : (
            <>
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-4 shadow-xs">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-1">Total Scheduled</span>
                  <div className="text-2xl font-black text-indigo-950">{summary.totalFollowups || 0}</div>
                  <span className="text-[11px] font-semibold text-indigo-600 mt-1 block">Enquiries: {summary.totalEnquiries || 0}</span>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 shadow-xs">
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Completion Rate</span>
                  <div className="text-2xl font-black text-emerald-950">{summary.completionRate || 0}%</div>
                  <span className="text-[11px] font-semibold text-emerald-700 mt-1 block">{summary.completedCount || 0} completed touchpoints</span>
                </div>

                <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 rounded-2xl p-4 shadow-xs">
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">Overdue / Missed Rate</span>
                  <div className="text-2xl font-black text-rose-950">{summary.overdueRate || 0}%</div>
                  <span className="text-[11px] font-semibold text-rose-700 mt-1 block">{summary.missedCount || 0} delayed follow-ups</span>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-4 shadow-xs">
                  <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest block mb-1">Escalated to Manager</span>
                  <div className="text-2xl font-black text-purple-950">{summary.escalatedCount || 0}</div>
                  <span className="text-[11px] font-semibold text-purple-700 mt-1 block">Unattended &gt; 24 hrs</span>
                </div>
              </div>

              {/* Counsellor Performance Breakdown Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                <div className="bg-slate-900 px-5 py-3 text-white flex items-center justify-between">
                  <h3 className="font-extrabold text-xs tracking-wider uppercase">Counsellor & Sales Rep Performance Leaderboard</h3>
                  <span className="text-[11px] text-slate-400 font-semibold">{breakdown.length} active advisors</span>
                </div>

                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider select-none">
                      <th className="py-3 px-4">ADVISOR NAME</th>
                      <th className="py-3 px-4 text-center">TOTAL TOUCHPOINTS</th>
                      <th className="py-3 px-4 text-center">COMPLETED</th>
                      <th className="py-3 px-4 text-center">OVERDUE / MISSED</th>
                      <th className="py-3 px-4 text-center">ESCALATED</th>
                      <th className="py-3 px-4 text-center">COMPLETION RATE</th>
                      <th className="py-3 px-4 text-center">AVG RESPONSE TIME</th>
                      <th className="py-3 px-4 text-center">CONVERSIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {breakdown.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">No advisor performance data available.</td>
                      </tr>
                    ) : (
                      breakdown.map((row: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-extrabold text-slate-900 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-black">
                              {idx + 1}
                            </span>
                            <span>{row.counsellor}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold">{row.total}</td>
                          <td className="py-3 px-4 text-center text-emerald-600 font-bold">{row.completed}</td>
                          <td className="py-3 px-4 text-center text-rose-600 font-bold">{row.missed}</td>
                          <td className="py-3 px-4 text-center text-purple-600 font-bold">{row.escalated}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                              row.completionRate >= 80 ? "bg-emerald-100 text-emerald-800" : row.completionRate >= 50 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"
                            }`}>
                              {row.completionRate}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-600">{row.avgResponseHours} hrs</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-900 font-black text-[11px]">
                              🎓 {row.admitted} ({row.conversionRate}%)
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
