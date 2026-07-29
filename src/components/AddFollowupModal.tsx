"use client";

import React, { useState, useEffect, useMemo } from "react";

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

  // Format today date in YYYY-MM-DD for date inputs
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
  const [availableCourses, setAvailableCourses] = useState<string[]>(DEFAULT_COURSES);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [searchAvailable, setSearchAvailable] = useState("");
  const [searchSelected, setSearchSelected] = useState("");
  const [selectedFromLeft, setSelectedFromLeft] = useState<string[]>([]);
  const [selectedFromRight, setSelectedFromRight] = useState<string[]>([]);

  // Lead Type & Call Duration
  const [leadType, setLeadType] = useState(record?.leadType || "walkin");
  const [callStart, setCallStart] = useState("");
  const [callEnd, setCallEnd] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History State
  const [historySearch, setHistorySearch] = useState("");
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(5);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);

  useEffect(() => {
    if (record) {
      if (record.targetCourse || record.course) {
        const c = record.targetCourse || record.course;
        setSelectedCourses([c]);
        setAvailableCourses(DEFAULT_COURSES.filter((item) => item !== c));
      }
      setLeadType(record.leadType || "walkin");
    }
  }, [record]);

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
        remarks: followupRemark,
        currentDate,
        currentTime,
        typeOfContact: leadType,
        selectedCourses,
        callStart,
        callEnd,
        status: "In Progress",
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      {/* Modal Card Matching Screenshot */}
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Dual Modal Header Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 select-none">
          <button
            onClick={() => setActiveTab("add")}
            className={`flex-1 py-3 text-sm font-bold transition-all cursor-pointer text-center relative ${
              activeTab === "add"
                ? "bg-white text-orange-600 border-t-2 border-t-orange-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            Add Followup
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-3 text-sm font-bold transition-all cursor-pointer text-center relative ${
              activeTab === "history"
                ? "bg-white text-orange-600 border-t-2 border-t-orange-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            Fees FollowUp History
          </button>
        </div>

        {/* TAB 1: ADD FOLLOWUP FORM (Matching Screenshot 1) */}
        {activeTab === "add" ? (
          <div className="p-8 overflow-y-auto space-y-5 text-xs text-slate-700 font-sans flex-1">
            
            {/* 1. Next Follow-up Date */}
            <div className="grid grid-cols-12 items-center gap-4">
              <div className="col-span-4 text-right pr-2">
                <label className="block font-semibold text-slate-800 leading-tight">
                  Next Follow-up Date
                </label>
                <span className="text-[10px] text-slate-400 font-normal">
                  (DD/MM/YYYY)
                </span>
              </div>
              <div className="col-span-8 flex items-center gap-3">
                <div className="flex-1 flex border border-slate-300 rounded-md overflow-hidden bg-white">
                  <div className="bg-slate-100 px-3 py-2 border-r border-slate-300 text-slate-500 flex items-center justify-center shrink-0">
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
                  className="w-40 px-3 py-2 border border-slate-300 rounded-md text-slate-800 font-semibold outline-none bg-white"
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

            {/* 2. Followup Remark */}
            <div className="grid grid-cols-12 items-start gap-4">
              <div className="col-span-4 text-right pr-2 pt-2">
                <label className="block font-semibold text-slate-800">
                  Followup Remark <span className="text-rose-500">*</span>
                </label>
              </div>
              <div className="col-span-8">
                <textarea
                  rows={3}
                  value={followupRemark}
                  onChange={(e) => setFollowupRemark(e.target.value)}
                  placeholder="Enter call outcome, student response or next action details..."
                  className="w-full p-3 border border-slate-300 rounded-md text-slate-800 font-medium outline-none bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  required
                />
              </div>
            </div>

            {/* 3. Follow Up Date */}
            <div className="grid grid-cols-12 items-center gap-4">
              <div className="col-span-4 text-right pr-2">
                <label className="block font-semibold text-slate-800 leading-tight">
                  Follow Up Date
                </label>
                <span className="text-[10px] text-slate-400 font-normal">
                  (DD/MM/YYYY)
                </span>
              </div>
              <div className="col-span-8 flex items-center gap-3">
                <div className="flex-1 flex border border-slate-300 rounded-md overflow-hidden bg-slate-50">
                  <div className="bg-slate-100 px-3 py-2 border-r border-slate-300 text-slate-500 flex items-center justify-center shrink-0">
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
                  className="w-40 px-3 py-2 border border-slate-300 rounded-md text-slate-800 font-semibold outline-none bg-white"
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
                <label className="block font-semibold text-slate-800">
                  Course
                </label>
              </div>
              <div className="col-span-8 grid grid-cols-11 gap-2 items-center">
                
                {/* Left Available Box */}
                <div className="col-span-5 border border-slate-300 rounded-md bg-white overflow-hidden">
                  <input
                    type="text"
                    value={searchAvailable}
                    onChange={(e) => setSearchAvailable(e.target.value)}
                    placeholder="Search Course..."
                    className="w-full px-2.5 py-1.5 border-b border-slate-200 text-xs outline-none bg-slate-50"
                  />
                  <div className="h-36 overflow-y-auto p-1 divide-y divide-slate-100">
                    {availableCourses
                      .filter((c) => c.toLowerCase().includes(searchAvailable.toLowerCase()))
                      .map((c) => (
                        <div
                          key={c}
                          onClick={() => {
                            if (selectedFromLeft.includes(c)) {
                              setSelectedFromLeft(selectedFromLeft.filter((item) => item !== c));
                            } else {
                              setSelectedFromLeft([...selectedFromLeft, c]);
                            }
                          }}
                          className={`p-1.5 text-[11px] font-medium cursor-pointer rounded transition-colors ${
                            selectedFromLeft.includes(c) ? "bg-orange-100 text-orange-800 font-bold" : "hover:bg-slate-100"
                          }`}
                        >
                          {c}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Middle Swap Arrow */}
                <div className="col-span-1 flex flex-col items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={moveToRight}
                    className="p-1.5 bg-slate-100 hover:bg-orange-100 border border-slate-300 text-slate-700 hover:text-orange-700 rounded transition-all cursor-pointer font-black text-sm"
                    title="Move to Selected"
                  >
                    ⇆
                  </button>
                </div>

                {/* Right Selected Box */}
                <div className="col-span-5 border border-slate-300 rounded-md bg-white overflow-hidden">
                  <input
                    type="text"
                    value={searchSelected}
                    onChange={(e) => setSearchSelected(e.target.value)}
                    placeholder="Search Course..."
                    className="w-full px-2.5 py-1.5 border-b border-slate-200 text-xs outline-none bg-slate-50"
                  />
                  <div className="h-36 overflow-y-auto p-1 divide-y divide-slate-100">
                    {selectedCourses
                      .filter((c) => c.toLowerCase().includes(searchSelected.toLowerCase()))
                      .map((c) => (
                        <div
                          key={c}
                          onClick={() => {
                            if (selectedFromRight.includes(c)) {
                              setSelectedFromRight(selectedFromRight.filter((item) => item !== c));
                            } else {
                              setSelectedFromRight([...selectedFromRight, c]);
                            }
                          }}
                          className={`p-1.5 text-[11px] font-medium cursor-pointer rounded transition-colors ${
                            selectedFromRight.includes(c) ? "bg-orange-100 text-orange-800 font-bold" : "hover:bg-slate-100 text-slate-800"
                          }`}
                        >
                          {c}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Lead Type */}
            <div className="grid grid-cols-12 items-center gap-4">
              <div className="col-span-4 text-right pr-2">
                <label className="block font-semibold text-slate-800">
                  Lead Type
                </label>
              </div>
              <div className="col-span-8">
                <select
                  value={leadType}
                  onChange={(e) => setLeadType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-slate-800 font-medium outline-none bg-white"
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
                <label className="block font-semibold text-slate-800">
                  Call Start
                </label>
              </div>
              <div className="col-span-8 flex items-center justify-between gap-4">
                <input
                  type="time"
                  value={callStart}
                  onChange={(e) => setCallStart(e.target.value)}
                  className="w-40 px-3 py-1.5 border border-slate-300 rounded-md text-slate-800 font-medium outline-none bg-white"
                />

                <div className="flex items-center gap-3">
                  <label className="font-semibold text-slate-800">
                    Call End
                  </label>
                  <input
                    type="time"
                    value={callEnd}
                    onChange={(e) => setCallEnd(e.target.value)}
                    className="w-40 px-3 py-1.5 border border-slate-300 rounded-md text-slate-800 font-medium outline-none bg-white"
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
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-md shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveFollowup(false, true)}
                disabled={isSubmitting}
                className="px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-md shadow-xs transition-all cursor-pointer"
              >
                <span>SMS</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveFollowup(false, false)}
                disabled={isSubmitting}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-md shadow-xs transition-all cursor-pointer"
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-md transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* TAB 2: FEES FOLLOWUP HISTORY (Matching Screenshot 2) */
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
                  className="px-2 py-1 border border-slate-300 rounded-md bg-white font-bold text-slate-700"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
                <span>records per page</span>
              </div>

              <input
                type="text"
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryCurrentPage(1);
                }}
                placeholder="Search history..."
                className="px-3 py-1.5 border border-slate-300 rounded-md text-xs font-semibold outline-none bg-white w-60"
              />
            </div>

            {/* History Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden flex-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider select-none">
                    <th className="py-2.5 px-3 w-12 text-center">Type ▾</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Followup Date ▾</th>
                    <th className="py-2.5 px-3 min-w-[110px]">Response Type ▾</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Followup Remarks ▾</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Followup By ▾</th>
                    <th className="py-2.5 px-3 min-w-[80px]">Start Time ▾</th>
                    <th className="py-2.5 px-3 min-w-[80px]">End Time ▾</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {paginatedHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400">No follow-up history logged yet.</td>
                    </tr>
                  ) : (
                    paginatedHistory.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-amber-500 text-white font-black text-xs rounded">
                            {item.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-800">{item.followupDate}</td>
                        <td className="py-3 px-3 capitalize text-slate-500">{item.responseType}</td>
                        <td className="py-3 px-3 text-slate-800 font-normal">{item.remarks}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">{item.followupBy}</td>
                        <td className="py-3 px-3 font-mono text-slate-500">{item.startTime}</td>
                        <td className="py-3 px-3 font-mono text-slate-500">{item.endTime}</td>
                        <td className="py-3 px-3 text-right text-slate-400">-</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="flex items-center justify-between pt-2 text-xs text-slate-500">
              <span>
                Showing {filteredHistory.length > 0 ? historyStartIdx + 1 : 0} to {Math.min(historyStartIdx + historyItemsPerPage, filteredHistory.length)} of {filteredHistory.length} entries
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setHistoryCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={historyCurrentPage === 1}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 font-bold"
                >
                  &lt;
                </button>
                {Array.from({ length: totalHistoryPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setHistoryCurrentPage(p)}
                    className={`px-2.5 py-1 rounded font-bold transition-all ${
                      historyCurrentPage === p
                        ? "bg-orange-600 text-white"
                        : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setHistoryCurrentPage((p) => Math.min(totalHistoryPages, p + 1))}
                  disabled={historyCurrentPage === totalHistoryPages}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 font-bold"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
