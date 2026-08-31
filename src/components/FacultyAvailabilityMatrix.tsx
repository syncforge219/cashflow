"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  HOURLY_SLOTS_8_TO_7,
  HourlySlot,
  calculateFacultyAvailability,
  FacultyAvailabilityProfile,
} from "@/lib/slotHelper";
import { motion, AnimatePresence } from "framer-motion";

interface FacultyAvailabilityMatrixProps {
  batches: any[];
  onScheduleSlot?: (facultyId: string, facultyName: string, timingSlot: string, day: string, brand: string) => void;
  onViewBatchDetails?: (batch: any) => void;
  userBrandScope?: string;
}

export default function FacultyAvailabilityMatrix({
  batches,
  onScheduleSlot,
  onViewBatchDetails,
  userBrandScope,
}: FacultyAvailabilityMatrixProps) {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "free" | "busy">("all");

  // Determine current day of week
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayShortMap: Record<string, string> = {
    Sunday: "Sun",
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
  };
  const todayName = daysOfWeek[new Date().getDay()];
  const todayShort = dayShortMap[todayName] || "Mon";

  const [selectedDay, setSelectedDay] = useState<string>(todayShort);
  const [hoveredSlotBatch, setHoveredSlotBatch] = useState<{ batch: any; x: number; y: number } | null>(null);

  // Real-time current hour marker (8 to 19)
  const currentHour = new Date().getHours();

  // Fetch teachers list from API
  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        setIsLoadingTeachers(true);
        let url = "/api/teachers";
        if (userBrandScope && userBrandScope !== "All Brands" && userBrandScope !== "ALL BRANDS") {
          url += `?brandScope=${encodeURIComponent(userBrandScope)}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok && (data.teachers || data.data)) {
          setTeachers(data.teachers || data.data || []);
        }
      } catch (err) {
        console.error("Failed to load teachers for matrix:", err);
      } finally {
        setIsLoadingTeachers(false);
      }
    };

    fetchTeachers();
  }, [userBrandScope]);

  // Combine teachers from API + any teachers found in batches list
  const combinedTeachers = useMemo(() => {
    const teacherMap = new Map<string, any>();

    // 1. Add all API teachers
    teachers.forEach((t) => {
      const id = String(t._id || t.id);
      if (id) {
        teacherMap.set(id, t);
      }
    });

    // 2. Add any teachers from batches that might not be in the direct teachers table
    batches.forEach((b) => {
      const id = String(b.teacherId || "");
      const name = b.teacherName || "Assigned Faculty";
      if (id && !teacherMap.has(id)) {
        teacherMap.set(id, {
          _id: id,
          name: name,
          designation: "Faculty",
          brandScope: b.brand || "CADD Mantra",
          subject: b.course,
        });
      } else if (!id && name && name !== "Unassigned Faculty") {
        const syntheticId = `teacher-name-${name.toLowerCase().replace(/\s+/g, "-")}`;
        if (!teacherMap.has(syntheticId)) {
          teacherMap.set(syntheticId, {
            _id: syntheticId,
            name: name,
            designation: "Faculty",
            brandScope: b.brand || "CADD Mantra",
            subject: b.course,
          });
        }
      }
    });

    return Array.from(teacherMap.values());
  }, [teachers, batches]);

  // Compute availability profile for all faculty members based on active day filter
  const facultyProfiles: FacultyAvailabilityProfile[] = useMemo(() => {
    return combinedTeachers.map((faculty) =>
      calculateFacultyAvailability(faculty, batches, selectedDay)
    );
  }, [combinedTeachers, batches, selectedDay]);

  // Filter faculty by search, brand, and availability
  const filteredProfiles = useMemo(() => {
    return facultyProfiles.filter((p) => {
      // Brand filter
      if (userBrandScope && userBrandScope !== "All Brands" && userBrandScope !== "ALL BRANDS") {
        if (p.brandScope && p.brandScope.toLowerCase() !== userBrandScope.toLowerCase()) {
          return false;
        }
      } else if (selectedBrand !== "All Brands") {
        if (p.brandScope !== selectedBrand) return false;
      }

      // Availability filter
      if (availabilityFilter === "free" && p.freeSlotsCount === 0) return false;
      if (availabilityFilter === "busy" && p.busySlotsCount === 0) return false;

      // Search term
      if (!searchTerm.trim()) return true;
      const lower = searchTerm.toLowerCase();
      return (
        p.facultyName.toLowerCase().includes(lower) ||
        p.designation?.toLowerCase().includes(lower) ||
        p.brandScope?.toLowerCase().includes(lower) ||
        (Array.isArray(p.subjects) && p.subjects.some((s) => s.toLowerCase().includes(lower))) ||
        (typeof p.subject === "string" && p.subject.toLowerCase().includes(lower))
      );
    });
  }, [facultyProfiles, userBrandScope, selectedBrand, availabilityFilter, searchTerm]);

  // Global Center Metrics for the active day
  const centerStats = useMemo(() => {
    const totalFaculty = filteredProfiles.length;
    const totalCapacityHours = totalFaculty * HOURLY_SLOTS_8_TO_7.length;
    const totalFreeHours = filteredProfiles.reduce((acc, p) => acc + p.freeSlotsCount, 0);
    const totalBusyHours = filteredProfiles.reduce((acc, p) => acc + p.busySlotsCount, 0);
    const overallFreePct = totalCapacityHours > 0 ? Math.round((totalFreeHours / totalCapacityHours) * 100) : 0;
    const overallUtilization = totalCapacityHours > 0 ? Math.round((totalBusyHours / totalCapacityHours) * 100) : 0;

    return {
      totalFaculty,
      totalCapacityHours,
      totalFreeHours,
      totalBusyHours,
      overallFreePct,
      overallUtilization,
    };
  }, [filteredProfiles]);

  const brandsList = useMemo(() => {
    const bSet = new Set<string>();
    combinedTeachers.forEach((t) => {
      if (t.brandScope) bSet.add(t.brandScope);
    });
    batches.forEach((b) => {
      if (b.brand) bSet.add(b.brand);
    });
    return Array.from(bSet).filter(Boolean);
  }, [combinedTeachers, batches]);

  const dayOptions = [
    { id: todayShort, label: `Today (${todayShort})`, isToday: true },
    { id: "All", label: "All Days (Overview)" },
    { id: "Mon", label: "Mon" },
    { id: "Tue", label: "Tue" },
    { id: "Wed", label: "Wed" },
    { id: "Thu", label: "Thu" },
    { id: "Fri", label: "Fri" },
    { id: "Sat", label: "Sat" },
    { id: "Sun", label: "Sun" },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Summary Metrics Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faculty Tracked</span>
            <span className="text-sm">👨‍🏫</span>
          </div>
          <span className="text-2xl font-black text-slate-800 tracking-tight">{centerStats.totalFaculty}</span>
          <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Active Instructors</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Available Free Time</span>
            <span className="text-sm">🟢</span>
          </div>
          <span className="text-2xl font-black text-emerald-600 tracking-tight">{centerStats.totalFreeHours} hrs</span>
          <p className="text-[10px] font-extrabold text-emerald-600 mt-0.5">{centerStats.overallFreePct}% Free Capacity</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Teaching Occupied</span>
            <span className="text-sm">📚</span>
          </div>
          <span className="text-2xl font-black text-indigo-600 tracking-tight">{centerStats.totalBusyHours} hrs</span>
          <p className="text-[10px] font-extrabold text-indigo-600 mt-0.5">{centerStats.overallUtilization}% Center Utilization</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Daily Slot Span</span>
            <span className="text-sm">⏰</span>
          </div>
          <span className="text-2xl font-black text-purple-700 tracking-tight">8 AM - 7 PM</span>
          <p className="text-[10px] font-semibold text-slate-500 mt-0.5">11 Hourly Slots / Day</p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs col-span-2 sm:col-span-4 lg:col-span-1 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Schedule Filter</span>
            <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
              {selectedDay === "All" ? "All Days" : selectedDay}
            </span>
          </div>
          <div className="text-xs font-bold text-slate-700">
            {selectedDay === "All" ? "Full Week Overlap" : `Targeting ${selectedDay} Schedule`}
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Click any free slot to schedule</p>
        </div>
      </div>

      {/* Control Bar: Day Filter Tabs & Search */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Day Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Day:
          </span>
          {dayOptions.map((opt) => {
            const isSelected = selectedDay === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedDay(opt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 scale-102"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
                }`}
              >
                <span>{opt.label}</span>
                {opt.isToday && !isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search and Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Faculty */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search faculty name..."
              className="w-full pl-8 pr-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Brand Scope Filter */}
          {!userBrandScope && brandsList.length > 0 && (
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="All Brands">All Brands</option>
              {brandsList.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}

          {/* Availability Status Filter */}
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value as any)}
            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="all">All Faculty</option>
            <option value="free">Has Free Slots</option>
            <option value="busy">Fully Occupied</option>
          </select>
        </div>
      </div>

      {/* Main Hourly Availability Matrix Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              {/* Main Header Row with 11 Hourly Slots */}
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 sticky left-0 bg-slate-50 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.03)] w-56 min-w-[220px]">
                  Faculty Instructor
                </th>
                {HOURLY_SLOTS_8_TO_7.map((slot) => {
                  const isCurrentLiveHour = currentHour === slot.startHour;
                  return (
                    <th
                      key={slot.id}
                      className={`py-3.5 px-2 text-center min-w-[86px] border-l border-slate-200/60 ${
                        isCurrentLiveHour ? "bg-amber-50 text-amber-900 font-black" : ""
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="leading-tight font-extrabold">{slot.timeHeader}</span>
                        <span className="text-[8px] opacity-75 font-semibold text-slate-400 lowercase">
                          to {slot.endHour > 12 ? `${slot.endHour - 12} PM` : slot.endHour === 12 ? "12 PM" : `${slot.endHour} AM`}
                        </span>
                        {isCurrentLiveHour && (
                          <span className="text-[7.5px] font-black bg-amber-200 text-amber-950 px-1 rounded uppercase mt-0.5 shadow-2xs">
                            Live
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoadingTeachers ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-semibold text-xs">Calculating faculty availability matrix...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-400">
                    No faculty found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((profile) => {
                  const initial = profile.facultyName ? profile.facultyName.charAt(0).toUpperCase() : "F";
                  return (
                    <tr key={profile.facultyId} className="hover:bg-slate-50/50 transition-colors group/row">
                      {/* Faculty Info Sticky Column */}
                      <td className="py-3 px-4 sticky left-0 bg-white group-hover/row:bg-slate-50/90 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.03)] border-r border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                            {profile.photoUrl ? (
                              <img src={profile.photoUrl} alt={profile.facultyName} className="h-full w-full object-cover" />
                            ) : (
                              <span>{initial}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-extrabold text-slate-800 text-xs truncate" title={profile.facultyName}>
                              {profile.facultyName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {profile.brandScope && (
                                <span className="text-[8.5px] font-bold bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200 truncate">
                                  {profile.brandScope}
                                </span>
                              )}
                              <span className="text-[9px] font-extrabold text-emerald-600">
                                {profile.freeSlotsCount}h Free
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold">•</span>
                              <span className="text-[9px] font-bold text-indigo-600">
                                {profile.busySlotsCount}h Busy
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 11 Hourly Slot Cells */}
                      {profile.slots.map((slotStatus) => {
                        const isCurrentLiveHour = currentHour === slotStatus.slot.startHour;
                        const isFree = slotStatus.isFree;
                        const occupyingBatch = slotStatus.occupyingBatches[0];

                        if (isFree) {
                          return (
                            <td
                              key={slotStatus.slot.id}
                              className={`p-1.5 text-center border-l border-slate-100 transition-all ${
                                isCurrentLiveHour ? "bg-amber-50/40" : ""
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (onScheduleSlot) {
                                    onScheduleSlot(
                                      profile.facultyId,
                                      profile.facultyName,
                                      slotStatus.slot.label,
                                      selectedDay === "All" ? "Mon" : selectedDay,
                                      profile.brandScope || "CADD Mantra"
                                    );
                                  }
                                }}
                                className="w-full h-12 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-700 border border-emerald-200/80 flex flex-col items-center justify-center p-1 transition-all group/cell cursor-pointer shadow-2xs hover:scale-102 hover:shadow-xs active:scale-95"
                                title={`FREE Slot (${slotStatus.slot.label}). Click to create batch for ${profile.facultyName}`}
                              >
                                <span className="text-[9px] font-black uppercase tracking-wider flex items-center gap-1 text-emerald-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover/cell:scale-125 transition-transform"></span>
                                  Free
                                </span>
                                <span className="text-[8px] font-bold text-emerald-600/80 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                  + Assign
                                </span>
                              </button>
                            </td>
                          );
                        }

                        // Busy Cell
                        return (
                          <td
                            key={slotStatus.slot.id}
                            className={`p-1.5 text-center border-l border-slate-100 transition-all ${
                              isCurrentLiveHour ? "bg-amber-50/40" : ""
                            }`}
                          >
                            <div
                              onClick={() => {
                                if (onViewBatchDetails && occupyingBatch) {
                                  onViewBatchDetails(occupyingBatch);
                                }
                              }}
                              className="w-full h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border border-indigo-200/90 text-indigo-900 flex items-center justify-center p-1.5 transition-all cursor-pointer shadow-2xs group/busy overflow-hidden relative hover:scale-102 active:scale-95"
                              title={`Batch: ${occupyingBatch?.batchName || "Batch"}\nCourse: ${occupyingBatch?.course || ""}\nTiming: ${occupyingBatch?.timing || ""}\n(Click to view details)`}
                            >
                              <span className="text-[10.5px] font-black text-indigo-800 uppercase tracking-tight text-center line-clamp-2 px-0.5 leading-snug">
                                {occupyingBatch?.batchName || "Class"}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Matrix Legend & Interactive Guide */}
        <div className="bg-slate-50 border-t border-slate-200/80 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-emerald-100 border border-emerald-300"></span>
              <span className="text-slate-700 font-bold text-[11px]">Free / Available Slot</span>
              <span className="text-[10px] text-slate-400">(Click to schedule new batch)</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-indigo-100 border border-indigo-300"></span>
              <span className="text-slate-700 font-bold text-[11px]">Busy / Active Class</span>
              <span className="text-[10px] text-slate-400">(Click to view batch roster)</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-amber-200 border border-amber-400"></span>
              <span className="text-slate-700 font-bold text-[11px]">Current Live Hour</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Calculated across morning 8:00 AM to evening 7:00 PM (1-hour discrete slots)
          </div>
        </div>
      </div>
    </div>
  );
}
