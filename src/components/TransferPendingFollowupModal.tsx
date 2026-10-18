"use client";

import { todayKey } from "@/lib/dates";
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
  allPendingLeads?: TransferLeadItem[];
  allCounsellors: any[];
  allAdvisorsOnLeads?: string[];
  userBrandScope?: string;
  initialMode?: "single_lead" | "course_wise" | "selected" | "counsellor_pending" | "all_pending";
  initialCourse?: string;
  onSuccess: (targetAdvisor: string, count: number) => void;
}

export default function TransferPendingFollowupModal({
  isOpen,
  onClose,
  selectedLeads = [],
  allPendingLeads = [],
  allCounsellors = [],
  allAdvisorsOnLeads = [],
  userBrandScope = "",
  initialMode,
  initialCourse = "",
  onSuccess,
}: TransferPendingFollowupModalProps) {
  const [transferMode, setTransferMode] = useState<"single_lead" | "course_wise" | "selected" | "counsellor_pending" | "all_pending">("single_lead");
  const [sourceCounsellor, setSourceCounsellor] = useState("");
  const [targetCounsellor, setTargetCounsellor] = useState("");
  const [targetSelectionMode, setTargetSelectionMode] = useState<"single" | "multiple">("single");
  const [selectedTargetCounsellors, setSelectedTargetCounsellors] = useState<string[]>([]);
  const [counsellorSearch, setCounsellorSearch] = useState("");
  const [distributionPercent, setDistributionPercent] = useState<number>(50);
  const [transferRemarks, setTransferRemarks] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [shouldReschedule, setShouldReschedule] = useState(false);
  const [filterCourse, setFilterCourse] = useState<string>("All");

  // Course-Wise transfer states
  const [selectedCourseForTransfer, setSelectedCourseForTransfer] = useState<string>(initialCourse || "");
  const [sourceCounsellorForCourse, setSourceCounsellorForCourse] = useState<string>("All");

  // Single Lead (One by One) states
  const [singleLeadToTransfer, setSingleLeadToTransfer] = useState<TransferLeadItem | null>(null);
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [fetchedLeads, setFetchedLeads] = useState<TransferLeadItem[]>([]);

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

  // Combined pool of available pending leads strictly isolated by brand scope
  const availableLeadsPool = useMemo(() => {
    let rawPool: TransferLeadItem[] = [];
    if (allPendingLeads && allPendingLeads.length > 0) rawPool = allPendingLeads;
    else if (fetchedLeads && fetchedLeads.length > 0) rawPool = fetchedLeads;
    else if (selectedLeads && selectedLeads.length > 0) rawPool = selectedLeads;

    if (isGlobalUser) return rawPool;
    return rawPool.filter((lead) => {
      const bLower = (lead.targetBrand || "").toLowerCase().trim();
      return userBrands.some((ub) => bLower === ub || bLower.includes(ub) || ub.includes(bLower));
    });
  }, [allPendingLeads, fetchedLeads, selectedLeads, isGlobalUser, userBrands]);

  // Fetch leads pool if not provided via props
  useEffect(() => {
    if (isOpen && allPendingLeads.length === 0 && fetchedLeads.length === 0) {
      const brandParam = !isGlobalUser && userBrands.length === 1 ? `?brand=${encodeURIComponent(userBrandScope)}` : "";
      fetch(`/api/enquiries${brandParam}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            const mapped: TransferLeadItem[] = data.data
              .filter((e: any) => {
                const s = (e.status || "").toLowerCase();
                if (e.isAdmitted || s.includes("admitted") || s.includes("admission") || s.includes("converted") || s.includes("lost") || s.includes("do not") || s.includes("completed")) return false;
                if (isGlobalUser) return true;
                const bLower = (e.targetBrand || e.brand || "").toLowerCase().trim();
                return userBrands.some((ub) => bLower === ub || bLower.includes(ub) || ub.includes(bLower));
              })
              .map((e: any) => ({
                _id: e._id,
                enquiryId: e.enquiryId || e.admissionId,
                studentFullName: e.studentFullName || e.fullName || "Student",
                primaryPhoneMobile: e.primaryPhoneMobile || e.mobileNumber || "",
                targetCourse: e.targetCourse || e.course || "",
                targetBrand: e.targetBrand || e.brand || "",
                assignedCrmAdvisor: e.assignedCrmAdvisor || "Unassigned",
                dueDateStr: e.followUps?.[e.followUps.length - 1]?.date || "Pending",
                lastRemarkStr: e.followUps?.[e.followUps.length - 1]?.remarks || e.remarks || "",
              }));
            setFetchedLeads(mapped);
          }
        })
        .catch((err) => console.error("Error fetching leads for transfer modal:", err));
    }
  }, [isOpen, allPendingLeads, fetchedLeads.length, isGlobalUser, userBrands, userBrandScope]);

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setError("");
      setSuccessMsg("");
      setIsLoading(false);
      setTransferRemarks("");
      setRescheduleDate("");
      setShouldReschedule(false);
      setLeadSearchQuery("");
      setFilterCourse("All");
      setSourceCounsellorForCourse("All");

      if (initialCourse) {
        setSelectedCourseForTransfer(initialCourse);
      } else if (allPendingCourses.length > 0) {
        setSelectedCourseForTransfer(allPendingCourses[0].name);
      }

      if (initialMode) {
        setTransferMode(initialMode);
        if (initialMode === "single_lead") {
          setSingleLeadToTransfer(selectedLeads[0] || allPendingLeads[0] || null);
        } else {
          setSingleLeadToTransfer(null);
        }
      } else if (selectedLeads.length === 1) {
        setTransferMode("single_lead");
        setSingleLeadToTransfer(selectedLeads[0]);
      } else if (selectedLeads.length > 1) {
        setTransferMode("selected");
        setSingleLeadToTransfer(null);
      } else {
        setTransferMode("single_lead");
        setSingleLeadToTransfer(allPendingLeads[0] || null);
      }

      if (eligibleCounsellors.length > 0) {
        setTargetCounsellor(eligibleCounsellors[0]?.name || "");
      } else {
        setTargetCounsellor("");
      }

      setTargetSelectionMode("single");
      setSelectedTargetCounsellors([]);
      setCounsellorSearch("");
      setDistributionPercent(50);

      if (allAdvisorsOnLeads.length > 0) {
        setSourceCounsellor(allAdvisorsOnLeads[0]);
      }
    }
  }, [isOpen, selectedLeads, allPendingLeads, eligibleCounsellors, allAdvisorsOnLeads, initialMode, initialCourse]);

  // Filtered leads for One by One search
  const filteredSearchLeads = useMemo(() => {
    const q = leadSearchQuery.trim().toLowerCase();
    if (!q) return availableLeadsPool;
    return availableLeadsPool.filter(
      (l) =>
        (l.studentFullName || "").toLowerCase().includes(q) ||
        (l.primaryPhoneMobile || "").toLowerCase().includes(q) ||
        (l.enquiryId || "").toLowerCase().includes(q) ||
        (l.targetCourse || "").toLowerCase().includes(q) ||
        (l.assignedCrmAdvisor || "").toLowerCase().includes(q)
    );
  }, [availableLeadsPool, leadSearchQuery]);

  // Count leads for the chosen source counsellor
  const sourceAdvisorPendingCount = useMemo(() => {
    if (!sourceCounsellor) return 0;
    return availableLeadsPool.filter(
      (l) => (l.assignedCrmAdvisor || "").toLowerCase() === sourceCounsellor.toLowerCase()
    ).length;
  }, [availableLeadsPool, sourceCounsellor]);

  // Source counsellor's specific pending leads
  const sourceAdvisorPendingLeads = useMemo(() => {
    if (!sourceCounsellor) return [];
    const s = sourceCounsellor.trim().toLowerCase();
    return availableLeadsPool.filter(
      (l) => (l.assignedCrmAdvisor || "").trim().toLowerCase() === s
    );
  }, [availableLeadsPool, sourceCounsellor]);

  // Unique courses with lead counts for the selected source counsellor
  const sourceCounsellorCourses = useMemo(() => {
    const map = new Map<string, number>();
    sourceAdvisorPendingLeads.forEach((l) => {
      const raw = l.targetCourse || "General Course";
      raw.split(",").forEach((c) => {
        const clean = c.trim();
        if (clean) map.set(clean, (map.get(clean) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [sourceAdvisorPendingLeads]);

  // Unique courses with lead counts across all pending leads
  const allPendingCourses = useMemo(() => {
    const map = new Map<string, number>();
    availableLeadsPool.forEach((l) => {
      const raw = l.targetCourse || "General Course";
      raw.split(",").forEach((c) => {
        const clean = c.trim();
        if (clean) map.set(clean, (map.get(clean) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [availableLeadsPool]);

  // Count of leads matching the course filter in counsellor_pending mode
  const matchingCourseCountForSource = useMemo(() => {
    if (filterCourse === "All") return sourceAdvisorPendingLeads.length;
    const fc = filterCourse.trim().toLowerCase();
    return sourceAdvisorPendingLeads.filter((l) =>
      (l.targetCourse || "").toLowerCase().includes(fc)
    ).length;
  }, [sourceAdvisorPendingLeads, filterCourse]);

  // Count of leads matching the course filter in all_pending mode
  const matchingCourseCountForAll = useMemo(() => {
    if (filterCourse === "All") return availableLeadsPool.length;
    const fc = filterCourse.trim().toLowerCase();
    return availableLeadsPool.filter((l) =>
      (l.targetCourse || "").toLowerCase().includes(fc)
    ).length;
  }, [availableLeadsPool, filterCourse]);

  // Matching leads for dedicated Course-Wise transfer
  const matchingCourseWiseLeads = useMemo(() => {
    if (!selectedCourseForTransfer) return [];
    const cLower = selectedCourseForTransfer.trim().toLowerCase();
    return availableLeadsPool.filter((l) => {
      const courseMatches = (l.targetCourse || "").toLowerCase().includes(cLower);
      if (!courseMatches) return false;
      if (sourceCounsellorForCourse && sourceCounsellorForCourse !== "All") {
        return (l.assignedCrmAdvisor || "").trim().toLowerCase() === sourceCounsellorForCourse.trim().toLowerCase();
      }
      return true;
    });
  }, [availableLeadsPool, selectedCourseForTransfer, sourceCounsellorForCourse]);

  // Counsellors who currently hold leads for the selected course
  const counsellorsWithSelectedCourse = useMemo(() => {
    if (!selectedCourseForTransfer) return [];
    const cLower = selectedCourseForTransfer.trim().toLowerCase();
    const map = new Map<string, number>();
    availableLeadsPool.forEach((l) => {
      if ((l.targetCourse || "").toLowerCase().includes(cLower)) {
        const adv = l.assignedCrmAdvisor ? l.assignedCrmAdvisor.trim() : "Unassigned";
        map.set(adv, (map.get(adv) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [availableLeadsPool, selectedCourseForTransfer]);

  // Filter counsellors by search query for multi-select
  const filteredTargetCounsellors = useMemo(() => {
    const q = counsellorSearch.trim().toLowerCase();
    if (!q) return eligibleCounsellors;
    return eligibleCounsellors.filter(
      (c: any) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.role || "").toLowerCase().includes(q) ||
        (c.brandScope || "").toLowerCase().includes(q)
    );
  }, [eligibleCounsellors, counsellorSearch]);

  // Total eligible leads for the active transfer mode
  const totalEligibleLeadsCount = useMemo(() => {
    if (transferMode === "single_lead") return singleLeadToTransfer ? 1 : 0;
    if (transferMode === "course_wise") return matchingCourseWiseLeads.length;
    if (transferMode === "counsellor_pending") return matchingCourseCountForSource;
    if (transferMode === "all_pending") return matchingCourseCountForAll;
    if (transferMode === "selected") return selectedLeads.length;
    return 0;
  }, [
    transferMode,
    singleLeadToTransfer,
    matchingCourseWiseLeads.length,
    matchingCourseCountForSource,
    matchingCourseCountForAll,
    selectedLeads.length,
  ]);

  // Number of leads to actually transfer based on distribution percentage
  const leadsToTransferCount = useMemo(() => {
    if (transferMode === "single_lead") return 1;
    if (totalEligibleLeadsCount === 0) return 0;
    if (distributionPercent >= 100) return totalEligibleLeadsCount;
    return Math.max(1, Math.min(totalEligibleLeadsCount, Math.round(totalEligibleLeadsCount * (distributionPercent / 100))));
  }, [transferMode, totalEligibleLeadsCount, distributionPercent]);

  // Number of leads remaining with their current counsellor
  const leadsRemainingCount = useMemo(() => {
    return Math.max(0, totalEligibleLeadsCount - leadsToTransferCount);
  }, [totalEligibleLeadsCount, leadsToTransferCount]);

  // Leads distribution allocation map across selected target counsellors
  const counsellorAllocationMap = useMemo(() => {
    const map = new Map<string, number>();
    if (targetSelectionMode === "single") {
      if (targetCounsellor) map.set(targetCounsellor, leadsToTransferCount);
      return map;
    }
    if (selectedTargetCounsellors.length === 0) return map;

    selectedTargetCounsellors.forEach((name) => map.set(name, 0));

    for (let i = 0; i < leadsToTransferCount; i++) {
      const targetName = selectedTargetCounsellors[i % selectedTargetCounsellors.length];
      map.set(targetName, (map.get(targetName) || 0) + 1);
    }
    return map;
  }, [targetSelectionMode, targetCounsellor, selectedTargetCounsellors, leadsToTransferCount]);

  const handleToggleTargetCounsellor = (cName: string) => {
    setSelectedTargetCounsellors((prev) => {
      if (prev.includes(cName)) {
        return prev.filter((n) => n !== cName);
      } else {
        return [...prev, cName];
      }
    });
  };

  const handleSelectAllCounsellors = () => {
    const allNames = filteredTargetCounsellors.map((c: any) => c.name).filter(Boolean);
    setSelectedTargetCounsellors(allNames);
  };

  const handleDeselectAllCounsellors = () => {
    setSelectedTargetCounsellors([]);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (targetSelectionMode === "single" && !targetCounsellor) {
      setError("Please select a target counsellor/employee from the dropdown.");
      return;
    }

    if (targetSelectionMode === "multiple" && selectedTargetCounsellors.length === 0) {
      setError("Please select at least one target counsellor to receive leads.");
      return;
    }

    if (transferMode === "single_lead" && !singleLeadToTransfer) {
      setError("Please search and select a student lead to transfer.");
      return;
    }

    if (transferMode === "course_wise") {
      if (!selectedCourseForTransfer) {
        setError("Please select a course to transfer follow-ups.");
        return;
      }
      if (matchingCourseWiseLeads.length === 0) {
        setError(`No pending follow-up leads found for course "${selectedCourseForTransfer}".`);
        return;
      }
    }

    if (transferMode === "selected" && selectedLeads.length === 0) {
      setError("No pending leads are selected to transfer.");
      return;
    }

    if (transferMode === "counsellor_pending" && !sourceCounsellor) {
      setError("Please select a source counsellor whose pending leads will be transferred.");
      return;
    }

    if (
      transferMode === "counsellor_pending" &&
      targetSelectionMode === "single" &&
      sourceCounsellor.toLowerCase() === targetCounsellor.toLowerCase()
    ) {
      setError("Source and target counsellor cannot be the same person.");
      return;
    }

    setIsLoading(true);

    try {
      const targetAdvisorsToSend =
        targetSelectionMode === "multiple"
          ? selectedTargetCounsellors.map((name) => {
              const u = eligibleCounsellors.find(
                (c: any) => (c.name || "").toLowerCase() === name.toLowerCase()
              );
              return { name, id: u?._id || u?.id };
            })
          : [
              {
                name: targetCounsellor,
                id: eligibleCounsellors.find(
                  (c: any) => (c.name || "").toLowerCase() === targetCounsellor.toLowerCase()
                )?._id,
              },
            ];

      const primaryTargetName =
        targetSelectionMode === "multiple"
          ? selectedTargetCounsellors.join(", ")
          : targetCounsellor;

      const leadsToTransferSlice =
        transferMode === "course_wise"
          ? matchingCourseWiseLeads.slice(0, leadsToTransferCount)
          : transferMode === "selected"
          ? selectedLeads.slice(0, leadsToTransferCount)
          : [];

      const enquiryIdsToSend =
        transferMode === "single_lead" && singleLeadToTransfer
          ? [singleLeadToTransfer._id]
          : leadsToTransferSlice.length > 0
          ? leadsToTransferSlice.map((l) => l._id)
          : [];

      const effectiveScope =
        transferMode === "single_lead" ? "selected" : transferMode;

      const payload = {
        enquiryIds: enquiryIdsToSend,
        targetAdvisor: primaryTargetName,
        targetAdvisorId: targetSelectionMode === "single" ? targetAdvisorsToSend[0]?.id : undefined,
        targetAdvisors: targetAdvisorsToSend,
        distributionPercent: transferMode === "single_lead" ? 100 : distributionPercent,
        sourceAdvisor:
          transferMode === "counsellor_pending"
            ? sourceCounsellor
            : transferMode === "course_wise" && sourceCounsellorForCourse !== "All"
            ? sourceCounsellorForCourse
            : undefined,
        transferScope: effectiveScope,
        transferRemarks: transferRemarks.trim() || undefined,
        rescheduleDate: shouldReschedule && rescheduleDate ? rescheduleDate : undefined,
        brandScope: userBrandScope && !isGlobalUser ? userBrandScope : undefined,
        course:
          transferMode === "course_wise"
            ? selectedCourseForTransfer
            : (transferMode === "counsellor_pending" || transferMode === "all_pending") && filterCourse !== "All"
            ? filterCourse
            : undefined,
      };

      const res = await fetch("/api/enquiries/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const count =
          transferMode === "single_lead"
            ? 1
            : data.transferredCount || leadsToTransferCount;

        const targetSummary =
          targetSelectionMode === "multiple" && selectedTargetCounsellors.length > 1
            ? `${selectedTargetCounsellors.length} counsellors (${selectedTargetCounsellors.join(", ")})`
            : targetCounsellor;

        const transferredName =
          transferMode === "single_lead" && singleLeadToTransfer
            ? `lead "${singleLeadToTransfer.studentFullName || "Student"}"`
            : transferMode === "course_wise"
            ? `${count} lead(s) for course "${selectedCourseForTransfer}"`
            : `${count} pending lead(s)`;

        setSuccessMsg(data.message || `Successfully transferred ${transferredName} to ${targetSummary}!`);

        setTimeout(() => {
          onSuccess(primaryTargetName, count);
          onClose();
        }, 1200);
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
      <div className="relative w-full max-w-2xl overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-rose-50/80 via-indigo-50/50 to-white shrink-0">
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
                Reassign leads one by one or in bulk to counsellors of your branch
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

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
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

          {/* Transfer Scope Mode Selector: ONE BY ONE vs BULK MODES */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider">
                Transfer Scope
              </label>
            </div>

            <div className={`grid ${selectedLeads.length > 1 ? "grid-cols-5" : "grid-cols-4"} gap-2`}>
              {/* Option 1: One by One */}
              <button
                type="button"
                onClick={() => setTransferMode("single_lead")}
                className={`p-2.5 rounded-xl border text-xs font-extrabold transition-all text-center cursor-pointer ${
                  transferMode === "single_lead"
                    ? "bg-rose-50 border-rose-400 text-rose-700 shadow-xs ring-1 ring-rose-400/40"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="block text-[10px] uppercase font-bold text-slate-400">One by One</span>
                <span className="block truncate">Single Lead</span>
              </button>

              {/* Option 2: By Course (Course Wise) */}
              <button
                type="button"
                onClick={() => {
                  setTransferMode("course_wise");
                  if (!selectedCourseForTransfer && allPendingCourses.length > 0) {
                    setSelectedCourseForTransfer(allPendingCourses[0].name);
                  }
                }}
                className={`p-2.5 rounded-xl border text-xs font-extrabold transition-all text-center cursor-pointer ${
                  transferMode === "course_wise"
                    ? "bg-indigo-50 border-indigo-400 text-indigo-700 shadow-xs ring-1 ring-indigo-400/40"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="block text-[10px] uppercase font-bold text-slate-400">By Course</span>
                <span className="block truncate">Course Wise</span>
              </button>

              {/* Option 3: Bulk By Advisor */}
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

              {/* Option 4: Bulk All Pending */}
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

              {/* Option 5: Bulk Selected from Table Checkboxes */}
              {selectedLeads.length > 1 && (
                <button
                  type="button"
                  onClick={() => setTransferMode("selected")}
                  className={`p-2.5 rounded-xl border text-xs font-extrabold transition-all text-center cursor-pointer ${
                    transferMode === "selected"
                      ? "bg-rose-50 border-rose-400 text-rose-700 shadow-xs ring-1 ring-rose-400/40"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Bulk Selected</span>
                  <span className="block truncate">{selectedLeads.length} Leads</span>
                </button>
              )}
            </div>
          </div>

          {/* MODE 1: ONE BY ONE LEAD SELECTOR */}
          {transferMode === "single_lead" && (
            <div className="space-y-3">
              {singleLeadToTransfer ? (
                /* Selected Lead Summary Card */
                <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900">
                          {singleLeadToTransfer.studentFullName || "Student"}
                        </h4>
                        {singleLeadToTransfer.enquiryId && (
                          <span className="text-[10px] font-mono font-bold bg-white text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded">
                            {singleLeadToTransfer.enquiryId}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-slate-600 font-semibold mt-1">
                        <span>📞 {singleLeadToTransfer.primaryPhoneMobile || "N/A"}</span>
                        <span>•</span>
                        <span>📚 {singleLeadToTransfer.targetCourse || "General Course"}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSingleLeadToTransfer(null)}
                      className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    >
                      Change Lead
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rose-200/60 text-[11px]">
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] block">Currently Handled By</span>
                      <span className="font-bold text-slate-800">👤 {singleLeadToTransfer.assignedCrmAdvisor || "Unassigned"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[9px] block">Next Follow-up Due</span>
                      <span className="font-bold text-rose-700">⏰ {singleLeadToTransfer.dueDateStr || "Pending Today"}</span>
                    </div>
                  </div>

                  {singleLeadToTransfer.lastRemarkStr && (
                    <div className="text-[11px] text-slate-600 bg-white/90 p-2 rounded-xl border border-rose-100 italic line-clamp-2">
                      &ldquo;{singleLeadToTransfer.lastRemarkStr}&rdquo;
                    </div>
                  )}
                </div>
              ) : (
                /* Searchable Lead Picker */
                <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Search & Select Lead to Transfer <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {filteredSearchLeads.length} available
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={leadSearchQuery}
                      onChange={(e) => setLeadSearchQuery(e.target.value)}
                      placeholder="Type student name, mobile number, enquiry ID, or course..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition-all bg-white"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-inner">
                    {filteredSearchLeads.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400 font-medium">
                        No pending leads found matching &quot;{leadSearchQuery}&quot;
                      </div>
                    ) : (
                      filteredSearchLeads.slice(0, 35).map((l) => (
                        <div
                          key={l._id}
                          onClick={() => setSingleLeadToTransfer(l)}
                          className="p-2.5 hover:bg-rose-50/70 transition-colors cursor-pointer flex items-center justify-between gap-2 text-xs group"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-800 group-hover:text-rose-700 truncate">
                                {l.studentFullName || "Student"}
                              </span>
                              {l.enquiryId && (
                                <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.5 rounded shrink-0">
                                  {l.enquiryId}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>📞 {l.primaryPhoneMobile}</span>
                              <span>•</span>
                              <span className="truncate">{l.targetCourse || "Course"}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-bold text-slate-600 block truncate max-w-[110px]">
                              👤 {l.assignedCrmAdvisor || "Unassigned"}
                            </span>
                            <span className="text-[9px] font-semibold text-rose-600">
                              {l.dueDateStr || "Due Today"}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: COURSE WISE LEAD TRANSFER */}
          {transferMode === "course_wise" && (
            <div className="space-y-3 bg-gradient-to-br from-indigo-50/70 via-indigo-50/40 to-white p-4 rounded-2xl border border-indigo-200/90 shadow-2xs animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-2xs">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <label className="block text-xs font-black text-indigo-950 uppercase tracking-wider">
                    Select Course to Transfer <span className="text-rose-500">*</span>
                  </label>
                </div>
                <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100/80 px-2 py-0.5 rounded border border-indigo-200">
                  {allPendingCourses.length} Courses with Pending Leads
                </span>
              </div>

              {allPendingCourses.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-indigo-200">
                  No courses with active pending leads found in this branch scope.
                </div>
              ) : (
                <select
                  value={selectedCourseForTransfer}
                  onChange={(e) => {
                    setSelectedCourseForTransfer(e.target.value);
                    setSourceCounsellorForCourse("All");
                  }}
                  required
                  className="w-full text-xs font-bold text-slate-900 bg-white border border-indigo-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 cursor-pointer shadow-2xs"
                >
                  <option value="">-- Choose Course to Reassign --</option>
                  {allPendingCourses.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count} pending lead{c.count === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
              )}

              {/* Optional Filter by Source Counsellor */}
              {selectedCourseForTransfer && counsellorsWithSelectedCourse.length > 1 && (
                <div className="pt-2.5 border-t border-indigo-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-black text-indigo-900 uppercase tracking-wider">
                      From Specific Counsellor (Optional)
                    </label>
                    <span className="text-[10px] text-indigo-600 font-bold">
                      {sourceCounsellorForCourse === "All" ? "All Advisors" : sourceCounsellorForCourse}
                    </span>
                  </div>
                  <select
                    value={sourceCounsellorForCourse}
                    onChange={(e) => setSourceCounsellorForCourse(e.target.value)}
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-indigo-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="All">
                      All Counsellors ({counsellorsWithSelectedCourse.reduce((acc, curr) => acc + curr.count, 0)} leads)
                    </option>
                    {counsellorsWithSelectedCourse.map((adv) => (
                      <option key={adv.name} value={adv.name}>
                        {adv.name} ({adv.count} lead{adv.count === 1 ? "" : "s"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Preview of Matching Leads */}
              {selectedCourseForTransfer && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <span className="text-emerald-600">●</span>
                      <span>
                        Found <strong className="text-indigo-700 font-black">{matchingCourseWiseLeads.length}</strong> pending lead{matchingCourseWiseLeads.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-200">
                      Brand: {userBrandScope || "All Branches"}
                    </span>
                  </div>

                  {matchingCourseWiseLeads.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-indigo-200">
                      No pending leads match this course and counsellor filter.
                    </div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto divide-y divide-indigo-50 bg-white rounded-xl border border-indigo-200 shadow-inner pr-1">
                      {matchingCourseWiseLeads.map((lead, idx) => {
                        const isTransferred = idx < leadsToTransferCount;
                        const targetRecipient =
                          targetSelectionMode === "single"
                            ? targetCounsellor || "New Counsellor"
                            : selectedTargetCounsellors.length > 0
                            ? selectedTargetCounsellors[idx % selectedTargetCounsellors.length]
                            : "New Counsellor";

                        return (
                          <div
                            key={lead._id}
                            className={`p-2.5 flex items-center justify-between text-xs transition-colors ${
                              isTransferred ? "hover:bg-indigo-50/50 bg-white" : "bg-slate-50/70 opacity-60"
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 truncate">
                                  {lead.studentFullName || "Student"}
                                </span>
                                {lead.enquiryId && (
                                  <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded shrink-0">
                                    {lead.enquiryId}
                                  </span>
                                )}
                                {isTransferred ? (
                                  <span className="text-[9px] font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded shrink-0">
                                    → Transfers ({targetRecipient})
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.2 rounded shrink-0">
                                    ● Remains ({lead.assignedCrmAdvisor || "Current"})
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>📞 {lead.primaryPhoneMobile}</span>
                                <span>•</span>
                                <span className="text-indigo-600 font-semibold truncate">{lead.targetCourse}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] font-bold text-slate-600 block truncate max-w-[120px]">
                                👤 {lead.assignedCrmAdvisor || "Unassigned"}
                              </span>
                              <span className="text-[9px] font-semibold text-rose-600">
                                {lead.dueDateStr || "Due Today"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MODE 3: SOURCE COUNSELLOR DROPDOWN (BULK BY ADVISOR) */}
          {transferMode === "counsellor_pending" && (
            <div className="space-y-1.5 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-amber-900 uppercase tracking-wider">
                  Source Counsellor (Transfer From) *
                </label>
                {sourceAdvisorPendingCount > 0 && (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    {sourceAdvisorPendingCount} pending lead(s)
                  </span>
                )}
              </div>
              <select
                value={sourceCounsellor}
                onChange={(e) => {
                  setSourceCounsellor(e.target.value);
                  setFilterCourse("All");
                }}
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

              {/* Optional Course Filter for Source Counsellor */}
              <div className="pt-2 border-t border-amber-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1">
                    <span>📚</span>
                    <span>Filter By Course (Optional)</span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                    {matchingCourseCountForSource} of {sourceAdvisorPendingCount} lead(s) match
                  </span>
                </div>
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 bg-white border border-amber-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 cursor-pointer"
                >
                  <option value="All">All Courses ({sourceAdvisorPendingCount} leads)</option>
                  {sourceCounsellorCourses.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count} lead{c.count === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-amber-700 font-medium">
                  {filterCourse === "All"
                    ? "Transfer all pending follow-ups regardless of course."
                    : `Only leads for "${filterCourse}" (${matchingCourseCountForSource} leads) will be transferred.`}
                </p>
              </div>
            </div>
          )}

          {/* MODE 3: BULK ALL PENDING SUMMARY */}
          {transferMode === "all_pending" && (
            <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base">📦</span>
                <span className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                  Bulk Reassign All Pending Leads
                </span>
              </div>
              <p className="text-xs text-indigo-700 font-medium">
                Reassign pending follow-ups across all counsellors for brand &ldquo;{userBrandScope || "All Branches"}&rdquo; to the target counsellor.
              </p>

              {/* Optional Course Filter for All Pending */}
              <div className="pt-2 border-t border-indigo-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1">
                    <span>📚</span>
                    <span>Filter By Course (Optional)</span>
                  </label>
                  <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                    {matchingCourseCountForAll} of {availableLeadsPool.length} lead(s) match
                  </span>
                </div>
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 bg-white border border-indigo-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 cursor-pointer"
                >
                  <option value="All">All Courses ({availableLeadsPool.length} leads)</option>
                  {allPendingCourses.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count} lead{c.count === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-indigo-700 font-medium">
                  {filterCourse === "All"
                    ? "Transfer all pending leads across every course."
                    : `Only leads for "${filterCourse}" (${matchingCourseCountForAll} leads) will be transferred.`}
                </p>
              </div>
            </div>
          )}

          {/* MODE 4: SELECTED LEADS PREVIEW LIST */}
          {transferMode === "selected" && selectedLeads.length > 0 && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-700">
                  {selectedLeads.length} Selected Lead{selectedLeads.length > 1 ? "s" : ""} to Reassign in Bulk:
                </span>
                <span className="text-[10px] font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  Bulk Selected
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto divide-y divide-slate-200/60 pr-1">
                {selectedLeads.map((lead, idx) => {
                  const isTransferred = idx < leadsToTransferCount;
                  return (
                    <div
                      key={lead._id}
                      className={`py-1.5 flex items-center justify-between text-xs ${
                        isTransferred ? "opacity-100" : "opacity-60 bg-slate-100/50"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 block truncate">
                            {lead.studentFullName || "Unnamed Student"}
                          </span>
                          {isTransferred ? (
                            <span className="text-[9px] font-black text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded shrink-0">
                              → Transfer
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-200 px-1.5 py-0.2 rounded shrink-0">
                              ● Retain
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {lead.enquiryId} • {lead.targetCourse || "Course"} • {lead.primaryPhoneMobile}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                        Currently: {lead.assignedCrmAdvisor || "Unassigned"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION: REDISTRIBUTION VOLUME / PERCENTAGE SELECTOR (For bulk & course modes) */}
          {transferMode !== "single_lead" && totalEligibleLeadsCount > 0 && (
            <div className="space-y-3 bg-gradient-to-br from-violet-50/80 via-indigo-50/40 to-white p-4 rounded-2xl border border-violet-200/90 shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-violet-600 text-white rounded-lg shadow-2xs">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                    </svg>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-violet-950 uppercase tracking-wider">
                      Redistribute Volume & Split Percentage
                    </label>
                    <span className="text-[10px] text-violet-700 font-semibold">
                      Choose what portion of pending leads to reassign
                    </span>
                  </div>
                </div>
                <span className="text-xs font-black px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 border border-violet-200 shadow-2xs">
                  ⚡ {leadsToTransferCount} of {totalEligibleLeadsCount} Leads ({distributionPercent}%)
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setDistributionPercent(50)}
                  className={`p-2 rounded-xl text-xs font-black transition-all cursor-pointer border flex flex-col items-center justify-center ${
                    distributionPercent === 50
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-600 shadow-sm shadow-violet-500/20 ring-2 ring-violet-400/40"
                      : "bg-white text-slate-700 border-slate-200 hover:border-violet-300 hover:bg-violet-50/50"
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <span>50% Split</span>
                    <span className={`text-[9px] px-1 py-0.2 rounded font-black ${distributionPercent === 50 ? "bg-white/20 text-white" : "bg-violet-100 text-violet-700"}`}>
                      Half
                    </span>
                  </span>
                  <span className="text-[10px] font-bold opacity-80 mt-0.5">
                    {Math.round(totalEligibleLeadsCount * 0.5)} leads
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDistributionPercent(25)}
                  className={`p-2 rounded-xl text-xs font-black transition-all cursor-pointer border flex flex-col items-center justify-center ${
                    distributionPercent === 25
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-600 shadow-sm shadow-violet-500/20 ring-2 ring-violet-400/40"
                      : "bg-white text-slate-700 border-slate-200 hover:border-violet-300 hover:bg-violet-50/50"
                  }`}
                >
                  <span>25% Quarter</span>
                  <span className="text-[10px] font-bold opacity-80 mt-0.5">
                    {Math.round(totalEligibleLeadsCount * 0.25)} leads
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDistributionPercent(75)}
                  className={`p-2 rounded-xl text-xs font-black transition-all cursor-pointer border flex flex-col items-center justify-center ${
                    distributionPercent === 75
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-600 shadow-sm shadow-violet-500/20 ring-2 ring-violet-400/40"
                      : "bg-white text-slate-700 border-slate-200 hover:border-violet-300 hover:bg-violet-50/50"
                  }`}
                >
                  <span>75% Majority</span>
                  <span className="text-[10px] font-bold opacity-80 mt-0.5">
                    {Math.round(totalEligibleLeadsCount * 0.75)} leads
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setDistributionPercent(100)}
                  className={`p-2 rounded-xl text-xs font-black transition-all cursor-pointer border flex flex-col items-center justify-center ${
                    distributionPercent === 100
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-600 shadow-sm shadow-violet-500/20 ring-2 ring-violet-400/40"
                      : "bg-white text-slate-700 border-slate-200 hover:border-violet-300 hover:bg-violet-50/50"
                  }`}
                >
                  <span>100% (All)</span>
                  <span className="text-[10px] font-bold opacity-80 mt-0.5">
                    {totalEligibleLeadsCount} leads
                  </span>
                </button>
              </div>

              {/* Slider and Input */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={distributionPercent}
                  onChange={(e) => setDistributionPercent(Number(e.target.value))}
                  className="w-full h-2 bg-violet-200 rounded-lg appearance-none cursor-pointer accent-violet-600"
                />
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={distributionPercent}
                    onChange={(e) => {
                      const val = Math.max(1, Math.min(100, Number(e.target.value) || 1));
                      setDistributionPercent(val);
                    }}
                    className="w-14 text-center text-xs font-black text-slate-900 bg-white border border-violet-300 rounded-lg py-1 px-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <span className="text-xs font-black text-violet-800">%</span>
                </div>
              </div>

              {/* Distribution Visual Ratio Bar */}
              <div className="space-y-1 pt-1">
                <div className="w-full h-3 rounded-full overflow-hidden bg-slate-200 flex">
                  <div
                    style={{ width: `${distributionPercent}%` }}
                    className="bg-gradient-to-r from-violet-600 to-indigo-600 transition-all duration-300 h-full"
                  />
                  <div
                    style={{ width: `${100 - distributionPercent}%` }}
                    className="bg-slate-300 transition-all duration-300 h-full"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-violet-700 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-violet-600"></span>
                    Reassign: <strong>{leadsToTransferCount} leads</strong> ({distributionPercent}%)
                  </span>
                  <span className="text-slate-500 flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-slate-400"></span>
                    Keep with current: <strong>{leadsRemainingCount} leads</strong> ({100 - distributionPercent}%)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TARGET COUNSELLOR SELECTION: SINGLE OR MULTIPLE */}
          <div className="space-y-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-200 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <label className="block text-xs font-black text-indigo-950 uppercase tracking-wider">
                  Target Counsellor(s) (Transfer To) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-indigo-700 font-semibold">
                  {targetSelectionMode === "single"
                    ? "Transfer leads directly to a single counsellor"
                    : "Distribute leads evenly across multiple selected counsellors"}
                </span>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 bg-white border border-indigo-200 px-2 py-0.5 rounded-md">
                Brand: {userBrandScope || "All Branches"}
              </span>
            </div>

            {/* Single vs Multiple Counsellor Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-indigo-100/60 rounded-xl">
              <button
                type="button"
                onClick={() => setTargetSelectionMode("single")}
                className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  targetSelectionMode === "single"
                    ? "bg-white text-indigo-950 shadow-xs"
                    : "text-indigo-700 hover:text-indigo-950 hover:bg-white/50"
                }`}
              >
                <span>👤 Single Counsellor</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetSelectionMode("multiple");
                  if (selectedTargetCounsellors.length === 0 && targetCounsellor) {
                    setSelectedTargetCounsellors([targetCounsellor]);
                  }
                }}
                className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  targetSelectionMode === "multiple"
                    ? "bg-white text-indigo-950 shadow-xs ring-1 ring-indigo-300"
                    : "text-indigo-700 hover:text-indigo-950 hover:bg-white/50"
                }`}
              >
                <span>👥 Multiple Counsellors (Redistribute)</span>
                {selectedTargetCounsellors.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[9px] font-black">
                    {selectedTargetCounsellors.length}
                  </span>
                )}
              </button>
            </div>

            {/* Option A: Single Counsellor Dropdown */}
            {targetSelectionMode === "single" && (
              <div className="space-y-1.5">
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
                  {leadsToTransferCount} lead(s) will be transferred directly to this counsellor.
                </p>
              </div>
            )}

            {/* Option B: Multiple Counsellors Multi-Select */}
            {targetSelectionMode === "multiple" && (
              <div className="space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={counsellorSearch}
                    onChange={(e) => setCounsellorSearch(e.target.value)}
                    placeholder="Filter counsellors by name or email..."
                    className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllCounsellors}
                      className="px-2 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-md cursor-pointer transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllCounsellors}
                      className="px-2 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {eligibleCounsellors.length === 0 ? (
                  <div className="p-3 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl">
                    ⚠️ No counsellors found matching brand &ldquo;{userBrandScope}&rdquo;.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-indigo-100/80 border border-indigo-200 rounded-xl bg-white shadow-inner">
                    {filteredTargetCounsellors.map((c: any) => {
                      const isSelected = selectedTargetCounsellors.includes(c.name);
                      const allocatedCount = counsellorAllocationMap.get(c.name) || 0;
                      const initials = (c.name || "C")
                        .split(" ")
                        .map((w: string) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <div
                          key={c._id || c.id || c.email}
                          onClick={() => handleToggleTargetCounsellor(c.name)}
                          className={`p-2.5 flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                            isSelected ? "bg-indigo-50/70 hover:bg-indigo-100/70" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by parent onClick
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                            />
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-900 truncate">
                                  {c.name}
                                </span>
                                {c.role && (
                                  <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded shrink-0">
                                    {c.role}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {c.email || c.brandScope || "Branch Staff"}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            {isSelected ? (
                              <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full shadow-2xs">
                                ⚡ Receives {allocatedCount} lead{allocatedCount === 1 ? "" : "s"}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                + Select
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Allocation breakdown pill summary */}
                {selectedTargetCounsellors.length > 0 && (
                  <div className="p-3 bg-white rounded-xl border border-indigo-200 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-black text-indigo-950">
                      <span>⚡ Round-Robin Allocation Preview:</span>
                      <span className="text-indigo-600">{selectedTargetCounsellors.length} Counsellors Selected</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTargetCounsellors.map((name) => {
                        const count = counsellorAllocationMap.get(name) || 0;
                        return (
                          <span
                            key={name}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-900"
                          >
                            <span>👤 {name}:</span>
                            <span className="font-black text-indigo-600 bg-white px-1.5 py-0.2 rounded border border-indigo-200 shadow-2xs">
                              {count} leads
                            </span>
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-indigo-700/80 font-medium">
                      The {leadsToTransferCount} leads will be distributed in equal round-robin turns across these {selectedTargetCounsellors.length} counsellors.
                    </p>
                  </div>
                )}
              </div>
            )}
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
                  min={todayKey()}
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
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-extrabold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isLoading ||
                eligibleCounsellors.length === 0 ||
                (targetSelectionMode === "single" && !targetCounsellor) ||
                (targetSelectionMode === "multiple" && selectedTargetCounsellors.length === 0) ||
                (transferMode === "single_lead" && !singleLeadToTransfer) ||
                (transferMode === "course_wise" && (!selectedCourseForTransfer || matchingCourseWiseLeads.length === 0)) ||
                leadsToTransferCount === 0
              }
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-rose-600 via-indigo-600 to-violet-600 hover:from-rose-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
            >
              {isLoading && (
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <span>
                {transferMode === "single_lead"
                  ? "Confirm & Transfer This Lead"
                  : targetSelectionMode === "multiple" && selectedTargetCounsellors.length > 0
                  ? `Confirm & Redistribute ${leadsToTransferCount} Leads (${distributionPercent}%) across ${selectedTargetCounsellors.length} Counsellor${selectedTargetCounsellors.length === 1 ? "" : "s"}`
                  : `Confirm & Transfer ${leadsToTransferCount} Leads (${distributionPercent}%) to ${targetCounsellor || "Counsellor"}`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
