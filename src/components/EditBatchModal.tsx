"use client";

import React, { useState, useEffect } from "react";

interface EditBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: any | null;
  onSuccess: () => void;
}

export default function EditBatchModal({
  isOpen,
  onClose,
  batch,
  onSuccess,
}: EditBatchModalProps) {
  const [batchName, setBatchName] = useState("");
  const [course, setCourse] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [brand, setBrand] = useState("");
  const [timing, setTiming] = useState("");
  const [status, setStatus] = useState("Upcoming");
  const [maxCapacity, setMaxCapacity] = useState(30);
  const [notes, setNotes] = useState("");

  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen || !batch) return;

    setBatchName(batch.batchName || "");
    setCourse(batch.course || "");
    setTeacherId(batch.teacherId || "");
    setBrand(batch.brand || "");
    setTiming(batch.timing || "");
    setStatus(batch.status || "Upcoming");
    setMaxCapacity(batch.maxCapacity || 30);
    setNotes(batch.notes || "");

    // Fetch teachers list for re-assignment
    fetch("/api/teachers")
      .then((r) => r.json())
      .then((res) => {
        if (res.success || res.teachers) {
          setTeachersList(res.data || res.teachers || []);
        }
      })
      .catch((err) => console.error("Failed to load teachers for edit modal:", err));
  }, [isOpen, batch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch?._id) return;

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const selectedTeacher = teachersList.find((t) => t._id === teacherId);

      const res = await fetch(`/api/batches/${batch._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchName: batchName.trim(),
          course,
          teacherId,
          teacherName: selectedTeacher ? selectedTeacher.name : batch.teacherName,
          timing,
          status,
          maxCapacity,
          notes: notes.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(json.error || "Failed to update batch.");
      }
    } catch (err: any) {
      setErrorMsg("Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !batch) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-8 animate-fade-in">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">
              Edit Batch / Reassign Faculty
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Update schedule, timing, or faculty assignment for {batch.batchName}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-semibold text-slate-700">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold text-xs">
              ⚠️ {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Batch Title
            </label>
            <input
              type="text"
              required
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Assigned Faculty
              </label>
              <select
                required
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-indigo-700"
              >
                {teachersList.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Batch Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
              >
                <option value="Upcoming">Upcoming</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Timing / Slot
              </label>
              <input
                type="text"
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Max Capacity
              </label>
              <input
                type="number"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Update Batch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
