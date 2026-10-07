"use client";

import { todayKey, toDateKey, daysBetween, addDaysKey, formatDate } from "@/lib/dates";
import React, { useState, useEffect, useMemo, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import ProfileDisplay from "@/components/ProfileDisplay";
import { useUser } from "@/app/component/context/user-context";
import LeadProfile from "@/components/LeadProfile";
import AddEnquiryModal from "@/components/AddEnquiryModal";
import AdvancedSearchModal, { AdvancedSearchFilterState } from "@/components/AdvancedSearchModal";
import AddFollowupModal from "@/components/AddFollowupModal";
import FollowupTimelineModal from "@/components/FollowupTimelineModal";
import FollowupPerformanceModal from "@/components/FollowupPerformanceModal";
import TransferPendingFollowupModal, { TransferLeadItem } from "@/components/TransferPendingFollowupModal";

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

const phoneDigits = (phone?: string) => (phone || "").replace(/\D/g, "");

// Leads created without a number get the "+91 0000000000" placeholder; don't offer to call those.
const hasRealPhone = (phone?: string) => {
  const last10 = phoneDigits(phone).slice(-10);
  return last10.length === 10 && !/^0+$/.test(last10);
};

// wa.me needs the country code; most numbers here are stored as 10 digits or "+91 XXXXXXXXXX".
const whatsAppLink = (phone: string | undefined, text: string) => {
  const digits = phoneDigits(phone);
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
};

const isClosedFollowup = (f: any) => {
  const s = (f?.status || "").toLowerCase();
  return Boolean(f?.isCompleted) || s === "completed" || s === "cancelled";
};

const isFollowupDone = (rec: EnquiryFollowupRecord) =>
  rec.followUps && rec.followUps.length > 0
    ? rec.followUps.every(isClosedFollowup)
    : (rec.status || "").toLowerCase() === "completed";

// "Today", "Tomorrow", "3 days overdue"... easier to scan than a bare date.
const describeDueKey = (dueKey?: string): { label: string; className: string } => {
  const key = toDateKey(dueKey);
  if (!key) return { label: "No date", className: "text-slate-400" };
  const diff = daysBetween(todayKey(), key);
  if (diff === 0) return { label: "Today", className: "text-orange-600" };
  if (diff === 1) return { label: "Tomorrow", className: "text-indigo-600" };
  if (diff > 1) return { label: `In ${diff} days`, className: "text-indigo-600" };
  if (diff === -1) return { label: "1 day overdue", className: "text-rose-600" };
  return { label: `${-diff} days overdue`, className: "text-rose-700" };
};

const describeDue = (rec: EnquiryFollowupRecord) =>
  rec.hasScheduledFollowup && rec.dueDateStr
    ? describeDueKey(rec.dueDateStr)
    : { label: "Not scheduled", className: "text-slate-400" };

const feeReminderText = (rec: FeesFollowupRecord) =>
  `Hello ${rec.fullName}, this is a reminder that your fee instalment of ₹${rec.dueAmount.toLocaleString("en-IN")} for ${rec.course} ` +
  `is due on ${formatDate(rec.feesDueDate)}. Please ignore this message if already paid. Thank you.`;

const priorityTextClass = (priority?: string) =>
  priority === "Urgent"
    ? "text-rose-600"
    : priority === "High"
    ? "text-orange-600"
    : priority === "Low"
    ? "text-sky-600"
    : "text-amber-600";

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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [viewType, setViewType] = useState<"list" | "grid">("list");
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Press "/" anywhere on the page to jump to search (ignored while typing in a field)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const [currentPage, setCurrentPage] = useState(1);

  // Tab Selection
  const [enquiryTab, setEnquiryTab] = useState<"today" | "new" | "pending" | "upcoming" | "donot">("today");
  const [feesTab, setFeesTab] = useState<"today" | "overdue" | "upcoming">("today");
  const [selectedNewLeadDate, setSelectedNewLeadDate] = useState<string>(todayKey());

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

  // User Brand Scope Resolution
  const userScopeRaw = (user?.brandScope || "").toLowerCase().trim();
  const isUserBrandRestricted = Boolean(
    userScopeRaw && !["all", "all brands", "global", "*"].includes(userScopeRaw)
  );
  const allowedUserBrands = useMemo(() => {
    if (!isUserBrandRestricted) return [];
    return userScopeRaw.split(/[,/|]/).map((b) => b.trim().toLowerCase()).filter(Boolean);
  }, [userScopeRaw, isUserBrandRestricted]);

  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [filterBrand, setFilterBrand] = useState("All");
  const [filterAdvisor, setFilterAdvisor] = useState("All");
  const [filterCourse, setFilterCourse] = useState("All");
  const [filterStage, setFilterStage] = useState("All");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<any | null>(null);

  // Load official brands from API
  useEffect(() => {
    fetch("/api/brands")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.brands)) {
          setBrandsList(data.brands);
        }
      })
      .catch((err) => console.error("Failed to load brands in followups:", err));
  }, []);

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

  // Centre Head Pending Lead Transfer & Bulk Selection State
  const [counsellorsList, setCounsellorsList] = useState<any[]>([]);
  const [selectedEnquiryIds, setSelectedEnquiryIds] = useState<string[]>([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [leadsForTransferModal, setLeadsForTransferModal] = useState<TransferLeadItem[]>([]);
  const [quickTargetCounsellor, setQuickTargetCounsellor] = useState("");
  const [isTransferringQuick, setIsTransferringQuick] = useState(false);
  const [transferToastMessage, setTransferToastMessage] = useState("");
  const [isSendingReminderEmail, setIsSendingReminderEmail] = useState(false);
  const [reminderToastMessage, setReminderToastMessage] = useState("");

  const userRole = (user?.role || "").toLowerCase().trim();
  const isCentreHead =
    userRole === "centre head" ||
    userRole === "center head" ||
    userRole === "centre-head" ||
    userRole === "center-head" ||
    userRole === "brand manager" ||
    userRole === "brand-manager" ||
    userRole === "admin" ||
    userRole === "super admin" ||
    userRole === "manager";

  // Fetch counsellors
  const fetchCounsellors = async () => {
    try {
      const res = await fetch("/api/counsellors");
      const data = await res.json();
      if (data.success && Array.isArray(data.counsellors)) {
        setCounsellorsList(data.counsellors);
      }
    } catch (err) {
      console.error("Failed to load counsellors for transfer:", err);
    }
  };

  useEffect(() => {
    fetchCounsellors();
  }, []);

  // Filter counsellors belonging strictly to Centre Head's brand scope
  const eligibleCounsellors = useMemo(() => {
    if (!counsellorsList || counsellorsList.length === 0) return [];
    const userScope = (user?.brandScope || "").toLowerCase().trim();
    if (!userScope || ["all", "all brands", "global", "*"].includes(userScope)) {
      return counsellorsList;
    }
    const parseBrands = (str: string) => str.split(/[,/|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const uBrands = parseBrands(userScope);

    return counsellorsList.filter((c: any) => {
      const cScope = (c.brandScope || c.scope || "").toLowerCase().trim();
      if (!cScope || ["all", "all brands", "global", "*"].includes(cScope)) return true;
      const cBrands = parseBrands(cScope);
      return uBrands.some((ub) => cBrands.includes(ub) || cBrands.some((cb) => cb.includes(ub) || ub.includes(cb)));
    });
  }, [counsellorsList, user?.brandScope]);

  // Unique list of all current advisors on enquiries
  const allCurrentAdvisors = useMemo(() => {
    const set = new Set<string>();
    enquiries.forEach((e: any) => {
      if (e.assignedCrmAdvisor && e.assignedCrmAdvisor.trim()) {
        set.add(e.assignedCrmAdvisor.trim());
      }
    });
    return Array.from(set);
  }, [enquiries]);

  // Bulk selection toggle handlers
  const handleToggleSelectAll = (isChecked: boolean, pageRecords: EnquiryFollowupRecord[]) => {
    if (isChecked) {
      const pageIds = pageRecords.map((r) => r._id);
      setSelectedEnquiryIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = new Set(pageRecords.map((r) => r._id));
      setSelectedEnquiryIds((prev) => prev.filter((id) => !pageIds.has(id)));
    }
  };

  const handleToggleSelectRow = (id: string, isChecked: boolean) => {
    if (isChecked) {
      setSelectedEnquiryIds((prev) => [...prev, id]);
    } else {
      setSelectedEnquiryIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleQuickBulkTransfer = async (targetName?: string) => {
    const targetAdvisor = targetName || quickTargetCounsellor;
    if (!targetAdvisor) {
      alert("Please select a target counsellor/employee from the dropdown.");
      return;
    }
    if (selectedEnquiryIds.length === 0) {
      alert("Please select at least one pending lead to transfer.");
      return;
    }

    setIsTransferringQuick(true);
    try {
      const res = await fetch("/api/enquiries/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enquiryIds: selectedEnquiryIds,
          targetAdvisor,
          transferScope: "selected",
          brandScope: user?.brandScope,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        playChimeSound("success");
        setTransferToastMessage(`✓ Successfully transferred ${data.transferredCount || selectedEnquiryIds.length} lead(s) to ${targetAdvisor}!`);
        setTimeout(() => setTransferToastMessage(""), 5000);
        setSelectedEnquiryIds([]);
        fetchData();
      } else {
        alert(data.error || data.message || "Failed to transfer leads.");
      }
    } catch (err) {
      console.error("Failed to execute quick transfer:", err);
      alert("Error transferring leads.");
    } finally {
      setIsTransferringQuick(false);
    }
  };

  const handleOpenTransferModalForSingleLead = (rec: EnquiryFollowupRecord) => {
    setLeadsForTransferModal([
      {
        _id: rec._id,
        enquiryId: rec.enquiryId,
        studentFullName: rec.studentFullName,
        primaryPhoneMobile: rec.primaryPhoneMobile,
        targetCourse: rec.targetCourse,
        targetBrand: rec.targetBrand,
        assignedCrmAdvisor: rec.assignedCrmAdvisor,
        dueDateStr: rec.dueDateStr,
        lastRemarkStr: rec.lastRemarkStr,
      },
    ]);
    setIsTransferModalOpen(true);
  };

  const handleOpenTransferModalForBulk = () => {
    if (selectedEnquiryIds.length > 0) {
      const selectedRecords = filteredEnquiryRecords
        .filter((r) => selectedEnquiryIds.includes(r._id))
        .map((rec) => ({
          _id: rec._id,
          enquiryId: rec.enquiryId,
          studentFullName: rec.studentFullName,
          primaryPhoneMobile: rec.primaryPhoneMobile,
          targetCourse: rec.targetCourse,
          targetBrand: rec.targetBrand,
          assignedCrmAdvisor: rec.assignedCrmAdvisor,
          dueDateStr: rec.dueDateStr,
          lastRemarkStr: rec.lastRemarkStr,
        }));
      setLeadsForTransferModal(selectedRecords);
    } else {
      setLeadsForTransferModal([]);
    }
    setIsTransferModalOpen(true);
  };

  const handleSendPendingFollowupsEmailAlert = async () => {
    const brandName = filterBrand !== "All" && filterBrand !== "All Brands" ? filterBrand : (user?.brandScope || "All Brands");
    const count = selectedEnquiryIds.length > 0 ? selectedEnquiryIds.length : enquiryCounts.pending;

    if (count === 0) {
      alert("No pending follow-up leads found to alert for.");
      return;
    }

    const scopeNotice = selectedEnquiryIds.length > 0 
      ? `Send reminder email for ${selectedEnquiryIds.length} selected pending lead(s)?`
      : `Send reminder email for all ${count} pending overdue lead(s) of "${brandName}"?`;

    const confirmMsg = `${scopeNotice}\n\n• Target Brand: ${brandName}\n• Centre Heads of this brand will receive an immediate action email.\n• Administration will be kept in the loop via CC/Digest.`;
    if (!window.confirm(confirmMsg)) return;

    setIsSendingReminderEmail(true);
    try {
      const res = await fetch("/api/followups/pending-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: filterBrand !== "All" && filterBrand !== "All Brands" ? filterBrand : undefined,
          targetLeadIds: selectedEnquiryIds.length > 0 ? selectedEnquiryIds : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        playChimeSound("success");
        setReminderToastMessage(`✓ ${data.message || "Follow-up reminder emails dispatched to Centre Heads and Admin!"}`);
        setTimeout(() => setReminderToastMessage(""), 6000);
      } else {
        alert(data.error || "Failed to send follow-up reminder email.");
      }
    } catch (err) {
      console.error("Failed to send pending follow-up email alert:", err);
      alert("Error sending pending follow-up email.");
    } finally {
      setIsSendingReminderEmail(false);
    }
  };

  // Fetch Data with brand parameter
  const fetchData = async (brandArg?: string) => {
    setIsLoading(true);
    try {
      const activeB = brandArg !== undefined ? brandArg : filterBrand;
      const bParam = activeB && activeB !== "All" && activeB !== "All Brands" ? `?brand=${encodeURIComponent(activeB)}` : "";

      const [enqRes, admRes] = await Promise.all([
        fetch(`/api/enquiries${bParam}`),
        fetch(`/api/admissions${bParam}`),
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
  }, [filterBrand]);

  const handleToggleFollowupDone = async (rec: EnquiryFollowupRecord, isChecked: boolean) => {
    const newStatus = isChecked ? "Completed" : "Pending";

    setEnquiries((prevEnquiries) =>
      prevEnquiries.map((enq) => {
        if (enq._id === rec._id) {
          const rawFollowups = Array.isArray(enq.followUps) ? enq.followUps : [];
          let updatedFollowups: any[] = [];

          if (rawFollowups.length > 0) {
            // Mirror the API: completing closes only open follow-ups, un-checking re-opens only the latest one
            updatedFollowups = rawFollowups.map((f: any, idx: number) => {
              const s = (f.status || "").toLowerCase();
              const isClosed = f.isCompleted || s === "completed" || s === "cancelled";
              if (isChecked) {
                return isClosed ? f : { ...f, status: newStatus, isCompleted: true, completedAt: new Date().toISOString() };
              }
              return idx === rawFollowups.length - 1
                ? { ...f, status: newStatus, isCompleted: false, completedAt: null }
                : f;
            });
          } else {
            updatedFollowups = [
              {
                date: enq.followUpDate || enq.date || todayKey(),
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

          // The API does not change the lead's status, so neither does the optimistic update
          return {
            ...enq,
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
    const todayStr = todayKey();

    const list: EnquiryFollowupRecord[] = [];

    enquiries.forEach((e: any) => {
      const rawFollowups = Array.isArray(e.followUps) ? e.followUps : [];
      const pendingFollowups = rawFollowups.filter((f: any) => !f.isCompleted && (f.status || "").toLowerCase() !== "completed" && (f.status || "").toLowerCase() !== "cancelled");
      
      const lastFollowup = rawFollowups.length > 0 ? rawFollowups[rawFollowups.length - 1] : null;
      const lastRemarkStr = lastFollowup?.remarks || e.remarks || e.followUpNotes || "No remark";

      // Follow-up due date calculation
      let dueDateStr = "";
      let hasScheduledFollowup = false;

      // Earliest open follow-up is the one due next (the recurring engine adds a later one alongside it)
      const pendingDates = pendingFollowups
        .map((f: any) => toDateKey(f.date))
        .filter(Boolean)
        .sort();

      if (pendingDates.length > 0) {
        dueDateStr = pendingDates[0];
        hasScheduledFollowup = true;
      } else if (toDateKey(e.nextFollowUpDate)) {
        dueDateStr = toDateKey(e.nextFollowUpDate);
        hasScheduledFollowup = true;
      } else if (toDateKey(lastFollowup?.date)) {
        dueDateStr = toDateKey(lastFollowup.date);
      } else if (e.createdAt) {
        dueDateStr = getLocalDateStr(e.createdAt);
      } else {
        dueDateStr = todayStr;
      }

      // Date keys (YYYY-MM-DD, IST) compare correctly as strings
      const isOverdue = hasScheduledFollowup && dueDateStr < todayStr;
      const isEscalated = rawFollowups.some((f: any) => f.escalatedToManager) || (isOverdue && daysBetween(dueDateStr, todayStr) > 1);

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
        targetBrand: (e.targetBrand || e.brand || "").trim(),
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

  // Filtered Enquiry Records based on Tab & Search & Advanced Filters & Strict Brand Isolation
  const filteredEnquiryRecords = useMemo(() => {
    const todayStr = todayKey();
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

      // Counsellor Role Isolation: Counsellors only see their own assigned follow-ups (or unassigned)
      const uName = (user?.name || "").trim().toLowerCase();
      const uRole = (user?.role || "").trim().toLowerCase();
      const isStaffOrAdmin = uRole.includes("admin") || uRole.includes("manager") || uRole.includes("head") || uRole.includes("cfo");

      if (!isStaffOrAdmin && uName) {
        const adv = (rec.assignedCrmAdvisor || "").trim().toLowerCase();
        if (adv && adv !== "unassigned" && adv !== "n/a" && adv !== uName && !adv.includes(uName) && !uName.includes(adv)) {
          return false;
        }
      }

      // 1. User Brand Scope Isolation: Users restricted to brand(s) can NEVER see records from other brands
      const recBrandLower = (rec.targetBrand || "").toLowerCase().trim();
      if (isUserBrandRestricted && allowedUserBrands.length > 0) {
        const matchesUserBrand = allowedUserBrands.some(
          (ub) => recBrandLower === ub || recBrandLower.includes(ub) || ub.includes(recBrandLower)
        );
        if (!matchesUserBrand) return false;
      }

      // 2. Interactive Brand Filter Dropdown
      if (filterBrand !== "All" && filterBrand !== "All Brands" && recBrandLower !== filterBrand.toLowerCase().trim()) {
        return false;
      }

      // Advanced Modal Filters
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
          const matchSt = advancedFilters.status.some((st: string) => recSt.includes(st.toLowerCase()) || (st === "Active" && !recSt.includes("lost")));
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
  }, [processedEnquiryFollowups, enquiryTab, selectedNewLeadDate, searchQuery, filterBrand, filterAdvisor, filterCourse, filterStage, advancedFilters, isUserBrandRestricted, allowedUserBrands, user?.name, user?.role]);

  // Tab Counters for Enquiry Mode strictly isolated by active Brand / Scope
  const enquiryCounts = useMemo(() => {
    const todayStr = todayKey();
    const todayTime = new Date(todayStr).getTime();
    const uName = (user?.name || "").trim().toLowerCase();
    const uRole = (user?.role || "").trim().toLowerCase();
    const isStaffOrAdmin = uRole.includes("admin") || uRole.includes("manager") || uRole.includes("head") || uRole.includes("cfo");

    let today = 0, newLeads = 0, pending = 0, upcoming = 0, donot = 0;

    processedEnquiryFollowups.forEach((rec) => {
      // 1. User Brand Scope and Active Brand filter isolation for counts
      const recBrandLower = (rec.targetBrand || "").toLowerCase().trim();
      if (isUserBrandRestricted && allowedUserBrands.length > 0) {
        const matchesUserBrand = allowedUserBrands.some(
          (ub) => recBrandLower === ub || recBrandLower.includes(ub) || ub.includes(recBrandLower)
        );
        if (!matchesUserBrand) return;
      }
      if (filterBrand !== "All" && filterBrand !== "All Brands" && recBrandLower !== filterBrand.toLowerCase().trim()) {
        return;
      }

      // 2. Counsellor Role Isolation
      if (!isStaffOrAdmin && uName) {
        const adv = (rec.assignedCrmAdvisor || "").trim().toLowerCase();
        if (adv && adv !== "unassigned" && adv !== "n/a" && adv !== uName && !adv.includes(uName) && !uName.includes(adv)) {
          return;
        }
      }

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
  }, [processedEnquiryFollowups, selectedNewLeadDate, isUserBrandRestricted, allowedUserBrands, filterBrand, user?.name, user?.role]);

  // -------------------------------------------------------------
  // PROCESSED FEES FOLLOWUPS DATA
  // -------------------------------------------------------------
  const processedFeesFollowups = useMemo(() => {
    const list: FeesFollowupRecord[] = [];
    const todayStr = todayKey();

    admissions.forEach((adm: any) => {
      if (adm.remainingBalance > 0) {
        const emiPlan = Array.isArray(adm.customEmiPlan) ? adm.customEmiPlan : [];
        const unpaidInstallments = emiPlan.filter((plan: any) => !plan.isPaid);

        const admBrand = (adm.brand || adm.targetBrand || "").trim();

        if (unpaidInstallments.length > 0) {
          unpaidInstallments.forEach((inst: any, idx: number) => {
            const feesDueDateStr = inst.dueDate ? toDateKey(new Date(inst.dueDate)) : todayStr;
            list.push({
              _id: adm._id,
              admissionId: adm.admissionId || "ADM-N/A",
              fullName: adm.fullName || "Unnamed Student",
              mobileNumber: adm.mobileNumber || "N/A",
              counsellor: adm.counsellor || "Unassigned",
              brand: admBrand,
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
          const fallbackDueDate = adm.downpaymentDueDate ? toDateKey(new Date(adm.downpaymentDueDate)) : todayStr;
          list.push({
            _id: adm._id,
            admissionId: adm.admissionId || "ADM-N/A",
            fullName: adm.fullName || "Unnamed Student",
            mobileNumber: adm.mobileNumber || "N/A",
            counsellor: adm.counsellor || "Unassigned",
            brand: admBrand,
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

  // Filtered Fees Records strictly isolated by active Brand / Scope
  const filteredFeesRecords = useMemo(() => {
    const todayStr = todayKey();
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

      // 1. User Brand Scope Isolation
      const recBrandLower = (rec.brand || "").toLowerCase().trim();
      if (isUserBrandRestricted && allowedUserBrands.length > 0) {
        const matchesUserBrand = allowedUserBrands.some(
          (ub) => recBrandLower === ub || recBrandLower.includes(ub) || ub.includes(recBrandLower)
        );
        if (!matchesUserBrand) return false;
      }

      // 2. Brand Filter Dropdown
      if (filterBrand !== "All" && filterBrand !== "All Brands" && recBrandLower !== filterBrand.toLowerCase().trim()) {
        return false;
      }

      // Advanced Filters
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
  }, [processedFeesFollowups, feesTab, searchQuery, filterBrand, filterAdvisor, filterCourse, isUserBrandRestricted, allowedUserBrands]);

  // Tab Counters for Fees Mode strictly isolated by active Brand / Scope
  const feesCounts = useMemo(() => {
    const todayStr = todayKey();
    const todayTime = new Date(todayStr).getTime();

    let today = 0, overdue = 0, upcoming = 0;

    processedFeesFollowups.forEach((rec) => {
      // Brand Scope and Filter Brand isolation for fees counts
      const recBrandLower = (rec.brand || "").toLowerCase().trim();
      if (isUserBrandRestricted && allowedUserBrands.length > 0) {
        const matchesUserBrand = allowedUserBrands.some(
          (ub) => recBrandLower === ub || recBrandLower.includes(ub) || ub.includes(recBrandLower)
        );
        if (!matchesUserBrand) return;
      }
      if (filterBrand !== "All" && filterBrand !== "All Brands" && recBrandLower !== filterBrand.toLowerCase().trim()) {
        return;
      }

      const recTime = new Date(rec.feesDueDate).getTime();
      if (rec.feesDueDate === todayStr || recTime <= todayTime) {
        today++;
        if (recTime < todayTime) overdue++;
      } else if (recTime > todayTime) {
        upcoming++;
      }
    });

    return { today, overdue, upcoming };
  }, [processedFeesFollowups, isUserBrandRestricted, allowedUserBrands, filterBrand]);

  // Pagination for Active Mode
  const activeRecordsLength = activeMode === "enquiry" ? filteredEnquiryRecords.length : filteredFeesRecords.length;
  const totalPages = Math.max(1, Math.ceil(activeRecordsLength / itemsPerPage));
  // Clamp so a search or filter that shrinks the list never leaves you on an empty page
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;

  const paginatedEnquiryRecords = useMemo(() => {
    return filteredEnquiryRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEnquiryRecords, startIndex, itemsPerPage]);

  const isAllPaginatedSelected = useMemo(() => {
    if (paginatedEnquiryRecords.length === 0) return false;
    return paginatedEnquiryRecords.every((r) => selectedEnquiryIds.includes(r._id));
  }, [paginatedEnquiryRecords, selectedEnquiryIds]);

  const paginatedFeesRecords = useMemo(() => {
    return filteredFeesRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredFeesRecords, startIndex, itemsPerPage]);

  // Available Brands list respecting user scope and official brand registry
  const availableBrandOptions = useMemo(() => {
    const list: string[] = [];
    if (brandsList && brandsList.length > 0) {
      brandsList.forEach((b: any) => {
        const name = b.brandName || b.name;
        if (name && !list.includes(name)) list.push(name);
      });
    }
    enquiries.forEach((e: any) => {
      const bName = e.targetBrand || e.brand;
      if (bName && !list.includes(bName)) list.push(bName);
    });
    admissions.forEach((a: any) => {
      const bName = a.brand || a.targetBrand;
      if (bName && !list.includes(bName)) list.push(bName);
    });

    if (isUserBrandRestricted && allowedUserBrands.length > 0) {
      return list.filter((bName) =>
        allowedUserBrands.some(
          (ub) =>
            bName.toLowerCase().trim() === ub ||
            bName.toLowerCase().includes(ub) ||
            ub.includes(bName.toLowerCase().trim())
        )
      );
    }
    return list;
  }, [brandsList, enquiries, admissions, isUserBrandRestricted, allowedUserBrands]);

  // Set default filterBrand when user is restricted
  useEffect(() => {
    if (isUserBrandRestricted && allowedUserBrands.length > 0) {
      const isAllowed = (bName: string) =>
        allowedUserBrands.some(
          (ub) =>
            bName.toLowerCase().trim() === ub ||
            bName.toLowerCase().includes(ub) ||
            ub.includes(bName.toLowerCase().trim())
        );
      const matched = availableBrandOptions.find(isAllowed);
      const fallback = matched || allowedUserBrands[0].charAt(0).toUpperCase() + allowedUserBrands[0].slice(1);
      // Only pick a default when the current choice is not one of the user's brands. This effect re-runs
      // after every data fetch, and used to snap multi-brand users back to their first brand each time.
      setFilterBrand((prev) => (prev && prev !== "All" && prev !== "All Brands" && isAllowed(prev) ? prev : fallback));
    }
  }, [isUserBrandRestricted, allowedUserBrands, availableBrandOptions]);

  const uniqueCourses = useMemo(() => Array.from(new Set(enquiries.map(e => e.targetCourse).filter(Boolean))), [enquiries]);

  // Human-readable list of the filters currently narrowing the list
  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (filterAdvisor !== "All") chips.push(`Counsellor: ${filterAdvisor}`);
    if (filterCourse !== "All") chips.push(`Course: ${filterCourse}`);
    if (filterStage !== "All") chips.push(`Stage: ${filterStage}`);
    if (advancedFilters) {
      if (advancedFilters.coursePackage) chips.push(`Course: ${advancedFilters.coursePackage}`);
      if (advancedFilters.studentQuery) chips.push(`Student: ${advancedFilters.studentQuery}`);
      const statuses = (advancedFilters.status || []).filter((s: string) => s !== "All");
      if (statuses.length > 0) chips.push(`Stage: ${statuses.join(", ")}`);
      if (advancedFilters.enableFromDate && advancedFilters.fromDate) chips.push(`From ${formatDate(advancedFilters.fromDate)}`);
      if (advancedFilters.enableTillDate && advancedFilters.tillDate) chips.push(`Till ${formatDate(advancedFilters.tillDate)}`);
    }
    return chips;
  }, [filterAdvisor, filterCourse, filterStage, advancedFilters]);

  const clearAllFilters = () => {
    setAdvancedFilters(null);
    setFilterAdvisor("All");
    setFilterCourse("All");
    setFilterStage("All");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const enquiryTabs = [
    { key: "today", label: "Due today", count: enquiryCounts.today, hint: "Follow-ups scheduled for today", activeClass: "border-orange-500 text-orange-600", badgeClass: "bg-orange-100 text-orange-700" },
    { key: "pending", label: "Overdue", count: enquiryCounts.pending, hint: "Follow-ups whose date has passed", activeClass: "border-rose-500 text-rose-600", badgeClass: "bg-rose-100 text-rose-700" },
    { key: "upcoming", label: "Upcoming", count: enquiryCounts.upcoming, hint: "Follow-ups scheduled after today", activeClass: "border-blue-500 text-blue-600", badgeClass: "bg-blue-100 text-blue-700" },
    { key: "new", label: "New leads", count: enquiryCounts.newLeads, hint: "Leads created on the chosen day", activeClass: "border-emerald-500 text-emerald-600", badgeClass: "bg-emerald-100 text-emerald-700" },
    { key: "donot", label: "Lost / don't follow up", count: enquiryCounts.donot, hint: "Leads marked Lost or Do not follow up", activeClass: "border-slate-600 text-slate-800", badgeClass: "bg-slate-200 text-slate-700" },
  ];

  const feesTabs = [
    { key: "today", label: "Due by today", count: feesCounts.today, hint: "Instalments due today, including overdue ones", activeClass: "border-orange-500 text-orange-600", badgeClass: "bg-orange-100 text-orange-700" },
    { key: "overdue", label: "Overdue", count: feesCounts.overdue, hint: "Instalments whose due date has passed", activeClass: "border-rose-500 text-rose-600", badgeClass: "bg-rose-100 text-rose-700" },
    { key: "upcoming", label: "Upcoming", count: feesCounts.upcoming, hint: "Instalments due after today", activeClass: "border-emerald-500 text-emerald-600", badgeClass: "bg-emerald-100 text-emerald-700" },
  ];

  const emptyStateMessage = (() => {
    if (searchQuery.trim() || activeFilterChips.length > 0) return "No follow-ups match your search or filters.";
    if (activeMode === "fees") {
      return feesTab === "upcoming" ? "No upcoming fee instalments." : "No fee instalments due. 🎉";
    }
    switch (enquiryTab) {
      case "today":
        return "Nothing due today. 🎉 Check the Overdue tab for anything missed.";
      case "pending":
        return "No overdue follow-ups. 🎉";
      case "upcoming":
        return "No follow-ups scheduled after today.";
      case "new":
        return `No new leads created on ${formatDate(selectedNewLeadDate)}.`;
      default:
        return "No lost or do-not-follow-up leads.";
    }
  })();

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden text-slate-800 selection:bg-orange-500 selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Top bar: title, mode switch and page-level actions */}
        <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-black tracking-tight text-slate-900">Follow-ups</h1>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200" role="tablist" aria-label="Follow-up type">
              <button
                role="tab"
                aria-selected={activeMode === "enquiry"}
                onClick={() => {
                  setActiveMode("enquiry");
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  activeMode === "enquiry" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Enquiries
              </button>
              <button
                role="tab"
                aria-selected={activeMode === "fees"}
                onClick={() => {
                  setActiveMode("fees");
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  activeMode === "fees" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Fees
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Alert toggles, compact */}
            <button
              type="button"
              aria-pressed={soundEnabled}
              onClick={() => {
                const nextState = !soundEnabled;
                setSoundEnabled(nextState);
                if (nextState) playChimeSound("notification");
              }}
              className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center border transition-colors cursor-pointer ${
                soundEnabled ? "bg-indigo-50 border-indigo-200" : "bg-slate-100 border-slate-200 opacity-50"
              }`}
              title={soundEnabled ? "Sound on (click to mute)" : "Sound off (click to turn on)"}
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>
            <button
              type="button"
              aria-pressed={notificationsEnabled}
              onClick={toggleNotifications}
              className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center border transition-colors cursor-pointer ${
                notificationsEnabled ? "bg-emerald-50 border-emerald-200" : "bg-slate-100 border-slate-200 opacity-50"
              }`}
              title={notificationsEnabled ? "Desktop notifications on (click to turn off)" : "Desktop notifications off (click to turn on)"}
            >
              🔔
            </button>

            <button
              onClick={() => setIsPerformanceModalOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              📊 Reports
            </button>

            <button
              onClick={() => setIsAddEnquiryModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>New Enquiry</span>
            </button>

            <ProfileDisplay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} logout={logout} />
          </div>
        </div>

        {/* Search, brand, filters and view */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="relative flex-1 min-w-[240px]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchQuery("");
                  setCurrentPage(1);
                }
              }}
              placeholder={
                activeMode === "enquiry"
                  ? "Search name, phone, course, enquiry ID or remark…"
                  : "Search student, phone, course, admission ID or counsellor…"
              }
              aria-label="Search follow-ups"
              className="w-full pl-9 pr-16 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1.5 px-1.5 py-0.5 text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
                aria-label="Clear search"
              >
                ✕
              </button>
            ) : (
              <kbd className="absolute right-2.5 top-2 px-1.5 rounded border border-slate-200 bg-white text-[10px] font-bold text-slate-400" title="Press / to search">
                /
              </kbd>
            )}
          </div>

          <label className="flex items-center gap-1.5 shrink-0 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Brand</span>
            <select
              id="followup-brand-filter"
              value={filterBrand}
              onChange={(e) => {
                const selected = e.target.value;
                setFilterBrand(selected);
                setCurrentPage(1);
                fetchData(selected);
              }}
              disabled={isUserBrandRestricted && allowedUserBrands.length <= 1}
              className={`bg-transparent text-xs font-extrabold outline-none ${
                isUserBrandRestricted && allowedUserBrands.length <= 1 ? "text-slate-500 cursor-not-allowed" : "text-slate-800 cursor-pointer"
              }`}
              title={
                isUserBrandRestricted && allowedUserBrands.length <= 1
                  ? `Locked to your brand (${allowedUserBrands[0]})`
                  : "Filter follow-ups by brand"
              }
            >
              {!isUserBrandRestricted && <option value="All">All Brands</option>}
              {availableBrandOptions.map((brandName) => (
                <option key={brandName} value={brandName}>
                  {brandName}
                </option>
              ))}
            </select>
          </label>

          {activeMode === "enquiry" && (
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className={`px-3 py-1.5 border font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeFilterChips.length > 0
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              <span>Filters</span>
              {activeFilterChips.length > 0 && (
                <span className="px-1.5 rounded-full bg-indigo-600 text-white text-[10px] font-black">{activeFilterChips.length}</span>
              )}
            </button>
          )}

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0" role="group" aria-label="Layout">
            <button
              type="button"
              aria-pressed={viewType === "list"}
              onClick={() => setViewType("list")}
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                viewType === "list" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ☰ List
            </button>
            <button
              type="button"
              aria-pressed={viewType === "grid"}
              onClick={() => setViewType("grid")}
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                viewType === "grid" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              ▦ Cards
            </button>
          </div>
        </div>

        {/* Applied filters, so it is always visible why rows are hidden */}
        {activeMode === "enquiry" && activeFilterChips.length > 0 && (
          <div className="bg-indigo-50/60 border-b border-indigo-100 px-6 py-2 flex flex-wrap items-center gap-1.5 shrink-0 text-[11px]">
            <span className="font-bold text-indigo-900 mr-1">Filtered by:</span>
            {activeFilterChips.map((chip) => (
              <span key={chip} className="px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-800 font-bold">
                {chip}
              </span>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-1 px-2 py-0.5 rounded-full text-indigo-700 hover:bg-indigo-100 font-extrabold cursor-pointer"
            >
              ✕ Clear all
            </button>
          </div>
        )}

        {/* Tabs + tab-specific tools */}
        <div className="bg-white border-b border-slate-200 px-6 flex flex-wrap items-center justify-between gap-x-3 select-none shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Follow-up list">
            {(activeMode === "enquiry" ? enquiryTabs : feesTabs).map((tab) => {
              const isActive = activeMode === "enquiry" ? enquiryTab === tab.key : feesTab === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={isActive}
                  title={tab.hint}
                  onClick={() => {
                    if (activeMode === "enquiry") setEnquiryTab(tab.key as typeof enquiryTab);
                    else setFeesTab(tab.key as typeof feesTab);
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-3 font-extrabold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    isActive ? tab.activeClass : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${tab.badgeClass}`}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 py-2 shrink-0">
            {/* New leads: pick the creation day */}
            {activeMode === "enquiry" && enquiryTab === "new" && (
              <>
                <span className="text-[11px] font-bold text-slate-500">Created on</span>
                <input
                  type="date"
                  value={selectedNewLeadDate}
                  max={todayKey()}
                  onChange={(e) => {
                    setSelectedNewLeadDate(e.target.value || todayKey());
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNewLeadDate(todayKey());
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 font-bold text-[11px] rounded-lg border transition-colors cursor-pointer ${
                    selectedNewLeadDate === todayKey()
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNewLeadDate(addDaysKey(todayKey(), -1));
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 font-bold text-[11px] rounded-lg border transition-colors cursor-pointer ${
                    selectedNewLeadDate === addDaysKey(todayKey(), -1)
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Yesterday
                </button>
              </>
            )}

            {/* Centre head tools */}
            {activeMode === "enquiry" && isCentreHead && (
              <>
                <button
                  type="button"
                  onClick={handleOpenTransferModalForBulk}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Move follow-ups to another counsellor in your branch"
                >
                  🔄 Transfer leads
                  {selectedEnquiryIds.length > 0 && (
                    <span className="px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-black">{selectedEnquiryIds.length}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleSendPendingFollowupsEmailAlert}
                  disabled={isSendingReminderEmail || enquiryCounts.pending === 0}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Email the centre heads (Admin in copy) about overdue follow-ups"
                >
                  {isSendingReminderEmail ? "⏳ Sending…" : "📧 Email overdue reminder"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table / Grid Area */}
        <div className="p-6 flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Transfer Toast Notification */}
          {transferToastMessage && (
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-2xl shadow-md font-bold text-xs flex items-center justify-between mb-3 shrink-0 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <span className="text-base">🎉</span>
                <span>{transferToastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setTransferToastMessage("")}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Reminder Email Toast Notification */}
          {reminderToastMessage && (
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-2xl shadow-md font-bold text-xs flex items-center justify-between mb-3 shrink-0 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <span className="text-base">📧</span>
                <span>{reminderToastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setReminderToastMessage("")}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Floating / Sticky Bulk Action Bar for Centre Head */}
          {activeMode === "enquiry" && isCentreHead && selectedEnquiryIds.length > 0 && (
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 mb-3 shrink-0 border border-slate-700/60 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-black flex items-center justify-center shadow-xs">
                  {selectedEnquiryIds.length}
                </span>
                <span className="text-xs font-black text-white">
                  Pending Lead{selectedEnquiryIds.length > 1 ? "s" : ""} Selected
                </span>
                <span className="text-[10px] text-slate-300 font-bold bg-white/10 px-2 py-0.5 rounded-md">
                  Brand: {user?.brandScope || "Assigned"}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-xl border border-white/15">
                  <span className="text-[11px] font-bold text-slate-200">Transfer to:</span>
                  <select
                    value={quickTargetCounsellor}
                    onChange={(e) => setQuickTargetCounsellor(e.target.value)}
                    className="bg-slate-800 text-white text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-700 outline-none focus:border-indigo-400 cursor-pointer"
                  >
                    <option value="">-- Choose Counsellor --</option>
                    {eligibleCounsellors.map((c: any) => (
                      <option key={c._id || c.id || c.email} value={c.name}>
                        {c.name} {c.role ? `(${c.role})` : ""} - {c.brandScope || "All"}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleQuickBulkTransfer()}
                  disabled={isTransferringQuick || !quickTargetCounsellor}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  {isTransferringQuick ? "Transferring..." : "⚡ Transfer Selected"}
                </button>

                <button
                  type="button"
                  onClick={handleOpenTransferModalForBulk}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  ⚙️ More Options
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedEnquiryIds([])}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  ✕ Clear
                </button>
              </div>
            </div>
          )}

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
                    <div className="py-20 text-center text-slate-400 font-bold animate-pulse">Loading follow-ups…</div>
                  ) : paginatedEnquiryRecords.length === 0 ? (
                    <div className="py-20 text-center">
                      <p className="text-slate-500 font-bold">{emptyStateMessage}</p>
                      {(searchQuery || activeFilterChips.length > 0) && (
                        <button type="button" onClick={clearAllFilters} className="mt-2 text-xs text-indigo-600 hover:underline font-bold cursor-pointer">
                          Clear search and filters
                        </button>
                      )}
                    </div>
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

                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <span className={`px-2 py-0.5 rounded-md border font-black text-[10px] uppercase ${priorityColor}`}>
                                    {rec.priorityLevel || "Medium"}
                                  </span>
                                  {rec.targetBrand && (
                                    <span className="px-2 py-0.5 rounded-md bg-violet-50 border border-violet-200 text-violet-700 font-extrabold text-[9px] uppercase tracking-wider">
                                      {rec.targetBrand}
                                    </span>
                                  )}
                                </div>
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
                                  const isDone = isFollowupDone(rec);
                                  return (
                                    <label className="inline-flex items-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200/80 px-2 py-0.5 rounded-md border border-slate-200 text-[10px] font-extrabold text-slate-700 transition-all select-none" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={isDone}
                                        onChange={(e) => handleToggleFollowupDone(rec, e.target.checked)}
                                        className="w-3 h-3 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                                      />
                                      <span className={isDone ? "text-emerald-700 font-extrabold uppercase" : "text-slate-600 uppercase"}>
                                        {isDone ? "✓ Done" : "Mark done"}
                                      </span>
                                    </label>
                                  );
                                })()}
                              </div>

                              {/* Due Date & Course Details */}
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Due</span>
                                  <span className={`font-black ${describeDue(rec).className}`} title={formatDate(rec.dueDateStr)}>
                                    📅 {describeDue(rec).label}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Stage</span>
                                  <span className="font-bold text-slate-700 truncate max-w-[140px]">{rec.status || "In Progress"}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Course</span>
                                  <span className="font-extrabold text-slate-800 truncate max-w-[140px]" title={rec.targetCourse}>
                                    🎓 {rec.targetCourse}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Counsellor</span>
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {isCentreHead && (
                                  <button
                                    onClick={() => handleOpenTransferModalForSingleLead(rec)}
                                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-black transition-all shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1"
                                    title="Transfer lead to another counsellor"
                                  >
                                    🔄 Transfer
                                  </button>
                                )}
                                {hasRealPhone(rec.primaryPhoneMobile) && (
                                  <>
                                    <a
                                      href={`tel:${phoneDigits(rec.primaryPhoneMobile)}`}
                                      className="w-8 h-8 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 flex items-center justify-center text-xs"
                                      title={`Call ${rec.primaryPhoneMobile}`}
                                      aria-label={`Call ${rec.studentFullName}`}
                                    >
                                      📞
                                    </a>
                                    <a
                                      href={whatsAppLink(rec.primaryPhoneMobile, `Hello ${rec.studentFullName}, regarding your enquiry for ${rec.targetCourse}...`)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center text-xs"
                                      title="WhatsApp"
                                      aria-label={`WhatsApp ${rec.studentFullName}`}
                                    >
                                      💬
                                    </a>
                                  </>
                                )}
                                <button
                                  onClick={() => {
                                    setTimelineRecord(rec);
                                    setIsTimelineOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-extrabold transition-all shadow-2xs cursor-pointer"
                                  title="Follow-up history"
                                >
                                  🕒 History
                                </button>
                              </div>

                              <button
                                onClick={() => {
                                  setActiveRecordForFollowup(rec);
                                  setIsQuickFollowupModalOpen(true);
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-extrabold transition-colors active:scale-95 cursor-pointer"
                              >
                                + Log follow-up
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
                      <tr className="border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider select-none">
                        {isCentreHead && (
                          <th className="py-3 px-3 w-[40px] text-center">
                            <input
                              type="checkbox"
                              checked={isAllPaginatedSelected}
                              onChange={(e) => handleToggleSelectAll(e.target.checked, paginatedEnquiryRecords)}
                              className="w-4 h-4 text-rose-600 bg-white border-slate-300 rounded focus:ring-rose-500 cursor-pointer"
                              aria-label="Select all leads on this page"
                              title="Select all leads on this page"
                            />
                          </th>
                        )}
                        <th className="py-3 px-3 w-[56px] text-center" title="Tick when the follow-up is done">Done</th>
                        <th className="py-3 px-4 min-w-[120px]">Due</th>
                        <th className="py-3 px-4 min-w-[170px]">Student</th>
                        <th className="py-3 px-4 min-w-[130px]">Phone</th>
                        <th className="py-3 px-4 min-w-[160px]">Course</th>
                        <th className="py-3 px-4 min-w-[120px]">Counsellor</th>
                        <th className="py-3 px-4 min-w-[120px]">Stage</th>
                        <th className="py-3 px-4 min-w-[180px]">Last remark</th>
                        <th className="py-3 px-4 text-right min-w-[210px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {isLoading ? (
                        <tr>
                          <td colSpan={isCentreHead ? 10 : 9} className="py-12 text-center text-slate-400 animate-pulse">Loading follow-ups…</td>
                        </tr>
                      ) : paginatedEnquiryRecords.length === 0 ? (
                        <tr>
                          <td colSpan={isCentreHead ? 10 : 9} className="py-14 text-center">
                            <p className="text-slate-500 font-bold">{emptyStateMessage}</p>
                            {(searchQuery || activeFilterChips.length > 0) && (
                              <button
                                type="button"
                                onClick={clearAllFilters}
                                className="mt-2 text-indigo-600 hover:underline font-bold cursor-pointer"
                              >
                                Clear search and filters
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        paginatedEnquiryRecords.map((rec: EnquiryFollowupRecord) => {
                          const isDone = isFollowupDone(rec);
                          const due = describeDue(rec);
                          const isSelected = selectedEnquiryIds.includes(rec._id);
                          return (
                            <tr
                              key={rec._id}
                              onClick={() => setSelectedLead(rec)}
                              className={`transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-rose-50/90"
                                  : rec.isOverdue && !isDone
                                  ? "bg-rose-50/40 hover:bg-rose-50"
                                  : "hover:bg-slate-50"
                              } ${isDone ? "opacity-60" : ""}`}
                              title="Click to open the lead profile"
                            >
                              {isCentreHead && (
                                <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => handleToggleSelectRow(rec._id, e.target.checked)}
                                    className="w-4 h-4 text-rose-600 bg-white border-slate-300 rounded focus:ring-rose-500 cursor-pointer"
                                    aria-label={`Select ${rec.studentFullName}`}
                                  />
                                </td>
                              )}
                              <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isDone}
                                  onChange={(e) => handleToggleFollowupDone(rec, e.target.checked)}
                                  className="w-4 h-4 text-emerald-600 bg-white border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                                  aria-label={isDone ? `Re-open follow-up for ${rec.studentFullName}` : `Mark follow-up done for ${rec.studentFullName}`}
                                  title={isDone ? "Done. Untick to re-open" : "Mark follow-up as done"}
                                />
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className={`font-black ${due.className}`}>{due.label}</span>
                                  <span className="text-[10px] text-slate-400 font-semibold">{formatDate(rec.dueDateStr)}</span>
                                  {rec.isEscalated && !isDone && (
                                    <span className="text-[9px] font-black text-purple-700 tracking-wider">⚡ ESCALATED</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 max-w-[220px]">
                                <div className="font-extrabold text-slate-900 truncate" title={rec.studentFullName}>
                                  {rec.studentFullName}
                                </div>
                                <div className="text-[10px] text-slate-400 font-semibold truncate">
                                  {rec.enquiryId}
                                  {rec.currentCity && rec.currentCity !== "N/A" ? ` · ${rec.currentCity}` : ""}
                                  {rec.createdAt ? ` · enquired ${formatDate(rec.createdAt)}` : ""}
                                </div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                {hasRealPhone(rec.primaryPhoneMobile) ? (
                                  <a href={`tel:${phoneDigits(rec.primaryPhoneMobile)}`} className="font-mono text-slate-700 hover:text-indigo-600 hover:underline" title="Call student">
                                    {rec.primaryPhoneMobile}
                                  </a>
                                ) : (
                                  <span className="text-slate-400">No phone</span>
                                )}
                                {hasRealPhone(rec.parentsPhoneNumber) && (
                                  <div className="text-[10px] text-slate-400">
                                    Parent:{" "}
                                    <a href={`tel:${phoneDigits(rec.parentsPhoneNumber)}`} className="font-mono hover:text-indigo-600 hover:underline" title="Call parent">
                                      {rec.parentsPhoneNumber}
                                    </a>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 max-w-[200px]">
                                <div className="font-bold text-slate-800 truncate" title={rec.targetCourse}>{rec.targetCourse}</div>
                                {rec.targetBrand && <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wide truncate">{rec.targetBrand}</div>}
                              </td>
                              <td className="py-3 px-4 text-slate-700 max-w-[140px] truncate" title={rec.assignedCrmAdvisor}>{rec.assignedCrmAdvisor}</td>
                              <td className="py-3 px-4">
                                <div className="flex flex-col items-start gap-1">
                                  <span className={`px-2 py-0.5 border rounded-md text-[10px] font-extrabold uppercase whitespace-nowrap ${
                                    isDone ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-700 border-slate-200"
                                  }`}>
                                    {isDone ? "Done" : rec.status || "In Progress"}
                                  </span>
                                  <span className={`text-[10px] font-black ${priorityTextClass(rec.priorityLevel)}`}>
                                    ● {(rec.priorityLevel || "Medium").toUpperCase()}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-500 max-w-[220px]">
                                <p className="line-clamp-2 font-medium" title={rec.lastRemarkStr}>{rec.lastRemarkStr || "-"}</p>
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <div className="inline-flex items-center gap-1.5">
                                  {hasRealPhone(rec.primaryPhoneMobile) && (
                                    <>
                                      <a
                                        href={`tel:${phoneDigits(rec.primaryPhoneMobile)}`}
                                        className="w-8 h-8 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 flex items-center justify-center"
                                        title="Call"
                                        aria-label={`Call ${rec.studentFullName}`}
                                      >
                                        📞
                                      </a>
                                      <a
                                        href={whatsAppLink(rec.primaryPhoneMobile, `Hello ${rec.studentFullName}, regarding your enquiry for ${rec.targetCourse}...`)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center"
                                        title="WhatsApp"
                                        aria-label={`WhatsApp ${rec.studentFullName}`}
                                      >
                                        💬
                                      </a>
                                    </>
                                  )}
                                  <button
                                    onClick={() => {
                                      setTimelineRecord(rec);
                                      setIsTimelineOpen(true);
                                    }}
                                    className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center cursor-pointer"
                                    title="Follow-up history"
                                    aria-label={`Follow-up history for ${rec.studentFullName}`}
                                  >
                                    🕒
                                  </button>
                                  {isCentreHead && (
                                    <button
                                      onClick={() => handleOpenTransferModalForSingleLead(rec)}
                                      className="w-8 h-8 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 flex items-center justify-center cursor-pointer"
                                      title="Transfer to another counsellor"
                                      aria-label={`Transfer ${rec.studentFullName}`}
                                    >
                                      🔄
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setActiveRecordForFollowup(rec);
                                      setIsQuickFollowupModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-extrabold transition-colors active:scale-95 cursor-pointer"
                                  >
                                    + Log follow-up
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
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
                    <div className="py-20 text-center text-slate-400 font-bold animate-pulse">Loading fee follow-ups…</div>
                  ) : paginatedFeesRecords.length === 0 ? (
                    <div className="py-20 text-center text-slate-500 font-bold">{emptyStateMessage}</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {paginatedFeesRecords.map((rec: FeesFollowupRecord, idx: number) => {
                        const initial = (rec.fullName || "S").charAt(0).toUpperCase();
                        const due = describeDueKey(rec.feesDueDate);
                        return (
                          <div
                            key={`${rec._id}-${idx}`}
                            className="bg-white rounded-2xl border border-slate-200/90 hover:border-emerald-500/50 transition-all duration-300 shadow-xs hover:shadow-lg overflow-hidden flex flex-col justify-between"
                          >
                            <div className="p-4 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-sm shadow-md shrink-0">
                                    {initial}
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="font-extrabold text-slate-900 text-sm truncate" title={rec.fullName}>
                                      {rec.fullName}
                                    </h3>
                                    <span className="text-[10px] font-mono font-extrabold text-slate-400 block truncate">
                                      {rec.admissionId}
                                      {rec.installmentIndex ? ` · Instalment ${rec.installmentIndex}` : ""}
                                    </span>
                                  </div>
                                </div>
                                {rec.brand && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-[9px] uppercase tracking-wider shrink-0">
                                    {rec.brand}
                                  </span>
                                )}
                              </div>

                              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 space-y-1 text-xs">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Amount due</span>
                                  <span className="font-black text-rose-600 text-sm">₹{rec.dueAmount.toLocaleString("en-IN")}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Due</span>
                                  <span className={`font-black ${due.className}`} title={formatDate(rec.feesDueDate)}>
                                    📅 {due.label}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Course</span>
                                  <span className="font-extrabold text-slate-800 truncate max-w-[140px]" title={rec.course}>
                                    🎓 {rec.course}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                              <span className="text-[11px] font-bold text-slate-500 truncate" title={rec.counsellor}>
                                👤 {rec.counsellor || "Unassigned"}
                              </span>
                              {hasRealPhone(rec.mobileNumber) ? (
                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={`tel:${phoneDigits(rec.mobileNumber)}`}
                                    className="w-8 h-8 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 flex items-center justify-center text-xs"
                                    title={`Call ${rec.mobileNumber}`}
                                    aria-label={`Call ${rec.fullName}`}
                                  >
                                    📞
                                  </a>
                                  <a
                                    href={whatsAppLink(rec.mobileNumber, feeReminderText(rec))}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-extrabold transition-colors"
                                    title="Send a fee reminder on WhatsApp"
                                  >
                                    💬 Send reminder
                                  </a>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400">No phone</span>
                              )}
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
                    <tr className="border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider select-none">
                      <th className="py-3 px-4 min-w-[120px]">Due</th>
                      <th className="py-3 px-4 min-w-[110px]">Amount</th>
                      <th className="py-3 px-4 min-w-[170px]">Student</th>
                      <th className="py-3 px-4 min-w-[130px]">Phone</th>
                      <th className="py-3 px-4 min-w-[160px]">Course</th>
                      <th className="py-3 px-4 min-w-[120px]">Counsellor</th>
                      <th className="py-3 px-4 text-right min-w-[170px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 animate-pulse">Loading fee follow-ups…</td>
                      </tr>
                    ) : paginatedFeesRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-14 text-center text-slate-500 font-bold">{emptyStateMessage}</td>
                      </tr>
                    ) : (
                      paginatedFeesRecords.map((rec: FeesFollowupRecord, idx: number) => {
                        const due = describeDueKey(rec.feesDueDate);
                        return (
                          <tr key={`${rec._id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className={`font-black ${due.className}`}>{due.label}</div>
                              <div className="text-[10px] text-slate-400 font-semibold">{formatDate(rec.feesDueDate)}</div>
                            </td>
                            <td className="py-3 px-4 font-black text-rose-600 whitespace-nowrap">
                              ₹{rec.dueAmount.toLocaleString("en-IN")}
                              {rec.installmentIndex ? (
                                <div className="text-[10px] text-slate-400 font-semibold">Instalment {rec.installmentIndex}</div>
                              ) : null}
                            </td>
                            <td className="py-3 px-4 max-w-[220px]">
                              <div className="font-extrabold text-slate-900 truncate" title={rec.fullName}>{rec.fullName}</div>
                              <div className="text-[10px] text-slate-400 font-mono font-semibold">{rec.admissionId}</div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {hasRealPhone(rec.mobileNumber) ? (
                                <a href={`tel:${phoneDigits(rec.mobileNumber)}`} className="font-mono text-slate-700 hover:text-indigo-600 hover:underline" title="Call student">
                                  {rec.mobileNumber}
                                </a>
                              ) : (
                                <span className="text-slate-400">No phone</span>
                              )}
                            </td>
                            <td className="py-3 px-4 max-w-[200px]">
                              <div className="font-bold text-slate-800 truncate" title={rec.course}>{rec.course}</div>
                              {rec.brand && <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide truncate">{rec.brand}</div>}
                            </td>
                            <td className="py-3 px-4 text-slate-700 max-w-[140px] truncate" title={rec.counsellor}>{rec.counsellor}</td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              {hasRealPhone(rec.mobileNumber) && (
                                <div className="inline-flex items-center gap-1.5">
                                  <a
                                    href={`tel:${phoneDigits(rec.mobileNumber)}`}
                                    className="w-8 h-8 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 flex items-center justify-center"
                                    title="Call"
                                    aria-label={`Call ${rec.fullName}`}
                                  >
                                    📞
                                  </a>
                                  <a
                                    href={whatsAppLink(rec.mobileNumber, feeReminderText(rec))}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-extrabold transition-colors"
                                    title="Send a fee reminder on WhatsApp"
                                  >
                                    💬 Send reminder
                                  </a>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Pagination Controls */}
            {activeRecordsLength > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-600">
                <span>Page {safePage} of {totalPages}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                    disabled={safePage === 1}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    &lt;
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          safePage === page
                            ? "bg-orange-500 text-white shadow-xs"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                    disabled={safePage === totalPages}
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
          if (!isUserBrandRestricted) {
            setFilterBrand("All");
          }
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
        initialBrand={filterBrand !== "All" && filterBrand !== "All Brands" ? filterBrand : (user?.brandScope || "")}
        userBrandScope={user?.brandScope}
        availableBrands={availableBrandOptions}
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

      {/* Transfer Pending Followup Modal for Centre Head */}
      <TransferPendingFollowupModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        selectedLeads={leadsForTransferModal}
        allPendingLeads={filteredEnquiryRecords.map((rec) => ({
          _id: rec._id,
          enquiryId: rec.enquiryId,
          studentFullName: rec.studentFullName,
          primaryPhoneMobile: rec.primaryPhoneMobile,
          targetCourse: rec.targetCourse,
          targetBrand: rec.targetBrand,
          assignedCrmAdvisor: rec.assignedCrmAdvisor,
          dueDateStr: rec.dueDateStr,
          lastRemarkStr: rec.lastRemarkStr,
        }))}
        allCounsellors={eligibleCounsellors}
        allAdvisorsOnLeads={allCurrentAdvisors}
        userBrandScope={user?.brandScope}
        onSuccess={(targetAdvisor, count) => {
          playChimeSound("success");
          setTransferToastMessage(`✓ Successfully transferred ${count} lead(s) to ${targetAdvisor}!`);
          setTimeout(() => setTransferToastMessage(""), 5000);
          setSelectedEnquiryIds([]);
          fetchData();
        }}
      />
    </div>
  );
}
