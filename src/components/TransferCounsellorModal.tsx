"use client";

import React, { useState, useEffect, useMemo } from "react";

interface TransferCounsellorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceCounsellor: any | null;
  allCounsellors: any[];
  onSuccess: () => void;
}

export default function TransferCounsellorModal({
  isOpen,
  onClose,
  sourceCounsellor,
  allCounsellors,
  onSuccess,
}: TransferCounsellorModalProps) {
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [transferEnquiries, setTransferEnquiries] = useState(true);
  const [transferAdmissions, setTransferAdmissions] = useState(true);
  const [transferTasks, setTransferTasks] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Parse brand scopes
  const parseBrands = (scopeStr: string) => {
    if (!scopeStr) return [];
    return String(scopeStr)
      .split(/[,/|]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  };

  const sourceBrands = useMemo(() => {
    return parseBrands(sourceCounsellor?.scope || sourceCounsellor?.brandScope);
  }, [sourceCounsellor]);

  // Filter target counsellors belonging to the same brand scope
  const eligibleTargetCounsellors = useMemo(() => {
    if (!sourceCounsellor) return [];

    const isGlobal = (brands: string[]) =>
      brands.some((b) => ["all", "all brands", "global", "*"].includes(b));

    return allCounsellors.filter((c) => {
      if (c.id === sourceCounsellor.id) return false;

      const targetBrands = parseBrands(c.scope || c.brandScope);
      if (isGlobal(sourceBrands) || isGlobal(targetBrands)) return true;

      return sourceBrands.some((sb) => targetBrands.includes(sb));
    });
  }, [sourceCounsellor, allCounsellors, sourceBrands]);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccessMsg("");
      setIsLoading(false);
      setSelectedTargetId(eligibleTargetCounsellors[0]?.id || "");
    }
  }, [isOpen, eligibleTargetCounsellors]);

  if (!isOpen || !sourceCounsellor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!selectedTargetId) {
      setError("Please select a target counsellor to receive data.");
      return;
    }

    if (!transferEnquiries && !transferAdmissions && !transferTasks) {
      setError("Please select at least one type of data to transfer.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/counsellors/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCounsellorId: sourceCounsellor.id,
          toCounsellorId: selectedTargetId,
          transferEnquiries,
          transferAdmissions,
          transferTasks,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(
          `Data transferred successfully! (${data.transferred.enquiries} Enquiries, ${data.transferred.admissions} Admissions, ${data.transferred.tasks} Tasks)`
        );
        setTimeout(() => {
          onSuccess();
        }, 1200);
      } else {
        setError(data.error || "Failed to transfer counsellor data.");
      }
    } catch (err: any) {
      console.error("Error submitting data transfer:", err);
      setError("An unexpected error occurred while transferring data.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs font-sans">
      <div className="relative w-full max-w-lg overflow-hidden bg-white rounded-2xl shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Transfer Counsellor Data</h3>
              <p className="text-xs text-slate-400">Reassign leads, admissions, & tasks within brand</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
              {successMsg}
            </div>
          )}

          {/* Source Counsellor Info Card */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Source Counsellor (Transfer From)
            </span>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-extrabold text-slate-800 block">
                  {sourceCounsellor.name}
                </span>
                <span className="text-xs text-slate-500 font-medium block">
                  {sourceCounsellor.email}
                </span>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-0.5 font-mono">
                {sourceCounsellor.scope}
              </span>
            </div>
          </div>

          {/* Target Counsellor Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Target Counsellor (Transfer To within {sourceCounsellor.scope}) *
            </label>

            {eligibleTargetCounsellors.length === 0 ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold">
                ⚠️ No other counsellors found assigned to brand "{sourceCounsellor.scope}". Register another counsellor in this brand before transferring data.
              </div>
            ) : (
              <select
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                required
                className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {eligibleTargetCounsellors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email}) - {c.scope}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Data Checkboxes */}
          <div className="space-y-2.5 pt-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Select Data Items to Transfer
            </label>

            <div className="grid grid-cols-1 gap-2">
              <label className="flex items-center gap-2.5 p-2.5 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={transferEnquiries}
                  onChange={(e) => setTransferEnquiries(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Assigned Enquiries & Leads
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Reassign all active and historical leads to target counsellor
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={transferAdmissions}
                  onChange={(e) => setTransferAdmissions(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Converted Admissions & Seats
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Reassign student enrollment entries & fee tracking credit
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={transferTasks}
                  onChange={(e) => setTransferTasks(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Assigned Follow-ups & Tasks
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Reassign pending calls, demos, and action items
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isLoading || eligibleTargetCounsellors.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-indigo-600/10 transition-all"
            >
              {isLoading && (
                <svg
                  className="animate-spin h-3.5 w-3.5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
              Transfer Data
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
