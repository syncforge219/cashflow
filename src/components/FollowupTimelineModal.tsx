"use client";

import React, { useState, useEffect, useMemo } from "react";

interface FollowupTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: any | null;
}

export default function FollowupTimelineModal({
  isOpen,
  onClose,
  record,
}: FollowupTimelineModalProps) {
  const [filterType, setFilterType] = useState<string>("All");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [linkedTasks, setLinkedTasks] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // Fetch linked standalone tasks for this enquiry from /api/tasks
  useEffect(() => {
    if (isOpen && record?._id) {
      setIsLoadingTasks(true);
      fetch(`/api/tasks?linkedEnquiryId=${record._id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setLinkedTasks(data.data);
          } else if (Array.isArray(data)) {
            setLinkedTasks(data);
          } else {
            setLinkedTasks([]);
          }
        })
        .catch((err) => {
          console.error("Failed to load linked tasks for timeline:", err);
          setLinkedTasks([]);
        })
        .finally(() => {
          setIsLoadingTasks(false);
        });
    } else {
      setLinkedTasks([]);
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const getPriorityBadge = (priority?: string) => {
    const p = (priority || "Medium").toLowerCase();
    if (p === "urgent") return <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-extrabold text-[10px]">🔴 URGENT</span>;
    if (p === "high") return <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-700 font-extrabold text-[10px]">🟠 HIGH</span>;
    if (p === "low") return <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 font-extrabold text-[10px]">🔵 LOW</span>;
    return <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 font-extrabold text-[10px]">🟡 MEDIUM</span>;
  };

  const getStatusBadge = (status?: string, isCompleted?: boolean) => {
    if (isCompleted || (status || "").toLowerCase() === "completed") {
      return <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">✓ COMPLETED</span>;
    }
    if ((status || "").toLowerCase() === "missed") {
      return <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-extrabold text-[10px]">🚨 MISSED</span>;
    }
    if ((status || "").toLowerCase() === "rescheduled") {
      return <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-extrabold text-[10px]">🔄 RESCHEDULED</span>;
    }
    if ((status || "").toLowerCase() === "cancelled") {
      return <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold text-[10px]">✕ CANCELLED</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold text-[10px]">⏳ PENDING</span>;
  };

  // Synthesize all historical touchpoints, tasks, and initial enquiry registration
  const allTimelineItems = useMemo(() => {
    const items: any[] = [];
    const seenSignatures = new Set<string>();

    // 1. Follow-up items logged on the Enquiry document
    const rawFollowups = Array.isArray(record.followUps) ? record.followUps : [];
    rawFollowups.forEach((f: any, idx: number) => {
      const sig = `fup-${f._id || idx}-${f.date}-${f.time}-${(f.remarks || "").slice(0, 20)}`;
      seenSignatures.add(sig);
      items.push({
        id: f._id || `fup-${idx}`,
        sourceType: "followup",
        date: f.date,
        time: f.time || "11:00 AM",
        createdAt: f.createdAt || f.completedAt,
        typeOfContact: f.typeOfContact || "Telephonic",
        priority: f.priority || "Medium",
        status: f.status || (f.isCompleted ? "Completed" : "Pending"),
        isCompleted: Boolean(f.isCompleted || (f.status || "").toLowerCase() === "completed"),
        assignedTo: f.assignedTo || f.plannedBy || record.assignedCrmAdvisor || "Counsellor",
        remarks: f.remarks || "Follow-up touchpoint",
        nextAction: f.nextAction || "",
        escalatedToManager: f.escalatedToManager,
        callStart: f.callStart,
        callEnd: f.callEnd,
        loggedDate: f.loggedDate,
        loggedTime: f.loggedTime,
      });
    });

    // 2. Standalone Task records linked to this Enquiry (e.g. Lead Call tasks, demos)
    linkedTasks.forEach((t: any) => {
      const taskDate = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : (t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : "");
      const sig = `task-${t._id}-${taskDate}-${(t.description || t.title || "").slice(0, 20)}`;
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        items.push({
          id: t._id,
          sourceType: "task",
          date: taskDate,
          time: t.dueTime || "11:00 AM",
          createdAt: t.createdAt,
          typeOfContact: t.taskType || "CRM Task",
          priority: t.priority || "Medium",
          status: t.status || "Pending",
          isCompleted: (t.status || "").toLowerCase() === "completed",
          assignedTo: t.assignedTo || record.assignedCrmAdvisor || "Counsellor",
          remarks: `${t.title || "Task"}${t.description ? ` - ${t.description}` : ""}`,
          nextAction: t.autoTriggerSource || "",
          escalatedToManager: t.isEscalated,
        });
      }
    });

    // 3. Follow-up Notes directly on enquiry (if not captured in follow-ups)
    if (record.followUpNotes && !rawFollowups.some((f: any) => (f.remarks || "").includes(record.followUpNotes))) {
      items.push({
        id: `note-${record._id}`,
        sourceType: "note",
        date: record.followUpDate || record.date,
        time: "10:00 AM",
        createdAt: record.updatedAt || record.createdAt,
        typeOfContact: "Follow-up Note",
        priority: record.priorityLevel || "Medium",
        status: "Completed",
        isCompleted: true,
        assignedTo: record.assignedCrmAdvisor || "Counsellor",
        remarks: record.followUpNotes,
        nextAction: "",
      });
    }

    // 4. Initial Lead Inquiry Registration Milestone
    const regDate = record.date || (record.createdAt ? new Date(record.createdAt).toISOString().slice(0, 10) : "");
    items.push({
      id: `reg-${record._id}`,
      sourceType: "registration",
      date: regDate,
      time: "09:30 AM",
      createdAt: record.createdAt || record.date,
      typeOfContact: "Lead Registration",
      priority: record.priorityLevel || "Medium",
      status: "Completed",
      isCompleted: true,
      assignedTo: record.assignedCrmAdvisor || "Initial Assignment",
      remarks: `Lead captured via ${record.leadSource || "Direct Entry"} for course "${record.targetCourse || record.course || "General"}".${record.remarks ? ` Initial Notes: ${record.remarks}` : ""}`,
      nextAction: "Initial counseling & course orientation",
    });

    // Sort chronologically
    return items.sort((a, b) => {
      const timeA = new Date(a.date || a.createdAt || 0).getTime();
      const timeB = new Date(b.date || b.createdAt || 0).getTime();
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });
  }, [record, linkedTasks, sortOrder]);

  const filteredItems = useMemo(() => {
    return allTimelineItems.filter((item: any) => {
      if (filterType === "All") return true;
      const t = (item.typeOfContact || "").toLowerCase();
      const keywords: Record<string, string[]> = {
        telephonic: ["phone", "call", "telephon"],
        whatsapp: ["whatsapp"],
        email: ["email", "e-mail", "mail"],
        walkin: ["walk", "in-person", "in person", "visit", "meeting"],
        tasks: ["task", "demo", "registration"],
      };
      const wanted = keywords[filterType.toLowerCase()] || [filterType.toLowerCase()];
      return wanted.some((k) => t.includes(k));
    });
  }, [allTimelineItems, filterType]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-base shadow-md">
              🕒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">
                  Follow-up Timeline & Interaction History
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px] border border-emerald-500/30">
                  {allTimelineItems.length} Events Logged
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Lead: <strong className="text-white">{record.studentFullName || record.fullName}</strong> ({record.enquiryId || record.admissionId || "ID-N/A"}) • Course: <span className="text-indigo-300 font-semibold">{record.targetCourse || record.course || "General"}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Lead Quick Overview Bar */}
        <div className="bg-indigo-50/60 border-b border-indigo-100 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span>👤 Advisor: <strong className="text-indigo-900 font-bold">{record.assignedCrmAdvisor || "Unassigned"}</strong></span>
            <span>•</span>
            <span>🏢 Brand: <strong className="text-slate-800 font-bold">{record.targetBrand || record.brand || "Main Campus"}</strong></span>
            <span>•</span>
            <span>📞 Phone: <strong className="text-slate-800 font-mono font-bold">{record.primaryPhoneMobile || "N/A"}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-bold">Sort:</span>
            <button
              onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
              className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-indigo-700 font-extrabold cursor-pointer"
            >
              {sortOrder === "newest" ? "▼ Newest First" : "▲ Oldest First"}
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shrink-0 text-xs">
          <span className="font-bold text-slate-600">
            Showing {filteredItems.length} of {allTimelineItems.length} Interactions
            {isLoadingTasks && <span className="text-slate-400 font-normal ml-2">(Refreshing tasks...)</span>}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Filter Contact:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-bold text-slate-700 outline-none cursor-pointer text-xs"
            >
              <option value="All">All Types</option>
              <option value="Telephonic">Telephonic / Calls</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Email">Email</option>
              <option value="Walkin">Walk-in</option>
              <option value="Tasks">Tasks & Milestones</option>
            </select>
          </div>
        </div>

        {/* Timeline Content List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <span className="text-3xl block">📭</span>
              <p className="text-slate-500 font-bold text-sm">
                No follow-up interaction timeline records match the selected filter.
              </p>
              <p className="text-xs text-slate-400">
                Switch filter back to &ldquo;All Types&rdquo; to view complete touchpoints.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-indigo-200 ml-4 pl-6 space-y-6">
              {filteredItems.map((item: any, idx: number) => {
                const dateDisplay = item.date
                  ? new Date(item.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : "N/A";

                const isRegistration = item.sourceType === "registration";

                return (
                  <div key={item.id || idx} className="relative group">
                    {/* Timeline Node Icon */}
                    <div className={`absolute -left-[35px] top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-black shadow-xs ${
                      isRegistration
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : item.isCompleted
                        ? "bg-white border-emerald-600 text-emerald-700"
                        : "bg-white border-indigo-600 text-indigo-600"
                    }`}>
                      {isRegistration ? "🏁" : idx + 1}
                    </div>

                    {/* Timeline Card */}
                    <div className={`border rounded-2xl p-4 transition-all shadow-xs space-y-2 ${
                      isRegistration
                        ? "bg-emerald-50/50 border-emerald-200"
                        : item.isCompleted
                        ? "bg-slate-50 hover:bg-slate-100/90 border-slate-200"
                        : "bg-amber-50/40 hover:bg-amber-50/70 border-amber-200"
                    }`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-xs">{dateDisplay}</span>
                          <span className="text-[11px] font-mono text-slate-500">at {item.time || "10:00 AM"}</span>
                          {getPriorityBadge(item.priority)}
                          {item.escalatedToManager && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-black text-[10px]">⚡ ESCALATED</span>
                          )}
                          {isRegistration && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px]">🎯 MILESTONE</span>
                          )}
                        </div>
                        {getStatusBadge(item.status, item.isCompleted)}
                      </div>

                      {/* Touchpoint Details */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-semibold pt-1">
                        <div>
                          <span className="text-slate-400 uppercase text-[9px] font-extrabold block">Contact Mode / Action</span>
                          <span className="text-indigo-900 font-bold capitalize">📞 {item.typeOfContact || "Telephonic"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 uppercase text-[9px] font-extrabold block">Handled / Assigned To</span>
                          <span className="text-slate-800 font-bold">👤 {item.assignedTo || record.assignedCrmAdvisor || "Counsellor"}</span>
                        </div>
                      </div>

                      {/* Discussion Remarks */}
                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700 font-medium">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                          Discussion Remarks & Notes:
                        </span>
                        <p className="whitespace-pre-wrap">{item.remarks || "No detailed remarks logged for this touchpoint."}</p>
                        {item.nextAction && (
                          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] font-bold text-indigo-700">
                            🎯 Next Action: {item.nextAction}
                          </div>
                        )}
                        {item.loggedDate && (
                          <div className="mt-1 text-[10px] text-slate-400 font-mono">
                            Call recorded on: {item.loggedDate} {item.loggedTime ? `at ${item.loggedTime}` : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-semibold">
            All records are safely synced with Lead CRM & Interaction Logs.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Close Timeline
          </button>
        </div>
      </div>
    </div>
  );
}
