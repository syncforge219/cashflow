"use client";

import React, { useState, useEffect } from "react";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useUser } from "@/app/component/context/user-context";

// Helper to determine if a batch value represents an unassigned state
const isBatchUnassigned = (batchName?: string) => {
  if (!batchName) return true;
  const b = batchName.trim().toLowerCase();
  return !b || b === "unassigned" || b === "general batch" || b === "regular batch" || b === "n/a" || b === "none";
};

export default function TeacherBatchesPage() {
  const { user } = useUser();
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [courses, setCourses] = useState<string[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

  // View state: 'batches' (show batch cards first) vs 'students' (flat student table)
  const [activeTab, setActiveTab] = useState<"batches" | "students">("batches");
  // Expanded batch ID or 'UNASSIGNED'
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("All Courses");
  const [selectedBatchFilter, setSelectedBatchFilter] = useState("All Batches");
  const [assignedBatchMap, setAssignedBatchMap] = useState<Record<string, string>>({});
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Fetch batches & enrolled students
  const fetchData = async () => {
    try {
      setIsLoadingStudents(true);
      const userId = user?._id || user?.id;
      const userName = (user?.name || "").trim().toLowerCase();
      const batchesUrl = userId ? `/api/batches?teacherId=${userId}` : "/api/batches";

      const [batchesRes, admissionsRes] = await Promise.all([
        fetch(batchesUrl).then((r) => r.json().catch(() => ({}))),
        fetch("/api/admissions").then((r) => r.json().catch(() => ({}))),
      ]);

      const fetchedBatches = batchesRes.success ? (batchesRes.data || batchesRes.batches || []) : [];

      // Filter batches to only show those assigned to the current logged-in teacher
      const teacherBatches = fetchedBatches.filter((b: any) => {
        if (!userId && !userName) return true;
        const bTeacherId = b.teacherId ? String(b.teacherId._id || b.teacherId.id || b.teacherId) : "";
        const idMatch = Boolean(userId && bTeacherId && bTeacherId === String(userId));
        const nameMatch = Boolean(userName && b.teacherName && b.teacherName.trim().toLowerCase().includes(userName));
        return idMatch || nameMatch;
      });

      setBatches(teacherBatches);

      const teacherBatchNames = new Set(teacherBatches.map((b: any) => (b.batchName || "").trim().toLowerCase()));
      const fetchedAdmissions = admissionsRes.success ? (admissionsRes.data || admissionsRes.admissions || []) : [];
      
      // Filter students by teacher's assigned brand / courses if scope exists
      const userBrand = (user?.brandScope || (user as any)?.brand || "").trim().toLowerCase();
      const isBrandScoped = userBrand && userBrand !== "all brands" && userBrand !== "all" && userBrand !== "*";

      const relevantStudents = fetchedAdmissions.filter((adm: any) => {
        if (isBrandScoped) {
          const admBrand = (adm.brand || "").trim().toLowerCase();
          if (admBrand && admBrand !== userBrand) return false;
        }

        // If student is assigned to a specific batch, ensure it belongs to this teacher
        if (!isBatchUnassigned(adm.batch)) {
          const studentBatch = (adm.batch || "").trim().toLowerCase();
          if (teacherBatchNames.size > 0 && !teacherBatchNames.has(studentBatch)) {
            return false;
          }
        }
        return true;
      });

      setStudents(relevantStudents);

      // Extract unique course list
      const uniqueCourses = Array.from(new Set(relevantStudents.map((s: any) => s.course).filter(Boolean))) as string[];
      setCourses(uniqueCourses);

      // Initialize batch selection map for each student
      const initialMap: Record<string, string> = {};
      relevantStudents.forEach((s: any) => {
        initialMap[s._id || s.id] = isBatchUnassigned(s.batch) ? "" : (s.batch || "");
      });
      setAssignedBatchMap(initialMap);

      // Auto-expand first batch if batches exist
      if (teacherBatches.length > 0 && !expandedBatchId) {
        setExpandedBatchId(teacherBatches[0]._id || teacherBatches[0].batchName);
      }

    } catch (err) {
      console.error("Failed to load teacher batches and students:", err);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Handle assign batch to student
  const handleAssignBatch = async (studentId: string) => {
    const targetBatch = assignedBatchMap[studentId];
    if (targetBatch === undefined) return;

    setUpdatingStudentId(studentId);
    try {
      const res = await fetch(`/api/admissions/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: targetBatch || "Unassigned" }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const savedBatch = targetBatch || "Unassigned";
        setSuccessToast(`Student batch updated to "${savedBatch}" successfully!`);
        setTimeout(() => setSuccessToast(null), 4000);
        // Refresh local student list
        setStudents((prev) =>
          prev.map((s) => (s._id === studentId || s.id === studentId ? { ...s, batch: savedBatch } : s))
        );
      } else {
        alert(json.message || "Failed to assign batch.");
      }
    } catch (err) {
      console.error("Error assigning batch:", err);
      alert("An error occurred while updating batch assignment.");
    } finally {
      setUpdatingStudentId(null);
    }
  };

  // Helper to get students enrolled in a specific batch
  const getStudentsInBatch = (batchName: string) => {
    return students.filter(
      (s) => s.batch && s.batch.trim().toLowerCase() === batchName.trim().toLowerCase()
    );
  };

  // Unassigned students
  const unassignedStudents = students.filter((s) => isBatchUnassigned(s.batch));
  const unassignedCount = unassignedStudents.length;

  // Filtered Students List for Directory View
  const filteredStudents = students.filter((s) => {
    if (selectedCourseFilter !== "All Courses" && s.course !== selectedCourseFilter) return false;
    if (selectedBatchFilter !== "All Batches") {
      if (selectedBatchFilter === "Unassigned") {
        if (!isBatchUnassigned(s.batch)) return false;
      } else if (s.batch !== selectedBatchFilter) {
        return false;
      }
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.fullName || s.studentFullName || "").toLowerCase().includes(q) ||
      (s.mobileNumber || s.phone || "").toLowerCase().includes(q) ||
      (s.admissionId || "").toLowerCase().includes(q) ||
      (s.course || "").toLowerCase().includes(q) ||
      (s.batch || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      {/* Teacher Navigation Sidebar */}
      <TeacherSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6 md:p-8 space-y-6">
        
        {/* Header Title & Tab Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mb-1">
              <span>Teacher Portal</span>
              <span>/</span>
              <span className="text-indigo-600 font-extrabold">Assigned Batches & Students</span>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              My Assigned Batches
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Manage batches assigned to you and view enrolled students per batch.
            </p>
          </div>

          {/* View Tab Buttons */}
          <div className="flex items-center bg-slate-200/60 p-1 rounded-2xl gap-1 shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab("batches")}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === "batches"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 cursor-pointer"
              }`}
            >
              📁 My Batches ({batches.length})
            </button>
            <button
              onClick={() => setActiveTab("students")}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
                activeTab === "students"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 cursor-pointer"
              }`}
            >
              👥 All Students Allocation ({students.length})
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
            <span className="flex items-center gap-2">
              <span className="text-emerald-500 font-black">✓</span> {successToast}
            </span>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-500 hover:text-emerald-800 font-bold">×</button>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-1">My Assigned Batches</span>
            <span className="text-2xl font-black text-indigo-600 tracking-tight">{batches.length}</span>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">Assigned Students</span>
            <span className="text-2xl font-black text-emerald-600 tracking-tight">{students.length - unassignedCount}</span>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block mb-1">Needs Batch Allocation</span>
            <span className="text-2xl font-black text-amber-600 tracking-tight">{unassignedCount}</span>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Scope Students</span>
            <span className="text-2xl font-black text-slate-800 tracking-tight">{students.length}</span>
          </div>
        </div>

        {/* TAB 1: BATCH-FIRST VIEW (DEFAULT) */}
        {activeTab === "batches" ? (
          <div className="space-y-6">
            
            {/* Search and Helper Info */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="relative w-full sm:w-80">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter batches or student names..."
                  className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <p className="text-xs font-semibold text-slate-400">
                💡 Click on any batch name to expand and view enrolled students.
              </p>
            </div>

            {/* List of Batches assigned to teacher */}
            <div className="space-y-4">
              {isLoadingStudents ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400 font-semibold border border-slate-200/80">
                  Loading your assigned batches and student rosters...
                </div>
              ) : batches.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400 font-semibold border border-slate-200/80">
                  No active batches assigned to you at the moment.
                </div>
              ) : (
                batches
                  .filter((b) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    const matchBatch = (b.batchName || "").toLowerCase().includes(q) || (b.course || "").toLowerCase().includes(q);
                    const enrolled = getStudentsInBatch(b.batchName);
                    const matchStudent = enrolled.some((s) => (s.fullName || s.studentFullName || "").toLowerCase().includes(q));
                    return matchBatch || matchStudent;
                  })
                  .map((batch) => {
                    const bId = batch._id || batch.batchName;
                    const enrolledList = getStudentsInBatch(batch.batchName);
                    const isExpanded = expandedBatchId === bId;

                    return (
                      <div
                        key={bId}
                        className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:border-indigo-200"
                      >
                        {/* Batch Header Bar (Clickable) */}
                        <div
                          onClick={() => setExpandedBatchId(isExpanded ? null : bId)}
                          className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none bg-gradient-to-r hover:from-slate-50/80 hover:to-indigo-50/30 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md shadow-indigo-600/20">
                              ⚡
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-extrabold text-slate-800 hover:text-indigo-600 transition-colors">
                                  {batch.batchName}
                                </h3>
                                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-extrabold">
                                  {batch.status || "Active Batch"}
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                                <span>📚 Course: <strong className="text-slate-700">{batch.course || "General"}</strong></span>
                                {batch.timing && <span>⏰ Timing: <strong className="text-slate-700">{batch.timing}</strong></span>}
                                {batch.days && batch.days.length > 0 && <span>🗓️ Days: <strong className="text-slate-700">{Array.isArray(batch.days) ? batch.days.join(", ") : batch.days}</strong></span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                            <span className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-black">
                              👨‍🎓 {enrolledList.length} Students Enrolled
                            </span>
                            <button
                              className="h-8 w-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold hover:bg-indigo-600 hover:text-white transition-all"
                              aria-label="Expand Batch Students"
                            >
                              {isExpanded ? "▲" : "▼"}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Student List */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-6 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                                Enrolled Students in {batch.batchName} ({enrolledList.length})
                              </h4>
                            </div>

                            {enrolledList.length === 0 ? (
                              <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center text-xs font-semibold text-slate-400">
                                No students are currently assigned to this batch. You can assign unassigned students below.
                              </div>
                            ) : (
                              <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                      <th className="py-3 px-4">Student Details</th>
                                      <th className="py-3 px-4">Enrolled Course</th>
                                      <th className="py-3 px-4">Mobile / Contact</th>
                                      <th className="py-3 px-4 text-right">Reassign Batch</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                                    {enrolledList.map((student) => {
                                      const sId = student._id || student.id;
                                      const selectedBatch = assignedBatchMap[sId] ?? student.batch;
                                      const isChanged = selectedBatch !== student.batch;

                                      return (
                                        <tr key={sId} className="hover:bg-slate-50/80 transition-colors">
                                          <td className="py-3 px-4">
                                            <div className="flex items-center gap-2.5">
                                              <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-xs shrink-0">
                                                {(student.fullName || student.studentFullName || "S").charAt(0).toUpperCase()}
                                              </div>
                                              <div>
                                                <span className="font-extrabold text-slate-800 block text-xs">
                                                  {student.fullName || student.studentFullName || "Student"}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium block">
                                                  {student.admissionId || "ADM-N/A"}
                                                </span>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="py-3 px-4 text-slate-700">
                                            {student.course || "General"}
                                          </td>
                                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                                            {student.mobileNumber || student.phone || "N/A"}
                                          </td>
                                          <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                              <select
                                                value={selectedBatch}
                                                onChange={(e) =>
                                                  setAssignedBatchMap((prev) => ({ ...prev, [sId]: e.target.value }))
                                                }
                                                className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1 outline-none cursor-pointer"
                                              >
                                                <option value={batch.batchName}>{batch.batchName} (Current)</option>
                                                <option value="Unassigned">Unassigned (Remove from batch)</option>
                                                {batches
                                                  .filter((b) => b.batchName !== batch.batchName)
                                                  .map((b) => (
                                                    <option key={b._id || b.batchName} value={b.batchName}>
                                                      Move to: {b.batchName}
                                                    </option>
                                                  ))}
                                              </select>
                                              {isChanged && (
                                                <button
                                                  onClick={() => handleAssignBatch(sId)}
                                                  disabled={updatingStudentId === sId}
                                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                                                >
                                                  {updatingStudentId === sId ? "Saving..." : "Save"}
                                                </button>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}

              {/* Unassigned Students Section */}
              <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-5 shadow-xs transition-all">
                <div
                  onClick={() => setExpandedBatchId(expandedBatchId === "UNASSIGNED" ? null : "UNASSIGNED")}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm shadow-amber-500/20">
                      ⚠️
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800 hover:text-amber-600 transition-colors">
                        Unassigned Students Pool
                      </h3>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        Students awaiting assignment to one of your active batches.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <span className="px-3 py-1.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-black">
                      {unassignedCount} Students Needing Batch
                    </span>
                    <button
                      className="h-8 w-8 rounded-xl bg-white text-slate-600 border border-slate-200 flex items-center justify-center font-bold hover:bg-amber-500 hover:text-white transition-all"
                      aria-label="Expand Unassigned Students"
                    >
                      {expandedBatchId === "UNASSIGNED" ? "▲" : "▼"}
                    </button>
                  </div>
                </div>

                {/* Expanded Unassigned List */}
                {expandedBatchId === "UNASSIGNED" && (
                  <div className="mt-5 border-t border-amber-200/60 pt-4 animate-in slide-in-from-top-2 duration-200">
                    {unassignedCount === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs font-semibold text-emerald-600">
                        🎉 Great job! All enrolled students are currently assigned to active batches.
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              <th className="py-3 px-4">Student Details</th>
                              <th className="py-3 px-4">Enrolled Course</th>
                              <th className="py-3 px-4">Assign New Batch</th>
                              <th className="py-3 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                            {unassignedStudents.map((student) => {
                              const sId = student._id || student.id;
                              const selectedBatch = assignedBatchMap[sId] || "";
                              const isChanged = selectedBatch !== "";

                              return (
                                <tr key={sId} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-extrabold text-xs shrink-0">
                                        {(student.fullName || student.studentFullName || "S").charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <span className="font-extrabold text-slate-800 block text-xs">
                                          {student.fullName || student.studentFullName || "Student"}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium block">
                                          {student.admissionId || "ADM-N/A"}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-xs font-bold border border-indigo-100 inline-block">
                                      {student.course || "General Course"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <select
                                      value={selectedBatch}
                                      onChange={(e) =>
                                        setAssignedBatchMap((prev) => ({ ...prev, [sId]: e.target.value }))
                                      }
                                      className="w-full max-w-xs text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                                    >
                                      <option value="">Select Batch Assignment...</option>
                                      {batches.map((b) => (
                                        <option key={b._id || b.batchName} value={b.batchName}>
                                          {b.batchName} {b.timing ? `(${b.timing})` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      onClick={() => handleAssignBatch(sId)}
                                      disabled={updatingStudentId === sId || !isChanged}
                                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                                        isChanged
                                          ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 cursor-pointer"
                                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                      } disabled:opacity-50`}
                                    >
                                      {updatingStudentId === sId ? "Saving..." : "Save Assignment"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: DIRECTORY / ALL STUDENTS LIST VIEW */
          <div className="space-y-6">
            
            {/* Filter Controls */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student by name, mobile, ID..."
                  className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <select
                  value={selectedCourseFilter}
                  onChange={(e) => setSelectedCourseFilter(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
                >
                  <option value="All Courses">All Taught Courses</option>
                  {courses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={selectedBatchFilter}
                  onChange={(e) => setSelectedBatchFilter(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
                >
                  <option value="All Batches">All Batch Filters</option>
                  <option value="Unassigned">⚠️ Unassigned Students Only</option>
                  {batches.map((b) => (
                    <option key={b._id || b.batchName} value={b.batchName}>{b.batchName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Full Students Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-6">Student Details</th>
                      <th className="py-3.5 px-6">Enrolled Course</th>
                      <th className="py-3.5 px-6">Current Assigned Batch</th>
                      <th className="py-3.5 px-6">Assign New Batch</th>
                      <th className="py-3.5 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                    {isLoadingStudents ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                          Loading enrolled students...
                        </td>
                      </tr>
                    ) : filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                          No enrolled students found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => {
                        const sId = student._id || student.id;
                        const currentBatch = student.batch;
                        const isUnassigned = isBatchUnassigned(currentBatch);
                        const selectedBatch = assignedBatchMap[sId] ?? (isUnassigned ? "" : currentBatch);
                        const isChanged = selectedBatch !== (isUnassigned ? "" : (currentBatch || ""));

                        return (
                          <tr key={sId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs">
                                  {(student.fullName || student.studentFullName || "S").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-extrabold text-slate-800 block text-xs">
                                    {student.fullName || student.studentFullName || "Student"}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium block">
                                    {student.admissionId || "ADM-N/A"}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 inline-block">
                                {student.course || "General Course"}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              {isUnassigned ? (
                                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-[11px] font-bold border border-amber-200 inline-flex items-center gap-1">
                                  <span>⚠️</span> Unassigned
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-bold border border-emerald-200 inline-flex items-center gap-1">
                                  <span>⚡</span> {currentBatch}
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6">
                              <select
                                value={selectedBatch}
                                onChange={(e) =>
                                  setAssignedBatchMap((prev) => ({ ...prev, [sId]: e.target.value }))
                                }
                                className="w-full max-w-xs text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                              >
                                <option value="">Select Batch Assignment...</option>
                                <option value="Unassigned">Unassigned (No Batch)</option>
                                {batches.map((b) => (
                                  <option key={b._id || b.batchName} value={b.batchName}>
                                    {b.batchName} {b.timing ? `(${b.timing})` : ""}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <button
                                onClick={() => handleAssignBatch(sId)}
                                disabled={updatingStudentId === sId || !isChanged}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                  isChanged
                                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 cursor-pointer"
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                } disabled:opacity-50`}
                              >
                                {updatingStudentId === sId ? "Saving..." : "Save Assignment"}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
