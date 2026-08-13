"use client";

import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import ManagerSidebar from "@/components/ManagerSidebar";
import CounsellorSidebar from "@/components/CounsellorSidebar";
import ProfileDisplay from "@/components/ProfileDisplay";
import { useUser } from "@/app/component/context/user-context";
import AddCorporateTrainingModal from "@/components/AddCorporateTrainingModal";
import CorporateTrainingDetailModal from "@/components/CorporateTrainingDetailModal";
import ExcelJS from "exceljs";

export default function CorporateTrainingsPage() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [trainings, setTrainings] = useState<any[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [facultyList, setFacultyList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedFaculty, setSelectedFaculty] = useState("All");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [datePreset, setDatePreset] = useState<string>("all");

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Role validation
  const userRole = (user?.role || "").toLowerCase().trim();
  const isCounsellor =
    userRole === "counsellor" ||
    userRole === "counselor" ||
    userRole.includes("counsellor") ||
    userRole.includes("counselor");

  const isBrandManager =
    userRole === "brand_manager" ||
    userRole === "brand-manager" ||
    userRole === "brand manager" ||
    userRole === "manager" ||
    userRole === "centre head" ||
    userRole === "centre_head" ||
    userRole === "center head" ||
    userRole === "center_head" ||
    userRole === "branch head" ||
    userRole === "branch_head";

  const isAuthorized =
    userRole === "admin" ||
    userRole === "super admin" ||
    userRole === "super_admin" ||
    userRole === "director" ||
    isBrandManager ||
    isCounsellor;

  useEffect(() => {
    if (isBrandManager && user?.brandScope && user?.brandScope !== "All Brands" && user?.brandScope !== "All") {
      setSelectedBrand(user.brandScope);
    }
  }, [userRole, user?.brandScope]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBrand, selectedStatus, selectedFaculty, sortBy, startDate, endDate]);

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    const toYMD = (d: Date) => d.toISOString().split("T")[0];

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = toYMD(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === "this_week") {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      setStartDate(toYMD(w));
      setEndDate(toYMD(now));
    } else if (preset === "this_month") {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toYMD(m));
      setEndDate(toYMD(now));
    }
  };

  const fetchTrainings = async () => {
    setIsLoading(true);
    try {
      let url = "/api/corporate-trainings";
      const params = new URLSearchParams();
      if (selectedBrand && selectedBrand !== "All Brands" && selectedBrand !== "All") {
        params.append("brand", selectedBrand);
      }
      if (searchQuery.trim()) {
        params.append("q", searchQuery.trim());
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTrainings(json.data);

        // Extract unique brands & faculty
        const bSet = new Set<string>();
        const fSet = new Set<string>();
        json.data.forEach((t: any) => {
          if (t.brand) bSet.add(t.brand);
          if (t.faculty) fSet.add(t.faculty);
        });
        setBrands(Array.from(bSet));
        setFacultyList(Array.from(fSet));
      }
    } catch (err) {
      console.error("Failed to fetch corporate trainings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchTrainings();
    }
  }, [isAuthorized, selectedBrand]);

  const getRecordTimestamp = (t: any): number => {
    const dStr = t.startDate || t.createdAt;
    if (!dStr) return 0;
    const time = new Date(dStr).getTime();
    return isNaN(time) ? 0 : time;
  };

  const formatDate = (dStr: any) => {
    if (!dStr) return "N/A";
    try {
      const d = new Date(dStr);
      return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return "N/A";
    }
  };

  // Filter and Sort trainings
  const filteredTrainings = useMemo(() => {
    const list = trainings.filter((t) => {
      if (selectedStatus !== "All" && t.status !== selectedStatus) {
        return false;
      }
      if (selectedFaculty !== "All" && t.faculty !== selectedFaculty) {
        return false;
      }

      // Date filtering on Start Date
      if (startDate || endDate) {
        const time = getRecordTimestamp(t);
        if (time > 0) {
          if (startDate) {
            const startMs = new Date(startDate).setHours(0, 0, 0, 0);
            if (time < startMs) return false;
          }
          if (endDate) {
            const endMs = new Date(endDate).setHours(23, 59, 59, 999);
            if (time > endMs) return false;
          }
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCompany = (t.companyName || "").toLowerCase().includes(q);
        const matchProgram = (t.trainingProgram || "").toLowerCase().includes(q);
        const matchFaculty = (t.faculty || "").toLowerCase().includes(q);
        const matchId = (t.trainingId || "").toLowerCase().includes(q);
        const matchContact = (t.contactPerson || "").toLowerCase().includes(q);
        const matchPhone = (t.contactPhone || "").toLowerCase().includes(q);
        const matchLoc = (t.location || "").toLowerCase().includes(q);
        return matchCompany || matchProgram || matchFaculty || matchId || matchContact || matchPhone || matchLoc;
      }
      return true;
    });

    return list.sort((a, b) => {
      const timeA = getRecordTimestamp(a);
      const timeB = getRecordTimestamp(b);

      if (sortBy === "date-desc") return timeB - timeA;
      if (sortBy === "date-asc") return timeA - timeB;
      if (sortBy === "amount-desc") return (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0);
      if (sortBy === "amount-asc") return (Number(a.totalAmount) || 0) - (Number(b.totalAmount) || 0);
      if (sortBy === "name-asc") return (a.companyName || "").localeCompare(b.companyName || "");
      if (sortBy === "name-desc") return (b.companyName || "").localeCompare(a.companyName || "");
      return timeB - timeA;
    });
  }, [trainings, selectedStatus, selectedFaculty, searchQuery, startDate, endDate, sortBy]);

  // Metrics
  const totalCommercials = filteredTrainings.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);
  const totalCollected = filteredTrainings.reduce((acc, t) => acc + (Number(t.amountReceived) || 0), 0);
  const totalOutstanding = filteredTrainings.reduce((acc, t) => acc + (Number(t.remainingBalance) || 0), 0);
  const activeCount = filteredTrainings.filter((t) => t.status === "Ongoing" || t.status === "Scheduled").length;

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CoachFlow Corporate Hub";
    const sheet = workbook.addWorksheet("Corporate Trainings");

    sheet.columns = [
      { header: "Training ID", key: "id", width: 18 },
      { header: "Client Organization", key: "company", width: 28 },
      { header: "Contact Person", key: "contact", width: 20 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Training Program", key: "program", width: 32 },
      { header: "Lead Faculty", key: "faculty", width: 20 },
      { header: "Start Date", key: "start", width: 14 },
      { header: "End Date", key: "end", width: 14 },
      { header: "Mode", key: "mode", width: 22 },
      { header: "Participants", key: "pax", width: 14 },
      { header: "Total Agreed Amount", key: "total", width: 20 },
      { header: "Amount Collected", key: "collected", width: 20 },
      { header: "Outstanding Balance", key: "balance", width: 20 },
      { header: "Status", key: "status", width: 16 },
      { header: "Brand Scope", key: "brand", width: 18 },
      { header: "Billing Entity", key: "entity", width: 28 },
      { header: "Sales Executive", key: "sales", width: 20 },
    ];

    // Style Header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    filteredTrainings.forEach((t) => {
      sheet.addRow({
        id: t.trainingId || "N/A",
        company: t.companyName || "-",
        contact: t.contactPerson || "-",
        phone: t.contactPhone || "-",
        program: t.trainingProgram || "-",
        faculty: t.faculty || "-",
        start: formatDate(t.startDate),
        end: formatDate(t.endDate),
        mode: t.trainingMode || "-",
        pax: t.numberOfParticipants || 1,
        total: Number(t.totalAmount) || 0,
        collected: Number(t.amountReceived) || 0,
        balance: Number(t.remainingBalance) || 0,
        status: t.status || "-",
        brand: t.brand || "-",
        entity: t.companyAssigned || "-",
        sales: t.salesExecutive || "-",
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Corporate_Trainings_Register_${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderSidebar = () => {
    if (userRole === "admin" || userRole === "super admin" || userRole === "super_admin") {
      return <Sidebar />;
    }
    if (isCounsellor) {
      return <CounsellorSidebar />;
    }
    return <ManagerSidebar />;
  };

  if (!isAuthorized && !isLoading) {
    return (
      <div className="flex h-screen bg-[#f8faff] text-slate-800 font-sans">
        {renderSidebar()}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white border border-rose-200 rounded-3xl p-8 max-w-md text-center shadow-xl">
            <div className="h-16 w-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 font-black text-2xl">
              🔒
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">Access Restricted</h2>
            <p className="text-xs font-semibold text-slate-500 mb-6">
              The Corporate Training Hub is accessible only to Administrators, Sales Executives, and Centre Heads.
            </p>
            <a
              href="/admin-dashboard"
              className="inline-block px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      {renderSidebar()}

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/80 pb-4 mb-6 shrink-0">
          <div>
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 select-none">
              <span>CoachFlow</span>
              <span>/</span>
              <span className="text-slate-600 font-bold">Corporate Trainings</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mt-1 flex items-center gap-2">
              <span>Corporate & Enterprise Training Hub</span>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-200">
                Admin, Sales & Centre Heads
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportToExcel}
              className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>📊</span>
              <span>Export Excel</span>
            </button>

            <button
              onClick={() => fetchTrainings()}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>🔄</span>
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>✨</span>
              <span>+ Add Corporate Training</span>
            </button>

            <ProfileDisplay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} logout={logout} />
          </div>
        </header>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Corporate Clients</span>
            <div className="text-2xl font-black text-indigo-600 mt-1">{filteredTrainings.length} Programs</div>
            <span className="text-[10px] font-semibold text-slate-400">{activeCount} Ongoing / Scheduled</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Agreed Contract Commercials</span>
            <div className="text-2xl font-black text-slate-900 mt-1">₹{totalCommercials.toLocaleString("en-IN")}</div>
            <span className="text-[10px] font-semibold text-slate-400">Total B2B Contract Value</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Fees Collected</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">₹{totalCollected.toLocaleString("en-IN")}</div>
            <span className="text-[10px] font-semibold text-slate-400">Advance & Installments</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Outstanding Balance</span>
            <div className="text-2xl font-black text-rose-600 mt-1">₹{totalOutstanding.toLocaleString("en-IN")}</div>
            <span className="text-[10px] font-semibold text-slate-400">Pending Receivables</span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 mb-6 shadow-xs space-y-3.5">
          {/* Top Row: Search + Filter Grid */}
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[280px] max-w-lg flex items-center gap-2">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Search by client, program, lead faculty, training ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-semibold"
                />
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400 absolute left-3 top-2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-center w-full xl:w-auto">
              {/* Sort Order */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full h-9 px-3 text-xs font-extrabold bg-indigo-50/80 border border-indigo-200 text-indigo-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="date-desc">📅 Date: Newest First</option>
                  <option value="date-asc">📅 Date: Oldest First</option>
                  <option value="amount-desc">💰 Amount: High → Low</option>
                  <option value="amount-asc">💰 Amount: Low → High</option>
                  <option value="name-asc">🏢 Client: A → Z</option>
                  <option value="name-desc">🏢 Client: Z → A</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full h-9 px-3 text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="All">📌 All Statuses</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Completed">Completed</option>
                  <option value="Payment Pending">Payment Pending</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Brand Filter */}
              <div className="relative">
                <select
                  value={selectedBrand}
                  disabled={isBrandManager && Boolean(user?.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All")}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full h-9 px-3 text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer disabled:opacity-60"
                >
                  <option value="All Brands">🏢 All Brands</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Faculty Filter */}
              <div className="relative">
                <select
                  value={selectedFaculty}
                  onChange={(e) => setSelectedFaculty(e.target.value)}
                  className="w-full h-9 px-3 text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="All">👨‍🏫 All Faculty</option>
                  {facultyList.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Bottom Row: Date Presets & Custom Date Range */}
          <div className="bg-slate-50/70 border border-slate-100 rounded-xl px-3.5 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1.5">Start Date Scope:</span>
              {[
                { id: "all", label: "All Dates" },
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "this_week", label: "Last 7 Days" },
                { id: "this_month", label: "This Month" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleDatePresetChange(p.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    datePreset === p.id && (!startDate && !endDate && p.id === "all" || p.id !== "all")
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset("custom");
                  }}
                  className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset("custom");
                  }}
                  className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>

              {(startDate || endDate || datePreset !== "all") && (
                <button
                  type="button"
                  onClick={() => handleDatePresetChange("all")}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  title="Reset Date Filter"
                >
                  ✕ Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Corporate Trainings Table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 pr-4 min-w-[180px]">Client & Training ID</th>
                  <th className="pb-3 pr-3 min-w-[180px]">Program & Mode</th>
                  <th className="pb-3 pr-3 min-w-[140px]">Lead Faculty</th>
                  <th className="pb-3 pr-3 min-w-[150px]">Schedule (Start → End)</th>
                  <th className="pb-3 pr-3 min-w-[90px]">Brand</th>
                  <th className="pb-3 px-3 text-right min-w-[100px]">Total Agreed</th>
                  <th className="pb-3 px-3 text-right min-w-[100px]">Balance Due</th>
                  <th className="pb-3 text-center min-w-[100px]">Status</th>
                  <th className="pb-3 text-right min-w-[110px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 font-semibold text-slate-600">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                      Loading Corporate Trainings Directory...
                    </td>
                  </tr>
                ) : filteredTrainings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                      No corporate training programs found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredTrainings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((t) => {
                    const totalAmt = Number(t.totalAmount) || 0;
                    const remBal = Number(t.remainingBalance) || 0;
                    const paid = Number(t.amountReceived) || 0;
                    const pct = totalAmt > 0 ? Math.min(100, Math.round((paid / totalAmt) * 100)) : 0;

                    return (
                      <tr
                        key={t._id}
                        onClick={() => {
                          setSelectedTraining(t);
                          setIsDetailModalOpen(true);
                        }}
                        className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0 uppercase border border-indigo-200">
                              {t.companyName ? t.companyName.substring(0, 2) : "CP"}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {t.companyName}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                                <span>{t.trainingId || "CORP-TRG"}</span>
                                {t.contactPerson && <span>• {t.contactPerson}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="pr-3 text-slate-700">
                          <div className="font-bold text-slate-800">{t.trainingProgram}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <span>{t.trainingMode || "Offline"}</span>
                            {t.numberOfParticipants && <span>• {t.numberOfParticipants} Attendees</span>}
                          </div>
                        </td>

                        <td className="pr-3 text-slate-700">
                          <div className="font-extrabold text-slate-800 flex items-center gap-1">
                            <span>👨‍🏫</span>
                            <span>{t.faculty}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {t.durationHours || "Standard Schedule"}
                          </div>
                        </td>

                        <td className="pr-3 whitespace-nowrap">
                          <div className="font-extrabold text-indigo-700 flex items-center gap-1">
                            <span>📅</span>
                            <span>{formatDate(t.startDate)}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            to {formatDate(t.endDate)}
                          </div>
                        </td>

                        <td className="pr-3">
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border border-indigo-100 whitespace-nowrap">
                            {t.brand || "Default"}
                          </span>
                        </td>

                        <td className="px-3 text-right font-black text-slate-900 whitespace-nowrap">
                          <div>₹{totalAmt.toLocaleString("en-IN")}</div>
                          <div className="text-[10px] font-extrabold text-emerald-600">
                            Recd: ₹{paid.toLocaleString("en-IN")} ({pct}%)
                          </div>
                        </td>

                        <td className="px-3 text-right whitespace-nowrap">
                          {remBal > 0 ? (
                            <span className="font-black text-rose-600">₹{remBal.toLocaleString("en-IN")}</span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border border-emerald-200">
                              Settled
                            </span>
                          )}
                        </td>

                        <td className="px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                              t.status === "Ongoing"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : t.status === "Completed"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : t.status === "Payment Pending"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            {t.status || "Scheduled"}
                          </span>
                        </td>

                        <td className="text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTraining(t);
                              setIsDetailModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-extrabold text-[11px] rounded-lg border border-indigo-200/80 transition-all cursor-pointer shadow-xs"
                          >
                            View / Pay
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredTrainings.length > itemsPerPage && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="text-slate-400 font-semibold">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, filteredTrainings.length)} of {filteredTrainings.length} programs
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-3 py-1 font-bold text-slate-700">
                  Page {currentPage} of {Math.ceil(filteredTrainings.length / itemsPerPage)}
                </span>
                <button
                  disabled={currentPage >= Math.ceil(filteredTrainings.length / itemsPerPage)}
                  onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredTrainings.length / itemsPerPage), p + 1))}
                  className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <AddCorporateTrainingModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => fetchTrainings()}
        currentUser={user}
      />

      {/* Detail / Payment Modal */}
      {selectedTraining && (
        <CorporateTrainingDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          training={selectedTraining}
          onUpdated={() => {
            fetchTrainings();
            setIsDetailModalOpen(false);
          }}
          currentUser={user}
        />
      )}
    </div>
  );
}
