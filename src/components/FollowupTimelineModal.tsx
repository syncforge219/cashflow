"use client";

import React, { useState } from "react";

interface FollowupTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: any | null;
}

export default function FollowupTimelineModal({
  isOpen,
  onClose,
  record,
}: FollowupTimelineModalProps) {
  const [filterType, setFilterType] = useState<string>("All");

  if (!isOpen || !record) return null;

  const followUps = Array.isArray(record.followUps) ? record.followUps : [];

  const getPriorityBadge = (priority?: string) => {
    const p = (priority || "Medium").toLowerCase();
    if (p === "urgent") return <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-extrabold text-[10px]">🔴 URGENT</span>;
    if (p === "high") return <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 font-extrabold text-[10px]">🟠 HIGH</span>;
    if (p === "low") return <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 font-extrabold text-[10px]">🔵 LOW</span>;
    return <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 font-extrabold text-[10px]">🟡 MEDIUM</span>;
  };

  const getStatusBadge = (status?: string, isCompleted?: boolean) => {
    if (isCompleted || (status || "").toLowerCase() === "completed") {
      return <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">✓ COMPLETED</span>;
    }
    if ((status || "").toLowerCase() === "missed") {
      return <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[10px]">🚨 MISSED</span>;
    }
    if ((status || "").toLowerCase() === "rescheduled") {
      return <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-extrabold text-[10px]">🔄 RESCHEDULED</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[10px]">⏳ PENDING</span>;
  };

  const filteredItems = followUps.filter((item: any) => {
    if (filterType === "All") return true;
    return (item.typeOfContact || "").toLowerCase() === filterType.toLowerCase();
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-base shadow-md">
              🕒
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                Follow-up Timeline & Interaction History
              </h2>
              <p className="text-xs text-slate-400">
                Lead: <strong className="text-white">{record.studentFullName || record.fullName}</strong> ({record.enquiryId || record.admissionId || "ID-N/A"})
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
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shrink-0 text-xs">
          <span className="font-bold text-slate-600">Total Interactions: {followUps.length}</span>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Filter Contact:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="All">All Types</option>
              <option value="Telephonic">Telephonic</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Email">Email</option>
              <option value="Walkin">Walkin</option>
            </select>
          </div>
        </div>

        {/* Timeline Content List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-semibold">
              No follow-up interaction timeline records match the selected filter.
            </div>
          ) : (
            <div className="relative border-l-2 border-indigo-200 ml-4 pl-6 space-y-6">
              {filteredItems.map((item: any, idx: number) => {
                const dateDisplay = item.date
                  ? new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : "N/A";

                return (
                  <div key={idx} className="relative group">
                    {/* Timeline Node Icon */}
                    <div className="absolute -left-[35px] top-0 w-8 h-8 rounded-full bg-white border-2 border-indigo-600 flex items-center justify-center text-indigo-600 text-xs font-black shadow-xs">
                      {idx + 1}
                    </div>

                    {/* Timeline Card */}
                    <div className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl p-4 transition-all shadow-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-xs">{dateDisplay}</span>
                          <span className="text-[11px] font-mono text-slate-500">at {item.time || "10:00 AM"}</span>
                          {getPriorityBadge(item.priority)}
                          {item.escalatedToManager && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-black text-[10px]">⚡ ESCALATED</span>
                          )}
                        </div>
                        {getStatusBadge(item.status, item.isCompleted)}
                      </div>

                      {/* Touchpoint Details */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-semibold pt-1">
                        <div>
                          <span className="text-slate-400 uppercase text-[9px] font-extrabold block">Contact Mode</span>
                          <span className="text-indigo-900 font-bold capitalize">📞 {item.typeOfContact || "Telephonic"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 uppercase text-[9px] font-extrabold block">Assigned / Planned By</span>
                          <span className="text-slate-800 font-bold">👤 {item.assignedTo || item.plannedBy || record.assignedCrmAdvisor || "Counsellor"}</span>
                        </div>
                      </div>

                      {/* Discussion Remarks */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700 font-medium">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                          Discussion Remarks & Notes:
                        </span>
                        <p className="whitespace-pre-wrap">{item.remarks || "No detailed remarks logged for this touchpoint."}</p>
                        {item.nextAction && (
                          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-bold text-indigo-700">
                            🎯 Next Action: {item.nextAction}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Close Timeline
          </button>
        </div>
      </div>
    </div>
  );
}
