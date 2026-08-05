"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";

export interface CourseSearchSelectProps {
  courses: any[];
  selectedCourses: string[];
  onSelectCourses: (selectedNames: string[], combinedCodes: string) => void;
  placeholder?: string;
}

export default function CourseSearchSelect({
  courses,
  selectedCourses,
  onSelectCourses,
  placeholder = "-- Select Courses --",
}: CourseSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredCourses = useMemo(() => {
    let list = courses;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = courses.filter(
        (c) =>
          (c.name || c.courseName || "").toLowerCase().includes(q) ||
          (c.code || c.courseCode || "").toLowerCase().includes(q) ||
          (c.category || "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base", numeric: true })
    );
  }, [courses, searchQuery]);

  const toggleCourse = (cName: string) => {
    let updated: string[];
    if (selectedCourses.includes(cName)) {
      updated = selectedCourses.filter((name) => name !== cName);
    } else {
      updated = [...selectedCourses, cName];
    }

    const codes = updated
      .map((name) => {
        const found = courses.find((c) => (c.name || c.courseName) === name);
        return found?.code || found?.courseCode || "";
      })
      .filter(Boolean);

    onSelectCourses(updated, Array.from(new Set(codes)).join(", "));
  };

  const handleSelectAllFiltered = () => {
    const filteredNames = filteredCourses.map((c) => c.name || c.courseName).filter(Boolean);
    const combinedNames = Array.from(new Set([...selectedCourses, ...filteredNames]));
    const codes = combinedNames
      .map((name) => {
        const found = courses.find((c) => (c.name || c.courseName) === name);
        return found?.code || found?.courseCode || "";
      })
      .filter(Boolean);

    onSelectCourses(combinedNames, Array.from(new Set(codes)).join(", "));
  };

  const handleClearAll = () => {
    onSelectCourses([], "");
  };

  const renderTriggerText = () => {
    if (selectedCourses.length === 0) {
      return <span className="text-slate-400 font-normal">{placeholder}</span>;
    }
    if (selectedCourses.length === 1) {
      const singleName = selectedCourses[0];
      const singleObj = courses.find((c) => (c.name || c.courseName) === singleName);
      return (
        <span className="text-slate-900 font-bold truncate" title={singleName}>
          {singleName}{" "}
          {singleObj?.code && (
            <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 ml-1 shrink-0">
              [{singleObj.code}]
            </span>
          )}
        </span>
      );
    }
    return (
      <div className="flex items-center gap-1.5 flex-wrap truncate" title={selectedCourses.join(", ")}>
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200 shrink-0">
          {selectedCourses.length} Selected
        </span>
        <span className="text-xs font-semibold text-slate-700 truncate max-w-[280px]">
          {selectedCourses.join(", ")}
        </span>
      </div>
    );
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[42px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 font-semibold cursor-pointer transition-all flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {renderTriggerText()}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 min-w-[320px] sm:min-w-[420px] max-w-[90vw] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in font-sans">
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 space-y-2">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search course name or code..."
                className="w-full pl-8 pr-7 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] px-1 font-bold text-slate-600">
              <span>{selectedCourses.length} selected</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-50 text-xs">
            {filteredCourses.length > 0 ? (
              filteredCourses.map((c, idx) => {
                const cName = c.name || c.courseName || `Course #${idx + 1}`;
                const cCode = c.code || c.courseCode || "";
                const isSelected = selectedCourses.includes(cName);

                return (
                  <div
                    key={c._id || idx}
                    onClick={() => toggleCourse(cName)}
                    className={`px-3 py-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-between select-none gap-2 ${
                      isSelected
                        ? "bg-indigo-50/80 text-indigo-900 font-bold"
                        : "hover:bg-slate-50 text-slate-700 font-medium"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by row click
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer shrink-0"
                      />
                      <span className="font-bold text-slate-800 break-words leading-tight">{cName}</span>
                      {cCode && (
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                          {cCode}
                        </span>
                      )}
                    </div>
                    {isSelected && <span className="text-indigo-600 font-bold text-xs shrink-0">✓</span>}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                No matching courses found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
