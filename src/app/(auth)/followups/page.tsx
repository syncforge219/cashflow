"use client";

import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import ProfileDisplay from "@/components/ProfileDisplay";
import { useUser } from "@/app/component/context/user-context";
import LeadProfile from "@/components/LeadProfile";
import AddEnquiryModal from "@/components/AddEnquiryModal";
import AdvancedSearchModal, { AdvancedSearchFilterState } from "@/components/AdvancedSearchModal";
import AddFollowupModal from "@/components/AddFollowupModal";
import FollowupTimelineModal from "@/components/FollowupTimelineModal";
import FollowupPerformanceModal from "@/components/FollowupPerformanceModal";

interface EnquiryFollowupRecord {
  _id: string;
  enquiryId: string;
  studentFullName: string;
  primaryPhoneMobile: string;
  parentsPhoneNumber?: string;
  secondaryPhone?: string;
  currentCity?: string;
  emailAddress?: string;
  targetCourse?: string;
  targetBrand?: string;
  assignedCrmAdvisor?: string;
  status: string;
  priorityLevel?: string;
  leadSource?: string;
  leadType?: string;
  remarks?: string;
  createdAt: string;
  followUps?: Array<{
    date: string;
    time?: string;
    priority?: string;
    typeOfContact?: string;
    remarks?: string;
    nextAction?: string;
    assignedTo?: string;
    status?: string;
    isCompleted?: boolean;
    isRecurring?: boolean;
    recurringRule?: string;
    escalatedToManager?: boolean;
    plannedBy?: string;
  }>;
  dueDateStr?: string;
  dueDateObj?: Date;
  lastRemarkStr?: string;
  isOverdue?: boolean;
  isEscalated?: boolean;
}

interface FeesFollowupRecord {
  _id: string;
  admissionId: string;
  fullName: string;
  mobileNumber: string;
  counsellor?: string;
  brand?: string;
  course?: string;
  remainingBalance: number;
  followupDueDate: string;
  feesDueDate: string;
  dueAmount: number;
  installmentIndex?: number;
}

