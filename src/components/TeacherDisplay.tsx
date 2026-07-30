"use client";

import React, { useState, useEffect } from "react";
import AddTeacherModal from "./AddTeacherModal";
import EditTeacherModal from "./EditTeacherModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import { useUser } from "@/app/component/context/user-context";

export default function TeacherDisplay() {
  const { user } = useUser();
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<any | null>(null);
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedBrandFilter, setSelectedBrandFilter] = useState("All Brands");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All Status");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm.length >= 3) {
        setDebouncedSearchTerm(searchTerm);
      } else {
        setDebouncedSearchTerm("");
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchTeachers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/teachers");
      const result = await res.json();
      if (result.success && (result.data || result.teachers)) {
        const rawData = result.data || result.teachers;
        const formattedData = rawData.map((u: any) => {
          const rawSubjects = u.subjects || u.subject;
          let subsArr: string[] = [];
          if (Array.isArray(rawSubjects)) {
            subsArr = rawSubjects.filter(Boolean);
          } else if (typeof rawSubjects === "string" && rawSubjects.trim()) {
            subsArr = rawSubjects.split(",").map((s: string) => s.trim()).filter(Boolean);
          }

          return {
            id: u._id.slice(-6).toUpperCase(),
            rawId: u._id,
            _id: u._id,
            name: u.name,
            initial: u.name
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .substring(0, 2)
              .toUpperCase() || "T",
            email: u.email,
            phone: u.phone || "No Phone",
            brand: u.brandScope || "Unassigned",
            brandScope: u.brandScope || "Unassigned",
            subjects: subsArr,
            subject: subsArr.length > 0 ? subsArr.join(", ") : "General Faculty",
            joined: u.joiningDate ? new Date(u.joiningDate).toLocaleDateString("en-GB") : new Date(u.createdAt).toLocaleDateString("en-GB"),
            status: "ACTIVE",
            registryId: `USER-${u._id.toUpperCase()}`,
            claim: "TEACHER",
            sync: "DB synchronized",
          };
        });
        setTeachersList(formattedData);
        if (formattedData.length > 0 && !selectedTeacherId) {
          setSelectedTeacherId(formattedData[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch teachers", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const confirmDeleteTeacher = async () => {
    if (!teacherToDelete) return;
    setIsDeleting(true);
    try {
      const targetId = teacherToDelete.rawId || teacherToDelete._id;
      const res = await fetch(`/api/teachers/${targetId}`, { method: "DELETE" });
      if (res.ok) {
        fetchTeachers();
        if (selectedTeacherId === teacherToDelete.id) setSelectedTeacherId(null);
        setTeacherToDelete(null);
      } else {
        alert("Failed to delete teacher");
      }
    } catch (e) {
      alert("Error deleting teacher");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter logic
  const roleLower = (user?.role || "").toLowerCase().trim();
  const isBrandManager =
    roleLower === "brand manager" ||
    roleLower === "brand_manager" ||
    roleLower === "brand-manager" ||
    roleLower === "centre head" ||
    roleLower === "centre_head" ||
    roleLower === "center head" ||
    roleLower === "center_head" ||
    roleLower === "manager";
  const userBrandScope = user?.brandScope;

  const brandsList = Array.from(new Set(teachersList.map((t) => t.brand).filter(Boolean)));

  const filteredTeachers = teachersList.filter((t) => {
    // Brand Manager scope lock
    if (isBrandManager && userBrandScope) {
      if (t.brand.toLowerCase() !== userBrandScope.toLowerCase()) return false;
    } else if (selectedBrandFilter !== "All Brands") {
      if (t.brand !== selectedBrandFilter) return false;
    }

    if (selectedStatusFilter !== "All Status" && t.status !== selectedStatusFilter) {
      return false;
    }

    if (!debouncedSearchTerm && !searchTerm) return true;
    const lower = (debouncedSearchTerm || searchTerm).toLowerCase();
    return (
      t.name.toLowerCase().includes(lower) ||
      t.email.toLowerCase().includes(lower) ||
      t.id.toLowerCase().includes(lower) ||
      t.subject.toLowerCase().includes(lower) ||
      t.phone.toLowerCase().includes(lower)
    );
  });

  const selectedTeacher = teachersList.find((t) => t.id === selectedTeacherId) || filteredTeachers[0] || null;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative font-sans">
      <div className="p-8 pb-32 flex-1 flex flex-col">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 mb-8">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Teachers Directory</h1>
            <p className="text-sm font-semibold text-slate-400 mt-1 max-w-xl">
              Review teacher directories, access-control privileges, and supervisor rosters.
            </p>
          </div>

          {/* Header buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2.5 shadow-md shadow-indigo-600/20 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Teacher
            </button>
          </div>
        </div>

        {/* Main split content */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 flex-1 min-h-0">

          {/* Left Column: List */}
          <div className="xl:col-span-3 flex flex-col min-h-0 bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">

            {/* Search bar & Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 mb-4 pb-4 border-b border-slate-100">
              <div className="relative flex-1 w-full">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search teachers by employee ID, email, name..."
                  className="w-full pl-9 pr-4 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                {!isBrandManager && (
                  <select
                    value={selectedBrandFilter}
                    onChange={(e) => setSelectedBrandFilter(e.target.value)}
                    className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none cursor-pointer appearance-none min-w-[120px]"
                  >
                    <option value="All Brands">All Brands</option>
                    {brandsList.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none cursor-pointer appearance-none min-w-[120px]"
                >
                  <option value="All Status">All Status</option>
                  <option value="ACTIVE">ACTIVE</option>
                </select>

                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 shrink-0">
                  <button className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 transition-all" title="Export">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                  </button>
                  <button className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 transition-all" title="Analytics">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                    </svg>
                  </button>
                  <button className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 transition-all" title="Reports">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Cards List */}
            <div className="overflow-y-auto flex-1 pr-2 space-y-3 custom-scrollbar">
              {isLoading ? (
                <div className="p-8 text-center text-sm font-semibold text-slate-400">Loading teachers...</div>
              ) : filteredTeachers.length === 0 ? (
                <div className="p-8 text-center text-sm font-semibold text-slate-400">No teachers found.</div>
              ) : (
                filteredTeachers.map((teacher, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedTeacherId(teacher.id)}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer group ${selectedTeacherId === teacher.id
                      ? "border-indigo-100 bg-indigo-50/30"
                      : "border-slate-100 bg-white hover:border-slate-200"
                      }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                          {teacher.initial}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-bold text-slate-800 text-sm">{teacher.name}</h3>
                            <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              {teacher.id}
                            </span>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                            <span className="truncate">{teacher.email}</span>
                            <span className="text-slate-300">|</span>
                            <span>{teacher.phone}</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <span className="text-[9px] font-bold px-2 py-1 rounded-md tracking-wider uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">
                          {teacher.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100/80">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate max-w-[70%]">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
                        </svg>
                        <span className="truncate">ASSIGNED: <strong className="text-slate-600">{teacher.brand}</strong></span>
                      </div>
                      <div className="text-[10px] font-semibold text-slate-400">
                        Joined: {teacher.joined}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Detail View */}
          <div className="xl:col-span-2 min-h-0 bg-white border border-slate-200/80 shadow-sm rounded-2xl flex flex-col p-6">

            {selectedTeacher ? (
              <>
                {/* Profile Header */}
                <div className="flex justify-between items-start mb-8 border-b border-slate-100 pb-6">
                  <div className="flex gap-4 items-center">
                    <div className="h-16 w-16 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-md shadow-indigo-600/20">
                      {selectedTeacher.initial}
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">{selectedTeacher.name}</h2>
                      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                        ERP Registry ID: <span className="text-slate-500">{selectedTeacher.registryId}</span>
                      </p>
                      <div className="mt-2 inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[9px] font-bold border border-indigo-100">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Academic Faculty Claims
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingTeacher(selectedTeacher)}
                      title="Edit Teacher"
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setTeacherToDelete(selectedTeacher)}
                      disabled={isDeleting}
                      title="Delete Teacher"
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="mb-8">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Contact & Registry Information</h3>
                  <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Employee ID</p>
                      <p className="text-xs font-bold text-indigo-600">{selectedTeacher.id}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Assigned Brand Scope</p>
                      <p className="text-xs font-bold text-slate-800">{selectedTeacher.brand}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Corporate Email</p>
                      <p className="text-xs font-semibold text-slate-600">{selectedTeacher.email}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mobile Phone</p>
                      <p className="text-xs font-semibold text-slate-600">{selectedTeacher.phone}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Specialization / Subjects ({selectedTeacher.subjects?.length || 0})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTeacher.subjects && selectedTeacher.subjects.length > 0 ? (
                          selectedTeacher.subjects.map((sub: string, i: number) => (
                            <span key={i} className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-lg border border-indigo-100">
                              {sub}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">{selectedTeacher.subject}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Access Privileges & Audit Trail */}
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Access Privileges & Audit Trail</h3>
                  <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-slate-500 font-mono">Authentic Claim:</span>
                      <span className="text-indigo-600 font-bold tracking-wide">{selectedTeacher.claim}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-slate-500 font-mono">Session Status:</span>
                      <span className="text-emerald-600 font-bold uppercase">{selectedTeacher.status}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-slate-500 font-mono">Registry Sync:</span>
                      <span className="text-slate-500">{selectedTeacher.sync}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm font-semibold text-slate-400">
                Select a teacher to view details
              </div>
            )}

          </div>
        </div>
      </div>



      {/* Add Teacher Modal */}
      <AddTeacherModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchTeachers();
        }}
        initialBrandScope={userBrandScope}
      />

      {/* Edit Teacher Modal */}
      <EditTeacherModal
        isOpen={!!editingTeacher}
        onClose={() => setEditingTeacher(null)}
        teacher={editingTeacher}
        onSuccess={() => {
          setEditingTeacher(null);
          fetchTeachers();
        }}
      />

      {/* Delete Teacher Modal */}
      <DeleteConfirmModal
        isOpen={!!teacherToDelete}
        onClose={() => setTeacherToDelete(null)}
        onConfirm={confirmDeleteTeacher}
        title="Delete Teacher"
        itemName={teacherToDelete?.name || "this teacher"}
        description={`Are you sure you want to delete ${teacherToDelete?.name}? This action is permanent and cannot be undone.`}
        isLoading={isDeleting}
      />
    </div>
  );
}
