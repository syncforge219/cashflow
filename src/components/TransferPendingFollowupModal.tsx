"use client";

import React, { useState, useEffect, useMemo } from "react";

export interface TransferLeadItem {
  _id: string;
  enquiryId?: string;
  studentFullName?: string;
  primaryPhoneMobile?: string;
  targetCourse?: string;
  targetBrand?: string;
  assignedCrmAdvisor?: string;
  dueDateStr?: string;
  lastRemarkStr?: string;
}

interface TransferPendingFollowupModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeads?: TransferLeadItem[];
  allCounsellors: any[];
  allAdvisorsOnLeads?: string[];
  userBrandScope?: string;
  onSuccess: (targetAdvisor: string, count: number) => void;
}

export default function TransferPendingFollowupModal({
  isOpen,
  onClose,
  selectedLeads = [],
  allCounsellors = [],
  allAdvisorsOnLeads = [],
  userBrandScope = "",
  onSuccess,
}: TransferPendingFollowupModalProps) {
  const [transferMode, setTransferMode] = useState<"selected" | "counsellor_pending" | "all_pending">(
    selectedLeads.length > 0 ? "selected" : "all_pending"
  );
  const [sourceCounsellor, setSourceCounsellor] = useState("");
  const [targetCounsellor, setTargetCounsellor] = useState("");
  const [transferRemarks, setTransferRemarks] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [shouldReschedule, setShouldReschedule] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Parse brand scopes helper
  const parseBrands = (scopeStr: string) => {
    if (!scopeStr) return [];
    return String(scopeStr)
      .split(/[,/|]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  };

  const userBrands = useMemo(() => parseBrands(userBrandScope), [userBrandScope]);
  const isGlobalUser = useMemo(
    () => !userBrandScope || userBrands.some((b) => ["all", "all brands", "global", "*"].includes(b)),
    [userBrandScope, userBrands]
  );

  // Filter counsellors belonging to Centre Head's brand
  const eligibleCounsellors = useMemo(() => {
    return allCounsellors.filter((c: any) => {
      if (isGlobalUser) return true;
      const cBrands = parseBrands(c.brandScope || c.scope || "");
      if (cBrands.some((b) => ["all", "all brands", "global", "*"].includes(b))) return true;
      return userBrands.some((ub) => cBrands.includes(ub) || cBrands.some((cb) => cb.includes(ub) || ub.includes(cb)));
    });
  }, [allCounsellors, userBrands, isGlobalUser]);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccessMsg("");
      setIsLoading(false);
      setTransferRemarks("");
      setRescheduleDate("");
      setShouldReschedule(false);

      if (selectedLeads.length > 0) {
        setTransferMode("selected");
      } else {
        setTransferMode("all_pending");
      }

      if (eligibleCounsellors.length > 0) {
        setTargetCounsellor(eligibleCounsellors[0]?.name || "");
      } else {
        setTargetCounsellor("");
      }

      if (allAdvisorsOnLeads.length > 0) {
        setSourceCounsellor(allAdvisorsOnLeads[0]);
      }
    }
  }, [isOpen, selectedLeads, eligibleCounsellors, allAdvisorsOnLeads]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!targetCounsellor) {
      setError("Please select a target counsellor/employee from the dropdown.");
      return;
    }

    if (transferMode === "selected" && selectedLeads.length === 0) {
      setError("No pending leads are selected to transfer.");
      return;
    }

    if (transferMode === "counsellor_pending" && !sourceCounsellor) {
      setError("Please select a source counsellor whose pending leads will be transferred.");
      return;
    }

    if (transferMode === "counsellor_pending" && sourceCounsellor.toLowerCase() === targetCounsellor.toLowerCase()) {
      setError("Source and target counsellor cannot be the same person.");
      return;
    }

    setIsLoading(true);

    try {
      const selectedUserObj = eligibleCounsellors.find(
        (c) => (c.name || "").toLowerCase() === targetCounsellor.toLowerCase()
      );

      const payload = {
        enquiryIds: transferMode === "selected" ? selectedLeads.map((l) => l._id) : [],
        targetAdvisor: targetCounsellor,
        targetAdvisorId: selectedUserObj?._id || selectedUserObj?.id,
        sourceAdvisor: transferMode === "counsellor_pending" ? sourceCounsellor : undefined,
        transferScope: transferMode,
        transferRemarks: transferRemarks.trim() || undefined,
        rescheduleDate: shouldReschedule && rescheduleDate ? rescheduleDate : undefined,
        brandScope: userBrandScope && !isGlobalUser ? userBrandScope : undefined,
      };

      const res = await fetch("/api/enquiries/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMsg(data.message || `Successfully transferred followups to ${targetCounsellor}!`);
        setTimeout(() => {
          onSuccess(targetCounsellor, data.transferredCount || selectedLeads.length);
          onClose();
        }, 1000);
      } else {
        setError(data.error || "Failed to transfer pending follow-ups.");
      }
    } catch (err: any) {
      console.error("Transfer submission error:", err);
      setError("An unexpected error occurred while transferring follow-ups.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-rose-50/80 via-indigo-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-100 text-rose-600 rounded-2xl border border-rose-200/80 shadow-xs">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight">Transfer Pending Follow-ups</h3>
                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
                  Centre Head Action
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Reassign pending leads & follow-up calls to counsellors of your branch
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
              <span>✓</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Transfer Scope Mode Pill / Selector */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider">
              Transfer Scope
            </label>
            <div className="grid grid-cols-3 gap-2">
              {selectedLeads.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTransferMode("selected")}
                  className={`p-2.5 rounded-xl border text-xs font-extrabold transition-all text-center cursor-pointer ${
                    transferMode === "selected"
                      ? "bg-rose-50 border-rose-400 text-rose-700 shadow-xs ring-1 ring-rose-400/40"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Selected</span>
                  <span className="block truncate">{selectedLeads.length} Lead(s)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setTransferMode("counsellor_pending")}
                className={`p-2.5 rounded-xl border text-xs font-extrabold transition-all text-center cursor-pointer ${
                  transferMode === "counsellor_pending"
                    ? "bg-rose-50 border-rose-400 text-rose-700 shadow-xs ring-1 ring-rose-400/40"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="block text-[10px] uppercase font-bold text-slate-400">By Advisor</span>
                <span className="block truncate">From Counsellor</span>
              </button>

              <button
                type="button"
                onClick={() => setTransferMode("all_pending")}
                className={`p-2.5 rounded-xl border text-xs font-extrabold transition-all text-center cursor-pointer ${
                  transferMode === "all_pending"
                    ? "bg-rose-50 border-rose-400 text-rose-700 shadow-xs ring-1 ring-rose-400/40"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="block text-[10px] uppercase font-bold text-slate-400">Bulk All</span>
                <span className="block truncate">All Pending</span>
              </button>
            </div>
          </div>

          {/* Mode 1: Selected Leads Preview List */}
          {transferMode === "selected" && selectedLeads.length > 0 && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-700">
                  {selectedLeads.length} Selected Lead{selectedLeads.length > 1 ? "s" : ""} to Reassign:
                </span>
                <span className="text-[10px] font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Pending Status
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto divide-y divide-slate-200/60 pr-1">
                {selectedLeads.map((lead) => (
                  <div key={lead._id} className="py-1.5 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <span className="font-bold text-slate-900 block truncate">
                        {lead.studentFullName || "Unnamed Student"}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {lead.enquiryId} • {lead.targetCourse || "Course"} • {lead.primaryPhoneMobile}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                      Currently: {lead.assignedCrmAdvisor || "Unassigned"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode 2: Source Counsellor Dropdown */}
          {transferMode === "counsellor_pending" && (
            <div className="space-y-1.5 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200">
              <label className="block text-xs font-black text-amber-900 uppercase tracking-wider">
                Source Counsellor (Transfer From) *
              </label>
              <select
                value={sourceCounsellor}
                onChange={(e) => setSourceCounsellor(e.target.value)}
                required
                className="w-full text-xs font-bold text-slate-800 bg-white border border-amber-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 cursor-pointer"
              >
                <option value="">-- Select Current Counsellor --</option>
                {allAdvisorsOnLeads.map((adv) => (
                  <option key={adv} value={adv}>
                    {adv} (All Pending Followups)
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-amber-700 font-medium">
                All uncompleted and pending follow-ups currently handled by this advisor will be reassigned.
              </p>
            </div>
          )}

          {/* TARGET COUNSELLOR SELECTION DROPDOWN */}
          <div className="space-y-1.5 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-indigo-950 uppercase tracking-wider">
                Target Counsellor (Transfer To) *
              </label>
              <span className="text-[10px] font-bold text-indigo-600 bg-white border border-indigo-200 px-2 py-0.5 rounded-md">
                Brand: {userBrandScope || "All Branches"}
              </span>
            </div>

            {eligibleCounsellors.length === 0 ? (
              <div className="p-3 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl">
                ⚠️ No counsellors found matching brand &ldquo;{userBrandScope}&rdquo;. Please verify counsellor brand settings in Staff management.
              </div>
            ) : (
              <select
                value={targetCounsellor}
                onChange={(e) => setTargetCounsellor(e.target.value)}
                required
                className="w-full text-xs font-bold text-slate-900 bg-white border border-indigo-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 cursor-pointer shadow-xs"
              >
                <option value="">-- Select Counsellor / Employee --</option>
                {eligibleCounsellors.map((c) => (
                  <option key={c._id || c.id || c.email} value={c.name}>
                    {c.name} {c.role ? `(${c.role})` : ""} - {c.brandScope || "All Brands"} [{c.email}]
                  </option>
                ))}
              </select>
            )}
            <p className="text-[10px] text-indigo-700/80 font-medium">
              The selected counsellor will immediately see these leads in their pending follow-up dashboard.
            </p>
          </div>

          {/* Optional Reschedule Date */}
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shouldReschedule}
                onChange={(e) => setShouldReschedule(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-xs font-extrabold text-slate-700">
                Reschedule Follow-up Due Date for New Counsellor
              </span>
            </label>

            {shouldReschedule && (
              <div className="pl-6 animate-in fade-in duration-150">
                <input
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            )}
          </div>

          {/* Optional Transfer Remarks */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              Transfer Reason / Special Instructions (Optional)
            </label>
            <textarea
              value={transferRemarks}
              onChange={(e) => setTransferRemarks(e.target.value)}
              placeholder="e.g. Assigned by Centre Head for urgent callback; student interested in AutoCAD evening batch."
              rows={2}
              className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all resize-none shadow-xs"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-extrabold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || eligibleCounsellors.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-rose-600 via-indigo-600 to-violet-600 hover:from-rose-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
            >
              {isLoading && (
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <span>Confirm & Transfer Leads</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
