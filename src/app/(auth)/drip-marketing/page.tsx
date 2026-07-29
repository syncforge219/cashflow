"use client";

import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import NotificationPanel from "@/components/NotificationPanel";

interface DripStep {
  stepNumber: number;
  delayDays: number;
  delayHours: number;
  title: string;
  messageTemplate: string;
  channel: string;
  sentCount?: number;
  deliveredCount?: number;
}

interface DripCampaignItem {
  _id: string;
  campaignId: string;
  campaignName: string;
  targetAudience: string;
  targetCourse: string;
  brandScope: string;
  channel: string;
  status: "Active" | "Paused" | "Completed" | "Draft";
  totalTargetLeads: number;
  totalMessagesSent: number;
  convertedCount: number;
  steps: DripStep[];
  createdAt?: string;
}

export default function DripMarketingPage() {
  const [campaigns, setCampaigns] = useState<DripCampaignItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [brandFilter, setBrandFilter] = useState("ALL BRANDS");
  const [brandsList, setBrandsList] = useState<string[]>(["ALL BRANDS"]);
  const [audienceStats, setAudienceStats] = useState({
    totalLeads: 0,
    totalAdmissions: 0,
    feePendingStudents: 0,
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [executingCampaignId, setExecutingCampaignId] = useState<string | null>(null);
  const [executionNotice, setExecutionNotice] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    campaignName: "",
    targetAudience: "All Leads",
    targetCourse: "All Courses",
    brandScope: "ALL BRANDS",
    channel: "WhatsApp",
    status: "Active" as "Active" | "Paused" | "Completed" | "Draft",
    steps: [
      {
        stepNumber: 1,
        delayDays: 0,
        delayHours: 0,
        title: "Day 0: Welcome & Course Guide",
        messageTemplate: "Hi {studentName}, welcome to {brandName}! Thank you for enquiring about our {courseName} program.",
        channel: "WhatsApp",
      },
    ] as DripStep[],
  });

  const fetchBrands = async () => {
    try {
      const res = await fetch("/api/brands");
      const data = await res.json();
      if (res.ok && Array.isArray(data.brands)) {
        const names = data.brands.map((b: any) => String(b.name || "").toUpperCase().trim()).filter(Boolean);
        const uniqueBrands = Array.from(new Set(["ALL BRANDS", ...names]));
        setBrandsList(uniqueBrands);
      }
    } catch (err) {
      console.error("Failed fetching brands:", err);
    }
  };

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const url = brandFilter && brandFilter !== "ALL BRANDS" && brandFilter !== "All"
        ? `/api/drip-campaigns?brand=${encodeURIComponent(brandFilter)}`
        : "/api/drip-campaigns";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCampaigns(data.data);
      }
      if (data.audienceStats) {
        setAudienceStats(data.audienceStats);
      }
    } catch (err) {
      console.error("Failed to fetch drip campaigns:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [brandFilter]);

  // Filtered Campaigns List
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((item) => {
      if (channelFilter !== "All" && item.channel !== channelFilter) return false;
      if (statusFilter !== "All" && item.status !== statusFilter) return false;
      if (brandFilter !== "ALL BRANDS" && brandFilter !== "All") {
        const itemBrand = String(item.brandScope || "").toUpperCase().trim();
        if (itemBrand !== "ALL BRANDS" && itemBrand !== brandFilter.toUpperCase().trim()) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.campaignName.toLowerCase().includes(q);
        const matchAudience = item.targetAudience.toLowerCase().includes(q);
        const matchCourse = item.targetCourse.toLowerCase().includes(q);
        const matchBrand = (item.brandScope || "").toLowerCase().includes(q);
        if (!matchName && !matchAudience && !matchCourse && !matchBrand) return false;
      }
      return true;
    });
  }, [campaigns, searchQuery, channelFilter, statusFilter, brandFilter]);

  // Aggregate KPI Numbers
  const totalMessagesSent = useMemo(() => {
    return campaigns.reduce((acc, curr) => acc + (curr.totalMessagesSent || 0), 0);
  }, [campaigns]);

  const activeCampaignsCount = useMemo(() => {
    return campaigns.filter((c) => c.status === "Active").length;
  }, [campaigns]);

  const totalConvertedCount = useMemo(() => {
    return campaigns.reduce((acc, curr) => acc + (curr.convertedCount || 0), 0);
  }, [campaigns]);

  // Open Modal for Create
  const handleOpenCreateModal = () => {
    setEditingCampaignId(null);
    setFormData({
      campaignName: "",
      targetAudience: "All Leads",
      targetCourse: "All Courses",
      brandScope: "ALL BRANDS",
      channel: "WhatsApp",
      status: "Active",
      steps: [
        {
          stepNumber: 1,
          delayDays: 0,
          delayHours: 0,
          title: "Day 0: Welcome & Course Guide",
          messageTemplate: "Hi {studentName}, welcome to {brandName}! Thank you for enquiring about our {courseName} program.",
          channel: "WhatsApp",
        },
        {
          stepNumber: 2,
          delayDays: 2,
          delayHours: 48,
          title: "Day 2: Free Demo Session Invitation",
          messageTemplate: "Hello {studentName}, experience our practical hands-on training! Reserve your seat for a free live Demo session for {courseName}.",
          channel: "WhatsApp",
        },
      ],
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEditModal = (item: DripCampaignItem) => {
    setEditingCampaignId(item._id);
    setFormData({
      campaignName: item.campaignName,
      targetAudience: item.targetAudience,
      targetCourse: item.targetCourse || "All Courses",
      brandScope: item.brandScope || "ALL BRANDS",
      channel: item.channel || "WhatsApp",
      status: item.status,
      steps: item.steps && item.steps.length > 0 ? item.steps : [
        {
          stepNumber: 1,
          delayDays: 0,
          delayHours: 0,
          title: "Step 1: Instant Message",
          messageTemplate: "Hi {studentName}, welcome to {brandName}!",
          channel: "WhatsApp",
        },
      ],
    });
    setIsModalOpen(true);
  };

  // Toggle Active / Paused Status
  const handleToggleStatus = async (item: DripCampaignItem) => {
    const nextStatus = item.status === "Active" ? "Paused" : "Active";
    try {
      const res = await fetch(`/api/drip-campaigns/${item._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        fetchCampaigns();
      }
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  // Delete Campaign
  const handleDeleteCampaign = async (id: string) => {
    if (!confirm("Are you sure you want to delete this drip campaign sequence?")) return;
    try {
      const res = await fetch(`/api/drip-campaigns/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchCampaigns();
      }
    } catch (err) {
      console.error("Error deleting campaign:", err);
    }
  };

  // Execute Sequence Now Trigger
  const handleExecuteNow = async (item: DripCampaignItem) => {
    setExecutingCampaignId(item._id);
    setExecutionNotice(null);
    try {
      const res = await fetch(`/api/drip-campaigns/${item._id}/trigger`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setExecutionNotice(data.message);
        fetchCampaigns();
      } else {
        alert(data.message || "Failed to trigger drip campaign sequence.");
      }
    } catch (err) {
      console.error("Error executing drip campaign:", err);
      alert("Network error triggering drip campaign sequence.");
    } finally {
      setExecutingCampaignId(null);
    }
  };

  // Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = editingCampaignId ? `/api/drip-campaigns/${editingCampaignId}` : "/api/drip-campaigns";
      const method = editingCampaignId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchCampaigns();
      } else {
        const data = await res.json();
        alert(data.message || "Failed to save drip campaign.");
      }
    } catch (err) {
      console.error("Error saving campaign:", err);
      alert("Error saving campaign.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Step to Form
  const handleAddStep = () => {
    const nextStepNum = formData.steps.length + 1;
    setFormData((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          stepNumber: nextStepNum,
          delayDays: nextStepNum === 1 ? 0 : 3,
          delayHours: nextStepNum === 1 ? 0 : 72,
          title: `Step ${nextStepNum}: Scheduled Drip Message`,
          messageTemplate: "Dear {studentName}, we invite you to explore {courseName} with {brandName}. Contact counsellor {counsellorName} today!",
          channel: prev.channel || "WhatsApp",
        },
      ],
    }));
  };

  // Remove Step from Form
  const handleRemoveStep = (idx: number) => {
    setFormData((prev) => {
      const newSteps = prev.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepNumber: i + 1 }));
      return { ...prev, steps: newSteps };
    });
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Top Title Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl shadow-md shadow-indigo-600/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
                  </svg>
                </span>
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Automated Drip Marketing Engine
                </h1>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black uppercase tracking-wider">
                  Live Production System
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Configure automated multi-step WhatsApp & Email sequences to nurture leads, convert prospects, and recover fee installments automatically.
              </p>
            </div>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/20 active:scale-95 flex items-center gap-2 cursor-pointer self-start md:self-auto shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Build New Drip Campaign</span>
            </button>
          </div>

          {/* Execution Alert Banner */}
          {executionNotice && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>{executionNotice}</span>
              </div>
              <button onClick={() => setExecutionNotice(null)} className="text-emerald-700 hover:text-emerald-950 font-black text-sm">✕</button>
            </div>
          )}

          {/* KPI Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Campaigns</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{activeCampaignsCount} <span className="text-xs font-semibold text-slate-400">/ {campaigns.length} total</span></h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                🚀
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Drip Messages Sent</p>
                <h3 className="text-2xl font-black text-indigo-600 mt-1">{totalMessagesSent.toLocaleString("en-IN")}</h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                📲
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Target Reachable Leads</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{audienceStats.totalLeads} <span className="text-xs font-semibold text-emerald-600">({audienceStats.feePendingStudents} fee pending)</span></h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                🎯
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Converted Enrollments</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">{totalConvertedCount} <span className="text-xs font-semibold text-slate-400">students</span></h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                🎓
              </div>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="Search drip campaigns or target audience..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400 absolute left-3 top-2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="bg-indigo-50 border border-indigo-200 text-xs font-black text-indigo-900 px-3 py-2 rounded-xl focus:outline-none cursor-pointer"
              >
                {brandsList.map((b) => (
                  <option key={b} value={b}>
                    🏷️ Brand: {b}
                  </option>
                ))}
              </select>

              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 px-3 py-2 rounded-xl focus:outline-none cursor-pointer"
              >
                <option value="All">All Channels</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="Omnichannel">Omnichannel</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 px-3 py-2 rounded-xl focus:outline-none cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Paused">Paused</option>
              </select>
            </div>
          </div>

          {/* Drip Campaigns Cards Grid */}
          {isLoading ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 font-semibold text-xs">
              Loading drip marketing campaigns...
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 font-semibold text-xs">
              No drip marketing campaigns found matching filters. Click &quot;Build New Drip Campaign&quot; to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredCampaigns.map((item) => (
                <div
                  key={item._id}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-6 flex flex-col justify-between space-y-5"
                >
                  {/* Campaign Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-lg">
                          {item.brandScope}
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900 mt-2 leading-snug">
                          {item.campaignName}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase border ${
                            item.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs font-semibold">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1">
                        🎯 Target: <strong className="text-slate-900">{item.targetAudience}</strong>
                      </span>
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1">
                        📚 Course: <strong className="text-slate-900">{item.targetCourse}</strong>
                      </span>
                      <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1">
                        💬 Channel: <strong>{item.channel}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Sequence Timeline Steps */}
                  <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      Automated Drip Sequence ({item.steps?.length || 0} Steps)
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {item.steps && item.steps.map((st, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-extrabold text-slate-800">
                              {st.title}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                              Day {st.delayDays} (+{st.delayHours}h)
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 font-medium line-clamp-2 leading-relaxed italic">
                            &quot;{st.messageTemplate}&quot;
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Campaign Stats Bar */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Target Audience</p>
                      <p className="text-sm font-black text-slate-800 mt-0.5">{item.totalTargetLeads}</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Messages Sent</p>
                      <p className="text-sm font-black text-indigo-600 mt-0.5">{item.totalMessagesSent}</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Converted</p>
                      <p className="text-sm font-black text-emerald-600 mt-0.5">{item.convertedCount}</p>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStatus(item)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                          item.status === "Active"
                            ? "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        }`}
                      >
                        {item.status === "Active" ? "Pause" : "Activate"}
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                      >
                        Edit Steps
                      </button>

                      <button
                        onClick={() => handleDeleteCampaign(item._id)}
                        className="px-2.5 py-1.5 text-rose-500 hover:text-rose-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>

                    <button
                      onClick={() => handleExecuteNow(item)}
                      disabled={executingCampaignId === item._id}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                      </svg>
                      <span>{executingCampaignId === item._id ? "Sending..." : "Execute Sequence Now"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </main>
      </div>

      {/* CREATE / EDIT DRIP CAMPAIGN MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>🚀</span>
                  <span>{editingCampaignId ? "Edit Drip Campaign Sequence" : "Configure New Drip Campaign"}</span>
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Set target audience, channel preferences, and create multi-step automated message schedules.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmitForm} className="p-6 flex-1 overflow-y-auto space-y-5">
              
              <div>
                <label className="block text-slate-700 font-extrabold text-xs mb-1">
                  Campaign Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 7-Day New Lead Nurturing Sequence"
                  value={formData.campaignName}
                  onChange={(e) => setFormData({ ...formData, campaignName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-700 font-extrabold text-xs mb-1">Target Brand</label>
                  <select
                    value={formData.brandScope}
                    onChange={(e) => setFormData({ ...formData, brandScope: e.target.value })}
                    className="w-full px-3 py-2 border border-indigo-200 bg-indigo-50/50 rounded-xl focus:outline-none text-xs font-black text-indigo-900 cursor-pointer"
                  >
                    {brandsList.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold text-xs mb-1">Target Audience</label>
                  <select
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none text-xs font-semibold text-slate-800 bg-white cursor-pointer"
                  >
                    <option value="All Leads">All Leads</option>
                    <option value="New Enquiries">New Enquiries</option>
                    <option value="Unconverted Leads">Unconverted Leads</option>
                    <option value="Fee Pending Students">Fee Pending Students</option>
                    <option value="Specific Course">Specific Course</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold text-xs mb-1">Course Filter</label>
                  <input
                    type="text"
                    placeholder="All Courses"
                    value={formData.targetCourse}
                    onChange={(e) => setFormData({ ...formData, targetCourse: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold text-xs mb-1">Dispatch Channel</label>
                  <select
                    value={formData.channel}
                    onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none text-xs font-semibold text-slate-800 bg-white cursor-pointer"
                  >
                    <option value="WhatsApp">WhatsApp (MSG91)</option>
                    <option value="Email">Email Service</option>
                    <option value="SMS">SMS Gateway</option>
                    <option value="Omnichannel">Omnichannel</option>
                  </select>
                </div>
              </div>

              {/* Drip Steps Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-800 font-black text-xs uppercase tracking-wide">
                    Sequence Steps Schedule ({formData.steps.length} Steps)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-extrabold transition-all border border-indigo-200 cursor-pointer"
                  >
                    + Add Next Step
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.steps.map((st, idx) => (
                    <div key={idx} className="bg-slate-50/90 border border-slate-200 p-4 rounded-2xl space-y-3 relative">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                          Step #{idx + 1}
                        </span>
                        {formData.steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStep(idx)}
                            className="text-rose-500 hover:text-rose-700 font-bold text-xs cursor-pointer"
                          >
                            Remove Step
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Step Title</label>
                          <input
                            type="text"
                            required
                            value={st.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData((prev) => {
                                const newSteps = [...prev.steps];
                                newSteps[idx].title = val;
                                return { ...prev, steps: newSteps };
                              });
                            }}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Trigger Delay (Days)</label>
                          <input
                            type="number"
                            min="0"
                            value={st.delayDays}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setFormData((prev) => {
                                const newSteps = [...prev.steps];
                                newSteps[idx].delayDays = val;
                                newSteps[idx].delayHours = val * 24;
                                return { ...prev, steps: newSteps };
                              });
                            }}
                            className="w-full px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Message Body Template (Placeholders: &#123;studentName&#125;, &#123;courseName&#125;, &#123;brandName&#125;, &#123;counsellorName&#125;)
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={st.messageTemplate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormData((prev) => {
                              const newSteps = [...prev.steps];
                              newSteps[idx].messageTemplate = val;
                              return { ...prev, steps: newSteps };
                            });
                          }}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : editingCampaignId ? "Update Campaign" : "Create Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
