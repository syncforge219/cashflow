"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "../../component/context/user-context";
import CounsellorSidebar from "@/components/CounsellorSidebar";
import ProfileDisplay from "@/components/ProfileDisplay";
import CommandPalette from "@/components/CommandPalette";
import AddEnquiryModal from "@/components/AddEnquiryModal";
import AdmissionModal from "@/components/AdmissionModal";
import AddBatchModal from "@/components/AddBatchModal";
import LeadProfile from "@/components/LeadProfile";
import StudentSearchCenter from "@/components/StudentSearchCenter";
import { motion, AnimatePresence } from "framer-motion";

export default function CounsellorDashboardPage() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Quick Action Modals
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
  const [isAdmissionModalOpen, setIsAdmissionModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  // Selected Lead Profile
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  // Counsellor Metrics
  const [stats, setStats] = useState({
    myLeads: 0,
    todaysCalls: 0,
    todaysDemos: 0,
    followupsDue: 0,
    pendingAdmissions: 0,
    conversionRate: "0%",
    monthlyTarget: 500000,
    monthlyAchieved: 0,
  });

  const [todayFollowups, setTodayFollowups] = useState<any[]>([]);
  const [todayDemos, setTodayDemos] = useState<any[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [myAdmissions, setMyAdmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Demo scheduling state inside modal
  const [demoDate, setDemoDate] = useState(new Date().toISOString().split("T")[0]);
  const [demoTime, setDemoTime] = useState("11:00 AM");
  const [demoStudentName, setDemoStudentName] = useState("");

  // Quick Call & WhatsApp state
  const [quickPhone, setQuickPhone] = useState("");
  const [quickStudentName, setQuickStudentName] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [waMessage, setWaMessage] = useState("Hello! Greetings from CoachFlow ERP. We have exciting updates regarding your course enquiry.");

  const fetchCounsellorData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [enqRes, admRes, taskRes] = await Promise.all([
        fetch("/api/enquiries"),
        fetch("/api/admissions"),
        fetch(`/api/tasks?assignedTo=${encodeURIComponent(user.name || '')}`)
      ]);

      const enqData = await enqRes.json();
      const admData = await admRes.json();
      const taskData = await taskRes.json();

      if (enqData.success && admData.success) {
        const allEnquiries = enqData.data || [];
        const allAdmissions = admData.data || [];

        const myEnquiries = allEnquiries.filter(
          (e: any) => (e.assignedCrmAdvisor || "").toLowerCase() === (user.name || "").toLowerCase()
        );

        const counsellorAdmissions = allAdmissions.filter(
          (a: any) => (a.counsellor || "").toLowerCase() === (user.name || "").toLowerCase()
        );

        const todayStr = new Date().toISOString().split("T")[0];

        // Today's Calls
        const todaysCallsCount = (taskData.tasks || []).filter(
          (t: any) => t.taskType === "Lead Call" && new Date(t.dueDate).toISOString().split("T")[0] === todayStr
        ).length;

        // Today's Demos
        const todaysDemosList = myEnquiries.filter((e: any) => e.isDemoScheduled || e.status === "Demo Attended");

        // Follow ups Due
        let followupsDueCount = 0;
        const todayFollowupsList: any[] = [];

        myEnquiries.forEach((e: any) => {
          if (e.followUps && e.followUps.length > 0) {
            e.followUps.forEach((f: any) => {
              if (!f.isCompleted) {
                followupsDueCount++;
                todayFollowupsList.push({
                  id: e._id,
                  enquiry: e,
                  studentName: e.studentFullName,
                  phone: e.primaryPhoneMobile,
                  course: e.targetCourse,
                  action: f.typeOfContact || "Call",
                  date: f.date || "Today"
                });
              }
            });
          }
        });

        // Pending Admissions (Negotiation / Hot Leads)
        const pendingAdmCount = myEnquiries.filter((e: any) => e.status === "Negotiation" || e.priorityLevel === "High").length;

        const rawConvRate = myEnquiries.length > 0 ? (counsellorAdmissions.length / myEnquiries.length) * 100 : 0;
        const convRate = Math.min(100, Number(rawConvRate.toFixed(1))) + "%";

        // Monthly Target Progress
        const monthlyAchievedSum = counsellorAdmissions.reduce((sum: number, a: any) => sum + Number(a.amountReceivedToday || a.finalFee || 0), 0);

        setStats({
          myLeads: myEnquiries.length,
          todaysCalls: todaysCallsCount > 0 ? todaysCallsCount : myEnquiries.filter((e: any) => e.status === "New").length,
          todaysDemos: todaysDemosList.length,
          followupsDue: followupsDueCount,
          pendingAdmissions: pendingAdmCount,
          conversionRate: convRate,
          monthlyTarget: 500000,
          monthlyAchieved: monthlyAchievedSum
        });

        setTodayFollowups(todayFollowupsList.slice(0, 5));
        setTodayDemos(todaysDemosList.slice(0, 4));
        setRecentLeads(myEnquiries.slice(0, 5));
        setMyAdmissions(counsellorAdmissions);
      }
    } catch (err) {
      console.error("Failed fetching counsellor data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCounsellorData();
  }, [user]);

  if (!user) return null;

  const displayName = user.name || "Counsellor";
  const initialLetter = displayName.charAt(0).toUpperCase();

  // Progress Bar Percent
  const targetPct = Math.min(100, (stats.monthlyAchieved / stats.monthlyTarget) * 100);

  const unreadNotificationsCount = stats.followupsDue + stats.todaysCalls;

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 font-sans overflow-hidden">
      <CounsellorSidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* HEADER BAR WITH NOTIFICATION BELL */}
        <header className="h-16 px-8 flex items-center justify-between bg-white/70 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200/80 shrink-0">
          
          <div className="flex items-center gap-3">
            <h2 className="text-base font-extrabold text-slate-800 tracking-tight">Counsellor Workspace</h2>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              Live Overview
            </span>
          </div>

          <div className="flex items-center gap-4">
            
            {/* NOTIFICATION BELL ICON WITH DROPDOWN */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                title="Notifications & Activity"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-extrabold h-4.5 w-4.5 rounded-full flex items-center justify-center shadow-xs">
                    {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* NOTIFICATION DROPDOWN POPOVER */}
              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 bg-white border border-slate-200/90 rounded-2xl shadow-2xl p-4 z-50 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                        Notifications ({unreadNotificationsCount})
                      </h4>
                      <button onClick={() => setIsNotificationsOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">✕</button>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {todayFollowups.length > 0 ? (
                        todayFollowups.map((f, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              setSelectedLead(f.enquiry);
                              setIsNotificationsOpen(false);
                            }}
                            className="p-2.5 bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-100 rounded-xl text-xs space-y-0.5 cursor-pointer transition-colors"
                          >
                            <span className="font-bold text-indigo-900 block">📞 Follow-up Due: {f.studentName}</span>
                            <span className="text-[10px] text-indigo-700 block font-medium">{f.course} • {f.phone}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-slate-400 font-semibold text-xs">
                          🎉 No pending follow-up alerts!
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-3 border-l border-slate-200 pl-4 cursor-pointer" onClick={() => setIsProfileOpen(true)}>
              <div className="h-9 w-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm overflow-hidden">
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <span>{initialLetter}</span>
                )}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-slate-800 leading-tight">{displayName}</p>
                <p className="text-[11px] font-semibold text-emerald-600 leading-tight mt-0.5 capitalize">{user.role === "counsellor" ? "Sales Executive" : user.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* SEARCH CENTER CONTAINER */}
        <div className="px-8 pt-6">
          <StudentSearchCenter />
        </div>

        {/* COUNSELLOR QUICK ACTION TOOLBAR */}
        <div className="px-8 pt-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex items-center gap-3 overflow-hidden">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider px-2 select-none shrink-0 border-r border-slate-200 pr-3">
              Quick Actions:
            </span>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5 w-full">
              <button
                onClick={() => setIsAddLeadModalOpen(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>➕ Add Lead</span>
              </button>

              <button
                onClick={() => {
                  if (recentLeads.length > 0) {
                    setQuickStudentName(recentLeads[0].studentFullName);
                    setQuickPhone(recentLeads[0].primaryPhoneMobile);
                  }
                  setIsCallModalOpen(true);
                }}
                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>📞 Call Student</span>
              </button>

              <button
                onClick={() => {
                  if (recentLeads.length > 0) {
                    setQuickStudentName(recentLeads[0].studentFullName);
                    setQuickPhone(recentLeads[0].primaryPhoneMobile);
                  }
                  setIsWhatsAppModalOpen(true);
                }}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>💬 Send WhatsApp</span>
              </button>

              <button
                onClick={() => setIsDemoModalOpen(true)}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>📅 Schedule Demo</span>
              </button>

              <button
                onClick={() => setIsAdmissionModalOpen(true)}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-xl border border-amber-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>🎓 Convert to Admission</span>
              </button>

              <button
                onClick={() => setIsBatchModalOpen(true)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>📚 Create Faculty Batch</span>
              </button>
            </div>
          </div>
        </div>

        {/* MAIN COUNSELLOR DASHBOARD METRICS */}
        <div className="p-8 space-y-8">
          
          {/* 7 Specified Counsellor Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">My Leads</span>
              <span className="text-2xl font-black text-slate-800">{stats.myLeads}</span>
              <span className="text-xs text-slate-400 font-medium block mt-1">Total Assigned Enquiries</span>
            </div>

            <div className="bg-white border border-blue-200/80 rounded-2xl p-5 shadow-xs">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block mb-1">Today's Calls</span>
              <span className="text-2xl font-black text-blue-700">{stats.todaysCalls}</span>
              <span className="text-xs text-blue-500 font-semibold block mt-1">Call Tasks Scheduled</span>
            </div>

            <div className="bg-white border border-purple-200/80 rounded-2xl p-5 shadow-xs">
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block mb-1">Today's Demos</span>
              <span className="text-2xl font-black text-purple-700">{stats.todaysDemos}</span>
              <span className="text-xs text-purple-500 font-semibold block mt-1">Demo Sessions</span>
            </div>

            <div className="bg-white border border-rose-200/80 rounded-2xl p-5 shadow-xs">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block mb-1">Follow-ups Due</span>
              <span className="text-2xl font-black text-rose-600">{stats.followupsDue}</span>
              <span className="text-xs text-rose-500 font-semibold block mt-1">Action Required</span>
            </div>

            <div className="bg-white border border-amber-200/80 rounded-2xl p-5 shadow-xs">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block mb-1">Pending Admissions</span>
              <span className="text-2xl font-black text-amber-700">{stats.pendingAdmissions}</span>
              <span className="text-xs text-amber-600 font-semibold block mt-1">Hot Negotiation Leads</span>
            </div>

            <div className="bg-white border border-emerald-200/80 rounded-2xl p-5 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">My Conversion Rate</span>
              <span className="text-2xl font-black text-emerald-700">{stats.conversionRate}</span>
              <span className="text-xs text-emerald-600 font-semibold block mt-1">Leads → Admissions</span>
            </div>

            {/* MY MONTHLY TARGET PROGRESS CARD */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-5 shadow-xs sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">My Monthly Target Progress</span>
                <span className="text-xs font-black text-indigo-700">₹{(stats.monthlyAchieved / 100000).toFixed(2)} L / ₹{(stats.monthlyTarget / 100000).toFixed(2)} L</span>
              </div>
              <div className="w-full bg-indigo-100 rounded-full h-3 overflow-hidden border border-indigo-200">
                <div
                  className="bg-gradient-to-r from-indigo-600 to-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${targetPct}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-indigo-800 font-semibold pt-1">
                <span>{targetPct.toFixed(1)}% Achieved</span>
                <span>Remaining: ₹{Math.max(0, stats.monthlyTarget - stats.monthlyAchieved).toLocaleString("en-IN")}</span>
              </div>
            </div>

          </div>

          {/* ── ENQUIRIES / ADMISSIONS / FEE COLLECTION SUMMARY CARDS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Enquiries Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden group">
              <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-indigo-600 absolute top-0 left-0"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">My Enquiries</span>
                <div className="w-9 h-9 bg-indigo-50 text-indigo-600 border border-indigo-100/80 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-2xs">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">{stats.myLeads}</div>
              <div className="flex flex-wrap gap-2 mt-3 text-[11px] font-bold">
                <span className="bg-slate-50 text-slate-600 border border-slate-200/80 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                  Follow-ups: {stats.followupsDue}
                </span>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  New: {recentLeads.filter((e:any) => e.status === 'New').length}
                </span>
              </div>
            </div>

            {/* Admissions Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden group">
              <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-emerald-600 absolute top-0 left-0"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">My Admissions</span>
                <div className="w-9 h-9 bg-emerald-50 text-emerald-600 border border-emerald-100/80 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-2xs">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">{myAdmissions.length}</div>
              <div className="flex flex-wrap gap-2 mt-3 text-[11px] font-bold">
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Conv. Rate: {stats.conversionRate}
                </span>
                <span className="bg-amber-50 text-amber-700 border border-amber-100 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Hot Leads: {stats.pendingAdmissions}
                </span>
              </div>
            </div>

            {/* Fee Collection Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden group">
              <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fee Collection</span>
                <div className="w-9 h-9 bg-amber-50 text-amber-600 border border-amber-100/80 rounded-xl flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-all shadow-2xs">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-black text-amber-600 tracking-tight">₹{(stats.monthlyAchieved / 100000).toFixed(1)}L</div>
              <div className="flex flex-wrap gap-2 mt-3 text-[11px] font-bold">
                <span className="bg-amber-50 text-amber-700 border border-amber-100 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  Total: ₹{stats.monthlyAchieved.toLocaleString('en-IN')}
                </span>
                <span className="bg-rose-50 text-rose-600 border border-rose-100 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Pending: ₹{myAdmissions.reduce((s:number,a:any)=>s+Number(a.remainingBalance||0),0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

          </div>

          {/* TWO COLUMN WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* TODAY'S FOLLOW-UP WORK QUEUE */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
                <span>📞 Today's Action Queue ({todayFollowups.length})</span>
                <span className="text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-md border border-blue-100">SCHEDULED</span>
              </h3>

              {todayFollowups.length === 0 ? (
                <div className="py-8 text-center text-slate-400 font-semibold text-xs">
                  🎉 No pending follow-up calls due today!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {todayFollowups.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedLead(item.enquiry)}
                      className="p-3.5 bg-slate-50 hover:bg-indigo-50/40 border border-slate-200/80 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">{item.studentName}</span>
                        <span className="text-[11px] text-slate-500 font-medium">{item.course} • {item.phone}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg">
                        {item.action}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MY RECENT LEADS */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
                <span>📋 My Recent Assigned Leads</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-md border border-emerald-100">ACTIVE</span>
              </h3>

              {recentLeads.length === 0 ? (
                <div className="py-8 text-center text-slate-400 font-semibold text-xs">
                  No assigned leads found.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentLeads.map((lead) => (
                    <div
                      key={lead._id}
                      onClick={() => setSelectedLead(lead)}
                      className="p-3.5 bg-slate-50 hover:bg-emerald-50/40 border border-slate-200/80 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">{lead.studentFullName}</span>
                        <span className="text-[11px] text-slate-500 font-medium">{lead.targetCourse} • {lead.primaryPhoneMobile}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg">
                        {lead.status || "New"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* MODALS */}
        <AddEnquiryModal
          isOpen={isAddLeadModalOpen}
          onClose={() => setIsAddLeadModalOpen(false)}
          defaultBrand={user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All" ? user.brandScope : undefined}
          onSuccess={() => {
            setIsAddLeadModalOpen(false);
            fetchCounsellorData();
          }}
        />

        <AdmissionModal
          isOpen={isAdmissionModalOpen}
          onClose={() => setIsAdmissionModalOpen(false)}
          lead={selectedLead || null}
          defaultBrand={user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All" ? user.brandScope : undefined}
          onSuccess={() => {
            setIsAdmissionModalOpen(false);
            fetchCounsellorData();
          }}
        />

        <LeadProfile
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onSuccess={() => fetchCounsellorData()}
        />

        <ProfileDisplay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} logout={logout} />

        {/* CALL STUDENT QUICK MODAL */}
        {isCallModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>📞 Call Student & Log Conversation</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Student Phone Number</label>
                  <input
                    type="text"
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Call Remarks / Outcome Notes</label>
                  <textarea
                    rows={3}
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    placeholder="Discussed course syllabus & fee structure..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                  ></textarea>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsCallModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <a
                  href={`tel:${quickPhone}`}
                  onClick={() => setIsCallModalOpen(false)}
                  className="px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1"
                >
                  <span>Dial Call ({quickPhone || 'Student'})</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* SEND WHATSAPP QUICK MODAL */}
        {isWhatsAppModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>💬 Send WhatsApp Message</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Student Mobile</label>
                  <input
                    type="text"
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">WhatsApp Message Text</label>
                  <textarea
                    rows={4}
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl"
                  ></textarea>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsWhatsAppModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <a
                  href={`https://wa.me/${quickPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(waMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsWhatsAppModalOpen(false)}
                  className="px-5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1"
                >
                  <span>Open WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* SCHEDULE DEMO QUICK MODAL */}
        {isDemoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">📅 Schedule Free Demo Class</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Candidate Name</label>
                  <input
                    type="text"
                    value={demoStudentName}
                    onChange={(e) => setDemoStudentName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Demo Date</label>
                    <input
                      type="date"
                      value={demoDate}
                      onChange={(e) => setDemoDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Demo Time</label>
                    <input
                      type="text"
                      value={demoTime}
                      onChange={(e) => setDemoTime(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsDemoModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsDemoModalOpen(false);
                    fetchCounsellorData();
                  }}
                  className="px-5 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl shadow-md"
                >
                  Confirm Demo Schedule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Batch Modal */}
        <AddBatchModal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          onSuccess={() => {
            setIsBatchModalOpen(false);
            fetchCounsellorData();
          }}
          initialBrandScope={user?.brandScope}
        />

      </div>
    </div>
  );
}
