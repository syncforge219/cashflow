"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/app/component/context/user-context";
import TeacherSidebar from "@/components/TeacherSidebar";
import TakeAttendanceModal from "@/components/TakeAttendanceModal";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { isBatchActiveOnDate, getLocalDateStr } from "@/lib/batchHelper";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export default function TeacherCalendarPage() {
  const { user } = useUser();
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const [demos, setDemos] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [selectedBatchForAttendance, setSelectedBatchForAttendance] = useState<string>("");

  const fetchData = async () => {
    try {
      setIsLoading(true);

      const params = new URLSearchParams();
      const teacherId = user?.id || user?._id;
      if (teacherId) params.append("teacherId", teacherId);
      if (user?.brandScope) params.append("brand", user.brandScope);

      const [statsRes, batchRes, attendanceRes] = await Promise.all([
        fetch("/api/teacher-dashboard/stats").then((r) => r.json().catch(() => ({}))),
        fetch(`/api/batches?${params.toString()}`).then((r) => r.json().catch(() => ({}))),
        fetch(`/api/attendance?${params.toString()}`).then((r) => r.json().catch(() => ({}))),
      ]);

      if (statsRes.success && statsRes.data) {
        setDemos(statsRes.data.extractedDemos || []);
      }

      if (batchRes.success || batchRes.batches) {
        setBatches(batchRes.data || batchRes.batches || []);
      }

      if (attendanceRes.success || attendanceRes.attendance) {
        setAttendanceLogs(attendanceRes.data || attendanceRes.attendance || []);
      }
    } catch (err) {
      console.error("Failed to load faculty schedule data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  if (!user) return null;

  // Calendar Date Calculations
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  const totalCells = days.length <= 35 ? 35 : 42;
  while (days.length < totalCells) {
    days.push(null);
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentMonthName = `${monthNames[month]} ${year}`;

  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));

  const isToday = (d: number) => {
    return d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };
  const isSelected = (d: number) => {
    return d === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
  };

  // Selected date formatted string YYYY-MM-DD
  const selectedDateStr = getLocalDateStr(selectedDate);
  const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const selectedDayOfWeek = dayNamesShort[selectedDate.getDay()];

  // 1. Demos for selected date
  const selectedDemos = demos.filter((d) => {
    if (!d.demoDate) return false;
    const dateStr = d.demoDate.includes("T") ? d.demoDate.split("T")[0] : d.demoDate;
    return dateStr === selectedDateStr;
  });

  // 2. Batches active on selected date (strictly valid between start date & end date, and scheduled day)
  const selectedBatches = batches.filter((b) => {
    return isBatchActiveOnDate(b, selectedDateStr, selectedDayOfWeek);
  });

  // 3. Attendance Logs logged on selected date
  const selectedAttendance = attendanceLogs.filter((att) => att.dateStr === selectedDateStr);

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      <TeacherSidebar />

      <div className="flex-1 h-screen overflow-y-auto min-w-0 pb-32">
        <motion.div
          className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full pb-32"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Page Header */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-slate-400 flex items-center gap-1 mb-1">
                <span>CoachFlow</span>
                <span>/</span>
                <span className="text-indigo-600 font-extrabold">Faculty Schedule & Demos</span>
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                Faculty Schedule & Demo Calendar
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Interactive timeline agenda showing assigned batches, scheduled demo classes, and student attendance
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedBatchForAttendance("");
                  setIsAttendanceModalOpen(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>📋</span> Take Attendance
              </button>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Calendar Section */}
            <motion.div variants={itemVariants} className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-slate-800 tracking-tight">{currentMonthName}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={prevMonth}
                    className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <button
                    onClick={nextMonth}
                    className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Days of Week Header */}
              <div className="grid grid-cols-7 mb-3">
                {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
                  <div key={d} className="text-center text-[10px] font-black text-slate-400 tracking-widest uppercase">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {days.map((day, index) => {
                  if (!day) return <div key={index} className="h-24 rounded-xl bg-slate-50/40"></div>;

                  const current = isToday(day);
                  const selected = isSelected(day);

                  // Count events on this day
                  const cellDate = new Date(year, month, day);
                  const cellDateStr = getLocalDateStr(cellDate);
                  const cellDayOfWeek = dayNamesShort[cellDate.getDay()];

                  const dayDemos = demos.filter((d) => (d.demoDate || "").includes(cellDateStr)).length;
                  const dayAttendance = attendanceLogs.filter((att) => att.dateStr === cellDateStr).length;
                  const dayBatches = batches.filter((b) => isBatchActiveOnDate(b, cellDateStr, cellDayOfWeek)).length;

                  return (
                    <div
                      key={index}
                      onClick={() => setSelectedDate(new Date(year, month, day))}
                      className={`h-24 rounded-xl p-2.5 cursor-pointer transition-all border flex flex-col justify-between ${
                        selected
                          ? "border-indigo-500 shadow-md shadow-indigo-100 bg-indigo-50/40 ring-2 ring-indigo-500/20"
                          : current
                          ? "border-emerald-400 bg-emerald-50/40 ring-1 ring-emerald-400/30"
                          : "border-slate-100 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-black ${
                            selected
                              ? "text-indigo-700"
                              : current
                              ? "text-emerald-600"
                              : "text-slate-700"
                          }`}
                        >
                          {day}
                        </span>

                        {current && (
                          <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.2 rounded-md">
                            TODAY
                          </span>
                        )}
                      </div>

                      {/* Micro event indicators */}
                      <div className="space-y-1 mt-1">
                        {dayBatches > 0 && (
                          <div className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-md truncate">
                            🎓 {dayBatches} Class{dayBatches > 1 ? "es" : ""}
                          </div>
                        )}
                        {dayDemos > 0 && (
                          <div className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded-md truncate">
                            🗓️ {dayDemos} Demo{dayDemos > 1 ? "s" : ""}
                          </div>
                        )}
                        {dayAttendance > 0 && (
                          <div className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md truncate">
                            📋 Logged
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Agenda Schedule Sidebar */}
            <motion.div variants={itemVariants} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs min-h-[520px] flex flex-col">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Daily Agenda Tasks</h3>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                    {monthNames[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()} ({selectedDayOfWeek})
                  </p>
                </div>
                <span className="px-2.5 py-1 text-[10px] font-extrabold bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                  {selectedDemos.length + selectedBatches.length} Events
                </span>
              </div>

              <div className="flex-1 flex flex-col space-y-4 overflow-y-auto custom-scrollbar">
                {selectedDemos.length === 0 && selectedBatches.length === 0 && selectedAttendance.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                    <span className="text-3xl mb-2">🗓️</span>
                    <p className="text-xs font-bold text-slate-400 max-w-[200px]">
                      No scheduled demos or active batch classes for this date.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Scheduled Demos Section */}
                    {selectedDemos.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-purple-600 uppercase tracking-widest flex items-center gap-1.5">
                          <span>🗓️</span> Scheduled Demo Sessions ({selectedDemos.length})
                        </h4>
                        {selectedDemos.map((demo) => (
                          <div
                            key={demo._id}
                            onMouseEnter={() => setHoveredItemId(demo._id)}
                            onMouseLeave={() => setHoveredItemId(null)}
                            className="p-3 bg-purple-50/40 border border-purple-200/80 rounded-xl relative hover:border-purple-300 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                                  {(demo.studentFullName || "S").charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <h5 className="text-xs font-extrabold text-slate-800">{demo.studentFullName}</h5>
                                  <p className="text-[10px] text-slate-500 font-semibold">{demo.targetCourse}</p>
                                </div>
                              </div>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md">
                                {demo.demoTime || "TBD"}
                              </span>
                            </div>

                            {/* Hover tooltip for Demo details */}
                            {hoveredItemId === demo._id && (
                              <div className="absolute top-0 right-full mr-3 w-64 bg-slate-900 text-white p-3 rounded-xl shadow-xl z-50 text-xs font-medium space-y-1.5">
                                <p className="font-bold text-purple-300">Demo Details</p>
                                <p className="text-[11px]">Status: {demo.status || "Scheduled"}</p>
                                <p className="text-[11px]">Mode: {demo.demoMode || "Online"}</p>
                                <p className="text-[11px]">Instructor: {demo.assignedTeacher}</p>
                                {demo.notes && <p className="text-[10px] text-slate-300 italic">{demo.notes}</p>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Active Batch Classes Section */}
                    {selectedBatches.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                          <span>🎓</span> Batch Classes Scheduled ({selectedBatches.length})
                        </h4>
                        {selectedBatches.map((batch) => (
                          <div
                            key={batch._id}
                            className="p-3 bg-indigo-50/40 border border-indigo-200/80 rounded-xl flex items-center justify-between hover:border-indigo-300 transition-all"
                          >
                            <div>
                              <h5 className="text-xs font-extrabold text-slate-800">{batch.batchName}</h5>
                              <p className="text-[10px] text-slate-500 font-semibold">{batch.course} • Timing: {batch.timing}</p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedBatchForAttendance(batch._id);
                                setIsAttendanceModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-[10px] font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors cursor-pointer"
                            >
                              Take Attendance
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Attendance Logs Conducted Section */}
                    {selectedAttendance.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                          <span>📋</span> Attendance Logged ({selectedAttendance.length})
                        </h4>
                        {selectedAttendance.map((log) => (
                          <div
                            key={log._id}
                            className="p-3 bg-emerald-50/40 border border-emerald-200/80 rounded-xl flex items-center justify-between"
                          >
                            <div>
                              <h5 className="text-xs font-extrabold text-slate-800">{log.batchName}</h5>
                              <p className="text-[10px] text-emerald-700 font-bold">
                                Present: {log.totalPresent} / {log.totalStudents} ({Math.round((log.totalPresent / log.totalStudents) * 100)}%)
                              </p>
                            </div>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md uppercase">
                              Verified
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Attendance Modal */}
      <TakeAttendanceModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
        initialBatchId={selectedBatchForAttendance}
        onSuccess={() => {
          setIsAttendanceModalOpen(false);
          fetchData();
        }}
      />
    </div>
  );
}
