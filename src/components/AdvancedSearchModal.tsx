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
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4">
      {/* Main Modal Card */}
      <div className="bg-white rounded-2xl shadow-2xl shadow-indigo-950/20 w-full max-w-xl overflow-hidden border border-slate-200/80 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Sleek Indigo/Slate Gradient Header Banner */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 px-6 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              ⚡
            </div>
            <h2 className="text-lg font-black text-white tracking-wide">
              Advanced Search
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-black text-sm transition-all cursor-pointer"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleApply} className="p-8 space-y-5 text-xs text-slate-700 font-sans">
          
          {/* 1. Todays Date */}
          <div className="grid grid-cols-12 items-center gap-4">
            <div className="col-span-4 text-right pr-2">
              <label className="block font-bold text-slate-800 leading-tight">
                Todays Date
              </label>
              <span className="text-[10px] text-indigo-500 font-semibold">
                (DD/MM/YYYY)
              </span>
            </div>
            <div className="col-span-8">
              <div className="flex border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-600">
                <div className="bg-slate-100 px-3.5 py-2.5 border-r border-slate-300 text-slate-500 flex items-center justify-center shrink-0">
                  📅
                </div>
                <input
                  type="text"
                  value={todayDate}
                  onChange={(e) => setTodayDate(e.target.value)}
                  className="w-full px-3 py-2 text-slate-800 font-bold outline-none bg-white"
                />
              </div>
            </div>
          </div>

          {/* 2. Course Package */}
          <div className="grid grid-cols-12 items-center gap-4">
            <div className="col-span-4 text-right pr-2">
              <label className="block font-bold text-slate-800">
                Course Package
              </label>
            </div>
            <div className="col-span-8">
              {courseOptions.length > 0 ? (
                <select
                  value={coursePackage}
                  onChange={(e) => setCoursePackage(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-semibold outline-none bg-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
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
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-medium outline-none bg-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              )}
            </div>
          </div>

          {/* 3. Student */}
          <div className="grid grid-cols-12 items-center gap-4">
            <div className="col-span-4 text-right pr-2">
              <label className="block font-bold text-slate-800">
                Student
              </label>
            </div>
            <div className="col-span-8">
              <input
                type="text"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Student name, mobile or ID..."
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-medium outline-none bg-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
          </div>

          {/* 4. Admission Status / Lead Stage */}
          <div className="grid grid-cols-12 items-center gap-4">
            <div className="col-span-4 text-right pr-2">
              <label className="block font-bold text-slate-800">
                Admission Status
              </label>
            </div>
            <div className="col-span-8">
              <div className="min-h-[44px] p-2 border border-slate-300 rounded-xl bg-white flex flex-wrap items-center gap-1.5 shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-600">
                {selectedStatuses.map((st) => (
                  <span
                    key={st}
                    className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors shadow-xs"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(st)}
                      className="text-indigo-400 hover:text-rose-600 font-bold text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                    <span>{st}</span>
                  </span>
                ))}
                
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value && !selectedStatuses.includes(e.target.value)) {
                      setSelectedStatuses([...selectedStatuses, e.target.value]);
                    }
                  }}
                  className="text-xs font-semibold text-slate-500 bg-transparent outline-none cursor-pointer py-1 ml-1"
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
              <label className="block font-bold text-slate-800 leading-tight">
                Joining From Date
              </label>
              <span className="text-[10px] text-indigo-500 font-semibold">
                (DD/MM/YYYY)
              </span>
            </div>
            <div className="col-span-8">
              <div className="flex border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
                <label className="bg-slate-100 px-3.5 py-2.5 border-r border-slate-300 flex items-center justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableFromDate}
                    onChange={(e) => setEnableFromDate(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
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
              <label className="block font-bold text-slate-800 leading-tight">
                Joining Till Date
              </label>
              <span className="text-[10px] text-indigo-500 font-semibold">
                (DD/MM/YYYY)
              </span>
            </div>
            <div className="col-span-8">
              <div className="flex border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
                <label className="bg-slate-100 px-3.5 py-2.5 border-r border-slate-300 flex items-center justify-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableTillDate}
                    onChange={(e) => setEnableTillDate(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
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
              className="px-7 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
            >
              Apply Filter
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-6 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Clear Filter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
