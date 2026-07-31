"use client";

import React, { useState, useEffect, useRef } from "react";

interface AddTeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialBrandScope?: string;
}

export default function AddTeacherModal({
  isOpen,
  onClose,
  onSuccess,
  initialBrandScope = "",
}: AddTeacherModalProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "+91 ",
    brandScope: initialBrandScope || "",
    joiningDate: new Date().toISOString().split("T")[0],
    password: "TeacherTemp123!",
  });

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSubjectDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSubjectDropdownOpen]);

  const filteredSubjects = React.useMemo(() => {
    if (!subjectSearchQuery.trim()) return availableSubjects;
    const q = subjectSearchQuery.toLowerCase().trim();
    return availableSubjects.filter((s) => s.toLowerCase().includes(q));
  }, [availableSubjects, subjectSearchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSubjectDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Brands strictly from Database
  useEffect(() => {
    const fetchBrandsFromDb = async () => {
      try {
        const res = await fetch("/api/brands");
        const data = await res.json();
        const rawBrands = data.brands || data.data || [];
        if (Array.isArray(rawBrands) && rawBrands.length > 0) {
          const brandNames: string[] = rawBrands.map((b: any) => b.name).filter(Boolean);
          setBrands(brandNames);

          if (!initialBrandScope && brandNames.length > 0) {
            setFormData((prev) => ({
              ...prev,
              brandScope: prev.brandScope || brandNames[0],
            }));
          }
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
  }, [isOpen, initialBrandScope]);

  // Fetch Courses / Subjects strictly from Database based on selected brand
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
      setSelectedSubjects([]);
    }
  }, [formData.brandScope, isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "+91 ",
        brandScope: initialBrandScope || (brands[0] || ""),
        joiningDate: new Date().toISOString().split("T")[0],
        password: "TeacherTemp123!",
      });
      setSelectedSubjects([]);
      setError("");
    }
  }, [isOpen, initialBrandScope, brands]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/^\+?91\s?/, "").replace(/\D/g, "").slice(0, 10);
    setFormData((prev) => ({
      ...prev,
      phone: "+91 " + digits,
    }));
  };

  // Toggle single subject selection
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
    setIsLoading(true);
    setError("");

    if (!formData.brandScope) {
      setError("Please select a valid brand / branch scope.");
      setIsLoading(false);
      return;
    }

    const cleanDigits = formData.phone.replace(/^\+?91\s?/, "").replace(/\D/g, "");
    const payload = {
      ...formData,
      subjects: selectedSubjects,
      subject: selectedSubjects,
      phone: cleanDigits ? `+91 ${cleanDigits}` : "",
    };

    try {
      const response = await fetch("/api/teachers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to register teacher.");
      } else {
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (err) {
      console.error(err);
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper text for subjects trigger button
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
            <h2 className="text-xl font-bold text-slate-800">Add New Teacher</h2>
            <p className="text-xs text-slate-500 mt-0.5">Provision a new faculty member into CoachFlow ERP</p>
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
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="firstName"
                required
                value={formData.firstName}
                onChange={handleChange}
                placeholder="e.g. Rahul"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="lastName"
                required
                value={formData.lastName}
                onChange={handleChange}
                placeholder="e.g. Sharma"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="rahul@example.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="+91 9876543210"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Brand / Branch <span className="text-rose-500">*</span>
              </label>
              <select
                name="brandScope"
                value={formData.brandScope}
                onChange={handleChange}
                disabled={!!initialBrandScope}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-75"
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
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in duration-150">
                  {/* Search Input Bar */}
                  <div className="p-1 mb-1.5 border-b border-slate-100 sticky -top-2 bg-white z-10">
                    <div className="relative">
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={subjectSearchQuery}
                        onChange={(e) => setSubjectSearchQuery(e.target.value)}
                        placeholder="🔍 Search subject / course..."
                        className="w-full pl-8 pr-7 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white"
                      />
                      <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
                      {subjectSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setSubjectSearchQuery("")}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

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
                  {filteredSubjects.length > 0 ? (
                    filteredSubjects.map((sub) => {
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
                    })
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400 font-medium">
                      No matching subjects found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Joining Date
              </label>
              <input
                type="date"
                name="joiningDate"
                value={formData.joiningDate}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Temporary Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Footer Actions */}
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
              disabled={isLoading}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Registering...</span>
                </>
              ) : (
                <span>Add Teacher</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
