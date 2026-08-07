"use client";

import React, { useState, useEffect } from "react";
import AddBatchModal from "./AddBatchModal";
import EditBatchModal from "./EditBatchModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import BatchStudentsModal from "./BatchStudentsModal";
import { useUser } from "@/app/component/context/user-context";

export default function BatchDisplay() {
  const { user } = useUser();
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<any | null>(null);
  const [batchToDelete, setBatchToDelete] = useState<any | null>(null);
  const [viewRosterBatch, setViewRosterBatch] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrandFilter, setSelectedBrandFilter] = useState("All Brands");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("All Status");

  const fetchBatches = async () => {
    try {
      setIsLoading(true);
      let url = "/api/batches";
      const queryParams = new URLSearchParams();
      if (user?.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "ALL BRANDS" && user.brandScope !== "All") {
        queryParams.append("brand", user.brandScope);
      }
      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      if (res.ok && json.success) {
        setBatches(json.data || json.batches || []);
      }
    } catch (err) {
      console.error("Failed to fetch batches:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, [user]);

  const confirmDeleteBatch = async () => {
    if (!batchToDelete?._id) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/batches/${batchToDelete._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBatchToDelete(null);
        fetchBatches();
      } else {
        alert("Failed to delete batch");
      }
    } catch (e) {
      alert("Error deleting batch");
    } finally {
      setIsDeleting(false);
    }
  };

  const hasBrandScope = Boolean(user?.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "ALL BRANDS" && user.brandScope !== "All");
  const userBrandScope = hasBrandScope ? user?.brandScope : undefined;

  const brandsList = Array.from(new Set(batches.map((b) => b.brand).filter(Boolean)));

  const filteredBatches = batches.filter((b) => {
    if (userBrandScope) {
      if (b.brand?.toLowerCase() !== userBrandScope.toLowerCase()) return false;
    } else if (selectedBrandFilter !== "All Brands") {
      if (b.brand !== selectedBrandFilter) return false;
    }

    if (selectedStatusFilter !== "All Status" && b.status !== selectedStatusFilter) {
      return false;
    }

    if (!searchTerm.trim()) return true;
    const lower = searchTerm.toLowerCase();
    return (
      b.batchName?.toLowerCase().includes(lower) ||
      b.course?.toLowerCase().includes(lower) ||
      b.teacherName?.toLowerCase().includes(lower) ||
      b.brand?.toLowerCase().includes(lower) ||
      b.timing?.toLowerCase().includes(lower)
    );
  });

  const activeBatchesCount = batches.filter((b) => b.status === "Active").length;
  const upcomingBatchesCount = batches.filter((b) => b.status === "Upcoming").length;
  const assignedFacultyCount = new Set(batches.map((b) => b.teacherId).filter(Boolean)).size;

  return (
    <div className="flex-1 flex flex-col min-w-0 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1 mb-1">
            <span>CoachFlow</span>
            <span>/</span>
            <span className="text-indigo-600 font-extrabold">Academics & Faculty Scheduling</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Faculty Batches Directory
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Create, schedule, and assign academic batches to faculty instructors
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 text-xs font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl px-5 py-2.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            + Create New Batch
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Batches</span>
          <span className="text-2xl font-black text-slate-800 tracking-tight">{batches.length}</span>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">Active Batches</span>
          <span className="text-2xl font-black text-emerald-600 tracking-tight">{activeBatchesCount}</span>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-1">Upcoming Batches</span>
          <span className="text-2xl font-black text-indigo-600 tracking-tight">{upcomingBatchesCount}</span>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-purple-500 uppercase tracking-wider block mb-1">Assigned Faculty</span>
          <span className="text-2xl font-black text-purple-600 tracking-tight">{assignedFacultyCount}</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by batch name, course, faculty..."
            className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!userBrandScope && (
            <select
              value={selectedBrandFilter}
              onChange={(e) => setSelectedBrandFilter(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
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
            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
          >
            <option value="All Status">All Status</option>
            <option value="Upcoming">Upcoming</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Batches Table List */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-6">Batch Name</th>
                <th className="py-3.5 px-6">Course</th>
                <th className="py-3.5 px-6">Assigned Faculty</th>
                <th className="py-3.5 px-6">Timing / Slot</th>
                <th className="py-3.5 px-6">Start Date</th>
                <th className="py-3.5 px-6">Brand Scope</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Loading faculty batches...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No batches found matching criteria. Click &quot;+ Create New Batch&quot; to add one.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch, idx) => (
                  <tr key={batch._id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-800">
                      <div
                        onClick={() => setViewRosterBatch(batch)}
                        className="flex items-center gap-2 cursor-pointer group"
                        title="Click to view admitted students in this batch"
                      >
                        <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 group-hover:scale-125 transition-transform"></span>
                        <span className="group-hover:text-indigo-600 group-hover:underline transition-colors">
                          {batch.batchName}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-1.5 py-0.5 opacity-90 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          👥 View Students
                        </span>
                      </div>
                      {batch.days && batch.days.length > 0 && (
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                          Days: {batch.days.join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-slate-700 font-bold">{batch.course}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-700 font-bold text-xs rounded-lg border border-purple-200">
                        <span>👨‍🏫</span> {batch.teacherName || "Unassigned"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-bold">{batch.timing}</td>
                    <td className="py-4 px-6 text-slate-600 font-bold">
                      <div>{batch.startDate ? new Date(batch.startDate).toLocaleDateString("en-GB") : "-"}</div>
                      {batch.endDate && (
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                          End: {new Date(batch.endDate).toLocaleDateString("en-GB")}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-md border border-slate-200">
                        {batch.brand}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold rounded-md border uppercase tracking-wide ${
                          batch.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : batch.status === "Upcoming"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : batch.status === "Completed"
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {batch.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingBatch(batch)}
                          className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                          title="Edit / Reassign Faculty"
                        >
                          Edit / Reassign
                        </button>
                        <button
                          onClick={() => setBatchToDelete(batch)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Batch"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Batch Modal */}
      <AddBatchModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchBatches();
        }}
        initialBrandScope={userBrandScope}
      />

      {/* Edit Batch Modal */}
      <EditBatchModal
        isOpen={!!editingBatch}
        onClose={() => setEditingBatch(null)}
        batch={editingBatch}
        onSuccess={() => {
          setEditingBatch(null);
          fetchBatches();
        }}
      />

      {/* Delete Batch Confirmation */}
      <DeleteConfirmModal
        isOpen={!!batchToDelete}
        onClose={() => setBatchToDelete(null)}
        onConfirm={confirmDeleteBatch}
        title="Delete Batch"
        itemName={batchToDelete?.batchName || "this batch"}
        description={`Are you sure you want to delete ${batchToDelete?.batchName}? This action cannot be undone.`}
        isLoading={isDeleting}
      />

      {/* Batch Students Roster Modal */}
      <BatchStudentsModal
        isOpen={!!viewRosterBatch}
        onClose={() => setViewRosterBatch(null)}
        batch={viewRosterBatch}
      />
    </div>
  );
}

