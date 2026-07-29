"use client";

import React, { useState, useEffect } from "react";

export interface AdvancedSearchFilterState {
  todayDate: string;
  coursePackage: string;
  studentQuery: string;
  status: string[];
  enableFromDate: boolean;
  fromDate: string;
  enableTillDate: boolean;
  tillDate: string;
}

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: AdvancedSearchFilterState) => void;
  onClear: () => void;
  courseOptions?: string[];
  statusOptions?: string[];
  initialFilters?: Partial<AdvancedSearchFilterState>;
}

export default function AdvancedSearchModal({
  isOpen,
  onClose,
  onApply,
  onClear,
  courseOptions = [],
  statusOptions = ["Active", "In Progress", "Interested", "Demo Scheduled", "Admitted", "Lost"],
  initialFilters,
}: AdvancedSearchModalProps) {
  // Format today's date as DD/MM/YYYY
  const formatTodayDDMMYYYY = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const [todayDate, setTodayDate] = useState(formatTodayDDMMYYYY());
  const [coursePackage, setCoursePackage] = useState(initialFilters?.coursePackage || "");
  const [studentQuery, setStudentQuery] = useState(initialFilters?.studentQuery || "");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(
    initialFilters?.status || ["Active"]
  );
  const [enableFromDate, setEnableFromDate] = useState(initialFilters?.enableFromDate || false);
  const [fromDate, setFromDate] = useState(initialFilters?.fromDate || "");
  const [enableTillDate, setEnableTillDate] = useState(initialFilters?.enableTillDate || false);
  const [tillDate, setTillDate] = useState(initialFilters?.tillDate || "");

  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.coursePackage !== undefined) setCoursePackage(initialFilters.coursePackage);
      if (initialFilters.studentQuery !== undefined) setStudentQuery(initialFilters.studentQuery);
      if (initialFilters.status !== undefined) setSelectedStatuses(initialFilters.status);
      if (initialFilters.enableFromDate !== undefined) setEnableFromDate(initialFilters.enableFromDate);
      if (initialFilters.fromDate !== undefined) setFromDate(initialFilters.fromDate);
      if (initialFilters.enableTillDate !== undefined) setEnableTillDate(initialFilters.enableTillDate);
      if (initialFilters.tillDate !== undefined) setTillDate(initialFilters.tillDate);
    }
  }, [initialFilters]);

  if (!isOpen) return null;

  const handleToggleStatus = (st: string) => {
    if (selectedStatuses.includes(st)) {
      setSelectedStatuses(selectedStatuses.filter((item) => item !== st));
    } else {
      setSelectedStatuses([...selectedStatuses, st]);
    }
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onApply({
      todayDate,
      coursePackage,
      studentQuery,
      status: selectedStatuses,
      enableFromDate,
      fromDate,
      enableTillDate,
      tillDate,
    });
    onClose();
  };

  const handleClear = () => {
    setCoursePackage("");
    setStudentQuery("");
    setSelectedStatuses(["Active"]);
    setEnableFromDate(false);
    setFromDate("");
    setEnableTillDate(false);
    setTillDate("");
    onClear();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      {/* Main Modal Card (Matching Screenshot Layout) */}
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Vibrant Orange Header Banner */}
        <div className="bg-orange-600 px-6 py-3.5 flex items-center justify-between shadow-xs">
          <h2 className="text-xl font-bold text-white tracking-wide">
            Advanced Search
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-orange-200 text-xl font-black transition-colors cursor-pointer"
            title="Close"
          >
            ✖
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleApply} className="p-8 space-y-5 text-sm text-slate-700 font-sans">
          
          {/* 1. Todays Date */}
          <div className="grid grid-cols-12 items-center gap-4">
            <div className="col-span-4 text-right pr-2">
              <label className="block font-semibold text-slate-800 leading-tight">
                Todays Date
              </label>
              <span className="text-[11px] text-slate-400 font-normal">
                (DD/MM/YYYY)
              </span>
            </div>
            <div className="col-span-8">
              <div className="flex border border-slate-300 rounded-md overflow-hidden bg-white focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500">
                <div className="bg-slate-100 px-3 py-2 border-r border-slate-300 text-slate-500 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={todayDate}
                  onChange={(e) => setTodayDate(e.target.value)}
                  className="w-full px-3 py-2 text-slate-800 font-semibold outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* 2. Course Package */}
          <div className="grid grid-cols-12 items-center gap-4">
            <div className="col-span-4 text-right pr-2">
              <label className="block font-semibold text-slate-800">
                Course Package
              </label>
            </div>
            <div className="col-span-8">
              {courseOptions.length > 0 ? (
                <select
                  value={coursePackage}
                  onChange={(e) => setCoursePackage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-800 font-medium outline-none bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                >
                  <option value="">Select Course Package...</option>
                  {courseOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={coursePackage}
                  onChange={(e) => setCoursePackage(e.target.value)}
                  placeholder="Enter or search course name..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-800 font-medium outline-none bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              )}
            </div>
          </div>

          {/* 3. Student */}
          <div className="grid grid-cols-12 items-center gap-4">
            <div className="col-span-4 text-right pr-2">
              <label className="block font-semibold text-slate-800">
                Student
              </label>
            </div>
            <div className="col-span-8">
              <input
                type="text"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Student name, mobile or ID..."
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-800 font-medium outline-none bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          {/* 4. Admission Status / Lead Stage */}
          <div className="grid grid-cols-12 items-center gap-4">
            <div className="col-span-4 text-right pr-2">
              <label className="block font-semibold text-slate-800">
                Admission Status
              </label>
            </div>
            <div className="col-span-8">
              <div className="min-h-[42px] p-2 border border-slate-300 rounded-md bg-white flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:border-orange-500">
                {selectedStatuses.map((st) => (
                  <span
                    key={st}
                    className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold px-2 py-0.5 rounded shadow-xs transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(st)}
                      className="text-slate-400 hover:text-rose-600 font-bold"
                    >
                      ×
                    </button>
                    <span>{st}</span>
                  </span>
                ))}
                
                {/* Select status dropdown to add more tag badges */}
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value && !selectedStatuses.includes(e.target.value)) {
                      setSelectedStatuses([...selectedStatuses, e.target.value]);
                    }
                  }}
                  className="text-xs text-slate-500 bg-transparent outline-none cursor-pointer py-1 ml-1"
                >
                  <option value="">+ Add Status...</option>
                  {statusOptions.map((st) => (
                    <option key={st} value={st} disabled={selectedStatuses.includes(st)}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 5. Joining From Date */}
          <div className="grid grid-cols-12 items-center gap-4">
            <div className="col-span-4 text-right pr-2">
              <label className="block font-semibold text-slate-800 leading-tight">
                Joining From Date
              </label>
              <span className="text-[11px] text-slate-400 font-normal">
                (DD/MM/YYYY)
              </span>
            </div>
            <div className="col-span-8">
              <div className="flex border border-slate-300 rounded-md overflow-hidden bg-white">
                <label className="bg-slate-100 px-3 py-2 border-r border-slate-300 flex items-center justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableFromDate}
                    onChange={(e) => setEnableFromDate(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 cursor-pointer"
                  />
                </label>
                <input
                  type="date"
                  value={fromDate}
                  disabled={!enableFromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className={`w-full px-3 py-2 text-slate-800 font-medium outline-none transition-colors ${
                    enableFromDate ? "bg-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* 6. Joining Till Date */}
          <div className="grid grid-cols-12 items-center gap-4">
            <div className="col-span-4 text-right pr-2">
              <label className="block font-semibold text-slate-800 leading-tight">
                Joining Till Date
              </label>
              <span className="text-[11px] text-slate-400 font-normal">
                (DD/MM/YYYY)
              </span>
            </div>
            <div className="col-span-8">
              <div className="flex border border-slate-300 rounded-md overflow-hidden bg-white">
                <label className="bg-slate-100 px-3 py-2 border-r border-slate-300 flex items-center justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableTillDate}
                    onChange={(e) => setEnableTillDate(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 cursor-pointer"
                  />
                </label>
                <input
                  type="date"
                  value={tillDate}
                  disabled={!enableTillDate}
                  onChange={(e) => setTillDate(e.target.value)}
                  className={`w-full px-3 py-2 text-slate-800 font-medium outline-none transition-colors ${
                    enableTillDate ? "bg-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-6 mt-4 border-t border-slate-100">
            <button
              type="submit"
              className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm rounded-md shadow-md shadow-orange-600/20 transition-all cursor-pointer border-b-2 border-orange-800"
            >
              Apply Filter
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-sm rounded-md transition-all cursor-pointer"
            >
              Clear Filter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
