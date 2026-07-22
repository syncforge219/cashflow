"use client";

import React, { useState, useEffect, useRef } from "react";

interface EditTeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: any;
  onSuccess?: () => void;
}

export default function EditTeacherModal({
  isOpen,
  onClose,
  teacher,
  onSuccess,
}: EditTeacherModalProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "+91 ",
    brandScope: "",
    password: "",
  });

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  const cleanPhoneDigits = (phone: string) => {
    if (!phone) return "";
    return String(phone).replace(/^\+?91\s?/, "").replace(/\D/g, "").slice(0, 10);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSubjectDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Brands strictly from DB
  useEffect(() => {
    const fetchBrandsFromDb = async () => {
      try {
        const res = await fetch("/api/brands");
        const data = await res.json();
        const rawBrands = data.brands || data.data || [];
        if (Array.isArray(rawBrands) && rawBrands.length > 0) {
          const brandNames = rawBrands.map((b: any) => b.name).filter(Boolean);
          setBrands(brandNames);
        } else {
          setBrands([]);
        }
      } catch (err) {
        console.error("Failed to fetch brands from database", err);
        setBrands([]);
      }
    };
    if (isOpen) {
      fetchBrandsFromDb();
    }
  }, [isOpen]);

  // Fetch Available Courses strictly from DB for selected brand
  useEffect(() => {
    const fetchCoursesFromDb = async () => {
      if (!formData.brandScope) {
        setAvailableSubjects([]);
        return;
      }
      try {
        const res = await fetch("/api/courses");
        const data = await res.json();
        const rawCourses = data.data || data.courses || [];
        if (Array.isArray(rawCourses)) {
          const brandCourses = rawCourses
            .filter(
              (c: any) =>
                !c.brand ||
                !formData.brandScope ||
                c.brand.toLowerCase().trim() === formData.brandScope.toLowerCase().trim()
            )
            .map((c: any) => c.name)
            .filter(Boolean);

          setAvailableSubjects(Array.from(new Set(brandCourses)));
        } else {
          setAvailableSubjects([]);
        }
      } catch (err) {
        console.error("Failed to fetch courses from database:", err);
        setAvailableSubjects([]);
      }
    };

    if (isOpen) {
      fetchCoursesFromDb();
    }
  }, [formData.brandScope, isOpen]);

  // Populate teacher data
  useEffect(() => {
    if (teacher) {
      const nameParts = (teacher.name || "").split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";
      const phoneCleaned = cleanPhoneDigits(teacher.phone || "");

      let initialSubs: string[] = [];
      if (Array.isArray(teacher.subjects) && teacher.subjects.length > 0) {
        initialSubs = teacher.subjects;
      } else if (Array.isArray(teacher.subject)) {
        initialSubs = teacher.subject;
      } else if (typeof teacher.subject === "string" && teacher.subject.trim()) {
        initialSubs = teacher.subject.split(",").map((s: string) => s.trim());
      }

      setFormData({
        firstName,
        lastName,
        email: teacher.email || "",
        phone: "+91 " + phoneCleaned,
        brandScope: teacher.brand || teacher.brandScope || "",
        password: "",
      });
      setSelectedSubjects(initialSubs);
      setError("");
    }
  }, [teacher]);

  if (!isOpen || !teacher) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/^\+?91\s?/, "").replace(/\D/g, "").slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: "+91 " + digits }));
  };

  // Toggle subject selection
  const handleToggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  // Toggle "Select All Subjects"
  const isAllSubjectsSelected =
    availableSubjects.length > 0 && availableSubjects.every((s) => selectedSubjects.includes(s));

  const handleToggleAllSubjects = () => {
    if (isAllSubjectsSelected) {
      setSelectedSubjects([]);
    } else {
      setSelectedSubjects([...availableSubjects]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const cleanDigits = cleanPhoneDigits(formData.phone);
    const targetId = teacher.rawId || teacher._id || teacher.id;

    const payload: any = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: cleanDigits ? `+91 ${cleanDigits}` : "",
      brandScope: formData.brandScope,
      subjects: selectedSubjects,
      subject: selectedSubjects,
    };

    if (formData.password && formData.password.trim().length >= 6) {
      payload.password = formData.password.trim();
    }

    try {
      const response = await fetch(`/api/teachers/${targetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to update teacher.");
      } else {
        onClose();
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error(err);
      setError("Network error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSubjectTriggerText = () => {
    if (availableSubjects.length === 0) return "No subjects found in database for this brand";
    if (isAllSubjectsSelected) return `All Subjects (${availableSubjects.length})`;
    if (selectedSubjects.length === 0) return "Select subjects / courses...";
    if (selectedSubjects.length === 1) return selectedSubjects[0];
    return `${selectedSubjects[0]}, ${selectedSubjects[1]} (+${selectedSubjects.length - 2 > 0 ? selectedSubjects.length - 2 : 1} more)`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Edit Teacher Details</h2>
            <p className="text-xs text-slate-500 mt-0.5">Update credentials and subjects for {teacher.name}</p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="h-8 w-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold rounded-xl flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">First Name</label>
              <input
                type="text"
                name="firstName"
                required
                value={formData.firstName}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Last Name</label>
              <input
                type="text"
                name="lastName"
                required
                value={formData.lastName}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Mobile Phone</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Brand / Branch Scope</label>
              <select
                name="brandScope"
                value={formData.brandScope}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              >
                {brands.length > 0 ? (
                  brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))
                ) : (
                  <option value="">No brands found</option>
                )}
              </select>
            </div>

            {/* Multi-Select Subject Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Subject / Specialization ({selectedSubjects.length})
              </label>
              <button
                type="button"
                onClick={() => setIsSubjectDropdownOpen(!isSubjectDropdownOpen)}
                disabled={availableSubjects.length === 0}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 text-left flex items-center justify-between focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-70"
              >
                <span className={`truncate ${selectedSubjects.length === 0 ? "text-slate-400 font-normal" : "text-slate-800 font-medium"}`}>
                  {getSubjectTriggerText()}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 text-slate-400 transition-transform ${isSubjectDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isSubjectDropdownOpen && availableSubjects.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in duration-150">
                  {/* Select All Checkbox */}
                  <label className="flex items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded-lg cursor-pointer font-bold text-xs text-indigo-700 border-b border-slate-100 mb-1 select-none">
                    <input
                      type="checkbox"
                      checked={isAllSubjectsSelected}
                      onChange={handleToggleAllSubjects}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span>Select All Subjects ({availableSubjects.length})</span>
                  </label>

                  {/* Individual Subject Checkboxes */}
                  {availableSubjects.map((sub) => {
                    const isChecked = selectedSubjects.includes(sub);
                    return (
                      <label
                        key={sub}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-semibold text-slate-700 select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSubject(sub)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="truncate">{sub}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">New Password (Leave blank to keep unchanged)</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
