"use client";

import React, { useState } from "react";

interface DeletePaymentConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
  student: any;
  allPayments?: any[];
  onConfirmDelete: (paymentId: string) => Promise<void>;
}

export default function DeletePaymentConfirmModal({
  isOpen,
  onClose,
  payment,
  student,
  allPayments = [],
  onConfirmDelete,
}: DeletePaymentConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !payment || !student) return null;

  const paymentAmount = Number(payment.amountReceived) || 0;
  const totalAgreedFee = Number(student.finalFee || student.courseFee || 0);

  // Current Total Collected from all verified payments
  const currentTotalCollected = allPayments.length > 0
    ? allPayments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0)
    : (totalAgreedFee - (Number(student.remainingBalance) || 0));

  const newTotalCollected = Math.max(0, currentTotalCollected - paymentAmount);
  const currentRemainingBalance = Number(student.remainingBalance) || 0;
  const newRemainingBalance = totalAgreedFee > 0
    ? Math.max(0, totalAgreedFee - newTotalCollected)
    : Math.max(0, currentRemainingBalance + paymentAmount);

  const currentProgressPercent = totalAgreedFee > 0
    ? Math.min(100, Math.round((currentTotalCollected / totalAgreedFee) * 100))
    : 0;

  const newProgressPercent = totalAgreedFee > 0
    ? Math.min(100, Math.round((newTotalCollected / totalAgreedFee) * 100))
    : 0;

  const targetCompany = (payment.company || student.companyAssigned || student.company || "Not Assigned").trim();
  const isValidCompany = targetCompany && targetCompany !== "Cash" && targetCompany !== "Unallocated" && targetCompany !== "Cash (Unallocated)" && targetCompany !== "Not Assigned";

  const paymentDateStr = payment.paymentDate || payment.createdAt
    ? new Date(payment.paymentDate || payment.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "N/A";

  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await onConfirmDelete(payment._id);
      onClose();
    } catch (err: any) {
      console.error("Error confirming payment delete:", err);
      setErrorMessage(err.message || "Failed to delete payment transaction. Please try again.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header Warning Bar */}
        <div className="bg-rose-50 border-b border-rose-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center text-lg font-black shadow-md shadow-rose-600/30 shrink-0">
              ⚠️
            </div>
            <div>
              <h2 className="text-base font-black text-rose-950">
                Confirm Payment Deletion
              </h2>
              <p className="text-xs text-rose-700 font-semibold">
                Permanent transaction removal & multi-ledger reversal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="w-8 h-8 rounded-full bg-rose-100/80 hover:bg-rose-200 text-rose-800 flex items-center justify-center text-sm font-black transition-colors cursor-pointer disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Content Body with Impact Breakdown */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          
          {/* Target Payment Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                Target Payment
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 font-mono font-black text-xs">
                {payment.receiptNo || "REC-N/A"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-extrabold text-slate-900">{student.fullName}</p>
                <p className="text-[11px] text-slate-500 font-bold">
                  {student.admissionId} • Mode: <span className="uppercase text-slate-800">{payment.paymentMode || "Cash"}</span> • Date: {paymentDateStr}
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-rose-600">
                  ₹{paymentAmount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Where Changes Will Reflect */}
          <div>
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span>📍</span>
              <span>Where this deletion will reflect:</span>
            </h4>

            <div className="space-y-3">
              
              {/* 1. Student 360 Financials Impact */}
              <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-indigo-950 flex items-center gap-1">
                    👤 Student Profile Balance & Progress
                  </span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                    Immediate Sync
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-indigo-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Collected</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-slate-400 line-through font-semibold text-[11px]">
                        ₹{currentTotalCollected.toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs font-black text-rose-600">
                        ➔ ₹{newTotalCollected.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded-lg border border-indigo-100">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Remaining Balance</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-slate-400 line-through font-semibold text-[11px]">
                        ₹{currentRemainingBalance.toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs font-black text-emerald-700">
                        ➔ ₹{newRemainingBalance.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-indigo-900 font-semibold">
                  Contract recovery progress will adjust from <strong className="text-indigo-950">{currentProgressPercent}%</strong> to <strong className="text-rose-700">{newProgressPercent}%</strong>.
                </p>
              </div>

              {/* 2. Company Collection Ledger Impact */}
              <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-emerald-950 flex items-center gap-1">
                    🏢 Company Collection Ledger ({targetCompany})
                  </span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    Cap Reversal
                  </span>
                </div>
                <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                  {isValidCompany ? (
                    <>
                      <strong>₹{paymentAmount.toLocaleString("en-IN")}</strong> will be automatically deducted from <strong>{targetCompany}</strong>&apos;s collected revenue, releasing blocked cap capacity back to the company quota.
                    </>
                  ) : (
                    <>
                      Amount was logged under <strong>{targetCompany}</strong>. Cash transaction log entries and company reports will be synchronized.
                    </>
                  )}
                </p>
              </div>

              {/* 3. Transaction History & Reports */}
              <div className="p-3.5 rounded-xl border border-amber-100 bg-amber-50/50 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-amber-950 flex items-center gap-1">
                    🧾 Ledger, EMI & BI Reports
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    Purged
                  </span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed font-medium">
                  Receipt <strong>{payment.receiptNo}</strong> will be permanently removed from all payment transaction lists, manager/counsellor finance dashboards, and daily BI collections. Any associated EMI installment will be reset to <em>Pending</em>.
                </p>
              </div>

            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-100 text-rose-800 text-xs font-bold rounded-xl border border-rose-200">
              {errorMessage}
            </div>
          )}

        </div>

        {/* Modal Action Buttons */}
        <div className="bg-slate-50 border-t border-slate-200/90 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-extrabold transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white text-xs font-black transition-all shadow-md shadow-rose-600/30 cursor-pointer active:scale-95 flex items-center gap-2 disabled:opacity-60"
          >
            {isDeleting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Deleting & Reversing...</span>
              </>
            ) : (
              <>
                <span>🗑️ Confirm & Delete Payment</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
