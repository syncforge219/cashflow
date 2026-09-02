"use client";

import React, { useState, useEffect } from "react";
import TakeAttendanceModal from "./TakeAttendanceModal";
import { useUser } from "@/app/component/context/user-context";
import { getBatchSlotInfo, sortBatchesByTiming, BatchSlotInfo } from "@/lib/slotHelper";

const formatBatchDate = (d?: string | Date) => {
  if (!d) return "Not Set";
  try {
    const dt = new Date(d);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  } catch (_) {}
  return String(d).split("T")[0] || "Not Set";
};

export default function AttendanceDisplay() {
  const { user } = useUser();
  const [logs, setLogs] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTakeModalOpen, setIsTakeModalOpen] = useState(false);
  const [modalBatchId, setModalBatchId] = useState<string>("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("All Batches");
  const [filterDate, setFilterDate] = useState<string>("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"BATCH_CARDS" | "HISTORY_LOGS">("BATCH_CARDS");

  // Batch slotting and timing filter states
  const [slotFilter, setSlotFilter] = useState<"all" | "morning" | "afternoon" | "evening">("all");
  const [isGroupedBySlot, setIsGroupedBySlot] = useState(true);
  const [quickEditBatch, setQuickEditBatch] = useState<any | null>(null);
  const [isSavingSlot, setIsSavingSlot] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      let batchUrl = "/api/batches";
      let logUrl = "/api/attendance";

      const queryParams = new URLSearchParams();
      const teacherId = user?.id || user?._id;
      if (user?.role === "teacher" && teacherId) {
        queryParams.append("teacherId", teacherId);
      } else if (user?.brandScope) {
        queryParams.append("brand", user.brandScope);
      }

      const queryString = queryParams.toString();
      if (queryString) {
        batchUrl += `?${queryString}`;
        logUrl += `?${queryString}`;
      }

      const [batchRes, logRes] = await Promise.all([
        fetch(batchUrl).then((r) => r.json().catch(() => ({}))),
        fetch(logUrl).then((r) => r.json().catch(() => ({}))),
      ]);

      if (batchRes.success || batchRes.batches) {
        setBatches(batchRes.data || batchRes.batches || []);
      }

      if (logRes.success || logRes.attendance) {
        setLogs(logRes.data || logRes.attendance || []);
      }
    } catch (err) {
      console.error("Failed to fetch attendance data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const filteredLogs = logs.filter((log) => {
    if (selectedBatchId !== "All Batches") {
      const matchBatch = batches.find((b) => String(b._id) === selectedBatchId || b.batchId === selectedBatchId);
      const bId = matchBatch?._id ? String(matchBatch._id) : selectedBatchId;
      const bCustom = matchBatch?.batchId ? String(matchBatch.batchId).trim() : "";
      const logBId = log.batchId ? String(log.batchId).trim() : "";
      if (logBId !== bId && (!bCustom || logBId !== bCustom)) {
        return false;
      }
    }
    if (filterDate && log.dateStr !== filterDate) {
      return false;
    }
    return true;
  });

  // KPI Computations
  const totalSessions = logs.length;
  const totalPresentSum = logs.reduce((sum, l) => sum + (l.totalPresent || 0), 0);
  const totalStudentsSum = logs.reduce((sum, l) => sum + (l.totalStudents || 0), 0);
  const overallPct = totalStudentsSum > 0 ? Math.round((totalPresentSum / totalStudentsSum) * 100) : 0;

  const handleOpenModalForBatch = (bId: string) => {
    setModalBatchId(bId);
    setIsTakeModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1 mb-1">
            <span>CoachFlow</span>
            <span>/</span>
            <span className="text-emerald-600 font-extrabold">Student Roster & Attendance</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Batch Attendance Command Center
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Monitor active batch rosters, last attendance dates, and present/absent ratios
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleOpenModalForBatch("")}
            className="flex items-center gap-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl px-5 py-2.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <span>📋</span> + Mark Batch Attendance
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Logged Sessions
          </span>
          <span className="text-2xl font-black text-slate-800 tracking-tight">{totalSessions}</span>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">
            Overall Attendance Rate
          </span>
          <span className="text-2xl font-black text-emerald-600 tracking-tight">{overallPct}%</span>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-1">
            Active Batches
          </span>
          <span className="text-2xl font-black text-indigo-600 tracking-tight">{batches.length}</span>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider block mb-1">
            Total Student Audits
          </span>
          <span className="text-2xl font-black text-purple-600 tracking-tight">{totalStudentsSum}</span>
        </div>
      </div>

      {/* Mode View Switcher Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("BATCH_CARDS")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === "BATCH_CARDS"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
            }`}
          >
            <span>📦</span>
            <span>Batch Blocks ({batches.length})</span>
          </button>

          <button
            onClick={() => setViewMode("HISTORY_LOGS")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              viewMode === "HISTORY_LOGS"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
            }`}
          >
            <span>📜</span>
            <span>Session Logs ({filteredLogs.length})</span>
          </button>
        </div>

        {viewMode === "HISTORY_LOGS" && (
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer w-full sm:w-52"
            >
              <option value="All Batches">All Faculty Batches</option>
              {batches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.batchName} ({b.course})
                </option>
              ))}
            </select>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none w-full sm:w-auto"
            />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {viewMode === "BATCH_CARDS" ? (
        /* BATCH CARDS BLOCKS GRID WITH TIME SLOTTING */
        <div className="space-y-5">
          {/* Time Slot Filter & Grouping Toolbar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                Time Slots:
              </span>
              <button
                onClick={() => setSlotFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  slotFilter === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                All Batches ({batches.length})
              </button>

              <button
                onClick={() => setSlotFilter("morning")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  slotFilter === "morning"
                    ? "bg-amber-500 text-white shadow-xs shadow-amber-500/20"
                    : "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60"
                }`}
              >
                <span>🌅</span>
                <span>Morning ({batches.filter((b) => getBatchSlotInfo(b.timing).slotKey === "morning").length})</span>
              </button>

              <button
                onClick={() => setSlotFilter("afternoon")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  slotFilter === "afternoon"
                    ? "bg-sky-600 text-white shadow-xs shadow-sky-600/20"
                    : "bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200/60"
                }`}
              >
                <span>☀️</span>
                <span>Afternoon ({batches.filter((b) => getBatchSlotInfo(b.timing).slotKey === "afternoon").length})</span>
              </button>

              <button
                onClick={() => setSlotFilter("evening")}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  slotFilter === "evening"
                    ? "bg-indigo-600 text-white shadow-xs shadow-indigo-600/20"
                    : "bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/60"
                }`}
              >
                <span>🌆</span>
                <span>Evening ({batches.filter((b) => getBatchSlotInfo(b.timing).slotKey === "evening").length})</span>
              </button>
            </div>

            {slotFilter === "all" && (
              <button
                onClick={() => setIsGroupedBySlot(!isGroupedBySlot)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>{isGroupedBySlot ? "🗂️ Grouped by Slot" : "▦ Grid Order"}</span>
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-slate-400 font-bold bg-white border border-slate-200/80 rounded-2xl shadow-xs">
              <span className="animate-pulse">Loading batch cards...</span>
            </div>
          ) : batches.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-bold bg-white border border-slate-200/80 rounded-2xl shadow-xs">
              No active batches assigned. Use &quot;+ Mark Batch Attendance&quot; to log attendance.
            </div>
          ) : (() => {
            const sortedBatches = sortBatchesByTiming(batches);
            const filteredBatches = sortedBatches.filter((b) => {
              if (slotFilter === "all") return true;
              return getBatchSlotInfo(b.timing).slotKey === slotFilter;
            });

            if (filteredBatches.length === 0) {
              return (
                <div className="py-12 text-center text-slate-400 font-bold bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                  No batches found in the selected time slot.
                </div>
              );
            }

            const renderBatchBlockCard = (batch: any) => {
              const slotInfo = getBatchSlotInfo(batch.timing);
              const bMongoId = batch._id ? String(batch._id) : "";
              const bCustomId = batch.batchId ? String(batch.batchId).trim() : "";
              const batchLogs = logs.filter((l) => {
                const lBId = l.batchId ? String(l.batchId).trim() : "";
                return (bMongoId && lBId === bMongoId) || (bCustomId && lBId === bCustomId);
              });
              const latestLog = batchLogs[0];

              const arrayCount = Array.isArray(batch.students) ? batch.students.length : 0;
              const dbCount = Number(batch.enrolledStudentsCount || batch.studentsCount || 0);
              const logCount = latestLog ? Number(latestLog.totalStudents || 0) : 0;
              const enrolledCount = Math.max(arrayCount, dbCount, logCount);

              const lastDateStr = latestLog
                ? latestLog.dateStr || new Date(latestLog.date).toLocaleDateString("en-GB")
                : "No logs recorded yet";

              const presentCount = latestLog ? Number(latestLog.totalPresent || 0) : 0;
              const totalCount = latestLog
                ? Number(latestLog.totalStudents || enrolledCount)
                : enrolledCount;

              const ratePct = totalCount > 0
                ? Math.round((presentCount / totalCount) * 100)
                : 0;

              return (
                <div
                  key={batch._id}
                  className="bg-white border border-slate-200/90 hover:border-indigo-300 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  {/* Block Header */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xl shrink-0 shadow-2xs">
                        🎓
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {batch.batchId && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                              {batch.batchId}
                            </span>
                          )}
                          <h3 className="text-base font-black text-slate-800 tracking-tight truncate">
                            {batch.batchName}
                          </h3>
                        </div>
                        <span className="text-[11px] font-bold text-indigo-600 block truncate">
                          {batch.course || "General Batch"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                          ratePct >= 80
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : ratePct >= 50
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {ratePct}% Rate
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border ${slotInfo.badgeBg} ${slotInfo.badgeText} ${slotInfo.badgeBorder} flex items-center gap-1`}
                      >
                        <span>{slotInfo.icon}</span>
                        <span>{slotInfo.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Block Details Grid */}
                  <div className="space-y-2.5 text-xs">
                    {/* Batch Timing */}
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2">
                      <span className="font-bold text-slate-500 flex items-center gap-1.5">
                        <span>⏰</span> Batch Timing:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-indigo-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                          {batch.timing || "10:00 AM - 12:00 PM"}
                        </span>
                        <button
                          onClick={() => setQuickEditBatch(batch)}
                          className="text-[11px] p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Edit Timing & Start Date"
                        >
                          ✏️
                        </button>
                      </div>
                    </div>

                    {/* Batch Start Date */}
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2">
                      <span className="font-bold text-slate-500 flex items-center gap-1.5">
                        <span>🗓️</span> Start Date:
                      </span>
                      <span className="font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                        {formatBatchDate(batch.startDate)}
                      </span>
                    </div>

                    {/* Enrolled Students Count */}
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2">
                      <span className="font-bold text-slate-500 flex items-center gap-1.5">
                        <span>👥</span> Enrolled Students:
                      </span>
                      <span className="font-black text-slate-800 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                        {enrolledCount} Students
                      </span>
                    </div>

                    {/* Last Date Attendance Taken */}
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2">
                      <span className="font-bold text-slate-500 flex items-center gap-1.5">
                        <span>📅</span> Last Date Taken:
                      </span>
                      <span className="font-bold text-slate-700">
                        {lastDateStr}
                      </span>
                    </div>

                    {/* Attendance Record (Present out of Total) */}
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2">
                      <span className="font-bold text-slate-500 flex items-center gap-1.5">
                        <span>📊</span> Latest Record:
                      </span>
                      <div className="font-black text-slate-800">
                        <span className="text-emerald-600 font-extrabold">{presentCount}</span> / {totalCount} Present
                      </div>
                    </div>
                  </div>

                  {/* Block Actions */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleOpenModalForBatch(batch.batchId || String(batch._id))}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>⚡</span> Mark Attendance
                    </button>

                    <button
                      onClick={() => setQuickEditBatch(batch)}
                      className="px-2.5 py-2.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 font-bold text-xs rounded-xl cursor-pointer transition-colors border border-slate-200"
                      title="Edit Batch Timing & Start Date"
                    >
                      ⏰
                    </button>

                    <button
                      onClick={() => {
                        setSelectedBatchId(batch._id);
                        setViewMode("HISTORY_LOGS");
                      }}
                      className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors border border-slate-200"
                      title="View Log History"
                    >
                      📜 History
                    </button>
                  </div>
                </div>
              );
            };

            if (slotFilter === "all" && isGroupedBySlot) {
              const slotBuckets = [
                {
                  key: "morning",
                  title: "Morning Slots",
                  subtitle: "08:00 AM - 12:00 PM",
                  icon: "🌅",
                  headerBg: "from-amber-500/10 to-transparent",
                  headerBorder: "border-amber-200",
                  headerText: "text-amber-800",
                  badge: "bg-amber-100 text-amber-800",
                  items: sortedBatches.filter((b) => getBatchSlotInfo(b.timing).slotKey === "morning"),
                },
                {
                  key: "afternoon",
                  title: "Afternoon Slots",
                  subtitle: "12:00 PM - 04:00 PM",
                  icon: "☀️",
                  headerBg: "from-sky-500/10 to-transparent",
                  headerBorder: "border-sky-200",
                  headerText: "text-sky-800",
                  badge: "bg-sky-100 text-sky-800",
                  items: sortedBatches.filter((b) => getBatchSlotInfo(b.timing).slotKey === "afternoon"),
                },
                {
                  key: "evening",
                  title: "Evening Slots",
                  subtitle: "04:00 PM - 08:00 PM",
                  icon: "🌆",
                  headerBg: "from-indigo-500/10 to-transparent",
                  headerBorder: "border-indigo-200",
                  headerText: "text-indigo-800",
                  badge: "bg-indigo-100 text-indigo-800",
                  items: sortedBatches.filter((b) => getBatchSlotInfo(b.timing).slotKey === "evening"),
                },
                {
                  key: "flexible",
                  title: "Flexible / Other Slots",
                  subtitle: "Custom Timings",
                  icon: "⏱️",
                  headerBg: "from-slate-500/10 to-transparent",
                  headerBorder: "border-slate-200",
                  headerText: "text-slate-700",
                  badge: "bg-slate-100 text-slate-700",
                  items: sortedBatches.filter((b) => getBatchSlotInfo(b.timing).slotKey === "flexible"),
                },
              ].filter((bucket) => bucket.items.length > 0);

              return (
                <div className="space-y-8">
                  {slotBuckets.map((bucket) => (
                    <div key={bucket.key} className="space-y-4">
                      <div className={`flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r ${bucket.headerBg} border ${bucket.headerBorder}`}>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{bucket.icon}</span>
                          <div>
                            <h2 className={`text-sm font-black ${bucket.headerText} tracking-tight`}>
                              {bucket.title}
                            </h2>
                            <p className="text-[11px] font-semibold text-slate-500">
                              {bucket.subtitle}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${bucket.badge}`}>
                          {bucket.items.length} Batch{bucket.items.length > 1 ? "es" : ""}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {bucket.items.map((b) => renderBatchBlockCard(b))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredBatches.map((b) => renderBatchBlockCard(b))}
              </div>
            );
          })()}
        </div>
      ) : (
        /* Attendance History Logs Table View */
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6">Batch Name</th>
                  <th className="py-3.5 px-6">Faculty Instructor</th>
                  <th className="py-3.5 px-6">Present / Total</th>
                  <th className="py-3.5 px-6">Rate</th>
                  <th className="py-3.5 px-6">Status Breakdown</th>
                  <th className="py-3.5 px-6 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Loading attendance records...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No attendance logs found. Click &quot;+ Mark Batch Attendance&quot; to log attendance.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isExpanded = expandedLogId === log._id;
                    const ratePct = log.totalStudents > 0
                      ? Math.round(((log.totalPresent + (log.totalLate || 0)) / log.totalStudents) * 100)
                      : 0;

                    return (
                      <React.Fragment key={log._id}>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-800">
                            {log.dateStr || new Date(log.date).toLocaleDateString("en-GB")}
                          </td>
                          <td className="py-4 px-6 font-bold text-indigo-700">
                            {log.batchName}
                            {log.course && (
                              <span className="block text-[10px] text-slate-400 font-medium">{log.course}</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-slate-700 font-bold">
                            👨‍🏫 {log.teacherName}
                          </td>
                          <td className="py-4 px-6 text-slate-800 font-bold">
                            <span className="text-emerald-600">{log.totalPresent}</span> / {log.totalStudents}
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`inline-block px-2 py-0.5 text-[10px] font-extrabold rounded-md border ${
                                ratePct >= 80
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : ratePct >= 50
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                            >
                              {ratePct}%
                            </span>
                          </td>
                          <td className="py-4 px-6 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-600">P:{log.totalPresent}</span>
                              <span className="text-rose-600">A:{log.totalAbsent}</span>
                              <span className="text-amber-600">L:{log.totalLate || 0}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log._id)}
                              className="px-3 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                            >
                              {isExpanded ? "Hide Roster" : "View Roster"}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Roster Details Drawer */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={7} className="p-4">
                              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                                  Student Roster Log for {log.batchName} ({log.dateStr})
                                </h4>
                                {log.notes && (
                                  <p className="text-xs italic text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    Notes: {log.notes}
                                  </p>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                                  {log.records?.map((rec: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs font-semibold"
                                    >
                                      <div>
                                        <p className="text-slate-800 font-bold">{rec.studentName}</p>
                                        <p className="text-[10px] text-slate-400">{rec.admissionId || "Enrolled"}</p>
                                      </div>
                                      <span
                                        className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md uppercase ${
                                          rec.status === "Present"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : rec.status === "Absent"
                                            ? "bg-rose-100 text-rose-800"
                                            : rec.status === "Late"
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-sky-100 text-sky-800"
                                        }`}
                                      >
                                        {rec.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Take Attendance Modal */}
      <TakeAttendanceModal
        isOpen={isTakeModalOpen}
        initialBatchId={modalBatchId}
        onClose={() => {
          setIsTakeModalOpen(false);
          setModalBatchId("");
        }}
        onSuccess={() => {
          setIsTakeModalOpen(false);
          setModalBatchId("");
          fetchData();
        }}
      />

      {/* Quick Edit Batch Timing & Start Date Modal */}
      {quickEditBatch && (
        <QuickEditBatchTimingModal
          batch={quickEditBatch}
          onClose={() => setQuickEditBatch(null)}
          onSuccess={() => {
            setQuickEditBatch(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function QuickEditBatchTimingModal({
  batch,
  onClose,
  onSuccess,
}: {
  batch: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [timing, setTiming] = useState(batch.timing || "10:00 AM - 12:00 PM");
  const [startDate, setStartDate] = useState(() => {
    if (!batch.startDate) return new Date().toISOString().split("T")[0];
    try {
      return new Date(batch.startDate).toISOString().split("T")[0];
    } catch (_) {
      return new Date().toISOString().split("T")[0];
    }
  });
  const [endDate, setEndDate] = useState(() => {
    if (!batch.endDate) return "";
    try {
      return new Date(batch.endDate).toISOString().split("T")[0];
    } catch (_) {
      return "";
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const timingPresets = [
    "08:00 AM - 10:00 AM",
    "09:30 AM - 11:30 AM",
    "10:00 AM - 12:00 PM",
    "11:00 AM - 01:00 PM",
    "12:00 PM - 02:00 PM",
    "01:00 PM - 03:00 PM",
    "02:00 PM - 04:00 PM",
    "04:00 PM - 06:00 PM",
    "05:00 PM - 07:00 PM",
    "06:00 PM - 08:00 PM",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timing.trim()) {
      setErrorMsg("Timing cannot be empty.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");

      const res = await fetch(`/api/batches/${batch._id || batch.batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timing: timing.trim(),
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        onSuccess();
      } else {
        setErrorMsg(json.error || "Failed to update batch timing.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update batch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-white/10 text-white flex items-center justify-center font-bold text-lg">
              ⏰
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                Update Batch Timing & Slot
              </h3>
              <p className="text-xs text-slate-300">
                {batch.batchName} • {batch.course || "General Batch"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Batch Timing */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Batch Timing / Slot <span className="text-rose-500">*</span></span>
              <span className="text-[10px] text-slate-400 font-semibold">e.g. 10:00 AM - 12:00 PM</span>
            </label>
            <input
              type="text"
              value={timing}
              onChange={(e) => setTiming(e.target.value)}
              placeholder="e.g. 10:00 AM - 12:00 PM"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              required
            />

            {/* Timing Quick Presets */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400">Presets:</span>
              {timingPresets.slice(0, 5).map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setTiming(preset)}
                  className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold transition-colors cursor-pointer ${
                    timing === preset
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Start & End Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                End Date <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
            >
              {isSubmitting ? "Saving..." : "Save Timing & Slot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

