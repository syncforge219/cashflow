"use client";

import React, { useState, useEffect } from "react";

interface AdmissionBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterLabel?: string;
  startDate?: string | null;
  endDate?: string | null;
  brandScope?: string | null;
}

export default function AdmissionBreakdownModal({
  isOpen,
  onClose,
  filterLabel = "Today",
  startDate,
  endDate,
  brandScope,
}: AdmissionBreakdownModalProps) {
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [allAdmissionsList, setAllAdmissionsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, startDate, endDate, filterLabel, brandScope]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch filtered admissions
      let queryParams = new URLSearchParams();
      if (brandScope && brandScope !== "all" && brandScope !== "All Brands") {
        queryParams.append("brand", brandScope);
      }
      if (startDate && endDate) {
        queryParams.append("startDate", startDate);
        queryParams.append("endDate", endDate);
      } else if (filterLabel?.toLowerCase() === "today") {
        queryParams.append("filter", "today");
      } else if (filterLabel?.toLowerCase().includes("month")) {
        queryParams.append("filter", "thisMonth");
      }

      const [filteredRes, allRes] = await Promise.all([
        fetch(`/api/admissions?${queryParams.toString()}`),
        fetch("/api/admissions"),
      ]);

      const filteredJson = await filteredRes.json();
      const allJson = await allRes.json();

      if (filteredJson.success && Array.isArray(filteredJson.data)) {
        setAdmissions(filteredJson.data);
      }
      if (allJson.success && Array.isArray(allJson.data)) {
        setAllAdmissionsList(allJson.data);
      }
    } catch (e) {
      console.error("Failed to fetch admissions breakdown:", e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  // Helper to determine if an admission is an upgrade
  const isUpgradeAdmission = (adm: any) => {
    const mobile = adm.mobileNumber?.trim();
    if (!mobile) return false;

    // An upgrade occurs ONLY if an EARLIER admission record exists for the same student
    const earlierExist = allAdmissionsList.some(
      (other) =>
        other.mobileNumber?.trim() === mobile &&
        String(other._id) !== String(adm._id) &&
        new Date(other.createdAt).getTime() < new Date(adm.createdAt).getTime()
    );

    return earlierExist;
  };

  const upgradedAdmissions = admissions.filter((a) => isUpgradeAdmission(a));
  const newAdmissions = admissions.filter((a) => !isUpgradeAdmission(a));

  const totalCount = admissions.length;
  const newCount = newAdmissions.length;
  const upgradeCount = upgradedAdmissions.length;

  const newPct = totalCount > 0 ? Math.round((newCount / totalCount) * 100) : 0;
  const upgradePct = totalCount > 0 ? Math.round((upgradeCount / totalCount) * 100) : 0;

  // Filtered list by local search query
  const displayedAdmissions = admissions.filter((adm) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      adm.fullName?.toLowerCase().includes(q) ||
      adm.admissionId?.toLowerCase().includes(q) ||
      adm.mobileNumber?.includes(q) ||
      adm.course?.toLowerCase().includes(q) ||
      adm.brand?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Window */}
      <div className="relative w-full max-w-3xl mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 px-6 py-5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-lg backdrop-blur-sm shrink-0">
                📊
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Admissions Analytics & Breakdown
                  </h2>
                  <span className="text-[10px] font-extrabold bg-white/20 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-sm">
                    {filterLabel}
                  </span>
                </div>
                <p className="text-xs text-indigo-100/90 font-medium mt-0.5">
                  Real-time classification of New Student Enrollments vs Course Upgrades
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Summary KPI Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Admissions Card */}
            <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                  Total Admissions
                </span>
                <span className="h-6 w-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                  Σ
                </span>
              </div>
              <p className="text-2xl font-black text-indigo-900">
                {isLoading ? "..." : totalCount}
              </p>
              <p className="text-[10px] font-semibold text-indigo-600 mt-1">
                Filter Scope: <span className="font-bold">{filterLabel}</span>
              </p>
            </div>

            {/* New Admissions Card */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                  New Student Admissions
                </span>
                <span className="h-6 w-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                  🌱
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-emerald-900">
                  {isLoading ? "..." : newCount}
                </p>
                <span className="text-xs font-extrabold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {newPct}%
                </span>
              </div>
              <p className="text-[10px] font-semibold text-emerald-600 mt-1">
                First-time student enrollments
              </p>
            </div>

            {/* Course Upgrades Card */}
            <div className="p-4 bg-purple-50/70 border border-purple-100 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">
                  Course Upgrades
                </span>
                <span className="h-6 w-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                  ⚡
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-purple-900">
                  {isLoading ? "..." : upgradeCount}
                </p>
                <span className="text-xs font-extrabold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                  {upgradePct}%
                </span>
              </div>
              <p className="text-[10px] font-semibold text-purple-600 mt-1">
                Multiple course enrollments / upgrades
              </p>
            </div>
          </div>

          {/* Search & Filter Bar for List */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z"
                />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by student name, admission ID, course, or brand..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
              />
            </div>
          </div>

          {/* Admissions Ledger Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            {isLoading ? (
              <div className="py-12 text-center">
                <svg
                  className="animate-spin h-6 w-6 text-indigo-500 mx-auto mb-2"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-xs font-bold text-slate-400">
                  Fetching admission breakdown data...
                </p>
              </div>
            ) : displayedAdmissions.length === 0 ? (
              <div className="py-12 text-center text-xs font-bold text-slate-400">
                No admissions found for this filter period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="p-3.5">Student</th>
                      <th className="p-3.5">Course & Brand</th>
                      <th className="p-3.5">Admission Type</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5 text-right">Course Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedAdmissions.map((adm, idx) => {
                      const isUpg = isUpgradeAdmission(adm);
                      return (
                        <tr
                          key={adm._id || idx}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isUpg
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {adm.fullName?.charAt(0)?.toUpperCase() || "S"}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">
                                  {adm.fullName || "Student"}
                                </p>
                                <p className="text-[9px] font-semibold text-slate-400 font-mono">
                                  {adm.admissionId || "N/A"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5">
                            <p className="font-bold text-slate-800">
                              {adm.course || "N/A"}
                            </p>
                            <p className="text-[9px] font-semibold text-slate-400">
                              {adm.brand || "N/A"}
                            </p>
                          </td>

                          <td className="p-3.5">
                            {isUpg ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                ⚡ Course Upgrade
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                🌱 New Admission
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 text-slate-600 font-semibold">
                            {new Date(adm.admissionDate || adm.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </td>

                          <td className="p-3.5 text-right font-extrabold text-slate-900">
                            ₹
                            {Number(adm.finalFee || 0).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              New: {newCount} ({newPct}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-500"></span>
              Upgrades: {upgradeCount} ({upgradePct}%)
            </span>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
