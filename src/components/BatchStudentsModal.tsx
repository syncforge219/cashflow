"use client";

import React, { useState, useEffect, useMemo } from "react";

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

  // Add Student Sub-Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [allBrandStudents, setAllBrandStudents] = useState<any[]>([]);
  const [isLoadingBrandStudents, setIsLoadingBrandStudents] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "unassigned" | "assigned">("all");
  const [allocatingStudentId, setAllocatingStudentId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchEnrolledStudents = async () => {
    if (!batch) return;
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
      const bCustomBatchId = batch.batchId ? String(batch.batchId).trim() : "";

      // Deduplicate students by mobile or admissionId/studentName
      const studentMap = new Map<string, any>();

      admStudentsRaw.forEach((s: any) => {
        const studentBId = String(s.batchId || "").trim();
        const matchesBatch = (bIdStr && studentBId === bIdStr) ||
                             (bMongoId && studentBId === bMongoId) ||
                             (bCustomBatchId && studentBId === bCustomBatchId);

        if (matchesBatch) {
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

  useEffect(() => {
    setStudents([]);
    setSearchQuery("");
    setIsAddModalOpen(false);

    if (isOpen && batch) {
      fetchEnrolledStudents();
    }
  }, [isOpen, batch?._id, batch?.batchId]);

  // Load all students for the brand when opening the Add Student modal
  const fetchAllBrandStudents = async () => {
    if (!batch) return;
    setIsLoadingBrandStudents(true);
    try {
      const brandParam = batch.brand ? `?brand=${encodeURIComponent(batch.brand)}&limit=1000` : "?limit=1000";
      const res = await fetch(`/api/admissions${brandParam}`);
      const json = await res.json();
      if (res.ok && json.success && Array.isArray(json.data)) {
        setAllBrandStudents(json.data);
      } else {
        setAllBrandStudents([]);
      }
    } catch (err) {
      console.error("Failed to fetch brand students:", err);
      showToast("Failed to load student directory", "error");
    } finally {
      setIsLoadingBrandStudents(false);
    }
  };

  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
    setAddSearchQuery("");
    setFilterType("all");
    fetchAllBrandStudents();
  };

  // Handle allocating a student to this batch
  const handleAllocateStudent = async (student: any) => {
    if (!batch || !student?._id) return;
    const targetBatchId = batch.batchId || batch._id;
    const targetBatchName = batch.batchName;

    setAllocatingStudentId(student._id);
    try {
      const res = await fetch(`/api/admissions/${student._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch: targetBatchName,
          batchId: targetBatchId,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`Allocated ${student.fullName || student.studentFullName || "student"} to batch ${batch.batchId ? `[${batch.batchId}] ` : ""}${batch.batchName}!`);
        
        // Update local brand students list
        setAllBrandStudents((prev) =>
          prev.map((s) =>
            s._id === student._id ? { ...s, batch: targetBatchName, batchId: targetBatchId } : s
          )
        );

        // Refresh batch roster
        await fetchEnrolledStudents();
      } else {
        showToast(json.error || json.message || "Failed to allocate student to batch", "error");
      }
    } catch (err: any) {
      console.error("Allocation error:", err);
      showToast("An error occurred during allocation", "error");
    } finally {
      setAllocatingStudentId(null);
    }
  };

  // Handle removing a student from this batch
  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to remove ${studentName} from batch "${batch.batchName}"?`)) return;

    setAllocatingStudentId(studentId);
    try {
      const res = await fetch(`/api/admissions/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch: "Unassigned",
          batchId: "",
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`Removed ${studentName} from batch successfully.`);
        setStudents((prev) => prev.filter((s) => s._id !== studentId));
      } else {
        showToast(json.error || json.message || "Failed to remove student", "error");
      }
    } catch (err) {
      console.error("Remove error:", err);
      showToast("An error occurred while removing student", "error");
    } finally {
      setAllocatingStudentId(null);
    }
  };

  // Filter Enrolled Students
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

  // Filter Brand Students in Add Modal
  const filteredBrandStudents = useMemo(() => {
    const currentBatchId = String(batch?.batchId || batch?._id || "").trim();
    const currentMongoId = batch?._id ? String(batch._id).trim() : "";

    return allBrandStudents.filter((s: any) => {
      const sBatchId = String(s.batchId || "").trim();
      const sBatchName = (s.batch || "").trim();
      const isAlreadyInBatch = (currentBatchId && sBatchId === currentBatchId) ||
                               (currentMongoId && sBatchId === currentMongoId) ||
                               (sBatchName === batch?.batchName && currentBatchId && sBatchId === currentBatchId);

      const isUnassigned = !sBatchName || sBatchName === "Unassigned" || sBatchName === "General Batch" || !sBatchId;

      if (filterType === "unassigned" && !isUnassigned) return false;
      if (filterType === "assigned" && isUnassigned) return false;

      if (!addSearchQuery.trim()) return true;
      const q = addSearchQuery.toLowerCase().trim();
      return (
        (s.fullName || s.studentFullName || "").toLowerCase().includes(q) ||
        (s.admissionId || "").toLowerCase().includes(q) ||
        (s.mobileNumber || s.phone || "").toLowerCase().includes(q) ||
        (s.course || "").toLowerCase().includes(q) ||
        (s.batch || "").toLowerCase().includes(q)
      );
    });
  }, [allBrandStudents, addSearchQuery, filterType, batch]);

  if (!isOpen || !batch) return null;

  const currentBatchIdentifier = String(batch.batchId || batch._id || "").trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] relative">
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-extrabold flex items-center gap-2 animate-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === "success"
              ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20"
              : "bg-rose-600 text-white border-rose-500 shadow-rose-600/20"
          }`}>
            <span>{toastMessage.type === "success" ? "✓" : "⚠️"}</span>
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-start justify-between relative shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-lg text-[10px] font-extrabold uppercase tracking-wider">
                Batch Roster
              </span>
              {batch.batchId && (
                <span className="px-2.5 py-0.5 bg-white/20 text-white font-mono text-[10px] font-extrabold rounded-lg">
                  {batch.batchId}
                </span>
              )}
              {batch.brand && (
                <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold">
                  🏢 {batch.brand}
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

        {/* Search & Action Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-80">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roster by name, ID, phone..."
              className="w-full pl-8 pr-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span>Enrolled:</span>
              <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-xl font-extrabold text-xs">
                👨‍🎓 {students.length} Students
              </span>
            </div>

            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <span>➕</span>
              <span>Add / Allocate Student</span>
            </button>
          </div>
        </div>

        {/* Student Roster Content Area */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 font-semibold text-xs">
              Loading enrolled students roster for {batch.batchName}...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-14 text-center space-y-3">
              <div className="h-14 w-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto text-2xl font-bold border border-amber-200/60 shadow-xs">
                ⚠️
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">
                  No Admitted Students Found in this Batch
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto font-medium pt-1">
                  {searchQuery
                    ? `No students matching "${searchQuery}" found in this batch.`
                    : `There are currently no students allocated to batch ${batch.batchId ? `[${batch.batchId}] ` : ""}"${batch.batchName}".`}
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={handleOpenAddModal}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-indigo-600/20 inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>➕</span>
                  <span>Allocate Students from {batch.brand || "Brand"}</span>
                </button>
              </div>
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
                        <div className="flex items-center justify-end gap-2">
                          {st.mobile && (
                            <>
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
                            </>
                          )}
                          {st._id && (
                            <button
                              onClick={() => handleRemoveStudent(st._id, st.name)}
                              disabled={allocatingStudentId === st._id}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-bold border border-rose-200 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Remove student from batch"
                            >
                              ✕ Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-semibold text-slate-400">
            Batch ID: <strong className="font-mono text-slate-600">{batch.batchId || batch._id}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Close Dialog
          </button>
        </div>

        {/* =================================================================== */}
        {/* ADD / ALLOCATE STUDENT MODAL (BRAND-SCOPED DIRECTORY) */}
        {/* =================================================================== */}
        {isAddModalOpen && (
          <div className="absolute inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
              
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-indigo-800 to-indigo-950 text-white flex items-start justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 bg-white/20 text-white text-[10px] font-extrabold uppercase rounded-lg">
                      Student Allocation
                    </span>
                    {batch.brand && (
                      <span className="px-2.5 py-0.5 bg-amber-400 text-slate-900 text-[10px] font-extrabold rounded-lg">
                        🏢 {batch.brand}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                    ➕ Allocate Student to {batch.batchId ? `[${batch.batchId}] ` : ""}{batch.batchName}
                  </h3>
                  <p className="text-xs text-indigo-200 font-medium pt-0.5">
                    Search students of this brand and allocate them to this batch.
                  </p>
                </div>

                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-7 w-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Search & Filter Bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-200/80 space-y-2.5 shrink-0">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={addSearchQuery}
                    onChange={(e) => setAddSearchQuery(e.target.value)}
                    placeholder="Search by student name, admission ID, mobile, course, current batch..."
                    className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    autoFocus
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setFilterType("all")}
                    className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      filterType === "all"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    All Students ({allBrandStudents.length})
                  </button>
                  <button
                    onClick={() => setFilterType("unassigned")}
                    className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      filterType === "unassigned"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Unassigned ({allBrandStudents.filter((s) => !s.batch || s.batch === "Unassigned" || s.batch === "General Batch" || !s.batchId).length})
                  </button>
                  <button
                    onClick={() => setFilterType("assigned")}
                    className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      filterType === "assigned"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    In Other Batches
                  </button>
                </div>
              </div>

              {/* Student Directory List */}
              <div className="p-4 overflow-y-auto flex-1 space-y-2 custom-scrollbar">
                {isLoadingBrandStudents ? (
                  <div className="py-16 text-center text-slate-400 text-xs font-semibold">
                    Loading student directory...
                  </div>
                ) : filteredBrandStudents.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                    No students found matching your criteria.
                  </div>
                ) : (
                  filteredBrandStudents.map((s: any) => {
                    const studentId = s._id;
                    const studentName = s.fullName || s.studentFullName || "Student";
                    const sBatchId = String(s.batchId || "").trim();
                    const sBatchName = (s.batch || "").trim();
                    const isAlreadyInThisBatch = (currentBatchIdentifier && sBatchId === currentBatchIdentifier) ||
                                                 (batch._id && sBatchId === String(batch._id)) ||
                                                 (sBatchName === batch.batchName && currentBatchIdentifier && sBatchId === currentBatchIdentifier);

                    const isUnassigned = !sBatchName || sBatchName === "Unassigned" || sBatchName === "General Batch" || !sBatchId;

                    return (
                      <div
                        key={studentId}
                        className="p-3 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 hover:border-indigo-200 hover:shadow-xs transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-extrabold text-xs shrink-0 border border-indigo-100">
                            {(studentName || "S").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-slate-900 truncate">
                                {studentName}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {s.admissionId}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold truncate max-w-xs">
                                📚 {s.course || "General Course"}
                              </span>
                              {s.mobileNumber && (
                                <span className="text-[10px] font-mono text-slate-500">
                                  📞 {s.mobileNumber}
                                </span>
                              )}
                            </div>
                            <div className="pt-1">
                              {isAlreadyInThisBatch ? (
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                                  ✓ Currently Enrolled in this Batch
                                </span>
                              ) : isUnassigned ? (
                                <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                                  ⚠️ Unassigned (No Batch)
                                </span>
                              ) : (
                                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block">
                                  ⚡ Current Batch: {s.batchId ? `[${s.batchId}] ` : ""}{s.batch}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isAlreadyInThisBatch ? (
                            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 inline-block">
                              ✓ Enrolled
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAllocateStudent(s)}
                              disabled={allocatingStudentId === studentId}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-extrabold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            >
                              {allocatingStudentId === studentId ? (
                                <span>Saving...</span>
                              ) : (
                                <>
                                  <span>➕</span>
                                  <span>Allocate</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-semibold shrink-0">
                <span>Showing {filteredBrandStudents.length} students</span>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
