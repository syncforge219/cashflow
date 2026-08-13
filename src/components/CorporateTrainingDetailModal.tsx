"use client";

import React, { useState } from "react";

interface CorporateTrainingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  training: any | null;
  onUpdated: () => void;
  currentUser?: any;
}

export default function CorporateTrainingDetailModal({
  isOpen,
  onClose,
  training,
  onUpdated,
  currentUser,
}: CorporateTrainingDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "payments" | "edit">("overview");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Record Payment Form State
  const [newPayment, setNewPayment] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMode: "Bank Transfer / NEFT",
    referenceNo: "",
    remarks: "Corporate Installment Payment",
  });

  // Edit Form State
  const [editData, setEditData] = useState<any>({});

  React.useEffect(() => {
    if (training) {
      setEditData({
        companyName: training.companyName || "",
        contactPerson: training.contactPerson || "",
        contactPhone: training.contactPhone || "",
        contactEmail: training.contactEmail || "",
        trainingProgram: training.trainingProgram || "",
        description: training.description || "",
        trainingMode: training.trainingMode || "Offline (Client Site)",
        numberOfParticipants: training.numberOfParticipants || 15,
        location: training.location || "",
        faculty: training.faculty || "",
        startDate: training.startDate ? new Date(training.startDate).toISOString().split("T")[0] : "",
        endDate: training.endDate ? new Date(training.endDate).toISOString().split("T")[0] : "",
        durationHours: training.durationHours || "",
        totalAmount: training.totalAmount || 0,
        brand: training.brand || "",
        companyAssigned: training.companyAssigned || "",
        salesExecutive: training.salesExecutive || "",
        centreHead: training.centreHead || "",
        status: training.status || "Scheduled",
        remarks: training.remarks || "",
      });
      setErrorMsg("");
      setSuccessMsg("");
      setActiveTab("overview");
    }
  }, [training, isOpen]);

  if (!isOpen || !training) return null;

  const totalAmount = Number(training.totalAmount) || 0;
  const amountReceived = Number(training.amountReceived) || 0;
  const remainingBalance = Number(training.remainingBalance) || 0;
  const paidPct = totalAmount > 0 ? Math.min(100, Math.round((amountReceived / totalAmount) * 100)) : 0;

  const formatDate = (d: any) => {
    if (!d) return "N/A";
    try {
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? "N/A" : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return "N/A";
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const payAmt = Number(newPayment.amount);
    if (!payAmt || payAmt <= 0) {
      setErrorMsg("Please enter a valid payment amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/corporate-trainings/${training._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "recordPayment",
          newPayment: {
            ...newPayment,
            amount: payAmt,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Payment of ₹${payAmt.toLocaleString("en-IN")} recorded successfully!`);
        setNewPayment({
          amount: "",
          date: new Date().toISOString().split("T")[0],
          paymentMode: "Bank Transfer / NEFT",
          referenceNo: "",
          remarks: "Corporate Installment Payment",
        });
        onUpdated();
      } else {
        setErrorMsg(data.error || "Failed to record payment.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/corporate-trainings/${training._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg("Corporate training updated successfully!");
        onUpdated();
      } else {
        setErrorMsg(data.error || "Failed to update training details.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred while updating.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto font-sans animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 font-black text-xl flex items-center justify-center">
              🏢
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">{training.companyName}</h2>
                <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                  {training.trainingId || "CORP-TRG"}
                </span>
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                    training.status === "Ongoing"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : training.status === "Completed"
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      : training.status === "Payment Pending"
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  }`}
                >
                  {training.status}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-300 mt-0.5">
                {training.trainingProgram} • Faculty: <span className="text-white font-bold">{training.faculty}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-slate-50/70 flex items-center gap-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer ${
              activeTab === "overview"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            📋 Training 360° Overview
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "payments"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>💰 Fee & Payment History</span>
            <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
              {training.paymentHistory?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("edit")}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer ${
              activeTab === "edit"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            ✏️ Edit Details
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {errorMsg && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2 animate-shake">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
              <span>✅</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Financial Progress Banner */}
              <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border border-indigo-100 rounded-2xl p-5 shadow-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left mb-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total Agreed Amount</span>
                    <div className="text-xl font-black text-slate-900 mt-0.5">₹{totalAmount.toLocaleString("en-IN")}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Amount Collected</span>
                    <div className="text-xl font-black text-emerald-600 mt-0.5">₹{amountReceived.toLocaleString("en-IN")}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Remaining Balance</span>
                    <div className="text-xl font-black text-rose-600 mt-0.5">₹{remainingBalance.toLocaleString("en-IN")}</div>
                  </div>
                </div>

                <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-full ${paidPct >= 100 ? "bg-emerald-500" : "bg-indigo-600"}`}
                    style={{ width: `${paidPct}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] font-extrabold text-slate-500 mt-1.5">
                  <span>{paidPct}% Collected</span>
                  <span>{remainingBalance > 0 ? `₹${remainingBalance.toLocaleString("en-IN")} Pending` : "Fully Settled"}</span>
                </div>
              </div>

              {/* Training & Faculty Specs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-2.5">
                  <h4 className="font-black text-slate-800 uppercase text-[11px] tracking-wider text-indigo-700">
                    👨‍🏫 Faculty & Schedule
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Lead Faculty:</span>
                      <span className="font-extrabold text-slate-800">{training.faculty}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Start Date:</span>
                      <span className="font-extrabold text-indigo-600">{formatDate(training.startDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">End Date:</span>
                      <span className="font-extrabold text-indigo-600">{formatDate(training.endDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Duration:</span>
                      <span className="font-bold text-slate-700">{training.durationHours || "Standard Program"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Training Mode:</span>
                      <span className="font-bold text-slate-700">{training.trainingMode || "Offline"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Participants:</span>
                      <span className="font-bold text-slate-700">{training.numberOfParticipants || 1} Attendees</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Location / Venue:</span>
                      <span className="font-bold text-slate-700">{training.location || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs space-y-2.5">
                  <h4 className="font-black text-slate-800 uppercase text-[11px] tracking-wider text-purple-700">
                    🏢 Client & Assignment
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Client Company:</span>
                      <span className="font-extrabold text-slate-800">{training.companyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Contact Person:</span>
                      <span className="font-bold text-slate-700">{training.contactPerson || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Phone / Mobile:</span>
                      <span className="font-bold text-slate-700">{training.contactPhone || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Email:</span>
                      <span className="font-bold text-slate-700">{training.contactEmail || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Brand Scope:</span>
                      <span className="font-extrabold text-indigo-700">{training.brand}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Billing Entity:</span>
                      <span className="font-bold text-slate-700">{training.companyAssigned}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-semibold">Sales Executive:</span>
                      <span className="font-bold text-slate-700">{training.salesExecutive || "Direct"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PAYMENTS */}
          {activeTab === "payments" && (
            <div className="space-y-6">
              {/* Record New Payment Box */}
              {remainingBalance > 0 && (
                <form onSubmit={handleRecordPayment} className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                    <span>💵</span> Record Additional Installment
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Amount (INR) *</label>
                      <input
                        type="number"
                        min={1}
                        max={remainingBalance}
                        required
                        placeholder={`Max ₹${remainingBalance}`}
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Payment Date</label>
                      <input
                        type="date"
                        value={newPayment.date}
                        onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Payment Mode</label>
                      <select
                        value={newPayment.paymentMode}
                        onChange={(e) => setNewPayment({ ...newPayment, paymentMode: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                      >
                        <option value="Bank Transfer / NEFT">Bank Transfer / NEFT</option>
                        <option value="Cheque">Cheque</option>
                        <option value="UPI">UPI / QR</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? "Recording..." : "Record Payment"}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Payment History Table */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-extrabold text-xs text-slate-700 flex justify-between items-center">
                  <span>Payment Receipts & Installments</span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {training.paymentHistory?.length || 0} Total Records
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase">
                        <th className="py-2.5 px-4">Receipt No</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Mode</th>
                        <th className="py-2.5 px-3">Recorded By</th>
                        <th className="py-2.5 px-4">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {training.paymentHistory && training.paymentHistory.length > 0 ? (
                        training.paymentHistory.map((p: any, idx: number) => (
                          <tr key={p._id || idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4 font-extrabold text-indigo-600">{p.receiptNo || `REC-${idx + 1}`}</td>
                            <td className="py-2.5 px-3">{formatDate(p.date)}</td>
                            <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                              ₹{(Number(p.amount) || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-600">{p.paymentMode || "Bank"}</td>
                            <td className="py-2.5 px-3 text-slate-500">{p.recordedBy || "-"}</td>
                            <td className="py-2.5 px-4 text-slate-500 truncate max-w-[150px]">{p.remarks || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                            No payment receipts recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: EDIT DETAILS */}
          {activeTab === "edit" && (
            <form onSubmit={handleUpdateDetails} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Client Company Name</label>
                  <input
                    type="text"
                    value={editData.companyName || ""}
                    onChange={(e) => setEditData({ ...editData, companyName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Training Program Title</label>
                  <input
                    type="text"
                    value={editData.trainingProgram || ""}
                    onChange={(e) => setEditData({ ...editData, trainingProgram: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Lead Faculty / Trainer</label>
                  <input
                    type="text"
                    value={editData.faculty || ""}
                    onChange={(e) => setEditData({ ...editData, faculty: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Training Status</label>
                  <select
                    value={editData.status || "Scheduled"}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Payment Pending">Payment Pending</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Faculty Start Date</label>
                  <input
                    type="date"
                    value={editData.startDate || ""}
                    onChange={(e) => setEditData({ ...editData, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Faculty End Date</label>
                  <input
                    type="date"
                    value={editData.endDate || ""}
                    onChange={(e) => setEditData({ ...editData, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Total Agreed Commercials (INR)</label>
                  <input
                    type="number"
                    value={editData.totalAmount || 0}
                    onChange={(e) => setEditData({ ...editData, totalAmount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Location / Venue</label>
                  <input
                    type="text"
                    value={editData.location || ""}
                    onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Saving Updates..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
