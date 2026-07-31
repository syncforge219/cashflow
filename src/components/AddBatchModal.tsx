"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/app/component/context/user-context";

interface AddBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialBrandScope?: string;
}

export default function AddBatchModal({
  isOpen,
  onClose,
  onSuccess,
  initialBrandScope,
}: AddBatchModalProps) {
  const { user } = useUser();
  const [batchName, setBatchName] = useState("");
  const [course, setCourse] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [brand, setBrand] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timing, setTiming] = useState("10:00 AM - 12:00 PM");
  const [selectedDays, setSelectedDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [maxCapacity, setMaxCapacity] = useState<number>(30);
  const [notes, setNotes] = useState("");

  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [brandsList, setBrandsList] = useState<string[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const handleCourseChange = (selectedName: string) => {
    setCourse(selectedName);
    const matched = coursesList.find((c) => (c.name || c.courseName) === selectedName);
    setCourseCode(matched?.code || matched?.courseCode || "");
  };

  // Fetch available courses, teachers, and brands
  useEffect(() => {
    if (!isOpen) return;

    const fetchOptions = async () => {
      setIsLoadingOptions(true);
      try {
        const [coursesRes, teachersRes, brandsRes] = await Promise.all([
          fetch("/api/courses").then((r) => r.json().catch(() => ({}))),
          fetch("/api/teachers").then((r) => r.json().catch(() => ({}))),
          fetch("/api/brands").then((r) => r.json().catch(() => ({}))),
        ]);

        if (coursesRes.success || coursesRes.courses) {
          const cList = coursesRes.data || coursesRes.courses || [];
          setCoursesList(cList);
          if (cList.length > 0 && !course) {
            const initialCourse = cList[0];
            const initialName = initialCourse.name || initialCourse.courseName || "";
            setCourse(initialName);
            setCourseCode(initialCourse.code || initialCourse.courseCode || "");
          }
        }

        if (teachersRes.success || teachersRes.teachers) {
          const tList = teachersRes.data || teachersRes.teachers || [];
          setTeachersList(tList);
          if (tList.length > 0 && !teacherId) {
            setTeacherId(tList[0]._id || "");
          }
        }

        if (brandsRes.success || brandsRes.brands) {
          const bList = (brandsRes.brands || brandsRes.data || []).map((b: any) => b.brandName || b.name).filter(Boolean);
          setBrandsList(bList);
        }

        // Set default brand scope
        const defaultBrand = initialBrandScope || user?.brandScope || (brandsList[0] || "CADD Mantra");
        setBrand(defaultBrand);

        // Default start date = today
        if (!startDate) {
          setStartDate(new Date().toISOString().split("T")[0]);
        }
      } catch (err) {
        console.error("Failed to load options for batch modal:", err);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    fetchOptions();
  }, [isOpen, initialBrandScope, user]);

  const handleDayToggle = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchName.trim()) {
      setErrorMsg("Batch name is required.");
      return;
    }
    if (!course) {
      setErrorMsg("Please select a course.");
      return;
    }
    if (!teacherId) {
      setErrorMsg("Please select a faculty/teacher.");
      return;
    }
    if (!startDate) {
      setErrorMsg("Please select a start date.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const selectedTeacherObj = teachersList.find((t) => t._id === teacherId);
      const teacherName = selectedTeacherObj ? selectedTeacherObj.name : "Faculty";

      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchName: batchName.trim(),
          course,
          courseCode: courseCode.trim() || undefined,
          teacherId,
          teacherName,
          brand: brand || user?.brandScope || "CADD Mantra",
          startDate,
          endDate: endDate || undefined,
          timing,
          days: selectedDays,
          maxCapacity,
          notes: notes.trim(),
          createdBy: user?.name || "User",
          creatorRole: user?.role || "counsellor",
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        onSuccess();
        onClose();
        // Reset form
        setBatchName("");
        setCourseCode("");
        setEndDate("");
        setNotes("");
      } else {
        setErrorMsg(json.error || "Failed to create batch.");
      }
    } catch (err: any) {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const roleLower = (user?.role || "").toLowerCase().trim();
  const isBrandLocked =
    roleLower === "brand manager" ||
    roleLower === "brand_manager" ||
    roleLower === "brand-manager" ||
    roleLower === "centre head" ||
    roleLower === "centre_head" ||
    roleLower === "center head" ||
    roleLower === "center_head" ||
    roleLower === "counsellor" ||
    roleLower === "counselor";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-slate-800 to-indigo-950 px-6 py-5 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                📚
              </span>
              Create Faculty Batch
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Schedule a new academic batch & assign faculty instructor
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
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold text-xs flex items-center gap-2">
              <span>⚠️</span> {errorMsg}
            </div>
          )}

          {/* Batch Name, Course & Course Code Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Batch Name / Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. CAD-Morning-B1"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Course / Specialization <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={course}
                onChange={(e) => handleCourseChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold cursor-pointer transition-all"
              >
                <option value="" disabled>Select Course</option>
                {coursesList.map((c, idx) => {
                  const cName = c.name || c.courseName || `Course #${idx+1}`;
                  return (
                    <option key={c._id || idx} value={cName}>
                      {cName}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Course Code</span>
                {courseCode && <span className="text-[10px] text-emerald-600 font-extrabold">✓ Auto-Fetched</span>}
              </label>
              <input
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="Auto-fetched course code"
                className="w-full px-3.5 py-2.5 bg-indigo-50/50 border border-indigo-200 text-indigo-900 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold transition-all"
              />
            </div>
          </div>

          {/* Faculty / Teacher & Brand Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Assigned Faculty (Teacher) <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-indigo-700 cursor-pointer transition-all"
              >
                <option value="" disabled>Select Faculty</option>
                {teachersList.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} ({t.brandScope || "Faculty"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Brand Scope <span className="text-rose-500">*</span>
              </label>
              <select
                required
                disabled={isBrandLocked && !!user?.brandScope}
                value={brand || user?.brandScope || "CADD Mantra"}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold cursor-pointer disabled:opacity-75 transition-all"
              >
                {brandsList.length > 0 ? (
                  brandsList.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))
                ) : (
                  <option value={user?.brandScope || "CADD Mantra"}>
                    {user?.brandScope || "CADD Mantra"}
                  </option>
                )}
              </select>
            </div>
          </div>

          {/* Schedule & Timing Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Class Timing / Slot <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
                placeholder="e.g. 10:00 AM - 12:00 PM"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold transition-all"
              />
            </div>
          </div>

          {/* Days Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Class Days
            </label>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleDayToggle(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capacity & Notes Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Max Capacity
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Notes / Syllabus Remarks
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes or lab instructions..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold transition-all"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingOptions}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Creating Batch...
                </>
              ) : (
                "Create Faculty Batch"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
