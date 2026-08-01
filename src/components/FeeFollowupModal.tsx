"use client";

import React, { useState, useEffect } from "react";

interface FeeFollowupModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: any | null;
  onSuccess: () => void;
}

export default function FeeFollowupModal({
  isOpen,
  onClose,
  record,
  onSuccess,
}: FeeFollowupModalProps) {
  const [activeTab, setActiveTab] = useState<"add" | "history">("add");

  const todayYYYYMMDD = new Date().toISOString().split("T")[0];

  // Fee Follow-up Specific Form Fields
  const [followupStatus, setFollowupStatus] = useState<string>("PTP (Promised to Pay)");
  const [ptpDate, setPtpDate] = useState<string>(todayYYYYMMDD);
  const [ptpAmount, setPtpAmount] = useState<number | "">(record?.pendingDueAmount || record?.remainingBalance || "");
  const [expectedPaymentMode, setExpectedPaymentMode] = useState<string>("UPI / QR Code");
  
  const [nextFollowupDate, setNextFollowupDate] = useState<string>(todayYYYYMMDD);
  const [nextFollowupTime, setNextFollowupTime] = useState<string>("11:00 AM");
  const [priority, setPriority] = useState<string>("High");
  const [assignedTo, setAssignedTo] = useState<string>(record?.counsellor || record?.assignedCrmAdvisor || "");
  const [remarks, setRemarks] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // History State
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && record) {
      setPtpAmount(record.pendingDueAmount || record.remainingBalance || "");
      setAssignedTo(record.counsellor || record.assignedCrmAdvisor || "");
      fetchFollowupHistory();
    }
  }, [isOpen, record]);

  const fetchFollowupHistory = async () => {
    if (!record?._id) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/admissions/${record._id}`);
      const json = await res.json();
      if (json.success && json.data) {
        const tasks = json.data.tasks || [];
        const feeTasks = tasks.filter(
          (t: any) =>
            (t.taskType || "").toLowerCase().includes("fee") ||
            (t.taskType || "").toLowerCase().includes("emi") ||
            (t.title || "").toLowerCase().includes("fee") ||
            (t.title || "").toLowerCase().includes("emi")
        );
        setHistoryItems(feeTasks);
      }
    } catch (err) {
      console.error("Error fetching fee follow-up history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) {
      alert("Please enter follow-up remarks/notes.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Update Admission record with last fee follow-up details
      const updatePayload = {
        lastFollowupDate: new Date().toISOString(),
        lastFollowupNotes: `[${followupStatus}] ${remarks}${ptpAmount ? ` | Promised Amount: ₹${ptpAmount}` : ""}${ptpDate ? ` | PTP Date: ${ptpDate}` : ""}`,
        nextFollowupDate: nextFollowupDate ? new Date(nextFollowupDate).toISOString() : null,
      };

      await fetch(`/api/admissions/${record._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      // 2. Create a Fee Follow-up Task for tracking in Overdue & Task Center
      const taskPayload = {
        title: `Fee Follow-up: ${record.studentName || record.fullName} (${followupStatus})`,
        description: `Status: ${followupStatus}\nPromised Amount: ₹${ptpAmount || 0}\nPTP Date: ${ptpDate}\nPayment Mode: ${expectedPaymentMode}\nRemarks: ${remarks}`,
        taskType: "Fee Followup",
        dueDate: nextFollowupDate ? new Date(`${nextFollowupDate}T11:00:00.000Z`) : new Date(),
        assignedTo: assignedTo || "Staff",
        priority: priority || "High",
        status: "Pending",
        linkedStudentId: record._id,
        linkedStudentName: record.studentName || record.fullName,
      };

      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskPayload),
      });

      alert("Fee follow-up recorded successfully!");
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error logging fee follow-up:", err);
      alert("Failed to record fee follow-up.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const studentName = record.studentName || record.fullName || "Student";
  const regId = record.admissionId || "N/A";
  const mobile = record.mobile || record.mobileNumber || "N/A";
  const pendingDue = Number(record.pendingDueAmount || record.remainingBalance || 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 font-black flex items-center justify-center text-lg border border-amber-500/30">
              💳
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>Fee Collection Follow-up Form</span>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded border border-amber-500/30 uppercase">
                  Financial Dues
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-semibold">
                {studentName} (ID: {regId}) • Mobile: {mobile}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Student Dues Summary Banner */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200/80 grid grid-cols-3 gap-3 text-xs font-semibold">
          <div className="bg-white border border-slate-200 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Agreed Fee</span>
            <span className="text-sm font-black text-slate-900">₹{Number(record.agreedFee || record.finalFee || 0).toLocaleString("en-IN")}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Pending Balance</span>
            <span className="text-sm font-black text-rose-600">₹{pendingDue.toLocaleString("en-IN")}</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-2.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Original Due Date</span>
            <span className="text-xs font-extrabold text-amber-700">{record.dueDate ? new Date(record.dueDate).toLocaleDateString("en-IN") : "Overdue"}</span>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("add")}
            className={`py-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "add"
                ? "border-amber-500 text-amber-700 bg-amber-50/40"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            📝 Log Fee Follow-up
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`py-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "history"
                ? "border-amber-500 text-amber-700 bg-amber-50/40"
                : "border-transparent text-slate-400 hover:text-slate-700"
            }`}
          >
            📜 Follow-up History ({historyItems.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {activeTab === "add" ? (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Fee Follow-up Outcome Category */}
              <div>
                <label className="block text-slate-700 font-extrabold mb-1.5">
                  Follow-up Call Category / Status <span className="text-rose-500">*</span>
                </label>
                <select
                  value={followupStatus}
                  onChange={(e) => setFollowupStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
                >
                  <option value="PTP (Promised to Pay)">🤝 PTP (Promised to Pay)</option>
                  <option value="Partial Payment Promised">💵 Partial Payment Promised</option>
                  <option value="Dispute / Fee Extension Requested">⏳ Dispute / Fee Extension Requested</option>
                  <option value="Financial Hardship">💔 Financial Hardship Reported</option>
                  <option value="Parent Discussion Pending">👨‍👩‍👧 Parent Discussion Pending</option>
                  <option value="Call Unanswered / RNR">📞 Call Unanswered / RNR</option>
                  <option value="Cheque / Bank Transfer Pending">🏦 Cheque / Bank Transfer Pending</option>
                  <option value="Refused to Pay / Escalated">⚠️ Refused to Pay / Escalated</option>
                </select>
              </div>

              {/* PTP Details Grid */}
              <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 space-y-3">
                <span className="text-[11px] font-black text-amber-800 uppercase tracking-wider block">
                  💰 Promise to Pay (PTP) Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-amber-900 font-bold mb-1">Promised Date (PTP)</label>
                    <input
                      type="date"
                      value={ptpDate}
                      onChange={(e) => setPtpDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-xl font-bold text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-amber-900 font-bold mb-1">Promised Amount (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 15000"
                      value={ptpAmount}
                      onChange={(e) => setPtpAmount(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-xl font-bold text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-amber-900 font-bold mb-1">Expected Mode</label>
                    <select
                      value={expectedPaymentMode}
                      onChange={(e) => setExpectedPaymentMode(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-amber-200 rounded-xl font-bold text-slate-800 focus:outline-none cursor-pointer"
                    >
                      <option value="UPI / QR Code">UPI / QR Code</option>
                      <option value="Bank Transfer (NEFT/IMPS)">Bank Transfer (NEFT/IMPS)</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Card / POS">Card / POS</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Next Follow-up Schedule Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Next Follow-up Date</label>
                  <input
                    type="date"
                    value={nextFollowupDate}
                    onChange={(e) => setNextFollowupDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Preferred Time</label>
                  <input
                    type="text"
                    placeholder="11:00 AM"
                    value={nextFollowupTime}
                    onChange={(e) => setNextFollowupTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="High">🔴 High Priority</option>
                    <option value="Medium">🟡 Medium Priority</option>
                    <option value="Low">🟢 Low Priority</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">
                  Collection Call Notes & Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Record summary of call with student/parent regarding fee payment..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Saving Follow-up..." : "Save Fee Follow-up"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 text-xs">
              {isLoadingHistory ? (
                <div className="py-8 text-center text-slate-400 font-bold">Loading fee follow-up history...</div>
              ) : historyItems.length === 0 ? (
                <div className="py-8 text-center text-slate-400 font-bold">No previous fee follow-ups recorded yet.</div>
              ) : (
                historyItems.map((item) => (
                  <div key={item._id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-extrabold text-slate-800">{item.title}</span>
                      <span className="text-slate-400 font-semibold">{new Date(item.createdAt || Date.now()).toLocaleDateString("en-IN")}</span>
                    </div>
                    <p className="text-slate-600 font-semibold whitespace-pre-line">{item.description}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
