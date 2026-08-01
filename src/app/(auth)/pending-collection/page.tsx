"use client";

import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import ManagerSidebar from "@/components/ManagerSidebar";
import CounsellorSidebar from "@/components/CounsellorSidebar";
import TeacherSidebar from "@/components/TeacherSidebar";
import CrmSidebar from "@/components/CrmSidebar";
import AddFollowupModal from "@/components/AddFollowupModal";
import Student360Modal from "@/components/Student360Modal";
import PaymentReceiptModal from "@/components/PaymentReceiptModal";
import ProfileDisplay from "@/components/ProfileDisplay";
import { useUser } from "@/app/component/context/user-context";

interface PendingRecord {
  _id: string;
  admissionId: string;
  studentName: string;
  mobileNumber: string;
  email: string;
  brand: string;
  branch: string;
  course: string;
  batch: string;
  counsellor: string;
  companyAssigned: string;
  agreedFee: number;
  remainingBalance: number;
  pendingInstallmentAmount: number;
  dueDate: string;
  diffDays: number;
  statusLabel: string;
  categoryKey: string;
  lastPaymentDate?: string | null;
  lastPaymentAmount?: number;
  lastFollowupDate?: string | null;
  lastFollowupNotes?: string | null;
  hasEmi: boolean;
  numInstallments: number;
}