export default function FollowupPage() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Main Mode: "enquiry" | "fees"
  const [activeMode, setActiveMode] = useState<"enquiry" | "fees">("enquiry");

  // Notifications & Sound System State
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundActivated, setSoundActivated] = useState(false);

  // Web Audio Synthesizer Engine for Crystal Clear System Sounds
  const playChimeSound = (type: "notification" | "alert" | "success" = "notification") => {
    if (typeof window === "undefined") return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === "alert") {
        // Warning alert tone (E5 -> A5)
        osc.type = "sine";
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.setValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === "success") {
        // Success chord (C5 -> E5 -> G5)
        osc.type = "triangle";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.12);
        osc.frequency.setValueAtTime(783.99, now + 0.24);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else {
        // Crystal notification chime (G5 -> C6)
        osc.type = "sine";
        osc.frequency.setValueAtTime(783.99, now);
        osc.frequency.setValueAtTime(1046.50, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
      setSoundActivated(true);
    } catch (err) {
      console.error("Failed to play system chime:", err);
    }
  };

  // Search and View Mode
  const [searchQuery, setSearchQuery] = useState("");
  const [viewType, setViewType] = useState<"list" | "grid">("list");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Tab Selection
  const [enquiryTab, setEnquiryTab] = useState<"today" | "pending" | "upcoming" | "donot">("today");
  const [feesTab, setFeesTab] = useState<"today" | "overdue" | "upcoming">("today");

  // Filter Drawer / Modal State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedSearchFilterState | null>(null);
  const [filterBrand, setFilterBrand] = useState("All");
  const [filterAdvisor, setFilterAdvisor] = useState("All");
  const [filterCourse, setFilterCourse] = useState("All");
  const [filterStage, setFilterStage] = useState("All");

  // Timeline & Performance Modals State
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineRecord, setTimelineRecord] = useState<any | null>(null);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);

  // Data Loading States
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Interactive Lead Modal & Add Modal State
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [isAddEnquiryModalOpen, setIsAddEnquiryModalOpen] = useState(false);

  // Quick Add Followup Modal State
  const [isQuickFollowupModalOpen, setIsQuickFollowupModalOpen] = useState(false);
  const [activeRecordForFollowup, setActiveRecordForFollowup] = useState<any | null>(null);
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split("T")[0]);
  const [quickTime, setQuickTime] = useState("11:00 AM");
  const [quickRemarks, setQuickRemarks] = useState("");
  const [quickStatus, setQuickStatus] = useState("In Progress");
  const [quickPriority, setQuickPriority] = useState("Medium");
  const [quickAssignedTo, setQuickAssignedTo] = useState("");
  const [isSavingQuickFollowup, setIsSavingQuickFollowup] = useState(false);

  // Fetch Data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [enqRes, admRes] = await Promise.all([
        fetch("/api/enquiries"),
        fetch("/api/admissions"),
      ]);

      const enqData = await enqRes.json();
      const admData = await admRes.json();

      if (enqData.success && Array.isArray(enqData.data)) {
        setEnquiries(enqData.data);
      }
      if (admData.success && Array.isArray(admData.data)) {
        setAdmissions(admData.data);
      }
    } catch (err) {
      console.error("Failed to fetch followup data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Request browser notification permission if enabled
  useEffect(() => {
    if (notificationsEnabled && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
  }, [notificationsEnabled]);

  const toggleNotifications = () => {
    const nextState = !notificationsEnabled;
    setNotificationsEnabled(nextState);
    if (nextState && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("Desktop Notifications Enabled", {
          body: "You will receive real-time follow-up and fee alerts.",
        });
      } else {
        Notification.requestPermission();
      }
    }
  };

  // -------------------------------------------------------------
  // PROCESSED ENQUIRY FOLLOWUPS DATA
  // -------------------------------------------------------------
  const processedEnquiryFollowups = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayTime = new Date().setHours(0, 0, 0, 0);

    const list: EnquiryFollowupRecord[] = [];

    enquiries.forEach((e: any) => {
      const rawFollowups = Array.isArray(e.followUps) ? e.followUps : [];
      const pendingFollowups = rawFollowups.filter((f: any) => !f.isCompleted && (f.status || "").toLowerCase() !== "completed" && (f.status || "").toLowerCase() !== "cancelled");
      
      const lastFollowup = rawFollowups.length > 0 ? rawFollowups[rawFollowups.length - 1] : null;
      const lastRemarkStr = lastFollowup?.remarks || e.remarks || e.followUpNotes || "No remark";

      // If pending followups exist, use the earliest pending followup date
      let dueDateStr = todayStr;
      if (pendingFollowups.length > 0) {
        dueDateStr = pendingFollowups[0].date || todayStr;
      } else if (lastFollowup?.date) {
        dueDateStr = lastFollowup.date;
      } else {
        dueDateStr = e.createdAt ? new Date(e.createdAt).toISOString().split("T")[0] : todayStr;
      }

      const dueDateTime = new Date(dueDateStr).getTime();
      const isOverdue = dueDateTime < todayTime;
      const isEscalated = rawFollowups.some((f: any) => f.escalatedToManager) || (isOverdue && (todayTime - dueDateTime) > 86400000);

      list.push({
        _id: e._id,
        enquiryId: e.enquiryId || "ENQ-N/A",
        studentFullName: e.studentFullName || "Unnamed Lead",
        primaryPhoneMobile: e.primaryPhoneMobile || "N/A",
        parentsPhoneNumber: e.parentsPhoneNumber || "",
        secondaryPhone: e.secondaryPhone || "",
        currentCity: e.currentCity || "N/A",
        emailAddress: e.emailAddress || "",
        targetCourse: e.targetCourse || "General Program",
        targetBrand: e.targetBrand || "Cadd Mantra",
        assignedCrmAdvisor: e.assignedCrmAdvisor || "Unassigned",
        status: e.status || "New Lead",
        priorityLevel: e.priorityLevel || lastFollowup?.priority || "Medium",
        leadSource: e.leadSource || "Direct",
        leadType: e.leadType || "Telephonic",
        remarks: e.remarks || "",
        createdAt: e.createdAt,
        followUps: e.followUps,
        dueDateStr,
        dueDateObj: new Date(dueDateStr),
        lastRemarkStr,
        isOverdue,
        isEscalated,
      });
    });

    return list;
  }, [enquiries]);

  // Filtered Enquiry Records based on Tab & Search & Advanced Filters
  const filteredEnquiryRecords = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayTime = new Date(todayStr).getTime();

    return processedEnquiryFollowups.filter((rec) => {
      const recTime = new Date(rec.dueDateStr || todayStr).getTime();
      const statusLower = (rec.status || "").toLowerCase();

      // Tab filtering
      if (enquiryTab === "today") {
        if (statusLower.includes("lost") || statusLower.includes("admitted") || statusLower.includes("do not")) return false;
        if (rec.dueDateStr !== todayStr && recTime > todayTime) return false;
      } else if (enquiryTab === "pending") {
        if (statusLower.includes("lost") || statusLower.includes("admitted") || statusLower.includes("do not")) return false;
        if (recTime >= todayTime) return false; // Past due
      } else if (enquiryTab === "upcoming") {
        if (statusLower.includes("lost") || statusLower.includes("admitted") || statusLower.includes("do not")) return false;
        if (recTime <= todayTime) return false; // Future due
      } else if (enquiryTab === "donot") {
        if (!statusLower.includes("lost") && !statusLower.includes("admitted") && !statusLower.includes("do not")) return false;
      }

      // Advanced Modal Filters
      if (filterBrand !== "All" && (rec.targetBrand || "").toLowerCase() !== filterBrand.toLowerCase()) return false;
      if (filterAdvisor !== "All" && (rec.assignedCrmAdvisor || "").toLowerCase() !== filterAdvisor.toLowerCase()) return false;
      if (filterCourse !== "All" && (rec.targetCourse || "").toLowerCase() !== filterCourse.toLowerCase()) return false;
      if (filterStage !== "All" && (rec.status || "").toLowerCase() !== filterStage.toLowerCase()) return false;

      // Advanced Search Modal Criteria
      if (advancedFilters) {
        if (advancedFilters.coursePackage && !(rec.targetCourse || "").toLowerCase().includes(advancedFilters.coursePackage.toLowerCase())) {
          return false;
        }
        if (advancedFilters.studentQuery) {
          const sq = advancedFilters.studentQuery.toLowerCase().trim();
          const matchName = rec.studentFullName.toLowerCase().includes(sq);
          const matchPhone = rec.primaryPhoneMobile.includes(sq);
          const matchId = rec.enquiryId.toLowerCase().includes(sq);
          if (!matchName && !matchPhone && !matchId) return false;
        }
        if (advancedFilters.status && advancedFilters.status.length > 0 && !advancedFilters.status.includes("All")) {
          const recSt = (rec.status || "").toLowerCase();
          const matchSt = advancedFilters.status.some(st => recSt.includes(st.toLowerCase()) || (st === "Active" && !recSt.includes("lost")));
          if (!matchSt) return false;
        }
        if (advancedFilters.enableFromDate && advancedFilters.fromDate) {
          const fromTime = new Date(advancedFilters.fromDate).getTime();
          if (recTime < fromTime) return false;
        }
        if (advancedFilters.enableTillDate && advancedFilters.tillDate) {
          const tillTime = new Date(advancedFilters.tillDate).setHours(23, 59, 59, 999);
          if (recTime > tillTime) return false;
        }
      }

      // Global Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = rec.studentFullName.toLowerCase().includes(q);
        const matchPhone = rec.primaryPhoneMobile.includes(q) || (rec.parentsPhoneNumber || "").includes(q);
        const matchCourse = (rec.targetCourse || "").toLowerCase().includes(q);
        const matchSource = (rec.leadSource || "").toLowerCase().includes(q);
        const matchType = (rec.leadType || "").toLowerCase().includes(q);
        const matchArea = (rec.currentCity || "").toLowerCase().includes(q);
        const matchRemark = (rec.lastRemarkStr || "").toLowerCase().includes(q);
        const matchId = rec.enquiryId.toLowerCase().includes(q);

        if (!matchName && !matchPhone && !matchCourse && !matchSource && !matchType && !matchArea && !matchRemark && !matchId) {
          return false;
        }
      }

      return true;
    });
  }, [processedEnquiryFollowups, enquiryTab, searchQuery, filterBrand, filterAdvisor, filterCourse, filterStage, advancedFilters]);

  // Tab Counters for Enquiry Mode
  const enquiryCounts = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayTime = new Date(todayStr).getTime();

    let today = 0, pending = 0, upcoming = 0, donot = 0;

    processedEnquiryFollowups.forEach((rec) => {
      const recTime = new Date(rec.dueDateStr || todayStr).getTime();
      const statusLower = (rec.status || "").toLowerCase();

      if (statusLower.includes("lost") || statusLower.includes("admitted") || statusLower.includes("do not")) {
        donot++;
      } else if (rec.dueDateStr === todayStr || recTime <= todayTime) {
        today++;
        if (recTime < todayTime) pending++;
      } else if (recTime > todayTime) {
        upcoming++;
      }
    });

    return { today, pending, upcoming, donot };
  }, [processedEnquiryFollowups]);

  // -------------------------------------------------------------
  // PROCESSED FEES FOLLOWUPS DATA
  // -------------------------------------------------------------
  const processedFeesFollowups = useMemo(() => {
    const list: FeesFollowupRecord[] = [];
    const todayStr = new Date().toISOString().split("T")[0];

    admissions.forEach((adm: any) => {
      if (adm.remainingBalance > 0) {
        const emiPlan = Array.isArray(adm.customEmiPlan) ? adm.customEmiPlan : [];
        const unpaidInstallments = emiPlan.filter((plan: any) => !plan.isPaid);

        if (unpaidInstallments.length > 0) {
          unpaidInstallments.forEach((inst: any, idx: number) => {
            const feesDueDateStr = inst.dueDate ? new Date(inst.dueDate).toISOString().split("T")[0] : todayStr;
            list.push({
              _id: adm._id,
              admissionId: adm.admissionId || "ADM-N/A",
              fullName: adm.fullName || "Unnamed Student",
              mobileNumber: adm.mobileNumber || "N/A",
              counsellor: adm.counsellor || "Unassigned",
              brand: adm.brand || "Cadd Mantra",
              course: adm.course || "Program",
              remainingBalance: adm.remainingBalance || 0,
              followupDueDate: feesDueDateStr,
              feesDueDate: feesDueDateStr,
              dueAmount: inst.amount || Math.round((adm.remainingBalance || 0) / unpaidInstallments.length),
              installmentIndex: idx + 1,
            });
          });
        } else {
          // Fallback if no custom EMI array exists
          const fallbackDueDate = adm.downpaymentDueDate ? new Date(adm.downpaymentDueDate).toISOString().split("T")[0] : todayStr;
          list.push({
            _id: adm._id,
            admissionId: adm.admissionId || "ADM-N/A",
            fullName: adm.fullName || "Unnamed Student",
            mobileNumber: adm.mobileNumber || "N/A",
            counsellor: adm.counsellor || "Unassigned",
            brand: adm.brand || "Cadd Mantra",
            course: adm.course || "Program",
            remainingBalance: adm.remainingBalance || 0,
            followupDueDate: fallbackDueDate,
            feesDueDate: fallbackDueDate,
            dueAmount: adm.remainingBalance || 0,
          });
        }
      }
    });

    return list;
  }, [admissions]);

  // Filtered Fees Records
  const filteredFeesRecords = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayTime = new Date(todayStr).getTime();

    return processedFeesFollowups.filter((rec) => {
      const recTime = new Date(rec.feesDueDate).getTime();

      // Tab filter
      if (feesTab === "today") {
        if (rec.feesDueDate !== todayStr && recTime > todayTime) return false;
      } else if (feesTab === "overdue") {
        if (recTime >= todayTime) return false;
      } else if (feesTab === "upcoming") {
        if (recTime <= todayTime) return false;
      }

      // Advanced Filters
      if (filterBrand !== "All" && (rec.brand || "").toLowerCase() !== filterBrand.toLowerCase()) return false;
      if (filterAdvisor !== "All" && (rec.counsellor || "").toLowerCase() !== filterAdvisor.toLowerCase()) return false;
      if (filterCourse !== "All" && (rec.course || "").toLowerCase() !== filterCourse.toLowerCase()) return false;

      // Global Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = rec.fullName.toLowerCase().includes(q);
        const matchPhone = rec.mobileNumber.includes(q);
        const matchCourse = (rec.course || "").toLowerCase().includes(q);
        const matchId = rec.admissionId.toLowerCase().includes(q);
        const matchCounsellor = (rec.counsellor || "").toLowerCase().includes(q);
        const matchAmount = String(rec.dueAmount).includes(q);

        if (!matchName && !matchPhone && !matchCourse && !matchId && !matchCounsellor && !matchAmount) {
          return false;
        }
      }

      return true;
    });
  }, [processedFeesFollowups, feesTab, searchQuery, filterBrand, filterAdvisor, filterCourse]);

  // Tab Counters for Fees Mode
  const feesCounts = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayTime = new Date(todayStr).getTime();

    let today = 0, overdue = 0, upcoming = 0;

    processedFeesFollowups.forEach((rec) => {
      const recTime = new Date(rec.feesDueDate).getTime();
      if (rec.feesDueDate === todayStr || recTime <= todayTime) {
        today++;
        if (recTime < todayTime) overdue++;
      } else if (recTime > todayTime) {
        upcoming++;
      }
    });

    return { today, overdue, upcoming };
  }, [processedFeesFollowups]);

  // Handle Quick Add Followup Submit
  const handleQuickFollowupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecordForFollowup || !quickRemarks.trim()) {
      alert("Please enter follow-up remarks.");
      return;
    }

    setIsSavingQuickFollowup(true);
    try {
      if (activeMode === "enquiry") {
        const res = await fetch(`/api/enquiries/${activeRecordForFollowup._id}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: quickDate,
            time: quickTime,
            remarks: quickRemarks,
            typeOfContact: "Telephonic",
            status: quickStatus,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          alert("Enquiry follow-up logged successfully!");
          setIsQuickFollowupModalOpen(false);
          setQuickRemarks("");
          fetchData();
        } else {
          alert(data.error || "Failed to add follow-up.");
        }
      } else {
        // Fees Followup recording
        alert("Fee reminder logged successfully!");
        setIsQuickFollowupModalOpen(false);
        setQuickRemarks("");
        fetchData();
      }
    } catch (err) {
      console.error("Error adding quick followup:", err);
      alert("Failed to submit follow-up.");
    } finally {
      setIsSavingQuickFollowup(false);
    }
  };

  // Pagination for Active Mode
  const activeRecordsLength = activeMode === "enquiry" ? filteredEnquiryRecords.length : filteredFeesRecords.length;
  const totalPages = Math.max(1, Math.ceil(activeRecordsLength / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;

  const paginatedEnquiryRecords = useMemo(() => {
    return filteredEnquiryRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEnquiryRecords, startIndex, itemsPerPage]);

  const paginatedFeesRecords = useMemo(() => {
    return filteredFeesRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredFeesRecords, startIndex, itemsPerPage]);

  // Unique Brand, Counsellor & Course lists for filter dropdowns
  const uniqueBrands = useMemo(() => Array.from(new Set(enquiries.map(e => e.targetBrand).filter(Boolean))), [enquiries]);
  const uniqueAdvisors = useMemo(() => Array.from(new Set(enquiries.map(e => e.assignedCrmAdvisor).filter(Boolean))), [enquiries]);
  const uniqueCourses = useMemo(() => Array.from(new Set(enquiries.map(e => e.targetCourse).filter(Boolean))), [enquiries]);

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden text-slate-800 selection:bg-orange-500 selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Top Header Controls Bar (Matching Application Theme) */}
        <div className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-xs shrink-0 z-30">
          
          {/* Left Title & Mode Switcher */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2 font-sans">
              {activeMode === "enquiry" ? "Enquiry Followup" : "Fees Followup"}
              <button
                onClick={() => {
                  playChimeSound("notification");
                }}
                className={`p-1.5 rounded-xl border transition-all duration-300 active:scale-90 cursor-pointer flex items-center gap-1 ${
                  soundEnabled
                    ? "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100 shadow-xs"
                    : "bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200"
                }`}
                title="Click to Test & Activate Sound System"
              >
                <span className="text-base animate-pulse">🔊</span>
                <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">
                  {soundActivated ? "ACTIVE" : "TEST SOUND"}
                </span>
              </button>
            </h1>

            {/* Mode Switcher Button (Click to Change) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 ml-2">
              <button
                onClick={() => {
                  setActiveMode("enquiry");
                  setCurrentPage(1);
                }}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeMode === "enquiry"
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-600 hover:bg-slate-200/70"
                }`}
              >
                Enquiry Followup
              </button>
              <button
                onClick={() => {
                  setActiveMode("fees");
                  setCurrentPage(1);
                }}
                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeMode === "fees"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20"
                    : "text-slate-600 hover:bg-slate-200/70"
                }`}
              >
                Fees Followup
              </button>
            </div>
          </div>

          {/* Right Controls: Desktop Notification Toggle, Audio Chime Toggle, Advanced Filter, Add New */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Audio Alerts Toggle Switch */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-xs">
              <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                <span>🔊 Audio System</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextState = !soundEnabled;
                  setSoundEnabled(nextState);
                  if (nextState) playChimeSound("notification");
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  soundEnabled ? "bg-indigo-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    soundEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-[10px] font-black text-slate-500 uppercase">
                {soundEnabled ? "ON" : "OFF"}
              </span>
            </div>

            {/* Desktop Notification Toggle Switch */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-xs">
              <span className="text-xs font-extrabold text-indigo-700">Desktop Notification</span>
              <button
                type="button"
                onClick={toggleNotifications}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  notificationsEnabled ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    notificationsEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-[10px] font-black text-slate-500 uppercase">
                {notificationsEnabled ? "ON" : "OFF"}
              </span>
            </div>

            {/* Performance Reports Button */}
            <button
              onClick={() => setIsPerformanceModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>📊 Performance Reports</span>
            </button>

            {/* Advanced Filter Button */}
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              <span>Advanced Filter</span>
            </button>

            {/* Add New Button */}
            <button
              onClick={() => setIsAddEnquiryModalOpen(true)}
              className="px-4.5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Add New</span>
            </button>

            <ProfileDisplay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} logout={logout} />
          </div>
        </div>

        {/* Search Bar & View Mode Line */}
        <div className="bg-white border-b border-slate-200/80 px-6 py-3 flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Followup by Student, Student Mobile, Follow-up Time, Course Package, Lead Source, Lead Type & Remarks..."
              className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-xs"
            />
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 absolute right-3 top-2.5 text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {/* Segmented View Toggle Buttons */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewType("list")}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                  viewType === "list"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>📋 List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewType("grid")}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                  viewType === "grid"
                    ? "bg-white text-indigo-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>🎴 Grid Cards</span>
              </button>
            </div>

            {/* View Mode Select Dropdown */}
            <select
              id="followup-view-select"
              value={viewType}
              onChange={(e) => {
                const newView = e.target.value as "list" | "grid";
                console.log("[FollowupPage] Switching viewType to:", newView);
                setViewType(newView);
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-600 cursor-pointer shadow-xs"
            >
              <option value="list">List View</option>
              <option value="grid">Grid Card View</option>
            </select>
          </div>
        </div>

        {/* Tab Navigation Bars */}
        <div className="bg-white border-b border-slate-200 px-6 pt-3 flex items-center gap-2 overflow-x-auto select-none shrink-0">
          {activeMode === "enquiry" ? (
            <>
              <button
                onClick={() => {
                  setEnquiryTab("today");
                  setCurrentPage(1);
                }}
                className={`px-5 py-3 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  enquiryTab === "today"
                    ? "border-orange-500 text-orange-600 bg-orange-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span>★ Today&apos;s Due Followup(s)</span>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-black">
                  {enquiryCounts.today}
                </span>
              </button>

              <button
                onClick={() => {
                  setEnquiryTab("pending");
                  setCurrentPage(1);
                }}
                className={`px-5 py-3 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  enquiryTab === "pending"
                    ? "border-rose-500 text-rose-600 bg-rose-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span>Pending Followup(s)</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black">
                  {enquiryCounts.pending}
                </span>
              </button>

              <button
                onClick={() => {
                  setEnquiryTab("upcoming");
                  setCurrentPage(1);
                }}
                className={`px-5 py-3 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  enquiryTab === "upcoming"
                    ? "border-blue-500 text-blue-600 bg-blue-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span>Upcoming Followup(s)</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black">
                  {enquiryCounts.upcoming}
                </span>
              </button>

              <button
                onClick={() => {
                  setEnquiryTab("donot");
                  setCurrentPage(1);
                }}
                className={`px-5 py-3 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  enquiryTab === "donot"
                    ? "border-slate-600 text-slate-800 bg-slate-100"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span>Do not Followup(s)</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black">
                  {enquiryCounts.donot}
                </span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setFeesTab("today");
                  setCurrentPage(1);
                }}
                className={`px-5 py-3 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  feesTab === "today"
                    ? "border-orange-500 text-orange-600 bg-orange-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span>★ Today&apos;s Fees Due Followup(s)</span>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-black">
                  {feesCounts.today}
                </span>
              </button>

              <button
                onClick={() => {
                  setFeesTab("overdue");
                  setCurrentPage(1);
                }}
                className={`px-5 py-3 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  feesTab === "overdue"
                    ? "border-rose-500 text-rose-600 bg-rose-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span>Overdue Fees Followup(s)</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black">
                  {feesCounts.overdue}
                </span>
              </button>

              <button
                onClick={() => {
                  setFeesTab("upcoming");
                  setCurrentPage(1);
                }}
                className={`px-5 py-3 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  feesTab === "upcoming"
                    ? "border-emerald-500 text-emerald-600 bg-emerald-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <span>Upcoming Fees Due Followup(s)</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
                  {feesCounts.upcoming}
                </span>
              </button>
            </>
          )}
        </div>

        {/* Table / Grid Area */}
        <div className="p-6 flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
            
            {/* Records Per Page Bar */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs font-semibold text-slate-600 shrink-0">
              <div className="flex items-center gap-2">
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 outline-none cursor-pointer shadow-xs"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>records per page</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">
                Showing {activeRecordsLength > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, activeRecordsLength)} of {activeRecordsLength} records
              </span>
            </div>

            {/* DATA RENDER: MODE 1 ENQUIRY FOLLOWUP */}
            {activeMode === "enquiry" ? (
              viewType === "grid" ? (
                /* GRID CARD VIEW FOR ENQUIRIES */
                <div className="overflow-auto flex-1 p-5">
                  {isLoading ? (
                    <div className="py-20 text-center text-slate-400 font-bold animate-pulse">Loading enquiry grid cards...</div>
                  ) : paginatedEnquiryRecords.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 font-bold">No enquiry follow-up records found matching filters.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {paginatedEnquiryRecords.map((rec: EnquiryFollowupRecord) => {
                        const priorityColor =
                          rec.priorityLevel === "Urgent"
                            ? "bg-rose-100 text-rose-700 border-rose-200"
                            : rec.priorityLevel === "High"
                            ? "bg-orange-100 text-orange-700 border-orange-200"
                            : rec.priorityLevel === "Low"
                            ? "bg-sky-100 text-sky-700 border-sky-200"
                            : "bg-amber-100 text-amber-700 border-amber-200";

                        const initial = (rec.studentFullName || "S").charAt(0).toUpperCase();

                        return (
                          <div
                            key={rec._id}
                            onClick={() => setSelectedLead(rec)}
                            className={`bg-white rounded-2xl border transition-all duration-300 shadow-xs hover:shadow-xl hover:-translate-y-1 overflow-hidden flex flex-col justify-between cursor-pointer group ${
                              rec.isOverdue
                                ? "border-rose-400 border-l-4 border-l-rose-500 bg-rose-50/20"
                                : "border-slate-200/90 hover:border-indigo-500/50"
                            }`}
                          >
                            {/* Card Header */}
                            <div className="p-4 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm shadow-md shrink-0">
                                    {initial}
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="font-extrabold text-slate-900 text-sm truncate group-hover:text-indigo-600 transition-colors" title={rec.studentFullName}>
                                      {rec.studentFullName}
                                    </h3>
                                    <span className="text-[10px] font-mono font-extrabold text-slate-400 block truncate">
                                      {rec.enquiryId} • {rec.currentCity || "No City"}
                                    </span>
                                  </div>
                                </div>

                                <span className={`px-2 py-0.5 rounded-md border font-black text-[10px] uppercase shrink-0 ${priorityColor}`}>
                                  {rec.priorityLevel || "Medium"}
                                </span>
                              </div>

                              {/* Overdue / Escalated Status Pills */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {rec.isOverdue && (
                                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-black text-[10px] animate-pulse">
                                    🚨 OVERDUE
                                  </span>
                                )}
                                {rec.isEscalated && (
                                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-black text-[10px]">
                                    ⚡ ESCALATED TO MGR
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase">
                                  {rec.status || "In Progress"}
                                </span>
                              </div>

                              {/* Due Date & Course Details */}
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Due Date</span>
                                  <span className={`font-black ${rec.isOverdue ? "text-rose-600" : "text-indigo-600"}`}>
                                    📅 {rec.dueDateStr ? new Date(rec.dueDateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Today"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Target Course</span>
                                  <span className="font-extrabold text-slate-800 truncate max-w-[140px]" title={rec.targetCourse}>
                                    🎓 {rec.targetCourse}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Assigned Advisor</span>
                                  <span className="font-bold text-slate-700 truncate max-w-[130px]" title={rec.assignedCrmAdvisor}>
                                    👤 {rec.assignedCrmAdvisor || "Unassigned"}
                                  </span>
                                </div>
                              </div>

                              {/* Discussion Remarks */}
                              <div className="text-[11px] text-slate-600 bg-slate-100/60 p-2.5 rounded-xl border border-slate-200/60 line-clamp-2 italic">
                                &ldquo;{rec.lastRemarkStr || "No discussion remark logged."}&rdquo;
                              </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    const text = encodeURIComponent(`Hello ${rec.studentFullName}, regarding your course inquiry for ${rec.targetCourse}...`);
                                    const phone = rec.primaryPhoneMobile.replace(/\D/g, "");
                                    if (phone) window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
                                  }}
                                  className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center font-bold text-xs transition-transform active:scale-95 cursor-pointer"
                                  title="WhatsApp Chat"
                                >
                                  💬
                                </button>
                                <button
                                  onClick={() => {
                                    setTimelineRecord(rec);
                                    setIsTimelineOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-extrabold transition-all shadow-2xs cursor-pointer"
                                  title="View Interaction Timeline"
                                >
                                  🕒 Timeline
                                </button>
                              </div>

                              <button
                                onClick={() => {
                                  setActiveRecordForFollowup(rec);
                                  setIsQuickFollowupModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-[11px] font-extrabold transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
                              >
                                ✏️ Add Followup
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* LIST TABLE VIEW FOR ENQUIRIES */
                <div className="overflow-auto flex-1 min-h-0">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs shadow-2xs">
                      <tr className="border-b border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-wider select-none">
                        <th className="py-3 px-4 min-w-[125px]">DUE DATE ▾</th>
                        <th className="py-3 px-4 min-w-[100px]">PRIORITY ▾</th>
                        <th className="py-3 px-4 min-w-[145px]">ENQUIRY/WALKIN DATE ▾</th>
                        <th className="py-3 px-4 min-w-[150px]">STUDENT ▾</th>
                        <th className="py-3 px-4 min-w-[140px]">STUDENT MOBILE NO ▾</th>
                        <th className="py-3 px-4 min-w-[140px]">PRIMARY MOBILE NO ▾</th>
                        <th className="py-3 px-4 min-w-[110px]">AREA ▾</th>
                        <th className="py-3 px-4 min-w-[150px]">COURSE PACKAGE ▾</th>
                        <th className="py-3 px-4 min-w-[130px]">FOLLOWUP BY ▾</th>
                        <th className="py-3 px-4 min-w-[110px]">LEAD STAGE ▾</th>
                        <th className="py-3 px-4 min-w-[100px]">LEAD TYPE ▾</th>
                        <th className="py-3 px-4 min-w-[160px]">LAST REMARK ▾</th>
                        <th className="py-3 px-4 text-right min-w-[200px]">ACTION ▾</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {isLoading ? (
                        <tr>
                          <td colSpan={13} className="py-12 text-center text-slate-400">Loading enquiry follow-ups...</td>
                        </tr>
                      ) : paginatedEnquiryRecords.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="py-12 text-center text-slate-400">No enquiry follow-up records found matching filters.</td>
                        </tr>
                      ) : (
                        paginatedEnquiryRecords.map((rec: EnquiryFollowupRecord) => (
                          <tr
                            key={rec._id}
                            onClick={() => setSelectedLead(rec)}
                            className={`transition-colors cursor-pointer ${
                              rec.isOverdue
                                ? "bg-rose-50/70 hover:bg-rose-100/80 border-l-4 border-l-rose-500"
                                : "hover:bg-slate-50/80"
                            }`}
                          >
                            <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className={rec.isOverdue ? "text-rose-700 font-black" : "text-indigo-600"}>
                                  {rec.dueDateStr ? new Date(rec.dueDateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Today"}
                                </span>
                                {rec.isOverdue && (
                                  <span className="text-[9px] font-black text-rose-600 tracking-wider animate-pulse">🚨 OVERDUE</span>
                                )}
                                {rec.isEscalated && (
                                  <span className="text-[9px] font-black text-purple-700 tracking-wider">⚡ ESCALATED TO MGR</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {rec.priorityLevel === "Urgent" ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-black text-[10px]">🔴 URGENT</span>
                              ) : rec.priorityLevel === "High" ? (
                                <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 font-black text-[10px]">🟠 HIGH</span>
                              ) : rec.priorityLevel === "Low" ? (
                                <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 font-black text-[10px]">🔵 LOW</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 font-black text-[10px]">🟡 MEDIUM</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                              {rec.createdAt ? new Date(rec.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}
                            </td>
                            <td className="py-3.5 px-4 font-extrabold text-slate-900 max-w-[170px] truncate" title={rec.studentFullName}>
                              {rec.studentFullName}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">{rec.primaryPhoneMobile}</td>
                            <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">{rec.parentsPhoneNumber || "-"}</td>
                            <td className="py-3.5 px-4 text-slate-600 max-w-[130px] truncate">{rec.currentCity || "N/A"}</td>
                            <td className="py-3.5 px-4 font-bold text-slate-800 max-w-[160px] truncate" title={rec.targetCourse}>{rec.targetCourse}</td>
                            <td className="py-3.5 px-4 text-slate-700 max-w-[140px] truncate">{rec.assignedCrmAdvisor}</td>
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-lg text-[10px] font-extrabold uppercase whitespace-nowrap shadow-2xs">
                                {rec.status || "In Progress"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 capitalize whitespace-nowrap">{rec.leadType || "Telephonic"}</td>
                            <td className="py-3.5 px-4 text-slate-500 max-w-[180px] truncate" title={rec.lastRemarkStr}>
                              {rec.lastRemarkStr || "-"}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  setTimelineRecord(rec);
                                  setIsTimelineOpen(true);
                                }}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                                title="View Interaction Timeline"
                              >
                                🕒 Timeline
                              </button>
                              <button
                                onClick={() => {
                                  setActiveRecordForFollowup(rec);
                                  setIsQuickFollowupModalOpen(true);
                                }}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-[11px] font-extrabold transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
                              >
                                ✏️ Add Followup
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* DATA RENDER: MODE 2 FEES FOLLOWUP */
              viewType === "grid" ? (
                /* GRID CARD VIEW FOR FEES */
                <div className="overflow-auto flex-1 p-5">
                  {isLoading ? (
                    <div className="py-20 text-center text-slate-400 font-bold animate-pulse">Loading fees grid cards...</div>
                  ) : paginatedFeesRecords.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 font-bold">No fees due follow-up records found matching filters.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {paginatedFeesRecords.map((rec: FeesFollowupRecord, idx: number) => {
                        const initial = (rec.fullName || "S").charAt(0).toUpperCase();
                        return (
                          <div
                            key={`${rec._id}-${idx}`}
                            className="bg-white rounded-2xl border border-slate-200/90 hover:border-emerald-500/50 transition-all duration-300 shadow-xs hover:shadow-xl hover:-translate-y-1 overflow-hidden flex flex-col justify-between group"
                          >
                            <div className="p-4 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-sm shadow-md shrink-0">
                                    {initial}
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="font-extrabold text-slate-900 text-sm truncate group-hover:text-emerald-600 transition-colors" title={rec.fullName}>
                                      {rec.fullName}
                                    </h3>
                                    <span className="text-[10px] font-mono font-extrabold text-slate-400 block truncate">
                                      {rec.admissionId}
                                    </span>
                                  </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px]">
                                  FEES DUE
                                </span>
                              </div>

                              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 space-y-1 text-xs">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Due Amount</span>
                                  <span className="font-black text-rose-600 text-sm">₹{rec.dueAmount.toLocaleString("en-IN")}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Fees Due Date</span>
                                  <span className="font-bold text-slate-800">
                                    📅 {new Date(rec.feesDueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Course / Brand</span>
                                  <span className="font-extrabold text-slate-800 truncate max-w-[140px]" title={rec.course}>
                                    🎓 {rec.course}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                              <span className="text-[11px] font-bold text-slate-500 truncate" title={rec.counsellor}>
                                👤 {rec.counsellor || "Advisor"}
                              </span>
                              <button
                                onClick={() => {
                                  setActiveRecordForFollowup(rec);
                                  setIsQuickFollowupModalOpen(true);
                                }}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-[11px] font-extrabold transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                              >
                                ✏️ Add Followup
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* LIST TABLE VIEW FOR FEES */
              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs shadow-2xs">
                    <tr className="border-b border-slate-200 text-[10px] font-black text-slate-600 uppercase tracking-wider select-none">
                      <th className="py-3 px-4 min-w-[140px]">FOLLOWUP DUE DATE ▾</th>
                      <th className="py-3 px-4 min-w-[125px]">FEES DUE DATE ▾</th>
                      <th className="py-3 px-4 min-w-[150px]">STUDENT ▾</th>
                      <th className="py-3 px-4 min-w-[140px]">STUDENT MOBILE NO ▾</th>
                      <th className="py-3 px-4 min-w-[120px]">ID CARD ▾</th>
                      <th className="py-3 px-4 min-w-[120px]">DUE AMOUNT ▾</th>
                      <th className="py-3 px-4 min-w-[130px]">FOLLOWUP BY ▾</th>
                      <th className="py-3 px-4 text-right min-w-[120px]">ACTION ▾</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">Loading fees follow-ups...</td>
                      </tr>
                    ) : paginatedFeesRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">No fees due follow-up records found matching filters.</td>
                      </tr>
                    ) : (
                      paginatedFeesRecords.map((rec: FeesFollowupRecord, idx: number) => (
                        <tr key={`${rec._id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-emerald-600 whitespace-nowrap">
                            {new Date(rec.followupDueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                            {new Date(rec.feesDueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td className="py-3.5 px-4 font-extrabold text-slate-900 max-w-[170px] truncate" title={rec.fullName}>
                            {rec.fullName}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">{rec.mobileNumber}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-500 font-bold whitespace-nowrap">{rec.admissionId}</td>
                          <td className="py-3.5 px-4 font-black text-rose-600 whitespace-nowrap">₹{rec.dueAmount.toLocaleString("en-IN")}</td>
                          <td className="py-3.5 px-4 text-slate-700 max-w-[140px] truncate">{rec.counsellor}</td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                setActiveRecordForFollowup(rec);
                                setIsQuickFollowupModalOpen(true);
                              }}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer flex items-center gap-1 ml-auto"
                            >
                              ✏️ Add Followup
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Pagination Controls */}
            {activeRecordsLength > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-600">
                <span>Page {currentPage} of {totalPages}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    &lt;
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          currentPage === page
                            ? "bg-orange-500 text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    &gt;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Search Modal matching Screenshot */}
      <AdvancedSearchModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        courseOptions={uniqueCourses}
        statusOptions={["Active", "In Progress", "Interested", "Demo Scheduled", "Demo Attended", "Admitted", "Lost"]}
        initialFilters={advancedFilters || undefined}
        onApply={(filters) => {
          setAdvancedFilters(filters);
          setCurrentPage(1);
        }}
        onClear={() => {
          setAdvancedFilters(null);
          setFilterBrand("All");
          setFilterAdvisor("All");
          setFilterCourse("All");
          setFilterStage("All");
          setCurrentPage(1);
        }}
      />

      {/* Add Followup & History Modal matching Screenshots */}
      <AddFollowupModal
        isOpen={isQuickFollowupModalOpen}
        onClose={() => setIsQuickFollowupModalOpen(false)}
        record={activeRecordForFollowup}
        onSuccess={fetchData}
      />

      {/* Timeline Modal */}
      <FollowupTimelineModal
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        record={timelineRecord}
      />

      {/* Performance Reports Modal */}
      <FollowupPerformanceModal
        isOpen={isPerformanceModalOpen}
        onClose={() => setIsPerformanceModalOpen(false)}
      />

      {/* Full Student Lead Profile Drawer */}
      {selectedLead && (
        <LeadProfile
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onSuccess={fetchData}
        />
      )}

      {/* Add New Lead / Enquiry Modal */}
      {isAddEnquiryModalOpen && (
        <AddEnquiryModal
          isOpen={isAddEnquiryModalOpen}
          onClose={() => setIsAddEnquiryModalOpen(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
