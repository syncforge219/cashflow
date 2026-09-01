"use client";

import React, { useState, useEffect } from "react";

interface BatchStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: any | null;
}

export default function BatchStudentsModal({
  isOpen,
  onClose,
  batch,
}: BatchStudentsModalProps) {
  const [students, setStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setStudents([]);
    setSearchQuery("");

    if (!isOpen || !batch) {
      return;
    }

    const fetchEnrolledStudents = async () => {
      setIsLoading(true);
      try {
        const batchId = String(batch.batchId || batch._id || "").trim();
        const mongoBatchId = batch._id ? String(batch._id).trim() : "";

        if (!batchId && !mongoBatchId) {
          setStudents([]);
          return;
        }

        // Fetch students strictly by unique batchId
        const [admissionsRes, rosterRes] = await Promise.all([
          fetch(`/api/admissions?batchId=${encodeURIComponent(batchId)}`).then((r) => r.json().catch(() => ({}))),
          fetch(`/api/attendance?batchId=${encodeURIComponent(batchId)}&rosterOnly=true`).then((r) => r.json().catch(() => ({}))),
        ]);

        const admStudentsRaw = admissionsRes.success && Array.isArray(admissionsRes.data) ? admissionsRes.data : [];
        const rosterStudents = rosterRes.success && Array.isArray(rosterRes.roster) ? rosterRes.roster : [];

        const bIdStr = batchId;
        const bMongoId = mongoBatchId;

        // Strictly verify that student's batchId matches this exact batch
        const admStudents = admStudentsRaw.filter((s: any) => {
          const studentBId = String(s.batchId || "").trim();
          if (!studentBId) return false;
          return (bIdStr && studentBId === bIdStr) || (bMongoId && studentBId === bMongoId);
        });

        // Deduplicate students by mobile or admissionId/studentName
        const studentMap = new Map<string, any>();

        admStudents.forEach((s: any) => {
          const key = (s.mobileNumber || s.admissionId || s.fullName || "").trim().toLowerCase();
          if (key) {
            studentMap.set(key, {
              _id: s._id,
              name: s.fullName || s.studentFullName || "Student",
              admissionId: s.admissionId || "ADM-N/A",
              mobile: s.mobileNumber || s.phone || "",
              course: s.course || batch.course || "N/A",
              admissionDate: s.admissionDate ? new Date(s.admissionDate).toLocaleDateString("en-GB") : "-",
              brand: s.brand || batch.brand || "",
            });
          }
        });

        rosterStudents.forEach((r: any) => {
          const key = (r.mobileNumber || r.admissionId || r.studentName || "").trim().toLowerCase();
          if (key && !studentMap.has(key)) {
            studentMap.set(key, {
              _id: r._id || key,
              name: r.studentName || "Student",
              admissionId: r.admissionId || "ADM-N/A",
              mobile: r.mobileNumber || "",
              course: batch.course || "N/A",
              admissionDate: "-",
              brand: batch.brand || "",
            });
          }
        });

        setStudents(Array.from(studentMap.values()));
      } catch (err) {
        console.error("Failed to load batch student roster:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnrolledStudents();
  }, [isOpen, batch?._id, batch?.batchId]);

  if (!isOpen || !batch) return null;

  const filteredStudents = students.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (s.name || "").toLowerCase().includes(q) ||
      (s.admissionId || "").toLowerCase().includes(q) ||
      (s.mobile || "").toLowerCase().includes(q) ||
      (s.course || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-start justify-between relative shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-lg text-[10px] font-extrabold uppercase tracking-wider">
                Batch Roster
              </span>
              {batch.batchId && (
                <span className="px-2.5 py-0.5 bg-white/20 text-white font-mono text-[10px] font-extrabold rounded-lg">
                  {batch.batchId}
                </span>
              )}
              <span
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase border ${
                  batch.status === "Active"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : batch.status === "Upcoming"
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                    : batch.status === "Completed"
                    ? "bg-slate-500/20 text-slate-300 border-slate-500/30"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                }`}
              >
                {batch.status || "Active"}
              </span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              ⚡ {batch.batchName}
            </h2>
            <div className="text-xs text-indigo-200 font-semibold flex flex-wrap items-center gap-3 pt-1">
              <span>📚 Course: <strong className="text-white">{batch.course || "General"}</strong></span>
              {batch.timing && <span>⏰ Slot: <strong className="text-white">{batch.timing}</strong></span>}
              {batch.teacherName && <span>👨‍🏫 Faculty: <strong className="text-white">{batch.teacherName}</strong></span>}
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Search & Roster Summary Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-72">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student by name, ID, phone..."
              className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span>Enrolled Students:</span>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-xl font-extrabold text-xs">
              👨‍🎓 {students.length} Students
            </span>
          </div>
        </div>

        {/* Student Roster Content Area */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 font-semibold text-xs">
              Loading enrolled students roster for {batch.batchName}...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto text-xl font-bold">
                ⚠️
              </div>
              <h4 className="text-sm font-extrabold text-slate-800">
                No Admitted Students Found
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                {searchQuery
                  ? `No students matching "${searchQuery}" found in this batch.`
                  : `There are currently no students admitted/allocated to batch "${batch.batchName}".`}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Student Details</th>
                    <th className="py-3 px-4">Enrolled Course</th>
                    <th className="py-3 px-4">Contact Number</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                  {filteredStudents.map((st, idx) => (
                    <tr key={st._id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs">
                            {(st.name || "S").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-900 block text-xs">
                              {st.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {st.admissionId}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[11px] font-bold border border-indigo-100 inline-block">
                          {st.course}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {st.mobile || "N/A"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {st.mobile && (
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`https://wa.me/91${st.mobile.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold border border-emerald-200 transition-colors inline-flex items-center gap-1"
                              title="WhatsApp Student"
                            >
                              💬 WhatsApp
                            </a>
                            <a
                              href={`tel:${st.mobile}`}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold border border-blue-200 transition-colors inline-flex items-center gap-1"
                              title="Call Student"
                            >
                              📞 Call
                            </a>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Close Dialog
          </button>
        </div>

      </div>
    </div>
  );
}