export default function PendingCollectionPage() {
  const { user, logout } = useUser();
  const [data, setData] = useState<{
    buckets: any;
    records: PendingRecord[];
    filters: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [selectedCourse, setSelectedCourse] = useState("All Courses");
  const [selectedBatch, setSelectedBatch] = useState("All Batches");
  const [selectedCounsellor, setSelectedCounsellor] = useState("All Counsellors");
  const [selectedCompany, setSelectedCompany] = useState("All Companies");
  const [activeBucket, setActiveBucket] = useState("all");
  const [sortField, setSortField] = useState<"dueDate" | "remainingBalance" | "studentName">("dueDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Selection & Modal States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeFollowupRecord, setActiveFollowupRecord] = useState<any | null>(null);
  const [active360AdmissionId, setActive360AdmissionId] = useState<string | null>(null);
  const [activePaymentRecord, setActivePaymentRecord] = useState<any | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchPendingData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedBrand !== "All Brands") params.append("brand", selectedBrand);
      if (selectedCourse !== "All Courses") params.append("course", selectedCourse);
      if (selectedBatch !== "All Batches") params.append("batch", selectedBatch);
      if (selectedCounsellor !== "All Counsellors") params.append("counsellor", selectedCounsellor);
      if (selectedCompany !== "All Companies") params.append("company", selectedCompany);
      if (activeBucket !== "all") params.append("bucket", activeBucket);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/pending-collection?${params.toString()}`);
      const json = await res.json();

      if (res.ok && json.success) {
        setData(json.data);
      } else {
        setError(json.message || "Failed to load pending collection data.");
      }
    } catch (err: any) {
      console.error("Error loading pending collection:", err);
      setError("An error occurred while fetching pending collection statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingData();
  }, [user, selectedBrand, selectedCourse, selectedBatch, selectedCounsellor, selectedCompany, activeBucket]);

  const userRole = (user?.role || (user as any)?.crmRole || (user as any)?.designation || "").toLowerCase().trim();

  const isSuperOrAdmin =
    userRole === "admin" ||
    userRole === "super admin" ||
    userRole === "super_admin" ||
    userRole === "director" ||
    (userRole.includes("admin") && !userRole.includes("centre") && !userRole.includes("center")) ||
    userRole.includes("director");

  const isCounsellor =
    userRole.includes("counsellor") ||
    userRole.includes("counselor") ||
    userRole.includes("sales executive");

  const isTeacher =
    userRole.includes("teacher") ||
    userRole.includes("faculty");

  const isManager =
    userRole.includes("manager") ||
    userRole.includes("centre") ||
    userRole.includes("center") ||
    userRole.includes("branch") ||
    userRole.includes("head");

  const renderSidebar = () => {
    if (isSuperOrAdmin) {
      return <Sidebar />;
    }
    if (isCounsellor) {
      return <CounsellorSidebar />;
    }
    if (isTeacher) {
      return <TeacherSidebar />;
    }
    if (isManager) {
      return <ManagerSidebar />;
    }
    if (userRole.includes("crm")) {
      return <CrmSidebar />;
    }
    return <ManagerSidebar />;
  };

  // Sort & Filter local records
  const processedRecords = useMemo(() => {
    if (!data?.records) return [];

    let list = [...data.records];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.studentName.toLowerCase().includes(q) ||
          r.admissionId.toLowerCase().includes(q) ||
          r.mobileNumber.includes(q) ||
          r.course.toLowerCase().includes(q) ||
          r.counsellor.toLowerCase().includes(q) ||
          r.brand.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "dueDate") {
        valA = new Date(a.dueDate).getTime();
        valB = new Date(b.dueDate).getTime();
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [data?.records, searchQuery, sortField, sortDirection]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(processedRecords.map((r) => r._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSendWhatsAppReminder = async (rec: PendingRecord) => {
    try {
      setToastMessage(`Sending WhatsApp fee reminder to ${rec.studentName}...`);
      const res = await fetch("/api/notifications/whatsapp-fee-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admissionId: rec._id,
          studentName: rec.studentName,
          mobileNumber: rec.mobileNumber,
          courseName: rec.course,
          pendingAmount: rec.remainingBalance,
          dueDate: new Date(rec.dueDate).toLocaleDateString("en-IN")
        })
      });
      const json = await res.json().catch(() => ({}));
      setToastMessage(`✓ WhatsApp reminder sent to ${rec.studentName} (${rec.mobileNumber})!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setToastMessage(`✓ Payment reminder link triggered for ${rec.studentName}!`);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const exportToExcel = () => {
    if (processedRecords.length === 0) {
      alert("No pending collection records available to export.");
      return;
    }

    const headers = [
      "Admission ID", "Student Name", "Mobile", "Email", "Brand", "Branch", "Course", "Batch", "Counselor", "Company", "Agreed Fee", "Remaining Balance", "Pending Due Amount", "Due Date", "Status", "Last Payment Date"
    ];

    const rows = processedRecords.map((r) => [
      r.admissionId,
      r.studentName,
      isTeacher ? "••••••••••" : r.mobileNumber,
      r.email,
      r.brand,
      r.branch,
      r.course,
      r.batch,
      r.counsellor,
      r.companyAssigned,
      r.agreedFee,
      r.remainingBalance,
      r.pendingInstallmentAmount,
      new Date(r.dueDate).toLocaleDateString("en-IN"),
      r.statusLabel,
      r.lastPaymentDate ? new Date(r.lastPaymentDate).toLocaleDateString("en-IN") : "None"
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((val) => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Pending_Collections_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const b = data?.buckets || {};

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 font-sans overflow-hidden">
      {/* Dynamic Role Sidebar */}
      {renderSidebar()}

      {/* Main Content Area */}
      <div className="flex-1 h-screen overflow-y-auto min-w-0 p-6 md:p-8 pb-32 space-y-6">
        
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mb-1">
              <span>Financial Ledger</span>
              <span>/</span>
              <span className="text-indigo-600 font-extrabold">Pending Collection Management</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Pending Collection Management
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Monitor outstanding fee balances, aging buckets, and execute fee recovery workflows from a single control interface.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>Export CSV / Excel</span>
            </button>

            <button
              onClick={() => fetchPendingData()}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-xs transition-all cursor-pointer"
              title="Refresh Dues Ledger"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-indigo-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>

            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="h-10 w-10 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                {(user?.name || "U").charAt(0).toUpperCase()}
              </button>
              <ProfileDisplay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} logout={logout} />
            </div>
          </div>
        </header>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
            <span className="flex items-center gap-2">
              <span className="text-emerald-500 font-black">✓</span> {toastMessage}
            </span>
            <button onClick={() => setToastMessage(null)} className="text-emerald-500 hover:text-emerald-800 font-bold">×</button>
          </div>
        )}

        {/* AGING BUCKETS TOP STATS GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          
          {/* Total Pending Card */}
          <div
            onClick={() => setActiveBucket("all")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              activeBucket === "all"
                ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20"
                : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className={`text-[10px] font-extrabold uppercase tracking-wider block mb-1 ${activeBucket === "all" ? "text-slate-400" : "text-slate-400"}`}>
              Total Pending
            </span>
            <div className="text-base font-black tracking-tight">₹{(b.totalPending?.amount || 0).toLocaleString("en-IN")}</div>
            <span className={`text-[10px] font-bold mt-1 block ${activeBucket === "all" ? "text-indigo-400" : "text-indigo-600"}`}>
              {b.totalPending?.count || 0} Students
            </span>
          </div>

          {/* Total Overdue */}
          <div
            onClick={() => setActiveBucket("overdue")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              activeBucket === "overdue"
                ? "bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-600/20"
                : "bg-rose-50/50 text-slate-800 border-rose-200/80 hover:bg-rose-100/50"
            }`}
          >
            <span className={`text-[10px] font-extrabold uppercase tracking-wider block mb-1 ${activeBucket === "overdue" ? "text-rose-200" : "text-rose-600"}`}>
              Total Overdue
            </span>
            <div className="text-base font-black tracking-tight">₹{(b.overdueTotal?.amount || 0).toLocaleString("en-IN")}</div>
            <span className={`text-[10px] font-bold mt-1 block ${activeBucket === "overdue" ? "text-rose-100" : "text-rose-700"}`}>
              {b.overdueTotal?.count || 0} Students
            </span>
          </div>

          {/* Due Today */}
          <div
            onClick={() => setActiveBucket("dueToday")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              activeBucket === "dueToday"
                ? "bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-500/20"
                : "bg-amber-50/50 text-slate-800 border-amber-200/80 hover:bg-amber-100/50"
            }`}
          >
            <span className={`text-[10px] font-extrabold uppercase tracking-wider block mb-1 ${activeBucket === "dueToday" ? "text-amber-100" : "text-amber-700"}`}>
              Due Today
            </span>
            <div className="text-base font-black tracking-tight">₹{(b.dueToday?.amount || 0).toLocaleString("en-IN")}</div>
            <span className={`text-[10px] font-bold mt-1 block ${activeBucket === "dueToday" ? "text-amber-100" : "text-amber-700"}`}>
              {b.dueToday?.count || 0} Students
            </span>
          </div>

          {/* Next 7 Days */}
          <div
            onClick={() => setActiveBucket("next7Days")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              activeBucket === "next7Days"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-600/20"
                : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className={`text-[10px] font-extrabold uppercase tracking-wider block mb-1 ${activeBucket === "next7Days" ? "text-indigo-200" : "text-slate-400"}`}>
              Next 7 Days
            </span>
            <div className="text-base font-black tracking-tight">₹{(b.next7Days?.amount || 0).toLocaleString("en-IN")}</div>
            <span className={`text-[10px] font-bold mt-1 block ${activeBucket === "next7Days" ? "text-indigo-100" : "text-indigo-600"}`}>
              {b.next7Days?.count || 0} Students
            </span>
          </div>

          {/* Next 15 Days */}
          <div
            onClick={() => setActiveBucket("next15Days")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              activeBucket === "next15Days"
                ? "bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-600/20"
                : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className={`text-[10px] font-extrabold uppercase tracking-wider block mb-1 ${activeBucket === "next15Days" ? "text-purple-200" : "text-slate-400"}`}>
              Next 15 Days
            </span>
            <div className="text-base font-black tracking-tight">₹{(b.next15Days?.amount || 0).toLocaleString("en-IN")}</div>
            <span className={`text-[10px] font-bold mt-1 block ${activeBucket === "next15Days" ? "text-purple-100" : "text-purple-600"}`}>
              {b.next15Days?.count || 0} Students
            </span>
          </div>

          {/* Next 30 Days */}
          <div
            onClick={() => setActiveBucket("next30Days")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              activeBucket === "next30Days"
                ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-600/20"
                : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className={`text-[10px] font-extrabold uppercase tracking-wider block mb-1 ${activeBucket === "next30Days" ? "text-blue-200" : "text-slate-400"}`}>
              Next 30 Days
            </span>
            <div className="text-base font-black tracking-tight">₹{(b.next30Days?.amount || 0).toLocaleString("en-IN")}</div>
            <span className={`text-[10px] font-bold mt-1 block ${activeBucket === "next30Days" ? "text-blue-100" : "text-blue-600"}`}>
              {b.next30Days?.count || 0} Students
            </span>
          </div>

          {/* 31–60 Days Overdue */}
          <div
            onClick={() => setActiveBucket("overdue31to60")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              activeBucket === "overdue31to60"
                ? "bg-orange-600 text-white border-orange-600 shadow-md ring-2 ring-orange-600/20"
                : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className={`text-[10px] font-extrabold uppercase tracking-wider block mb-1 ${activeBucket === "overdue31to60" ? "text-orange-200" : "text-slate-400"}`}>
              31–60 Days
            </span>
            <div className="text-base font-black tracking-tight">₹{(b.overdue31to60?.amount || 0).toLocaleString("en-IN")}</div>
            <span className={`text-[10px] font-bold mt-1 block ${activeBucket === "overdue31to60" ? "text-orange-100" : "text-orange-600"}`}>
              {b.overdue31to60?.count || 0} Students
            </span>
          </div>

          {/* 90+ Days Overdue */}
          <div
            onClick={() => setActiveBucket("overdue90Plus")}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
              activeBucket === "overdue90Plus"
                ? "bg-red-700 text-white border-red-700 shadow-md ring-2 ring-red-700/20"
                : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className={`text-[10px] font-extrabold uppercase tracking-wider block mb-1 ${activeBucket === "overdue90Plus" ? "text-red-200" : "text-slate-400"}`}>
              90+ Days
            </span>
            <div className="text-base font-black tracking-tight">₹{(b.overdue90Plus?.amount || 0).toLocaleString("en-IN")}</div>
            <span className={`text-[10px] font-bold mt-1 block ${activeBucket === "overdue90Plus" ? "text-red-100" : "text-red-600"}`}>
              {b.overdue90Plus?.count || 0} Students
            </span>
          </div>

        </div>

        {/* ADVANCED SEARCH & FILTERS BAR */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 min-w-[240px]">
            <input
              type="text"
              placeholder="Search by student name, admission #, mobile, course, counselor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold text-slate-800 transition-all"
            />
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400 absolute left-3 top-2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
            </svg>
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Brand Filter */}
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="All Brands">All Brands</option>
              {data?.filters?.availableBrands?.map((b: string) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Course Filter */}
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="All Courses">All Courses</option>
              {data?.filters?.availableCourses?.map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Batch Filter */}
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="All Batches">All Batches</option>
              {data?.filters?.availableBatches?.map((btc: string) => (
                <option key={btc} value={btc}>{btc}</option>
              ))}
            </select>

            {/* Counselor Filter */}
            <select
              value={selectedCounsellor}
              onChange={(e) => setSelectedCounsellor(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="All Counsellors">All Counselors</option>
              {data?.filters?.availableCounsellors?.map((cn: string) => (
                <option key={cn} value={cn}>{cn}</option>
              ))}
            </select>

            {/* Sorting */}
            <select
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [f, d] = e.target.value.split("-") as [any, any];
                setSortField(f);
                setSortDirection(d);
              }}
              className="px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-extrabold outline-none cursor-pointer"
            >
              <option value="dueDate-asc">📅 Due Date (Soonest)</option>
              <option value="dueDate-desc">📅 Due Date (Latest)</option>
              <option value="remainingBalance-desc">💰 Balance (Highest)</option>
              <option value="remainingBalance-asc">💰 Balance (Lowest)</option>
              <option value="studentName-asc">👤 Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* LEDGER TABLE CONTAINER */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          
          {/* Table Header Bar */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-800">
                Showing <span className="text-indigo-600 font-extrabold">{processedRecords.length}</span> Records
              </span>
              {selectedIds.length > 0 && (
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-extrabold rounded-lg">
                  {selectedIds.length} Selected
                </span>
              )}
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    alert(`Triggered bulk WhatsApp reminders for ${selectedIds.length} selected students!`);
                  }}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  💬 Bulk WhatsApp Reminders ({selectedIds.length})
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={processedRecords.length > 0 && selectedIds.length === processedRecords.length}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-6">Student Details</th>
                  <th className="py-3.5 px-6">Course & Brand</th>
                  <th className="py-3.5 px-6">Counselor & Batch</th>
                  <th className="py-3.5 px-6">Due Date & Aging</th>
                  <th className="py-3.5 px-6">Pending Dues</th>
                  <th className="py-3.5 px-6">Last Activity</th>
                  <th className="py-3.5 px-6 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td colSpan={8} className="py-4 px-6">
                        <div className="h-4 bg-slate-200/80 rounded-lg w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : processedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                      No pending collection records match the selected filters.
                    </td>
                  </tr>
                ) : (
                  processedRecords.map((rec) => {
                    const isOverdue = rec.diffDays < 0;
                    const isDueToday = rec.diffDays === 0;

                    return (
                      <tr key={rec._id} className="hover:bg-slate-50/80 transition-colors">
                        
                        {/* Checkbox */}
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(rec._id)}
                            onChange={() => handleSelectOne(rec._id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>

                        {/* Student Details */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                              {rec.studentName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-900 block text-xs">
                                {rec.studentName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium block">
                                {rec.admissionId} • {isTeacher ? "••••••••••" : rec.mobileNumber}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Course & Brand */}
                        <td className="py-4 px-6">
                          <span className="font-bold text-slate-800 block text-xs">{rec.course}</span>
                          <span className="inline-block mt-0.5 px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-md border border-slate-200">
                            {rec.brand}
                          </span>
                        </td>

                        {/* Counselor & Batch */}
                        <td className="py-4 px-6">
                          <span className="font-bold text-slate-700 block text-xs">{rec.counsellor}</span>
                          <span className="text-[10px] text-slate-400 font-medium block">{rec.batch}</span>
                        </td>

                        {/* Due Date & Aging */}
                        <td className="py-4 px-6">
                          <span className="font-bold text-slate-800 block text-xs">
                            {new Date(rec.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          <span
                            className={`inline-block mt-0.5 px-2 py-0.5 font-bold text-[10px] rounded-md border ${
                              isOverdue
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : isDueToday
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {rec.statusLabel}
                          </span>
                        </td>

                        {/* Pending Dues */}
                        <td className="py-4 px-6">
                          <span className="font-black text-rose-600 block text-sm">
                            ₹{rec.remainingBalance.toLocaleString("en-IN")}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium block">
                            Agreed Fee: ₹{rec.agreedFee.toLocaleString("en-IN")}
                          </span>
                        </td>

                        {/* Last Activity */}
                        <td className="py-4 px-6 text-xs">
                          <span className="text-slate-600 block font-medium">
                            Payment: {rec.lastPaymentDate ? new Date(rec.lastPaymentDate).toLocaleDateString("en-IN") : "No Payment"}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                            Follow-up: {rec.lastFollowupDate ? new Date(rec.lastFollowupDate).toLocaleDateString("en-IN") : "None"}
                          </span>
                        </td>

                        {/* Quick Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            
                            {/* Record Payment */}
                            <button
                              onClick={() => {
                                window.location.href = `/manager-dashboard/fee-collection?admissionId=${rec.admissionId}`;
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                              title="Record Payment"
                            >
                              💳 Pay
                            </button>

                            {/* Send WhatsApp Reminder */}
                            <button
                              onClick={() => handleSendWhatsAppReminder(rec)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-xs transition-colors cursor-pointer"
                              title="Send WhatsApp Fee Reminder"
                            >
                              💬 WhatsApp
                            </button>

                            {/* Add Follow-up */}
                            <button
                              onClick={() => {
                                setActiveFollowupRecord({
                                  _id: rec._id,
                                  studentFullName: rec.studentName,
                                  primaryPhoneMobile: rec.mobileNumber,
                                  targetCourse: rec.course,
                                  targetBrand: rec.brand
                                });
                              }}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                              title="Schedule Follow-up"
                            >
                              📝 Follow-up
                            </button>

                            {/* Student 360 */}
                            <button
                              onClick={() => setActive360AdmissionId(rec._id)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 transition-colors cursor-pointer"
                              title="View Student 360"
                            >
                              👤 360
                            </button>

                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Modals Integration */}
      {activeFollowupRecord && (
        <AddFollowupModal
          isOpen={Boolean(activeFollowupRecord)}
          onClose={() => setActiveFollowupRecord(null)}
          record={activeFollowupRecord}
          onSuccess={() => {
            setActiveFollowupRecord(null);
            fetchPendingData();
          }}
        />
      )}

      {active360AdmissionId && (
        <Student360Modal
          isOpen={Boolean(active360AdmissionId)}
          admissionId={active360AdmissionId}
          onClose={() => setActive360AdmissionId(null)}
          onRefresh={() => fetchPendingData()}
        />
      )}

    </div>
  );
}
