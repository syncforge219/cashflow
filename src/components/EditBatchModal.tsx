"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/app/component/context/user-context";
import CourseSearchSelect from "./CourseSearchSelect";

interface EditBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  batch: any | null;
  onSuccess: () => void;
}

export default function EditBatchModal({
  isOpen,
  onClose,
  batch,
  onSuccess,
}: EditBatchModalProps) {
  const { user } = useUser();
  const [batchName, setBatchName] = useState("");
  const [course, setCourse] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [courseCode, setCourseCode] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [brand, setBrand] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timing, setTiming] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [status, setStatus] = useState("Upcoming");
  const [maxCapacity, setMaxCapacity] = useState(30);
  const [notes, setNotes] = useState("");

  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const formatDateForInput = (d?: string | Date) => {
    if (!d) return "";
    try {
      const dt = new Date(d);
      if (!isNaN(dt.getTime())) {
        return dt.toISOString().split("T")[0];
      }
    } catch (_) {}
    return String(d).split("T")[0] || "";
  };

  useEffect(() => {
    if (!isOpen || !batch) return;

    setBatchName(batch.batchName || "");

    let initialCourses: string[] = [];
    if (Array.isArray(batch.courses) && batch.courses.length > 0) {
      initialCourses = batch.courses.filter(Boolean);
    } else if (batch.course) {
      initialCourses = batch.course.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    setSelectedCourses(initialCourses);
    setCourse(batch.course || "");
    setCourseCode(batch.courseCode || "");
    setTeacherId(batch.teacherId || "");
    setBrand(batch.brand || "");
    setStartDate(formatDateForInput(batch.startDate));
    setEndDate(formatDateForInput(batch.endDate));
    setTiming(batch.timing || "");
    setSelectedDays(Array.isArray(batch.days) ? batch.days : ["Mon", "Wed", "Fri"]);
    setStatus(batch.status || "Upcoming");
    setMaxCapacity(batch.maxCapacity || 30);
    setNotes(batch.notes || "");

    // Determine brand scope for fetching courses based on logged-in user and batch brand
    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "ALL BRANDS" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";
    const targetBrand = isBrandRestricted ? userBrand : (batch.brand || userBrand);

    let coursesUrl = "/api/courses";
    if (targetBrand && targetBrand !== "All Brands" && targetBrand !== "ALL BRANDS" && targetBrand !== "All") {
      coursesUrl += `?brand=${encodeURIComponent(targetBrand)}`;
    }

    // Fetch options
    Promise.all([
      fetch("/api/teachers").then((r) => r.json().catch(() => ({}))),
      fetch(coursesUrl).then((r) => r.json().catch(() => ({}))),
    ])
      .then(([tRes, cRes]) => {
        if (tRes.success || tRes.teachers) {
          setTeachersList(tRes.data || tRes.teachers || []);
        }
        if (cRes.success || cRes.courses || Array.isArray(cRes.data)) {
          setCoursesList(cRes.data || cRes.courses || []);
        }
      })
      .catch((err) => console.error("Failed to load options for edit modal:", err));
  }, [isOpen, batch, user]);

  const handleDayToggle = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch?._id) return;

    if (selectedCourses.length === 0) {
      setErrorMsg("Please select at least one course.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const selectedTeacher = teachersList.find((t) => t._id === teacherId);

      const res = await fetch(`/api/batches/${batch._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchName: batchName.trim(),
          course: selectedCourses.join(", "),
          courses: selectedCourses,
          courseCode: courseCode.trim() || undefined,
          teacherId,
          teacherName: selectedTeacher ? selectedTeacher.name : batch.teacherName,
          brand,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          timing,
          days: selectedDays,
          status,
          maxCapacity,
          notes: notes.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(json.error || "Failed to update batch.");
      }
    } catch (err: any) {
      setErrorMsg("Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !batch) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-8 animate-fade-in">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">
              Edit Batch / Reassign Faculty
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Update schedule, timing, or faculty assignment for {batch.batchName}
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
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold text-xs">
              ⚠️ {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Batch Title
            </label>
            <input
              type="text"
              required
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Courses
            </label>
            <CourseSearchSelect
              courses={coursesList}
              selectedCourses={selectedCourses}
              onSelectCourses={(names, codes) => {
                setSelectedCourses(names);
                setCourseCode(codes);
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Assigned Faculty
              </label>
              <select
                required
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-indigo-700"
              >
                {teachersList.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Batch Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
              >
                <option value="Upcoming">Upcoming</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Schedule Days
            </label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {daysOfWeek.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => handleDayToggle(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Timing / Slot
              </label>
              <input
                type="text"
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Max Capacity
              </label>
              <input
                type="number"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Update Batch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
