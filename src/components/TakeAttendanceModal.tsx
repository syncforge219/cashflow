"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/app/component/context/user-context";

interface TakeAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialBatchId?: string;
}

export default function TakeAttendanceModal({
  isOpen,
  onClose,
  onSuccess,
  initialBatchId,
}: TakeAttendanceModalProps) {
  const { user } = useUser();
  const [batchesList, setBatchesList] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId || "");
  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [studentRecords, setStudentRecords] = useState<any[]>([]);
  const [notes, setNotes] = useState("");

  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Fetch faculty's assigned batches when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchBatches = async () => {
      setIsLoadingBatches(true);
      try {
        let url = "/api/batches";
        if (user?.role === "teacher" && user?.id) {
          url += `?teacherId=${user.id}`;
        } else if (user?.brandScope) {
          url += `?brand=${encodeURIComponent(user.brandScope)}`;
        }

        const res = await fetch(url);
        const json = await res.json();

        if (res.ok && json.success && (json.data || json.batches)) {
          const bList = json.data || json.batches || [];
          setBatchesList(bList);

          if (bList.length > 0) {
            const initialId = initialBatchId && bList.some((b: any) => b._id === initialBatchId)
              ? initialBatchId
              : bList[0]._id;
            setSelectedBatchId(initialId);
          }
        }
      } catch (err) {
        console.error("Failed to load batches for attendance modal:", err);
      } finally {
        setIsLoadingBatches(false);
      }
    };

    fetchBatches();
  }, [isOpen, initialBatchId, user]);

  // Load student roster & existing attendance log when selected batch or date changes
  useEffect(() => {
    if (!isOpen || !selectedBatchId) return;

    const fetchRosterAndExistingLog = async () => {
      setIsLoadingRoster(true);
      setErrorMsg("");
      setSuccessMsg("");

      try {
        // First, check if attendance log already exists for this batch on selected date
        const existingRes = await fetch(
          `/api/attendance?batchId=${selectedBatchId}&dateStr=${attendanceDate}`
        );
        const existingJson = await existingRes.json();

        if (existingRes.ok && existingJson.success && existingJson.data?.length > 0) {
          const existingLog = existingJson.data[0];
          setStudentRecords(existingLog.records || []);
          setNotes(existingLog.notes || "");
          setSuccessMsg("Loaded existing attendance log for this date.");
        } else {
          // If no existing log, fetch roster for batch
          const rosterRes = await fetch(
            `/api/attendance?batchId=${selectedBatchId}&rosterOnly=true`
          );
          const rosterJson = await rosterRes.json();

          if (rosterRes.ok && rosterJson.success) {
            setStudentRecords(rosterJson.roster || []);
          }
        }
      } catch (err) {
        console.error("Error loading roster:", err);
        setErrorMsg("Failed to load student roster.");
      } finally {
        setIsLoadingRoster(false);
      }
    };

    fetchRosterAndExistingLog();
  }, [isOpen, selectedBatchId, attendanceDate]);

  const handleStatusChange = (index: number, newStatus: "Present" | "Absent" | "Late" | "Excused") => {
    setStudentRecords((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status: newStatus };
      return updated;
    });
  };

  const handleRemarkChange = (index: number, remark: string) => {
    setStudentRecords((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], remarks: remark };
      return updated;
    });
  };

  const handleMarkAll = (status: "Present" | "Absent") => {
    setStudentRecords((prev) =>
      prev.map((r) => ({ ...r, status }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) {
      setErrorMsg("Please select a batch.");
      return;
    }
    if (!attendanceDate) {
      setErrorMsg("Please select a valid date.");
      return;
    }
    if (studentRecords.length === 0) {
      setErrorMsg("No students found in this batch roster to mark attendance.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const selectedBatch = batchesList.find((b) => b._id === selectedBatchId);
      const batchName = selectedBatch ? selectedBatch.batchName : "Faculty Batch";
      const course = selectedBatch ? selectedBatch.course : "";
      const brand = selectedBatch ? selectedBatch.brand : user?.brandScope || "";

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: selectedBatchId,
          batchName,
          course,
          date: attendanceDate,
          teacherId: user?.id || user?._id || selectedBatch?.teacherId || "000000000000000000000000",
          teacherName: user?.name || selectedBatch?.teacherName || "Faculty Instructor",
          brand,
          records: studentRecords,
          notes: notes.trim(),
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(json.error || "Failed to save attendance.");
      }
    } catch (err: any) {
      setErrorMsg("Network error saving attendance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totalPresent = studentRecords.filter((r) => r.status === "Present").length;
  const totalAbsent = studentRecords.filter((r) => r.status === "Absent").length;
  const totalLate = studentRecords.filter((r) => r.status === "Late").length;
  const totalExcused = studentRecords.filter((r) => r.status === "Excused").length;
  const presentPct = studentRecords.length > 0
    ? Math.round(((totalPresent + totalLate) / studentRecords.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-6 animate-fade-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-slate-800 to-indigo-950 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
              <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                📋
              </span>
              Batch Student Attendance
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Mark daily attendance for enrolled students in your batch
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controls Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs font-semibold">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <div className="w-full sm:w-64">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Select Batch
              </label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                disabled={isLoadingBatches}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
              >
                {batchesList.length === 0 ? (
                  <option value="">No batches found</option>
                ) : (
                  batchesList.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.batchName} ({b.course})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Attendance Date
              </label>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-4">
            <button
              type="button"
              onClick={() => handleMarkAll("Present")}
              className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition-all"
            >
              ✓ Mark All Present
            </button>
            <button
              type="button"
              onClick={() => handleMarkAll("Absent")}
              className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg text-xs font-bold transition-all"
            >
              ✕ Mark All Absent
            </button>
          </div>
        </div>

        {/* Realtime Attendance Stats Summary Bar */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between text-xs font-bold shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-slate-500">Students: <strong className="text-slate-800">{studentRecords.length}</strong></span>
            <span className="text-emerald-600">Present: <strong>{totalPresent}</strong></span>
            <span className="text-rose-600">Absent: <strong>{totalAbsent}</strong></span>
            <span className="text-amber-600">Late: <strong>{totalLate}</strong></span>
            <span className="text-sky-600">Excused: <strong>{totalExcused}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Attendance Rate:</span>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200 font-extrabold text-xs">
              {presentPct}%
            </span>
          </div>
        </div>

        {/* Student Roster List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold text-xs">
              ⚠️ {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-bold text-xs">
              ℹ️ {successMsg}
            </div>
          )}

          {isLoadingRoster ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-400">
              Loading student roster...
            </div>
          ) : studentRecords.length === 0 ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-400">
              No enrolled students found for this batch. Select another batch or check admissions.
            </div>
          ) : (
            studentRecords.map((record, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  record.status === "Present"
                    ? "border-emerald-200/80 bg-emerald-50/30"
                    : record.status === "Absent"
                    ? "border-rose-200/80 bg-rose-50/30"
                    : record.status === "Late"
                    ? "border-amber-200/80 bg-amber-50/30"
                    : "border-sky-200/80 bg-sky-50/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                    {(record.studentName || "S").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">{record.studentName}</h4>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      ID: <span className="text-slate-600">{record.admissionId || "N/A"}</span>
                      {record.mobileNumber && ` | Mobile: ${record.mobileNumber}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                    {(["Present", "Absent", "Late", "Excused"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleStatusChange(idx, st)}
                        className={`px-2.5 py-1 text-xs font-extrabold rounded-lg transition-all ${
                          record.status === st
                            ? st === "Present"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : st === "Absent"
                              ? "bg-rose-600 text-white shadow-xs"
                              : st === "Late"
                              ? "bg-amber-600 text-white shadow-xs"
                              : "bg-sky-600 text-white shadow-xs"
                            : "text-slate-400 hover:text-slate-700"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Remarks..."
                    value={record.remarks || ""}
                    onChange={(e) => handleRemarkChange(idx, e.target.value)}
                    className="w-36 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Notes & Submit */}
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-4 shrink-0">
          <input
            type="text"
            placeholder="Class topic or session notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-500"
          />

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || studentRecords.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? "Saving..." : "Save Attendance Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
