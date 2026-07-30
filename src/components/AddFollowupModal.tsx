"use client";

import React, { useState, useEffect } from "react";

interface AddFollowupModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: any | null;
  onSuccess: () => void;
}

const DEFAULT_COURSES = [
  "Certificate Course in CorelDraw-15000",
  "Certificate Course in Illustration-15000",
  "Certificate Course in InDesign-15000",
  "Certificate Course in PhotoShop-15000",
  "Certificate course in Textile-25000",
  "Master Diploma in Interior Architecture Design-120000",
  "Diploma in Graphic Design-45000",
  "Master Diploma in Fashion Design-135000",
  "Advance Course in AutoCAD Electrical-30000",
];

export default function AddFollowupModal({
  isOpen,
  onClose,
  record,
  onSuccess,
}: AddFollowupModalProps) {
  const [activeTab, setActiveTab] = useState<"add" | "history">("add");

  const todayYYYYMMDD = new Date().toISOString().split("T")[0];
  const currentTimeStr = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Form Fields State
  const [nextDate, setNextDate] = useState(todayYYYYMMDD);
  const [nextTime, setNextTime] = useState("03:47 PM");
  const [followupRemark, setFollowupRemark] = useState("");
  const [currentDate, setCurrentDate] = useState(todayYYYYMMDD);
  const [currentTime, setCurrentTime] = useState(currentTimeStr);

  // Dual Transfer List Courses State
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [searchAvailable, setSearchAvailable] = useState("");
  const [searchSelected, setSearchSelected] = useState("");
  const [selectedFromLeft, setSelectedFromLeft] = useState<string[]>([]);
  const [selectedFromRight, setSelectedFromRight] = useState<string[]>([]);

  // Additional Follow-up Features State
  const [priority, setPriority] = useState<string>(record?.priorityLevel || record?.priority || "Medium");
  const [assignedTo, setAssignedTo] = useState<string>(record?.assignedCrmAdvisor || record?.counsellor || "");
  const [nextAction, setNextAction] = useState<string>("");
  const [status, setStatus] = useState<string>("Pending");
  const [recurringRule, setRecurringRule] = useState<string>("none");
  const [counsellorsList, setCounsellorsList] = useState<any[]>([]);

  // Lead Type & Call Duration
  const [leadType, setLeadType] = useState(record?.leadType || "walkin");
  const [callStart, setCallStart] = useState("");
  const [callEnd, setCallEnd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Response Type & Dynamic Add Modal State
  const [responseTypes, setResponseTypes] = useState<string[]>([
    "incoming call",
    "INCOMING NOT AVAIALABLE",
    "Not interested",
    "ntr",
    "remark",
    "RNR",
    "sw/off",
    "Wrong no.",
    "Telephonic",
    "WhatsApp",
    "Email",
    "Walkin",
    "Campus Visit",
  ]);
  const [responseType, setResponseType] = useState<string>("incoming call");

  // Add Response Type Modal State
  const [isAddResponseTypeModalOpen, setIsAddResponseTypeModalOpen] = useState(false);
  const [newResponseTypeName, setNewResponseTypeName] = useState("");
  const [newResponseTypeRemarks, setNewResponseTypeRemarks] = useState("");
  const [isSavingResponseType, setIsSavingResponseType] = useState(false);

  // History State
  const [historySearch, setHistorySearch] = useState("");
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(5);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);

  // Fetch real courses, counsellors and response types from backend
  useEffect(() => {
    const fetchRealData = async () => {
      try {
        const [cRes, counsRes, respRes] = await Promise.all([
          fetch("/api/courses").then(r => r.json().catch(() => ({}))),
          fetch("/api/counsellors").then(r => r.json().catch(() => ({}))),
          fetch("/api/response-types").then(r => r.json().catch(() => ({}))),
        ]);

        let courseList: string[] = [];
        if (cRes.success && Array.isArray(cRes.data) && cRes.data.length > 0) {
          courseList = Array.from(new Set(cRes.data.map((c: any) => `${c.name}${c.fee ? `-${c.fee}` : ""}`)));
        } else {
          courseList = Array.from(new Set(DEFAULT_COURSES));
        }

        if (counsRes.success && Array.isArray(counsRes.data)) {
          setCounsellorsList(counsRes.data);
        }

        if (respRes.success && Array.isArray(respRes.data) && respRes.data.length > 0) {
          const names: string[] = Array.from(new Set(respRes.data.map((t: any) => String(t.name))));
          setResponseTypes(names);
        }

        if (record && (record.targetCourse || record.course)) {
          const selected = record.targetCourse || record.course;
          setSelectedCourses(Array.from(new Set([selected])));
          setAvailableCourses(Array.from(new Set(courseList.filter((item) => item !== selected))));
        } else {
          setAvailableCourses(Array.from(new Set(courseList)));
        }
      } catch (err) {
        console.error("Error loading modal dropdown data:", err);
        setAvailableCourses(DEFAULT_COURSES);
      }
    };

    if (isOpen) {
      fetchRealData();
      if (record) {
        setLeadType(record.leadType || "walkin");
        setAssignedTo(record.assignedCrmAdvisor || record.counsellor || "");
        setPriority(record.priorityLevel || record.priority || "Medium");
      }
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  // Followup History List
  const rawFollowUps = Array.isArray(record.followUps) ? record.followUps : [];
  const historyList = rawFollowUps.map((f: any) => ({
    type: "F",
    followupDate: f.date
      ? `${new Date(f.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ${f.time || ""}`
      : f.createdAt
      ? `${new Date(f.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ${new Date(f.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
      : "N/A",
    responseType: f.typeOfContact || "Telephonic",
    remarks: f.remarks || f.notes || "No remark entered",
    followupBy: f.plannedBy || record.assignedCrmAdvisor || record.counsellor || "Admin",
    startTime: f.callStart || "-",
    endTime: f.callEnd || "-",
  }));

  // Filtered History
  const filteredHistory = historyList.filter((item: any) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase().trim();
    return (
      item.remarks.toLowerCase().includes(q) ||
      item.followupBy.toLowerCase().includes(q) ||
      item.followupDate.toLowerCase().includes(q)
    );
  });

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / historyItemsPerPage));
  const historyStartIdx = (historyCurrentPage - 1) * historyItemsPerPage;
  const paginatedHistory = filteredHistory.slice(historyStartIdx, historyStartIdx + historyItemsPerPage);

  // Transfer Handlers
  const moveToRight = () => {
    if (selectedFromLeft.length === 0) return;
    setSelectedCourses([...selectedCourses, ...selectedFromLeft]);
    setAvailableCourses(availableCourses.filter((c) => !selectedFromLeft.includes(c)));
    setSelectedFromLeft([]);
  };

  const moveToLeft = () => {
    if (selectedFromRight.length === 0) return;
    setAvailableCourses([...availableCourses, ...selectedFromRight]);
    setSelectedCourses(selectedCourses.filter((c) => !selectedFromRight.includes(c)));
    setSelectedFromRight([]);
  };

  // Submit Handler
  const handleSaveFollowup = async (sendWA = false, sendSMS = false) => {
    if (!followupRemark.trim()) {
      alert("Please enter a follow-up remark.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        date: nextDate,
        time: nextTime,
        priority,
        assignedTo,
        remarks: followupRemark,
        nextAction,
        currentDate,
        currentTime,
        typeOfContact: leadType,
        selectedCourses,
        callStart,
        callEnd,
        status,
        isRecurring: recurringRule !== "none",
        recurringRule,
      };

      const res = await fetch(`/api/enquiries/${record._id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (sendWA) {
          const text = encodeURIComponent(`Hello ${record.studentFullName || record.fullName}, regarding your course inquiry: ${followupRemark}`);
          const phone = (record.primaryPhoneMobile || record.mobileNumber || "").replace(/\D/g, "");
          if (phone) window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
        }
        alert("Follow-up saved successfully!");
        onSuccess();
        onClose();
      } else {
        alert(data.message || "Failed to save follow-up.");
      }
    } catch (err) {
      console.error("Error saving followup:", err);
      alert("Failed to save follow-up.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4">
      {/* Elegant Rounded Card with Soft Indigo Glow */}
      <div className="bg-white rounded-2xl shadow-2xl shadow-indigo-950/20 w-full max-w-4xl overflow-hidden border border-slate-200/80 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header Bar with Student Summary */}
        <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-sm shadow-md">
              {(record.studentFullName || record.fullName || "S").charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base leading-tight">
                {record.studentFullName || record.fullName}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Phone: {record.primaryPhoneMobile || record.mobileNumber || "N/A"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-black text-sm transition-all cursor-pointer"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Dual Segmented Header Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 p-1.5 gap-2 select-none shrink-0">
          <button
            onClick={() => setActiveTab("add")}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-2 ${
              activeTab === "add"
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
            }`}
          >
            <span>✏️ Add Followup</span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-2 ${
              activeTab === "history"
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
            }`}
          >
            <span>📜 FollowUp History ({historyList.length})</span>
          </button>
        </div>

        {/* TAB 1: ADD FOLLOWUP FORM */}
        {activeTab === "add" ? (
          <div className="p-8 overflow-y-auto space-y-6 text-xs text-slate-700 font-sans flex-1">
            
            {/* 1. Priority & Assignment Row */}
            <div className="grid grid-cols-12 items-center gap-4">
              <div className="col-span-4 text-right pr-2">
                <label className="block font-bold text-slate-800">
                  Priority & Assignee
                </label>
              </div>
              <div className="col-span-8 grid grid-cols-2 gap-3">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-bold outline-none bg-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                >
                  <option value="Urgent">🔴 Urgent Priority</option>
                  <option value="High">🟠 High Priority</option>
                  <option value="Medium">🟡 Medium Priority</option>
                  <option value="Low">🔵 Low Priority</option>
                </select>

                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-bold outline-none bg-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                >
                  <option value="">-- Assign Counsellor / Rep --</option>
                  {counsellorsList.map((c) => (
                    <option key={c._id || c.name} value={c.name}>
                      👤 {c.name} {c.brand ? `(${c.brand})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Next Follow-up Date & Time */}
            <div className="grid grid-cols-12 items-center gap-4">
              <div className="col-span-4 text-right pr-2">
                <label className="block font-bold text-slate-800 leading-tight">
                  Next Follow-up Date
                </label>
                <span className="text-[10px] text-indigo-500 font-semibold">
                  (DD/MM/YYYY)
                </span>
              </div>
              <div className="col-span-8 flex items-center gap-3">
                <div className="flex-1 flex border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-600">
                  <div className="bg-slate-100 px-3.5 py-2.5 border-r border-slate-300 text-slate-500 flex items-center justify-center shrink-0">
                    📅
                  </div>
                  <input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className="w-full px-3 py-2 text-slate-800 font-semibold outline-none bg-white"
                  />
                </div>

                <select
                  value={nextTime}
                  onChange={(e) => setNextTime(e.target.value)}
                  className="w-40 px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-semibold outline-none bg-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                >
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="11:00 AM">11:00 AM</option>
                  <option value="12:00 PM">12:00 PM</option>
                  <option value="02:00 PM">02:00 PM</option>
                  <option value="03:47 PM">03:47 PM</option>
                  <option value="05:00 PM">05:00 PM</option>
                  <option value="06:30 PM">06:30 PM</option>
                </select>
              </div>
            </div>

            {/* 3. Recurring Follow-up & Touchpoint Status */}
            <div className="grid grid-cols-12 items-center gap-4">
              <div className="col-span-4 text-right pr-2">
                <label className="block font-bold text-slate-800">
                  Status & Auto-Recurring
                </label>
              </div>
              <div className="col-span-8 grid grid-cols-2 gap-3">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-bold outline-none bg-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                >
                  <option value="Pending">⏳ Pending</option>
                  <option value="In Progress">🔄 In Progress</option>
                  <option value="Completed">✓ Completed</option>
                  <option value="Rescheduled">📅 Rescheduled</option>
                  <option value="Missed">🚨 Missed</option>
                </select>

                <select
                  value={recurringRule}
                  onChange={(e) => setRecurringRule(e.target.value)}
                  className="px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-bold outline-none bg-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                >
                  <option value="none">🔁 Auto-Recurring: None</option>
                  <option value="1_day">🔁 Every 1 Day (+1d)</option>
                  <option value="3_days">🔁 Every 3 Days (+3d)</option>
                  <option value="7_days">🔁 Every 7 Days (+7d)</option>
                  <option value="14_days">🔁 Every 14 Days (+14d)</option>
                  <option value="30_days">🔁 Monthly (+30d)</option>
                </select>
              </div>
            </div>

            {/* 4. Followup Remark & Next Action Step */}
            <div className="grid grid-cols-12 items-start gap-4">
              <div className="col-span-4 text-right pr-2 pt-2">
                <label className="block font-bold text-slate-800">
                  Remarks & Next Action
                </label>
              </div>
              <div className="col-span-8 space-y-2">
                <textarea
                  rows={3}
                  value={followupRemark}
                  onChange={(e) => setFollowupRemark(e.target.value)}
                  placeholder="Enter call outcome or remarks (optional)..."
                  className="w-full p-3.5 border border-slate-300 rounded-xl text-slate-800 font-medium outline-none bg-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
                <input
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="Target next action step (optional)..."
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-slate-800 font-medium outline-none bg-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            {/* 3. Follow Up Date */}
            <div className="grid grid-cols-12 items-center gap-4">
              <div className="col-span-4 text-right pr-2">
                <label className="block font-bold text-slate-800 leading-tight">
                  Follow Up Date
                </label>
                <span className="text-[10px] text-indigo-500 font-semibold">
                  (DD/MM/YYYY)
                </span>
              </div>
              <div className="col-span-8 flex items-center gap-3">
                <div className="flex-1 flex border border-slate-300 rounded-xl overflow-hidden bg-slate-50 shadow-xs">
                  <div className="bg-slate-100 px-3.5 py-2.5 border-r border-slate-300 text-slate-500 flex items-center justify-center shrink-0">
                    📅
                  </div>
                  <input
                    type="date"
                    value={currentDate}
                    onChange={(e) => setCurrentDate(e.target.value)}
                    className="w-full px-3 py-2 text-slate-800 font-semibold outline-none bg-slate-50"
                  />
                </div>

                <select
                  value={currentTime}
                  onChange={(e) => setCurrentTime(e.target.value)}
                  className="w-40 px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-semibold outline-none bg-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                >
                  <option value="10:00 AM">10:00 AM</option>
                  <option value="11:00 AM">11:00 AM</option>
                  <option value="03:47 PM">03:47 PM</option>
                  <option value="05:00 PM">05:00 PM</option>
                </select>
              </div>
            </div>

            {/* 4. Course Dual List Selector Box */}
            <div className="grid grid-cols-12 items-start gap-4">
              <div className="col-span-4 text-right pr-2 pt-2">
                <label className="block font-bold text-slate-800">
                  Course
                </label>
              </div>
              <div className="col-span-8 grid grid-cols-11 gap-2 items-center">
                
                {/* Left Available Box */}
                <div className="col-span-5 border border-slate-300 rounded-xl bg-white overflow-hidden shadow-xs">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                    Available Courses
                  </div>
                  <input
                    type="text"
                    value={searchAvailable}
                    onChange={(e) => setSearchAvailable(e.target.value)}
                    placeholder="Search Course..."
                    className="w-full px-3 py-1.5 border-b border-slate-200 text-xs outline-none bg-slate-50"
                  />
                  <div className="h-36 overflow-y-auto p-1.5 divide-y divide-slate-100">
                    {availableCourses
                      .filter((c) => c.toLowerCase().includes(searchAvailable.toLowerCase()))
                      .map((c, idx) => (
                        <div
                          key={`avail-${c}-${idx}`}
                          onClick={() => {
                            if (selectedFromLeft.includes(c)) {
                              setSelectedFromLeft(selectedFromLeft.filter((item) => item !== c));
                            } else {
                              setSelectedFromLeft([...selectedFromLeft, c]);
                            }
                          }}
                          className={`p-2 text-[11px] font-medium cursor-pointer rounded-lg transition-colors ${
                            selectedFromLeft.includes(c) ? "bg-indigo-100 text-indigo-800 font-bold" : "hover:bg-slate-100"
                          }`}
                        >
                          {c}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Middle Transfer Arrows Button */}
                <div className="col-span-1 flex flex-col items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={moveToRight}
                    className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl shadow-md flex items-center justify-center font-black text-sm transition-transform active:scale-95 cursor-pointer"
                    title="Move to Selected"
                  >
                    ⇆
                  </button>
                </div>

                {/* Right Selected Box */}
                <div className="col-span-5 border border-slate-300 rounded-xl bg-white overflow-hidden shadow-xs">
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 text-[11px] font-bold text-indigo-700 uppercase">
                    Selected Courses ({selectedCourses.length})
                  </div>
                  <input
                    type="text"
                    value={searchSelected}
                    onChange={(e) => setSearchSelected(e.target.value)}
                    placeholder="Search Course..."
                    className="w-full px-3 py-1.5 border-b border-slate-200 text-xs outline-none bg-slate-50"
                  />
                  <div className="h-36 overflow-y-auto p-1.5 divide-y divide-slate-100">
                    {selectedCourses
                      .filter((c) => c.toLowerCase().includes(searchSelected.toLowerCase()))
                      .map((c, idx) => (
                        <div
                          key={`sel-${c}-${idx}`}
                          onClick={() => {
                            if (selectedFromRight.includes(c)) {
                              setSelectedFromRight(selectedFromRight.filter((item) => item !== c));
                            } else {
                              setSelectedFromRight([...selectedFromRight, c]);
                            }
                          }}
                          className={`p-2 text-[11px] font-bold cursor-pointer rounded-lg transition-colors ${
                            selectedFromRight.includes(c) ? "bg-rose-100 text-rose-800" : "bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
                          }`}
                        >
                          {c}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Response Type */}
            <div className="grid grid-cols-12 items-center gap-4">
              <div className="col-span-4 text-right pr-2">
                <label className="block font-bold text-slate-800">
                  Response Type <span className="text-rose-500">*</span>
                </label>
              </div>
              <div className="col-span-8 flex items-center gap-2">
                <select
                  value={responseType}
                  onChange={(e) => setResponseType(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-bold outline-none bg-white shadow-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600 cursor-pointer"
                >
                  {responseTypes.map((t, idx) => (
                    <option key={`resp-${t}-${idx}`} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                {/* Orange + Button to open Add Response Type Modal (Matching Screenshot) */}
                <button
                  type="button"
                  onClick={() => setIsAddResponseTypeModalOpen(true)}
                  className="w-10 h-10 bg-orange-600 hover:bg-orange-700 text-white font-black text-xl rounded-xl flex items-center justify-center shadow-md shadow-orange-600/30 transition-all active:scale-95 cursor-pointer shrink-0"
                  title="Add New Response Type"
                >
                  +
                </button>
              </div>
            </div>

            {/* 6. Lead Type */}
            <div className="grid grid-cols-12 items-center gap-4">
              <div className="col-span-4 text-right pr-2">
                <label className="block font-bold text-slate-800">
                  Lead Type
                </label>
              </div>
              <div className="col-span-8">
                <select
                  value={leadType}
                  onChange={(e) => setLeadType(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-slate-800 font-medium outline-none bg-white shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                >
                  <option value="walkin">walkin</option>
                  <option value="telephonic">telephonic</option>
                  <option value="whatsapp">whatsapp</option>
                  <option value="email">email</option>
                  <option value="campus visit">campus visit</option>
                </select>
              </div>
            </div>

            {/* 6. Call Start & Call End */}
            <div className="grid grid-cols-12 items-center gap-4">
              <div className="col-span-4 text-right pr-2">
                <label className="block font-bold text-slate-800">
                  Call Start
                </label>
              </div>
              <div className="col-span-8 flex items-center justify-between gap-4">
                <input
                  type="time"
                  value={callStart}
                  onChange={(e) => setCallStart(e.target.value)}
                  className="w-40 px-3.5 py-2 border border-slate-300 rounded-xl text-slate-800 font-medium outline-none bg-white shadow-xs"
                />

                <div className="flex items-center gap-3">
                  <label className="font-bold text-slate-800">
                    Call End
                  </label>
                  <input
                    type="time"
                    value={callEnd}
                    onChange={(e) => setCallEnd(e.target.value)}
                    className="w-40 px-3.5 py-2 border border-slate-300 rounded-xl text-slate-800 font-medium outline-none bg-white shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons Footer */}
            <div className="flex items-center justify-end gap-3 pt-6 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSaveFollowup(true, false)}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveFollowup(false, true)}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <span>SMS</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveFollowup(false, false)}
                disabled={isSubmitting}
                className="px-7 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* TAB 2: FOLLOWUP HISTORY */
          <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 font-sans flex-1 flex flex-col">
            
            {/* Top Search & Records Per Page Bar */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <select
                  value={historyItemsPerPage}
                  onChange={(e) => {
                    setHistoryItemsPerPage(Number(e.target.value));
                    setHistoryCurrentPage(1);
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded-xl bg-white font-bold text-slate-700 shadow-xs outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
                <span className="font-semibold text-slate-500">records per page</span>
              </div>

              <input
                type="text"
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryCurrentPage(1);
                }}
                placeholder="Search history..."
                className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold outline-none bg-white w-64 shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>

            {/* History Table */}
            <div className="border border-slate-200/80 rounded-xl overflow-hidden flex-1 shadow-xs bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                    <th className="py-3 px-3.5 w-12 text-center">Type ▾</th>
                    <th className="py-3 px-3.5 min-w-[130px]">Followup Date ▾</th>
                    <th className="py-3 px-3.5 min-w-[110px]">Response Type ▾</th>
                    <th className="py-3 px-3.5 min-w-[180px]">Followup Remarks ▾</th>
                    <th className="py-3 px-3.5 min-w-[130px]">Followup By ▾</th>
                    <th className="py-3 px-3.5 min-w-[80px]">Start Time ▾</th>
                    <th className="py-3 px-3.5 min-w-[80px]">End Time ▾</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {paginatedHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">No follow-up history logged yet.</td>
                    </tr>
                  ) : (
                    paginatedHistory.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-amber-500 to-orange-600 text-white font-black text-xs rounded-md shadow-xs">
                            {item.type}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-indigo-950 font-bold">{item.followupDate}</td>
                        <td className="py-3 px-3.5 capitalize text-slate-500">{item.responseType}</td>
                        <td className="py-3 px-3.5 text-slate-800 font-normal">{item.remarks}</td>
                        <td className="py-3 px-3.5 font-bold text-slate-900">{item.followupBy}</td>
                        <td className="py-3 px-3.5 font-mono text-slate-500">{item.startTime}</td>
                        <td className="py-3 px-3.5 font-mono text-slate-500">{item.endTime}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="flex items-center justify-between pt-2 text-xs font-semibold text-slate-500">
              <span>
                Showing {filteredHistory.length > 0 ? historyStartIdx + 1 : 0} to {Math.min(historyStartIdx + historyItemsPerPage, filteredHistory.length)} of {filteredHistory.length} entries
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setHistoryCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={historyCurrentPage === 1}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-bold shadow-xs cursor-pointer"
                >
                  &lt;
                </button>
                {Array.from({ length: totalHistoryPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setHistoryCurrentPage(p)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      historyCurrentPage === p
                        ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs"
                        : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setHistoryCurrentPage((p) => Math.min(totalHistoryPages, p + 1))}
                  disabled={historyCurrentPage === totalHistoryPages}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 font-bold shadow-xs cursor-pointer"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Add Response Type Modal matching Screenshots */}
        {isAddResponseTypeModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
              {/* Header matching Screenshot 3: Bright Orange Header */}
              <div className="bg-gradient-to-r from-orange-600 to-orange-500 px-6 py-4 flex items-center justify-between text-white">
                <h2 className="text-lg font-extrabold flex items-center gap-2">
                  <span>Response Type</span>
                  <span className="text-base animate-pulse">🔊</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setIsAddResponseTypeModalOpen(false)}
                  className="text-white/80 hover:text-white font-black text-xl transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Body Form matching Screenshot 3 */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newResponseTypeName.trim()) return;
                  setIsSavingResponseType(true);
                  try {
                    const res = await fetch("/api/response-types", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: newResponseTypeName,
                        remarks: newResponseTypeRemarks,
                      }),
                    });
                    const json = await res.json();
                    if (json.success && json.data) {
                      const addedName = json.data.name;
                      setResponseTypes((prev) => Array.from(new Set([...prev, addedName])));
                      setResponseType(addedName);
                      setNewResponseTypeName("");
                      setNewResponseTypeRemarks("");
                      setIsAddResponseTypeModalOpen(false);
                    }
                  } catch (err) {
                    console.error("Error adding response type:", err);
                  } finally {
                    setIsSavingResponseType(false);
                  }
                }}
                className="p-6 space-y-4 text-left"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Response Type Name<span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newResponseTypeName}
                    onChange={(e) => setNewResponseTypeName(e.target.value)}
                    placeholder="e.g. Call Back Later, Busy, Switched Off..."
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    Response Type Remarks<span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={newResponseTypeRemarks}
                    onChange={(e) => setNewResponseTypeRemarks(e.target.value)}
                    placeholder="Enter guidelines or remarks..."
                    className="w-full p-3.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600"
                  />
                </div>

                {/* Footer Buttons matching Screenshot 3 */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddResponseTypeModalOpen(false)}
                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingResponseType}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingResponseType ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
