"use client";

import React, { useState, useEffect } from "react";

interface AdmissionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  admission: any;
  onUpgradeCourse?: (admission: any, targetCourse: string, targetCourseFee?: any) => void;
  isAdmin?: boolean;
}

export default function AdmissionDetailModal({
  isOpen,
  onClose,
  admission,
  onUpgradeCourse,
  isAdmin,
}: AdmissionDetailModalProps) {
  const [brandCourses, setBrandCourses] = useState<any[]>([]);
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [isAdminUser, setIsAdminUser] = useState(false);

  const parseFeeNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    const cleaned = String(val).replace(/[^0-9.]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const getCourseFee = (c: any): number => {
    if (!c) return 0;
    const raw = c.fee ?? c.totalFee ?? c.courseFee ?? c.price ?? c.expectedCourseFee ?? 0;
    return parseFeeNumber(raw);
  };

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const storedRole = localStorage.getItem("userRole");
      let roleStr = storedRole || "";
      if (storedUser) {
        const u = JSON.parse(storedUser);
        if (u.role) roleStr = u.role;
      }
      const r = (roleStr || "").toLowerCase().trim();
      if (r === "admin" || r === "super admin" || r === "super_admin" || r === "director") {
        setIsAdminUser(true);
      } else {
        setIsAdminUser(false);
      }
    } catch (e) {
      setIsAdminUser(false);
    }
  }, []);

  const isUserAdmin = isAdmin !== undefined ? isAdmin : isAdminUser;

  useEffect(() => {
    if (isOpen && admission?.brand) {
      fetchBrandCourses(admission.brand);
    }
  }, [isOpen, admission?.brand]);

  useEffect(() => {
    if (isOpen) {
      setSelectedCourse("");
    }
  }, [isOpen]);

  const fetchBrandCourses = async (brandName: string) => {
    setIsLoadingCourses(true);
    try {
      const res = await fetch("/api/courses");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const filtered = json.data.filter(
          (c: any) =>
            c.brand &&
            c.brand.toLowerCase() === brandName.toLowerCase()
        );
        setBrandCourses(filtered);
      }
    } catch (e) {
      console.error("Failed to fetch courses:", e);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  if (!isOpen || !admission) return null;

  const feePaid = Number(admission.finalFee || 0) - Number(admission.remainingBalance || 0);
  const remaining = Number(admission.remainingBalance || 0);

  const selectedCourseObj = brandCourses.find((c) => c.name === selectedCourse);

  const handleUpgradeClick = () => {
    if (selectedCourse && onUpgradeCourse) {
      onUpgradeCourse(admission, selectedCourse, selectedCourseObj?.fee);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm backdrop-blur-sm">
                {admission.fullName?.charAt(0)?.toUpperCase() || "S"}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {admission.fullName || "Student"}
                </h2>
                <p className="text-xs font-semibold text-indigo-100/80">
                  {admission.admissionId || "N/A"} • {admission.brand || "N/A"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors cursor-pointer"
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

        {/* Content */}
        <div className="px-6 py-6 space-y-5">
          {/* Student Name */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4.5 h-4.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                Student Name
              </p>
              <p className="text-sm font-bold text-slate-800 truncate">
                {admission.fullName || "N/A"}
              </p>
            </div>
          </div>

          {/* Course Name */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4.5 h-4.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
                Present Course
              </p>
              <p className="text-sm font-bold text-slate-800 truncate">
                {admission.course || "N/A"}
              </p>
            </div>
          </div>

          {/* Fee Details Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Course Fee */}
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center">
              <p className="text-[9px] font-bold text-blue-500/80 uppercase tracking-widest mb-1.5">
                Course Fee
              </p>
              <p className="text-lg font-extrabold text-blue-700">
                ₹{Number(admission.finalFee || 0).toLocaleString("en-IN")}
              </p>
            </div>

            {/* Fee Paid */}
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
              <p className="text-[9px] font-bold text-emerald-500/80 uppercase tracking-widest mb-1.5">
                Fee Paid
              </p>
              <p className="text-lg font-extrabold text-emerald-700">
                ₹{feePaid.toLocaleString("en-IN")}
              </p>
            </div>

            {/* Remaining Fee */}
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 text-center">
              <p className="text-[9px] font-bold text-rose-500/80 uppercase tracking-widest mb-1.5">
                Remaining
              </p>
              <p className="text-lg font-extrabold text-rose-700">
                ₹{remaining.toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* Brand Courses Dropdown & Upgrade Action (Available to all users) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                All Courses Under "{admission.brand || "Brand"}"
              </label>
              {courseSearchQuery && (
                <button
                  type="button"
                  onClick={() => setCourseSearchQuery("")}
                  className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  Clear Search
                </button>
              )}
            </div>

            {/* Search input for courses */}
            <div className="relative">
              <input
                type="text"
                value={courseSearchQuery}
                onChange={(e) => setCourseSearchQuery(e.target.value)}
                placeholder="🔍 Type to search course..."
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:font-normal"
              />
            </div>

            {isLoadingCourses ? (
              <div className="flex items-center gap-2 py-3 px-4 bg-slate-50 rounded-xl border border-slate-200">
                <svg
                  className="animate-spin h-4 w-4 text-indigo-500"
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
                <span className="text-xs font-semibold text-slate-500">
                  Loading courses...
                </span>
              </div>
            ) : brandCourses.length === 0 ? (
              <div className="py-3 px-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-400">
                No courses found for this brand.
              </div>
            ) : (
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all cursor-pointer appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 12px center",
                  backgroundSize: "16px",
                }}
              >
                <option value="" disabled>
                  -- Select another course to upgrade --
                </option>
                {brandCourses
                  .filter((c: any) => (c.name || "").toLowerCase().includes(courseSearchQuery.toLowerCase()))
                  .map((c: any, idx: number) => {
                    const isEnrolled =
                      c.name?.trim().toLowerCase() ===
                      admission.course?.trim().toLowerCase();
                    const feeVal = getCourseFee(c);
                    const feeText = feeVal > 0 ? `₹${feeVal.toLocaleString("en-IN")}` : (c.fee ? `₹${c.fee}` : "Fee on request");
                    return (
                      <option
                        key={c._id || idx}
                        value={c.name}
                        disabled={isEnrolled}
                      >
                        {c.name} — {feeText}
                        {isEnrolled ? " (Currently Enrolled)" : ""}
                      </option>
                    );
                  })}
              </select>
            )}

            {/* Banner when a course is selected for upgrade */}
            {selectedCourse && (
              <div className="p-3.5 bg-gradient-to-r from-indigo-50 via-purple-50 to-violet-50 rounded-xl border border-indigo-200/80 flex items-center justify-between animate-in fade-in duration-200">
                <div>
                  <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">
                    Selected Upgrade Course
                  </p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">
                    {selectedCourse}{" "}
                    {selectedCourseObj?.fee ? (
                      <span className="text-indigo-600">
                        (₹{selectedCourseObj.fee})
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  onClick={handleUpgradeClick}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-all shadow-sm shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className="w-3.5 h-3.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                  Upgrade Now
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-slate-400">
            {selectedCourse ? `Selected: ${selectedCourse}` : "Select a course to upgrade student"}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
            {selectedCourse && (
              <button
                onClick={handleUpgradeClick}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
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
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Upgrade & Enroll
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
