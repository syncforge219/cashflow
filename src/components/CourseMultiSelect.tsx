"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";

export interface CourseOption {
  _id?: string;
  name: string;
  fee?: string;
  brand?: string;
}

interface CourseMultiSelectProps {
  courses: CourseOption[];
  selectedCourses: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  showFees?: boolean;
}

export default function CourseMultiSelect({
  courses,
  selectedCourses = [],
  onChange,
  disabled = false,
  placeholder = "-- Select Course(s) --",
  showFees = true,
}: CourseMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCourses = useMemo(() => {
    let list = courses;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = courses.filter((c) => c.name.toLowerCase().includes(q));
    }
    // Alphabetical sorting A-Z
    return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base", numeric: true }));
  }, [courses, searchQuery]);

  const toggleCourse = (courseName: string) => {
    if (selectedCourses.includes(courseName)) {
      onChange(selectedCourses.filter((c) => c !== courseName));
    } else {
      onChange([...selectedCourses, courseName]);
    }
  };

  const handleSelectAll = () => {
    const allNames = filteredCourses.map((c) => c.name);
    const combined = Array.from(new Set([...selectedCourses, ...allNames]));
    onChange(combined);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger Button / Input Box */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl cursor-pointer flex items-center justify-between gap-2 shadow-2xs transition-all ${
          isOpen ? "ring-2 ring-indigo-500/20 border-indigo-500" : "hover:border-slate-300"
        } ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 max-h-[84px] overflow-y-auto pr-1">
          {selectedCourses.length === 0 ? (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          ) : (
            selectedCourses.map((cName) => (
              <span
                key={cName}
                className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 px-2 py-0.5 rounded-lg text-[11px] shrink-0"
              >
                {cName}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCourse(cName);
                  }}
                  className="text-indigo-400 hover:text-indigo-800 font-bold text-xs ml-0.5 rounded-full hover:bg-indigo-100 px-1 transition-colors"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pl-1">
          {selectedCourses.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="text-[10px] font-bold text-rose-500 hover:text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 hover:bg-rose-100 transition-colors mr-1 cursor-pointer"
              title="Clear all selected"
            >
              Clear
            </button>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[100] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-72 animate-in fade-in duration-100">
          {/* Header Search Bar */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/80 space-y-2 shrink-0">
            <div className="relative flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800 placeholder-slate-400"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 font-bold text-xs p-1"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-1 text-[10px] font-extrabold text-slate-500">
              <span>{filteredCourses.length} course(s) found</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>

          {/* List of Courses with Checkboxes */}
          <div className="overflow-y-auto flex-1 p-1 space-y-0.5">
            {filteredCourses.length === 0 ? (
              <div className="py-6 text-center text-xs font-semibold text-slate-400">
                No courses match &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredCourses.map((c) => {
                const isSelected = selectedCourses.includes(c.name);
                return (
                  <label
                    key={c._id || c.name}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      isSelected ? "bg-indigo-50/80 text-indigo-900 font-bold" : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleCourse(c.name)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                      />
                      <span className="truncate">{c.name}</span>
                    </div>

                    {showFees && c.fee && c.fee !== "₹0" && (
                      <span className="text-[10px] font-extrabold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                        {c.fee}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Footer Summary */}
          {selectedCourses.length > 0 && (
            <div className="p-2 border-t border-slate-100 bg-indigo-50/50 text-[11px] font-bold text-indigo-900 flex items-center justify-between shrink-0">
              <span>{selectedCourses.length} course(s) selected</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1 rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
