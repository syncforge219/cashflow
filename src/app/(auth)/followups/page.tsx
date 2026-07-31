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
  hasScheduledFollowup?: boolean;
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
  const [enquiryTab, setEnquiryTab] = useState<"today" | "new" | "pending" | "upcoming" | "donot">("today");
  const [feesTab, setFeesTab] = useState<"today" | "overdue" | "upcoming">("today");
  const [selectedNewLeadDate, setSelectedNewLeadDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Helper for local YYYY-MM-DD date string
  const getLocalDateStr = (dateVal?: string | Date) => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

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

  const handleToggleFollowupDone = async (rec: EnquiryFollowupRecord, isChecked: boolean) => {
    const newStatus = isChecked ? "Completed" : "Pending";

    setEnquiries((prevEnquiries) =>
      prevEnquiries.map((enq) => {
        if (enq._id === rec._id) {
          const rawFollowups = Array.isArray(enq.followUps) ? enq.followUps : [];
          let updatedFollowups: any[] = [];

          if (rawFollowups.length > 0) {
            updatedFollowups = rawFollowups.map((f: any) => ({
              ...f,
              status: newStatus,
              isCompleted: isChecked,
              completedAt: isChecked ? new Date().toISOString() : null,
            }));
          } else {
            updatedFollowups = [
              {
                date: enq.followUpDate || enq.date || new Date().toISOString().split("T")[0],
                time: "10:00",
                priority: enq.priorityLevel || "Medium",
                typeOfContact: "Phone Call",
                remarks: "Follow-up marked completed",
                status: newStatus,
                isCompleted: isChecked,
                completedAt: isChecked ? new Date().toISOString() : null,
                createdAt: new Date().toISOString(),
              },
            ];
          }

          return {
            ...enq,
            status: isChecked ? "Completed" : enq.status,
            followUps: updatedFollowups,
          };
        }
        return enq;
      })
    );

    try {
      const res = await fetch(`/api/enquiries/${rec._id}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isCompleted: isChecked,
          status: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        console.error("Failed to toggle followup completed status:", data);
        fetchData();
      }
    } catch (err) {
      console.error("Error toggling followup completed:", err);
      fetchData();
    }
  };

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

      // Follow-up due date calculation
      let dueDateStr = "";
      let hasScheduledFollowup = false;

      if (pendingFollowups.length > 0 && pendingFollowups[0].date) {
        dueDateStr = pendingFollowups[0].date;
        hasScheduledFollowup = true;
      } else if (e.nextFollowUpDate) {
        dueDateStr = e.nextFollowUpDate;
        hasScheduledFollowup = true;
      } else if (lastFollowup?.date) {
        dueDateStr = lastFollowup.date;
      } else if (e.createdAt) {
        dueDateStr = getLocalDateStr(e.createdAt);
      } else {
        dueDateStr = todayStr;
      }

      const dueDateTime = dueDateStr ? new Date(dueDateStr).getTime() : 0;
      const isOverdue = hasScheduledFollowup && dueDateTime < todayTime;
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
        hasScheduledFollowup,
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

      const isCompletedLead =
        statusLower.includes("completed") ||
        (Array.isArray(rec.followUps) && rec.followUps.length > 0 && rec.followUps.every((f: any) => f.isCompleted || (f.status || "").toLowerCase() === "completed" || (f.status || "").toLowerCase() === "cancelled"));

      // Tab filtering
      if (enquiryTab === "new") {
        const createdDateStr = getLocalDateStr(rec.createdAt);
        if (createdDateStr !== selectedNewLeadDate) return false;
      } else if (enquiryTab === "today") {
        if (statusLower.includes("lost") || statusLower.includes("admitted") || statusLower.includes("do not") || isCompletedLead) return false;
        if (!rec.hasScheduledFollowup || rec.dueDateStr !== todayStr) return false;
      } else if (enquiryTab === "pending") {
        if (statusLower.includes("lost") || statusLower.includes("admitted") || statusLower.includes("do not") || isCompletedLead) return false;
        if (!rec.hasScheduledFollowup || recTime >= todayTime) return false; // Past due
      } else if (enquiryTab === "upcoming") {
        if (statusLower.includes("lost") || statusLower.includes("admitted") || statusLower.includes("do not") || isCompletedLead) return false;
        if (!rec.hasScheduledFollowup || recTime <= todayTime) return false; // Future due
      } else if (enquiryTab === "donot") {
        if (!statusLower.includes("lost") && !statusLower.includes("do not")) return false;
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
          const checkTime = enquiryTab === "new" && rec.createdAt ? new Date(rec.createdAt).getTime() : recTime;
          if (checkTime < fromTime) return false;
        }
        if (advancedFilters.enableTillDate && advancedFilters.tillDate) {
          const tillTime = new Date(advancedFilters.tillDate).setHours(23, 59, 59, 999);
          const checkTime = enquiryTab === "new" && rec.createdAt ? new Date(rec.createdAt).getTime() : recTime;
          if (checkTime > tillTime) return false;
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
  }, [processedEnquiryFollowups, enquiryTab, selectedNewLeadDate, searchQuery, filterBrand, filterAdvisor, filterCourse, filterStage, advancedFilters]);

  // Tab Counters for Enquiry Mode
  const enquiryCounts = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayTime = new Date(todayStr).getTime();

    let today = 0, newLeads = 0, pending = 0, upcoming = 0, donot = 0;

    processedEnquiryFollowups.forEach((rec) => {
      const recTime = rec.dueDateStr ? new Date(rec.dueDateStr).getTime() : 0;
      const statusLower = (rec.status || "").toLowerCase();
      const createdDateStr = getLocalDateStr(rec.createdAt);
      const isCompletedLead =
        statusLower.includes("completed") ||
        (Array.isArray(rec.followUps) && rec.followUps.length > 0 && rec.followUps.every((f: any) => f.isCompleted || (f.status || "").toLowerCase() === "completed" || (f.status || "").toLowerCase() === "cancelled"));

      if (createdDateStr === selectedNewLeadDate) {
        newLeads++;
      }

      if (statusLower.includes("lost") || statusLower.includes("do not")) {
        donot++;
      } else if (statusLower.includes("admitted") || isCompletedLead) {
        // Exclude completed or admitted leads from active follow-up tab counts
      } else if (rec.hasScheduledFollowup) {
        if (rec.dueDateStr === todayStr) {
          today++;
        } else if (recTime < todayTime) {
          pending++;
        } else if (recTime > todayTime) {
          upcoming++;
        }
      }
    });

    return { today, newLeads, pending, upcoming, donot };
  }, [processedEnquiryFollowups, selectedNewLeadDate]);

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
        
        {/* Top Header Controls Bar (Sleek Single-Row Layout) */}
        <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-6 py-2.5 flex items-center justify-between gap-4 shadow-2xs shrink-0 z-30">
          
          {/* Left: Mode Title & Pill Selector */}
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-black tracking-tight text-slate-900 font-sans">
              Followup CRM
            </h1>

            {/* Mode Switcher Pill */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                onClick={() => {
                  setActiveMode("enquiry");
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  activeMode === "enquiry"
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Enquiry Followups
              </button>
              <button
                onClick={() => {
                  setActiveMode("fees");
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  activeMode === "fees"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Fees Followups
              </button>
            </div>
          </div>

          {/* Right Controls: Unified Alerts Capsule, Performance Reports, Filter, Add New */}
          <div className="flex items-center gap-2.5">
            
            {/* Unified Alerts Capsule (Sound & Desktop Notifications) */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-xl shadow-2xs">
              {/* Sound Test / Toggle Button */}
              <button
                type="button"
                onClick={() => {
                  const nextState = !soundEnabled;
                  setSoundEnabled(nextState);
                  playChimeSound("notification");
                }}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                  soundEnabled
                    ? "bg-indigo-100/80 text-indigo-700 hover:bg-indigo-200/80"
                    : "bg-slate-200 text-slate-400"
                }`}
                title="Click to Test Audio Chime"
              >
                <span className="animate-pulse">🔊</span>
                <span>Sound: {soundEnabled ? "ON" : "OFF"}</span>
              </button>

              <div className="h-3 w-px bg-slate-200" />

              {/* Desktop Notification Toggle Switch */}
              <button
                type="button"
                onClick={toggleNotifications}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                  notificationsEnabled
                    ? "bg-emerald-100/80 text-emerald-800 hover:bg-emerald-200/80"
                    : "bg-slate-200 text-slate-400"
                }`}
                title="Toggle Desktop Notifications"
              >
                <span>🔔 Desktop: {notificationsEnabled ? "ON" : "OFF"}</span>
              </button>
            </div>

            {/* Performance Reports Button */}
            <button
              onClick={() => setIsPerformanceModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <span>📊 Performance Reports</span>
            </button>

            {/* Advanced Filter Button */}
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              <span>Filter</span>
            </button>

            {/* Add New Button */}
            <button
              onClick={() => setIsAddEnquiryModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
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
        <div className="bg-white border-b border-slate-200 px-6 pt-3 flex flex-wrap items-center justify-between gap-3 select-none shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto">
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
                    setEnquiryTab("new");
                    setCurrentPage(1);
                  }}
                  className={`px-5 py-3 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    enquiryTab === "new"
                      ? "border-emerald-500 text-emerald-600 bg-emerald-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <span>✦ New Lead(s)</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black">
                    {enquiryCounts.newLeads}
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

          {/* New Lead Creation Date Picker Controls */}
          {activeMode === "enquiry" && enquiryTab === "new" && (
            <div className="flex items-center gap-2 py-2 shrink-0">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Creation Date:</span>
              <input
                type="date"
                value={selectedNewLeadDate}
                onChange={(e) => {
                  setSelectedNewLeadDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-emerald-50/60 border border-emerald-300 text-slate-800 text-xs font-extrabold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 transition-all cursor-pointer shadow-xs"
              />
              <button
                type="button"
                onClick={() => {
                  const todayStr = getLocalDateStr(new Date());
                  setSelectedNewLeadDate(todayStr);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  setSelectedNewLeadDate(getLocalDateStr(yesterday));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                Yesterday
              </button>
            </div>
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
                                {(() => {
                                  const isDone = Boolean(
                                    rec.followUps && rec.followUps.length > 0
                                      ? rec.followUps.every((f: any) => f.isCompleted || (f.status || "").toLowerCase() === "completed")
                                      : (rec.status || "").toLowerCase() === "completed"
                                  );
                                  return (
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200/80 px-2 py-0.5 rounded-md border border-slate-200 text-[10px] font-extrabold text-slate-700 transition-all select-none" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={isDone}
                                        onChange={(e) => handleToggleFollowupDone(rec, e.target.checked)}
                                        className="w-3 h-3 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                                      />
                                      <span className={isDone ? "text-emerald-700 font-extrabold uppercase" : "text-slate-600 uppercase"}>
                                        {isDone ? "✓ Completed" : (rec.status || "In Progress")}
                                      </span>
                                    </label>
                                  );
                                })()}
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
                        <th className="py-3 px-3 w-[70px] text-center min-w-[70px]">DONE ▾</th>
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
                          <td colSpan={14} className="py-12 text-center text-slate-400">Loading enquiry follow-ups...</td>
                        </tr>
                      ) : paginatedEnquiryRecords.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="py-12 text-center text-slate-400">No enquiry follow-up records found matching filters.</td>
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
                            <td className="py-3.5 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              {(() => {
                                const isDone = Boolean(
                                  rec.followUps && rec.followUps.length > 0
                                    ? rec.followUps.every((f: any) => f.isCompleted || (f.status || "").toLowerCase() === "completed")
                                    : (rec.status || "").toLowerCase() === "completed"
                                );
                                return (
                                  <label className="inline-flex items-center justify-center cursor-pointer p-1 group" title={isDone ? "Mark as Pending" : "Mark Follow-up as Completed"}>
                                    <input
                                      type="checkbox"
                                      checked={isDone}
                                      onChange={(e) => handleToggleFollowupDone(rec, e.target.checked)}
                                      className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500 focus:ring-2 cursor-pointer transition-all"
                                    />
                                  </label>
                                );
                              })()}
                            </td>
                            <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                              <div className="flex flex-col">
                                {rec.hasScheduledFollowup ? (
                                  <span className={rec.isOverdue ? "text-rose-700 font-black" : "text-indigo-600"}>
                                    {rec.dueDateStr ? new Date(rec.dueDateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Today"}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-medium text-xs">
                                    {rec.dueDateStr ? new Date(rec.dueDateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not Scheduled"}
                                  </span>
                                )}
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
                              {(() => {
                                const isDone = Boolean(
                                  rec.followUps && rec.followUps.length > 0
                                    ? rec.followUps.every((f: any) => f.isCompleted || (f.status || "").toLowerCase() === "completed")
                                    : (rec.status || "").toLowerCase() === "completed"
                                );
                                const displayStatus = isDone ? "Completed" : (rec.status || "In Progress");
                                return (
                                  <span className={`px-2.5 py-0.5 border rounded-lg text-[10px] font-extrabold uppercase whitespace-nowrap shadow-2xs ${
                                    isDone
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-indigo-50 text-indigo-700 border-indigo-200/80"
                                  }`}>
                                    {displayStatus}
                                  </span>
                                );
                              })()}
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
