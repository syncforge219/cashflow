"use client";

import React, { useState, useEffect } from "react";
import AddEnquiryModal from "./AddEnquiryModal";
import LeadProfile from "./LeadProfile";
import ImportLeadsModal from "./ImportLeadsModal";
import GoogleFormIntegrationModal from "./GoogleFormIntegrationModal";
import LeadSourceManagerModal from "./LeadSourceManagerModal";
import JustdialIntegrationModal from "./JustdialIntegrationModal";

export default function EnquiriesDisplay() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isLeadSourceModalOpen, setIsLeadSourceModalOpen] = useState(false);
  const [isJustdialModalOpen, setIsJustdialModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [counsellorsList, setCounsellorsList] = useState<any[]>([]);
  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [dbLeadSources, setDbLeadSources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [dateOffset, setDateOffset] = useState(0);

  // New filter states
  const [brandFilter, setBrandFilter] = useState("");
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<"today" | "week" | "month" | "year" | "custom" | "all">("month");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [isGoogleFormModalOpen, setIsGoogleFormModalOpen] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      // Apply search immediately if empty, otherwise wait for at least 3 chars
      if (searchQuery.length >= 3 || searchQuery.length === 0) {
        setDebouncedSearchQuery(searchQuery);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(handler);
  }, [searchQuery]);

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - dateOffset);
  const targetDateString = targetDate.toDateString();

  // 1. Date Filtered Enquiries (for Date Range Presets)
  const dateFilteredEnquiries = enquiries.filter((lead) => {
    const rawDateVal = lead.date || lead.createdAt;
    if (!rawDateVal || dateFilterMode === "all") return true;
    const leadDate = new Date(rawDateVal);
    const now = new Date();

    if (dateFilterMode === "today") {
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return leadDate >= startToday && leadDate <= endToday;
    } else if (dateFilterMode === "week") {
      const startWeek = new Date(now);
      startWeek.setDate(startWeek.getDate() - 7);
      startWeek.setHours(0, 0, 0, 0);
      const endWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return leadDate >= startWeek && leadDate <= endWeek;
    } else if (dateFilterMode === "month") {
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return leadDate >= startMonth && leadDate <= endMonth;
    } else if (dateFilterMode === "year") {
      const startYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const endYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return leadDate >= startYear && leadDate <= endYear;
    } else if (dateFilterMode === "custom") {
      if (startDateFilter) {
        const startCustom = new Date(startDateFilter);
        startCustom.setHours(0, 0, 0, 0);
        if (leadDate < startCustom) return false;
      }
      if (endDateFilter) {
        const endCustom = new Date(endDateFilter);
        endCustom.setHours(23, 59, 59, 999);
        if (leadDate > endCustom) return false;
      }
      return true;
    }
    return true;
  });

  // 2. Full Filtered Enquiries (dropdowns + search)
  const filteredEnquiries = dateFilteredEnquiries.filter((lead) => {
    if (brandFilter && lead.targetBrand !== brandFilter) return false;
    if (advisorFilter && lead.assignedCrmAdvisor !== advisorFilter) return false;
    if (sourceFilter && lead.leadSource !== sourceFilter) return false;
    if (priorityFilter && lead.priorityLevel !== priorityFilter) return false;
    if (statusFilter && lead.status !== statusFilter) return false;

    if (!debouncedSearchQuery) return true;
    const query = debouncedSearchQuery.toLowerCase();
    return (
      (lead.studentFullName && lead.studentFullName.toLowerCase().includes(query)) ||
      (lead.emailAddress && lead.emailAddress.toLowerCase().includes(query)) ||
      (lead.primaryPhoneMobile && String(lead.primaryPhoneMobile).toLowerCase().includes(query)) ||
      (lead.enquiryId && lead.enquiryId.toLowerCase().includes(query))
    );
  });

  const fetchEnquiries = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/enquiries");
      const result = await response.json();
      if (result.success) {
        setEnquiries(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch enquiries:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();

    fetch("/api/counsellors")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCounsellorsList(data.counsellors || []);
      })
      .catch(console.error);

    fetch("/api/brands")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setBrandsList(data.brands || []);
      })
      .catch(console.error);

    fetch("/api/lead-sources")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setDbLeadSources(data.data);
        }
      })
      .catch(console.error);
  }, []);

  // Compute unique values for dropdowns based on actual database entries (case-insensitive deduplication)
  const uniqueBrands = Array.from<string>(
    enquiries.reduce((map, e) => {
      if (e.targetBrand && e.targetBrand.trim()) {
        const key = e.targetBrand.trim().toLowerCase();
        if (!map.has(key)) map.set(key, e.targetBrand.trim());
      }
      return map;
    }, new Map<string, string>()).values()
  );

  const uniqueAdvisors = Array.from<string>(
    enquiries
      .filter(e => !brandFilter || (e.targetBrand && e.targetBrand.toLowerCase().trim() === brandFilter.toLowerCase().trim()))
      .reduce((map, e) => {
        if (e.assignedCrmAdvisor && e.assignedCrmAdvisor.trim()) {
          const key = e.assignedCrmAdvisor.trim().toLowerCase();
          if (!map.has(key)) map.set(key, e.assignedCrmAdvisor.trim());
        }
        return map;
      }, new Map<string, string>()).values()
  );

  const uniqueSources = Array.from<string>(
    [
      ...dbLeadSources.map((s: any) => s.name),
      ...enquiries.map((e: any) => e.leadSource).filter(Boolean),
    ].reduce((map, src) => {
      if (src && typeof src === "string" && src.trim()) {
        const key = src.trim().toLowerCase();
        if (!map.has(key)) map.set(key, src.trim());
      }
      return map;
    }, new Map<string, string>()).values()
  );

  const uniquePriorities = Array.from<string>(
    enquiries.reduce((map, e) => {
      if (e.priorityLevel && e.priorityLevel.trim()) {
        const key = e.priorityLevel.trim().toLowerCase();
        if (!map.has(key)) map.set(key, e.priorityLevel.trim());
      }
      return map;
    }, new Map<string, string>()).values()
  );

  const uniqueStatuses = Array.from<string>(
    enquiries.reduce((map, e) => {
      if (e.status && e.status.trim()) {
        const key = e.status.trim().toLowerCase();
        if (!map.has(key)) map.set(key, e.status.trim());
      }
      return map;
    }, new Map<string, string>()).values()
  );
  const isCustomDateRangeActive = startDateFilter !== "" || endDateFilter !== "" || dateFilterMode !== "all";

  // Dynamic metric computations calculated on dateFilteredEnquiries
  const totalPeriodEnquiries = dateFilteredEnquiries.length;

  const pendingFollowupsCount = dateFilteredEnquiries.reduce((acc, lead) => {
    const pendingTasks = lead.followUps?.filter((t: any) => !t.isCompleted && t.status !== "Completed").length || 0;
    if (pendingTasks > 0) return acc + pendingTasks;
    if (lead.status === "Pending" || lead.status === "Hot Follow-up" || lead.status === "Cold Follow-up" || lead.status === "Follow-up") {
      return acc + 1;
    }
    return acc;
  }, 0);

  const admissionsConvertedCount = dateFilteredEnquiries.filter(
    (e) => e.status === "Admission" || e.status === "Admitted" || e.status === "Converted"
  ).length;

  const lostLeadsCount = dateFilteredEnquiries.filter(
    (e) => e.status === "Lost" || e.status === "Closed"
  ).length;

  const conversionRateStr = totalPeriodEnquiries > 0 ? `${Math.min(100, Math.round((admissionsConvertedCount / totalPeriodEnquiries) * 100))}%` : "0%";

  const firstCardTitleMap: Record<string, string> = {
    today: "Today's Enquiries",
    week: "This Week's Enquiries",
    month: "This Month's Enquiries",
    year: "This Year's Enquiries",
    custom: "Period Enquiries",
    all: "Total Enquiries",
  };

  const stats = [
    {
      title: firstCardTitleMap[dateFilterMode] || "Enquiries",
      value: String(totalPeriodEnquiries),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 text-blue-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      ),
      bg: "bg-blue-50/50 border-blue-100"
    },
    {
      title: "Pending Follow-ups",
      value: String(pendingFollowupsCount),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 text-amber-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      bg: "bg-amber-50/50 border-amber-100"
    },
    {
      title: "Admissions Converted",
      value: String(admissionsConvertedCount),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 text-emerald-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
      bg: "bg-emerald-50/50 border-emerald-100"
    },
    {
      title: "Lost Leads",
      value: String(lostLeadsCount),
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 text-rose-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
      ),
      bg: "bg-rose-50/50 border-rose-100"
    },
    {
      title: "Conversion Rate",
      value: conversionRateStr,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 text-purple-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
        </svg>
      ),
      bg: "bg-purple-50/50 border-purple-100"
    }
  ];

  return (
    <div className="space-y-6 flex-1 flex flex-col justify-between">

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Enquiry Management Command Center</h1>
          <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
            Supervise, route, and convert student inquiries across legal CRM pathways.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsJustdialModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-extrabold bg-gradient-to-r from-blue-700 via-indigo-600 to-orange-500 hover:from-blue-800 hover:to-orange-600 text-white rounded-xl px-4 py-2 shadow-xs transition-all cursor-pointer border border-blue-400/30"
          >
            <span className="font-black text-[10px] bg-blue-950/50 text-orange-400 px-1.5 py-0.5 rounded border border-orange-400/30">JD</span>
            <span>Justdial Connector</span>
          </button>
          <button
            onClick={() => setIsGoogleFormModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-xl px-4 py-2 shadow-xs transition-all cursor-pointer"
          >
            <span>📝 Google Forms & Links</span>
          </button>
          <button
            onClick={() => setIsLeadSourceModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-xl px-4 py-2 shadow-xs transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 text-indigo-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Lead Sources
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-xl px-4 py-2 shadow-sm transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Upload Leads
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2 shadow-md shadow-indigo-600/10 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Register Enquiry
          </button>
        </div>
      </div>

      {/* Date Filter Preset Bar ABOVE KPI Cards */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          {[
            { id: "today", label: "Today" },
            { id: "week", label: "This Week" },
            { id: "month", label: "This Month" },
            { id: "year", label: "This Year" },
            { id: "custom", label: "Custom Range" },
            { id: "all", label: "All Time" },
          ].map((btn) => (
            <button
              type="button"
              key={btn.id}
              onClick={() => setDateFilterMode(btn.id as any)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                dateFilterMode === btn.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {dateFilterMode === "custom" && (
          <div className="flex items-center gap-2 animate-fade-in">
            <span className="text-xs font-bold text-slate-500 select-none">Custom Range:</span>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
            <span className="text-xs font-bold text-slate-400 select-none">to</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
            />
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block select-none">
                {stat.title}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold text-slate-800 tracking-tight leading-none">
                  {stat.value}
                </span>
              </div>
            </div>
            <div className={`p-2 rounded-xl border ${stat.bg} shrink-0`}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Middle row: Filtering & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Filtering Column */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs lg:col-span-2">
          <div className="flex items-center gap-1.5 mb-4 text-slate-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4.5 w-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.59v3.499a.75.75 0 0 1-.316.615l-3 2.13a.75.75 0 0 1-1.184-.615v-5.629a2.25 2.25 0 0 0-.659-1.59L4.084 7.409A2.25 2.25 0 0 1 3.425 5.82V4.774c0-.54.384-1.006.917-1.096A48.254 48.254 0 0 1 12 3z" />
            </svg>
            <h2 className="text-xs font-bold uppercase tracking-wider select-none">CRM Target Segments Filtering</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative sm:col-span-3">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Name, Email, Phone, ID..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>

            {/* Dropdowns */}
            <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus:outline-none">
              <option value="">All Brands</option>
              {uniqueBrands.map(b => <option key={b as string} value={b as string}>{b as string}</option>)}
            </select>
            <select value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)} className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus:outline-none">
              <option value="">All Advisors</option>
              {uniqueAdvisors.map(a => <option key={a as string} value={a as string}>{a as string}</option>)}
            </select>
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus:outline-none">
              <option value="">All Sources</option>
              {uniqueSources.map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus:outline-none">
              <option value="">All Priorities</option>
              {uniquePriorities.map(p => <option key={p as string} value={p as string}>{p as string}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus:outline-none sm:col-span-2">
              <option value="">All Pipeline Statuses</option>
              {uniqueStatuses.map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
            </select>
          </div>
        </div>

        {/* Lead Source Channels */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider select-none">Lead Source Channels</h2>
              <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 select-none">
                Live Mix
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5 select-none">Marketing acquisition mix distribution</p>
          </div>

          {(() => {
            const sourceStats = filteredEnquiries.reduce((acc, curr) => {
              const source = curr.leadSource || "Other";
              acc[source] = (acc[source] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            const totalSources = filteredEnquiries.length || 1;

            const sourceColors: Record<string, string> = {
              "Google Ads": "#6366f1",
              "Meta Ads": "#8b5cf6",
              "Google Search": "#06b6d4",
              "Website": "#f43f5e",
              "Seminar": "#f59e0b",
              "Hoarding": "#10b981",
              "Reference": "#3b82f6",
              "Direct Walkin": "#ec4899",
              "Call on Database": "#14b8a6",
              "Other": "#94a3b8"
            };

            const tailwindColors: Record<string, string> = {
              "Google Ads": "bg-indigo-500",
              "Meta Ads": "bg-purple-500",
              "Google Search": "bg-cyan-500",
              "Website": "bg-rose-500",
              "Seminar": "bg-amber-500",
              "Hoarding": "bg-emerald-500",
              "Reference": "bg-blue-500",
              "Direct Walkin": "bg-pink-500",
              "Call on Database": "bg-teal-500",
              "Other": "bg-slate-400"
            };

            let currentAngle = 0;
            const gradientStops = Object.entries(sourceStats).map(([source, count]) => {
              const percentage = (count as number / totalSources) * 100;
              const color = sourceColors[source] || sourceColors["Other"];
              const start = currentAngle;
              const end = currentAngle + percentage;
              currentAngle = end;
              return `${color} ${start}% ${end}%`;
            }).join(", ");

            return (
              <>
                <div className="my-auto py-3 flex items-center justify-center">
                  {filteredEnquiries.length > 0 ? (
                    <div
                      className="w-28 h-28 sm:w-32 sm:h-32 rounded-full shadow-sm flex items-center justify-center relative"
                      style={{
                        background: `conic-gradient(${gradientStops})`,
                      }}
                    >
                      {/* Inner circle to create donut effect with centered total count */}
                      <div className="w-18 h-18 sm:w-20 sm:h-20 bg-white rounded-full shadow-inner flex flex-col items-center justify-center text-center">
                        <span className="text-base sm:text-lg font-black text-slate-800 tracking-tight">{filteredEnquiries.length}</span>
                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase select-none">Total</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-slate-100 flex items-center justify-center">
                      <span className="text-[10px] text-slate-400 font-bold">No Data</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  {Object.entries(sourceStats).map(([source, count]) => {
                    const pct = Math.round(((count as number) / totalSources) * 100);
                    return (
                      <div key={source} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${tailwindColors[source] || tailwindColors["Other"]}`}></span>
                            <span className="font-semibold text-slate-700">{source}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800">{pct}%</span>
                            <span className="text-[10px] font-semibold text-slate-400">({String(count)})</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${tailwindColors[source] || tailwindColors["Other"]}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>

      </div>

      {/* Leads Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex-1 flex flex-col justify-between">

        {/* Table Title bar */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 shrink-0 select-none">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Client Directory Leads ({filteredEnquiries.length})</h2>
          <button onClick={fetchEnquiries} title="Refresh enquiries" className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4.5 w-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>

        {/* Real Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
                <th className="py-3 px-6">Enquiry No</th>
                <th className="py-3 px-6">Basic Details</th>
                <th className="py-3 px-6">Course Requested</th>
                <th className="py-3 px-6">Registered Brand</th>
                <th className="py-3 px-6">Advisor</th>
                <th className="py-3 px-6">Source</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-500">Loading enquiries...</td>
                </tr>
              ) : filteredEnquiries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-500">No enquiries found.</td>
                </tr>
              ) : (
                filteredEnquiries.map((lead, idx) => (
                  <tr
                    key={lead._id || idx}
                    onClick={() => setSelectedLead(lead)}
                    className="hover:bg-slate-50/40 transition-colors cursor-pointer group"
                  >
                    {/* Enquiry No & Date */}
                    <td className="py-4 px-6 text-slate-800 font-bold group-hover:text-indigo-600 transition-colors">
                      <div className="font-mono">{lead.enquiryId}</div>
                      <div className="text-[10px] text-slate-400 font-normal font-mono mt-0.5">
                        📅 {lead.date || (lead.createdAt ? new Date(lead.createdAt).toISOString().split('T')[0] : "N/A")}
                      </div>
                    </td>

                    {/* Basic Details */}
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">{lead.studentFullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>{lead.primaryPhoneMobile}</span>
                        {lead.emailAddress && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[140px]">{lead.emailAddress}</span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Course requested */}
                    <td className="py-4 px-6 font-semibold text-slate-700">
                      {lead.targetCourse || "-"}
                    </td>

                    {/* Brand */}
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md px-2 py-0.5 border border-slate-200">
                        {lead.targetBrand || "Default Brand"}
                      </span>
                    </td>

                    {/* Advisor dropdown */}
                    <td className="py-4 px-6">
                      <select
                        value={lead.assignedCrmAdvisor || ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={async (e) => {
                          e.stopPropagation();
                          const newAdvisor = e.target.value;
                          try {
                            const res = await fetch(`/api/enquiries/${lead._id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ assignedCrmAdvisor: newAdvisor }),
                            });
                            if (res.ok) {
                              fetchEnquiries();
                            }
                          } catch (err) {
                            console.error("Failed to update advisor:", err);
                          }
                        }}
                        className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-600 focus:outline-none hover:border-indigo-300 transition-colors"
                      >
                        <option value="">Unassigned</option>
                        {uniqueAdvisors.map((adv: any) => (
                          <option key={adv} value={adv}>
                            {adv}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Source */}
                    <td className="py-4 px-6 text-slate-500">
                      {lead.leadSource}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center text-[9px] font-bold bg-blue-50 text-blue-600 rounded-md px-2 py-0.5 border border-blue-100 uppercase group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors">
                        {lead.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-4 px-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to delete enquiry "${lead.studentFullName}" (${lead.enquiryId})?`)) {
                            try {
                              const res = await fetch(`/api/enquiries/${lead._id}`, { method: "DELETE" });
                              const data = await res.json();
                              if (res.ok && data.success) {
                                fetchEnquiries();
                              } else {
                                alert(data.error || data.message || "Failed to delete enquiry.");
                              }
                            } catch (err) {
                              console.error(err);
                            }
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Enquiry"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Date Pagination */}
        <div className={`flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50 shrink-0 ${isCustomDateRangeActive ? 'opacity-50 pointer-events-none' : ''}`}>
          <button
            onClick={() => setDateOffset(prev => prev + 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Previous Day
          </button>

          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-slate-700">
              {isCustomDateRangeActive ? "Custom Range Active" : dateOffset === 0 ? "All Leads (Newest First)" : dateOffset === 1 ? "Yesterday's Leads" : targetDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
              {isCustomDateRangeActive ? "Clear dates to use pagination" : dateOffset === 0 ? "Showing active directory" : `Page ${dateOffset + 1}`}
            </span>
          </div>

          <button
            onClick={() => setDateOffset(prev => Math.max(0, prev - 1))}
            disabled={dateOffset === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Day
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

      </div>

      <AddEnquiryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
          fetchEnquiries();
        }}
      />

      <LeadProfile
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onSuccess={() => fetchEnquiries()}
      />

      <ImportLeadsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchEnquiries}
      />

      <GoogleFormIntegrationModal
        isOpen={isGoogleFormModalOpen}
        onClose={() => setIsGoogleFormModalOpen(false)}
      />

      <LeadSourceManagerModal
        isOpen={isLeadSourceModalOpen}
        onClose={() => setIsLeadSourceModalOpen(false)}
        onSourceAdded={(newSrc) => {
          setDbLeadSources((prev) => {
            if (prev.some((s) => s.name.toLowerCase() === newSrc.toLowerCase())) return prev;
            return [...prev, { name: newSrc }];
          });
        }}
      />

      <JustdialIntegrationModal
        isOpen={isJustdialModalOpen}
        onClose={() => setIsJustdialModalOpen(false)}
        counsellorsList={counsellorsList}
        dbLeadSources={dbLeadSources}
        onConfigSaved={fetchEnquiries}
      />

    </div>
  );
}
