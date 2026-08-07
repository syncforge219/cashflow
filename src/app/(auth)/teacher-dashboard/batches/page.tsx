"use client";

import React, { useState, useEffect } from "react";
import TeacherSidebar from "@/components/TeacherSidebar";
import { useUser } from "@/app/component/context/user-context";

export default function TeacherBatchesPage() {
  const { user } = useUser();
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [courses, setCourses] = useState<string[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("All Courses");
  const [selectedBatchFilter, setSelectedBatchFilter] = useState("All Batches");
  const [assignedBatchMap, setAssignedBatchMap] = useState<Record<string, string>>({});
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"assign" | "directory">("assign");

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

      const fetchedAdmissions = admissionsRes.success ? (admissionsRes.data || admissionsRes.admissions || []) : [];
      
      // Filter students by teacher's assigned brand / courses if scope exists
      const userBrand = (user?.brandScope || (user as any)?.brand || "").trim().toLowerCase();
      const isBrandScoped = userBrand && userBrand !== "all brands" && userBrand !== "all" && userBrand !== "*";

      const relevantStudents = fetchedAdmissions.filter((adm: any) => {
        if (isBrandScoped) {
          const admBrand = (adm.brand || "").trim().toLowerCase();
          if (admBrand && admBrand !== userBrand) return false;
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
        initialMap[s._id || s.id] = s.batch || "";
      });
      setAssignedBatchMap(initialMap);

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
        body: JSON.stringify({ batch: targetBatch }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessToast(`Student batch updated to "${targetBatch || "Unassigned"}" successfully!`);
        setTimeout(() => setSuccessToast(null), 4000);
        // Refresh local student list
        setStudents((prev) =>
          prev.map((s) => (s._id === studentId || s.id === studentId ? { ...s, batch: targetBatch } : s))
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

  // Filtered Students List
  const filteredStudents = students.filter((s) => {
    if (selectedCourseFilter !== "All Courses" && s.course !== selectedCourseFilter) return false;
    if (selectedBatchFilter !== "All Batches") {
      if (selectedBatchFilter === "Unassigned") {
        if (s.batch && s.batch.trim() !== "" && s.batch !== "Unassigned" && s.batch !== "Regular Batch") return false;
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

  const unassignedCount = students.filter(
    (s) => !s.batch || s.batch === "Unassigned" || s.batch === "Regular Batch" || s.batch.trim() === ""
  ).length;

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      {/* Teacher Navigation Sidebar */}
      <TeacherSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6 md:p-8 space-y-6">
        
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mb-1">
              <span>Teacher Portal</span>
              <span>/</span>
              <span className="text-indigo-600 font-extrabold">Student Batch Allocation</span>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              Student Batch Allocation
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Assign enrolled students to active course batches created by branch management.
            </p>
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

        {/* Student Batch Allocation Section */}
        <div className="space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Enrolled Students</span>
                <span className="text-2xl font-black text-slate-800 tracking-tight">{students.length}</span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block mb-1">Needs Batch Assignment</span>
                <span className="text-2xl font-black text-amber-600 tracking-tight">{unassignedCount}</span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">Assigned to Batches</span>
                <span className="text-2xl font-black text-emerald-600 tracking-tight">{students.length - unassignedCount}</span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-1">Available Batches</span>
                <span className="text-2xl font-black text-indigo-600 tracking-tight">{batches.length}</span>
              </div>
            </div>

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

            {/* Students Table & Batch Assigner */}
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
                          Loading enrolled students and batch schedules...
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
                        const isUnassigned = !currentBatch || currentBatch === "Unassigned" || currentBatch === "Regular Batch" || currentBatch.trim() === "";
                        const selectedBatch = assignedBatchMap[sId] ?? (currentBatch || "");
                        const isChanged = selectedBatch !== (currentBatch || "");

                        // Get batches relevant to student's course or all active batches
                        const courseBatches = batches.filter(
                          (b) => !b.course || b.course.toLowerCase().trim() === (student.course || "").toLowerCase().trim()
                        );
                        const availableOptions = courseBatches.length > 0 ? courseBatches : batches;

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
                                {availableOptions.map((b) => (
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

      </div>
    </div>
  );
}
