"use client";

import React, { useState, useEffect } from "react";
import TakeAttendanceModal from "./TakeAttendanceModal";
import { useUser } from "@/app/component/context/user-context";

export default function AttendanceDisplay() {
  const { user } = useUser();
  const [logs, setLogs] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTakeModalOpen, setIsTakeModalOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("All Batches");
  const [filterDate, setFilterDate] = useState<string>("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

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
    if (selectedBatchId !== "All Batches" && log.batchId !== selectedBatchId) {
      return false;
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
            Batch Attendance Center
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Log daily student attendance, monitor batch presence rates, and audit logs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsTakeModalOpen(true)}
            className="flex items-center gap-2 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl px-5 py-2.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <span>📋</span> + Take Batch Attendance
          </button>
        </div>
      </div>

      {/* KPI Cards */}
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

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none cursor-pointer w-full sm:w-60"
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
            className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none w-full sm:w-auto"
          />

          {filterDate && (
            <button
              onClick={() => setFilterDate("")}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 px-2 py-1 bg-rose-50 rounded-lg"
            >
              Clear Date
            </button>
          )}
        </div>

        <div className="text-xs font-semibold text-slate-400">
          Showing <strong className="text-slate-700">{filteredLogs.length}</strong> attendance session logs
        </div>
      </div>

      {/* Attendance History Logs Table */}
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
                    No attendance logs found. Click &quot;+ Take Batch Attendance&quot; to log attendance.
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

      {/* Take Attendance Modal */}
      <TakeAttendanceModal
        isOpen={isTakeModalOpen}
        onClose={() => setIsTakeModalOpen(false)}
        onSuccess={() => {
          setIsTakeModalOpen(false);
          fetchData();
        }}
      />
    </div>
  );
}
