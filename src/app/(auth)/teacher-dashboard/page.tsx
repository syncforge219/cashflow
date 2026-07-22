"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/app/component/context/user-context";
import TeacherSidebar from "@/components/TeacherSidebar";
import ProfileDisplay from "@/components/ProfileDisplay";
import CommandPalette from "@/components/CommandPalette";

export default function TeacherDashboard() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"courses" | "demos" | "students">("courses");
  const [trendMode, setTrendMode] = useState<"daily" | "cumulative">("daily");
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

  const [teacherData, setTeacherData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Keyboard shortcut for command palette (CTRL+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Fetch teacher-specific data
  useEffect(() => {
    const fetchTeacherDashboardData = async () => {
      try {
        setIsLoading(true);
        const [coursesRes, enquiriesRes] = await Promise.all([
          fetch("/api/courses").then((r) => r.json().catch(() => ({}))),
          fetch("/api/enquiries").then((r) => r.json().catch(() => ({}))),
        ]);

        const allCourses = coursesRes.data || coursesRes.courses || [];
        const allEnquiries = enquiriesRes.enquiries || [];

        // Filter courses matching teacher's brand or assigned subjects
        const assignedSubjects: string[] = Array.isArray(user?.subjects)
          ? user.subjects
          : Array.isArray(user?.subject)
          ? user.subject
          : typeof user?.subject === "string"
          ? user.subject.split(",").map((s: string) => s.trim())
          : [];

        const myBrandCourses = allCourses.filter((c: any) =>
          !user?.brandScope || !c.brand || c.brand.toLowerCase().trim() === user.brandScope.toLowerCase().trim()
        );

        // Demo classes from enquiries
        const demoClasses = allEnquiries.filter((e: any) => e.isDemoScheduled || (e.demos && e.demos.length > 0));

        setTeacherData({
          assignedSubjectsCount: assignedSubjects.length || myBrandCourses.length || 4,
          myBrandCourses,
          demoClasses,
          allEnquiries,
        });
      } catch (err) {
        console.error("Failed to load teacher dashboard stats:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeacherDashboardData();
  }, [user]);

  if (!user) return null;

  const initialLetter = user.name ? user.name.charAt(0).toUpperCase() : "T";

  // KPI Metrics Data
  const metrics = [
    { name: "Assigned Subjects", value: teacherData?.assignedSubjectsCount || 4, trend: "Active Subjects", isGreen: true, color: "text-blue-600 bg-blue-50 border-blue-100" },
    { name: "Active Batches", value: 6, trend: "Current Quarter", isGreen: true, color: "text-teal-600 bg-teal-50 border-teal-100" },
    { name: "Enrolled Students", value: 128, trend: "Active Roster", isGreen: true, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
    { name: "Demos Scheduled", value: teacherData?.demoClasses?.length || 12, trend: "This Month", isGreen: true, color: "text-purple-600 bg-purple-50 border-purple-100" },
    { name: "Demos Completed", value: Math.max(0, (teacherData?.demoClasses?.length || 12) - 2), trend: "92% Completion", isGreen: true, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
    { name: "Conversion Rate", value: "83.3%", trend: "Demo to Enrollment", isGreen: true, color: "text-sky-600 bg-sky-50 border-sky-100" },
    { name: "Today's Classes", value: 3, trend: "Scheduled Today", isGreen: true, color: "text-amber-600 bg-amber-50 border-amber-100" },
    { name: "Student Attendance", value: "94.2%", trend: "Average Rate", isGreen: true, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
    { name: "Student Rating", value: "4.9 ⭐", trend: "Based on 48 Reviews", isGreen: true, color: "text-rose-600 bg-rose-50 border-rose-100" },
    { name: "High Priority Demos", value: 4, trend: "Follow-up Due", isGreen: false, color: "text-orange-600 bg-orange-50 border-orange-100" },
  ];

  // Dummy Trend Days data for Line Chart
  const rawTrendDays = [
    { dayLabel: "Mon", demos: 2, classes: 4, attendance: 95, conversions: 2 },
    { dayLabel: "Tue", demos: 4, classes: 5, attendance: 92, conversions: 3 },
    { dayLabel: "Wed", demos: 3, classes: 3, attendance: 96, conversions: 2 },
    { dayLabel: "Thu", demos: 5, classes: 6, attendance: 94, conversions: 4 },
    { dayLabel: "Fri", demos: 2, classes: 4, attendance: 98, conversions: 2 },
    { dayLabel: "Sat", demos: 6, classes: 7, attendance: 91, conversions: 5 },
    { dayLabel: "Sun", demos: 1, classes: 2, attendance: 99, conversions: 1 },
  ];

  const processedTrendDays = React.useMemo(() => {
    if (trendMode === "daily") return rawTrendDays;
    let rDemos = 0;
    let rClasses = 0;
    let rConversions = 0;
    return rawTrendDays.map((d) => {
      rDemos += d.demos;
      rClasses += d.classes;
      rConversions += d.conversions;
      return { ...d, demos: rDemos, classes: rClasses, conversions: rConversions };
    });
  }, [trendMode]);

  const maxVal = Math.max(...processedTrendDays.map((d) => Math.max(d.demos, d.classes, d.conversions)), 10);

  const generatePath = (key: "demos" | "classes" | "conversions") => {
    const totalPoints = processedTrendDays.length;
    const step = 600 / Math.max(1, totalPoints - 1);
    return processedTrendDays
      .map((d, i) => {
        const x = i * step;
        const y = 160 - ((d[key] || 0) / maxVal) * 140;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  };

  // Donut chart sources
  const subjectSources = [
    { name: "AutoCAD & CAD", pctNum: 35, hex: "#6366f1" },
    { name: "Revit Architecture", pctNum: 25, hex: "#10b981" },
    { name: "Python & Coding", pctNum: 20, hex: "#f59e0b" },
    { name: "STAAD & Structural", pctNum: 20, hex: "#ec4899" },
  ];

  let currentOffset = 0;
  const donutCircles = subjectSources.map((source, i) => {
    const strokeDasharray = `${source.pctNum} ${100 - source.pctNum}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += source.pctNum;
    return (
      <circle
        key={i}
        cx="18"
        cy="18"
        r="15.915"
        fill="transparent"
        stroke={source.hex}
        strokeWidth="3"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
      />
    );
  });

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans transition-colors duration-200">
      {/* Teacher Sidebar */}
      <TeacherSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6">
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/80 pb-4 mb-6 shrink-0">
          <div>
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 select-none">
              <span>CoachFlow</span>
              <span>/</span>
              <span className="text-slate-600 font-bold">Faculty Command Center (Live)</span>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="relative w-full sm:w-64 flex items-center justify-between pl-3 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-400 group"
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 mr-2 group-hover:text-indigo-500 transition-colors">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                </svg>
                Search subjects, demos...
              </div>
              <span className="flex items-center pointer-events-none text-[9px] font-bold text-slate-400/80 uppercase">
                CTRL+K
              </span>
            </button>

            <ProfileDisplay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} logout={logout} />

            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-700">{user.name}</div>
                <div className="text-[9px] font-bold text-indigo-600 uppercase tracking-wide">Teacher / Faculty</div>
              </div>
              <button
                onClick={() => setIsProfileOpen(true)}
                className="h-8 w-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center border border-indigo-500 shadow-md hover:bg-indigo-500 transition-colors overflow-hidden shrink-0"
                title="View Profile Details"
              >
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : null}
                <span className={user.photoUrl ? "hidden" : "block"}>{initialLetter}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Teacher Quick Actions Bar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 mb-6 shadow-xs flex items-center justify-between gap-3 overflow-x-auto shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider px-2 select-none">Quick Actions:</span>
            <button
              onClick={() => setActiveTab("courses")}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>📚 My Assigned Subjects</span>
            </button>
            <button
              onClick={() => setActiveTab("demos")}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>🗓️ Upcoming Demos</span>
            </button>
            <button
              onClick={() => setActiveTab("students")}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>👥 Student Roster</span>
            </button>
          </div>
          <div className="text-xs font-semibold text-slate-400 px-2 shrink-0">
            Brand Scope: <strong className="text-slate-700">{user.brandScope || "Cadd Mantra"}</strong>
          </div>
        </div>

        {/* 10 KPI Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {metrics.map((metric, idx) => (
            <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{metric.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${metric.color}`}>
                  {metric.trend}
                </span>
              </div>
              <div className="text-2xl font-black text-slate-800 tracking-tight">{metric.value}</div>
            </div>
          ))}
        </div>

        {/* Charts & Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

          {/* Left Chart: Class & Demo Activity Trend */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">Faculty Activity & Demo Trend</h3>
                <p className="text-[11px] font-medium text-slate-400">Weekly class sessions, demo schedules, and conversions</p>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setTrendMode("daily")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    trendMode === "daily" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setTrendMode("cumulative")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    trendMode === "cumulative" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Cumulative
                </button>
              </div>
            </div>

            {/* SVG Line Graph */}
            <div className="relative h-48 w-full mt-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 600 160">
                {/* Horizontal Grid lines */}
                <line x1="0" y1="20" x2="600" y2="20" stroke="#f1f5f9" strokeDasharray="4 4" />
                <line x1="0" y1="70" x2="600" y2="70" stroke="#f1f5f9" strokeDasharray="4 4" />
                <line x1="0" y1="120" x2="600" y2="120" stroke="#f1f5f9" strokeDasharray="4 4" />
                <line x1="0" y1="160" x2="600" y2="160" stroke="#e2e8f0" />

                {/* Path Lines */}
                <path d={generatePath("classes")} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />
                <path d={generatePath("demos")} fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" />
                <path d={generatePath("conversions")} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
              </svg>

              {/* Day Labels */}
              <div className="flex justify-between mt-2 px-1 text-[10px] font-bold text-slate-400 uppercase">
                {processedTrendDays.map((d, i) => (
                  <span
                    key={i}
                    onMouseEnter={() => setHoveredTrendIndex(i)}
                    onMouseLeave={() => setHoveredTrendIndex(null)}
                    className="cursor-pointer hover:text-indigo-600 transition-colors"
                  >
                    {d.dayLabel}
                  </span>
                ))}
              </div>
            </div>

            {/* Chart Legend */}
            <div className="flex items-center gap-6 mt-4 pt-3 border-t border-slate-100 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500"></span>
                <span className="text-slate-600">Classes Conducted</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span>
                <span className="text-slate-600">Demos Scheduled</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                <span className="text-slate-600">Converted Enrollments</span>
              </div>
            </div>
          </div>

          {/* Right Chart: Subject Breakdown Donut Chart */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">Subject Breakdown</h3>
              <p className="text-[11px] font-medium text-slate-400">Distribution of student demo requests by domain</p>
            </div>

            <div className="flex items-center justify-center my-4 relative">
              <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 36 36">
                {donutCircles}
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-black text-slate-800">100%</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Specialized</span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              {subjectSources.map((src, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: src.hex }}></span>
                    <span className="font-semibold text-slate-700 truncate">{src.name}</span>
                  </div>
                  <span className="font-bold text-slate-800">{src.pctNum}%</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Live Data Management Table Section */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          {/* Table Header Controls */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => setActiveTab("courses")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "courses" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                My Assigned Courses ({teacherData?.assignedSubjectsCount || 4})
              </button>
              <button
                onClick={() => setActiveTab("demos")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "demos" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Upcoming Demos ({teacherData?.demoClasses?.length || 12})
              </button>
              <button
                onClick={() => setActiveTab("students")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "students" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Student Roster (128)
              </button>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Filter roster records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-6">Subject / Course Name</th>
                  <th className="py-3.5 px-6">Brand Scope</th>
                  <th className="py-3.5 px-6">Schedule / Slot</th>
                  <th className="py-3.5 px-6">Enrolled Students</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {(teacherData?.myBrandCourses?.length > 0
                  ? teacherData.myBrandCourses
                  : [
                      { name: "AutoCAD 2D/3D Masterclass", brand: "Cadd Mantra", schedule: "Mon, Wed, Fri (10:00 AM)", students: 32, status: "ACTIVE" },
                      { name: "Revit Architecture Professional", brand: "Cadd Mantra", schedule: "Tue, Thu, Sat (02:00 PM)", students: 28, status: "ACTIVE" },
                      { name: "STAAD Pro Structural Design", brand: "Cadd Mantra", schedule: "Mon, Wed, Fri (04:00 PM)", students: 24, status: "ACTIVE" },
                      { name: "3ds Max & V-Ray Visualization", brand: "Cadd Mantra", schedule: "Tue, Thu (06:00 PM)", students: 18, status: "ACTIVE" },
                    ]
                )
                  .filter((c: any) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((course: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-6 font-bold text-slate-800 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
                        {course.name}
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-slate-600">
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-md border border-slate-200">
                          {course.brand || user.brandScope || "Cadd Mantra"}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-medium text-slate-600">{course.schedule || "Mon, Wed, Fri (10:00 AM)"}</td>
                      <td className="py-3.5 px-6 font-bold text-indigo-600">{course.students || 25} Students</td>
                      <td className="py-3.5 px-6">
                        <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-md border border-emerald-200/60">
                          {course.status || "ACTIVE"}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition-colors border border-indigo-200">
                          View Roster
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
    </div>
  );
}
