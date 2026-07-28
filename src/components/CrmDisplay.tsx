"use client";

import React, { useState, useEffect, useRef } from "react";
import RegisterCounsellorModal from "./RegisterCounsellorModal";
import EditCounsellorModal from "./EditCounsellorModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import TransferCounsellorModal from "./TransferCounsellorModal";
import { useUser } from "@/app/component/context/user-context";

const monthsList = [
  { value: 0, label: "January" },
  { value: 1, label: "February" },
  { value: 2, label: "March" },
  { value: 3, label: "April" },
  { value: 4, label: "May" },
  { value: 5, label: "June" },
  { value: 6, label: "July" },
  { value: 7, label: "August" },
  { value: 8, label: "September" },
  { value: 9, label: "October" },
  { value: 10, label: "November" },
  { value: 11, label: "December" },
];

const weeksList = [
  { value: "week1", label: "Week 1 (1st - 7th)" },
  { value: "week2", label: "Week 2 (8th - 14th)" },
  { value: "week3", label: "Week 3 (15th - 21st)" },
  { value: "week4", label: "Week 4 (22nd - 28th)" },
  { value: "week5", label: "Week 5 (29th - End)" },
];

const yearsList = [2024, 2025, 2026, 2027];

export default function CrmDisplay() {
  const { user } = useUser();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [counsellorToEdit, setCounsellorToEdit] = useState<any | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [counsellorToTransfer, setCounsellorToTransfer] = useState<any | null>(null);
  const [counsellorToDelete, setCounsellorToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  const [counsellorList, setCounsellorList] = useState<any[]>([]);
  const [rawEnquiries, setRawEnquiries] = useState<any[]>([]);
  const [rawAdmissions, setRawAdmissions] = useState<any[]>([]);
  const [dbBrands, setDbBrands] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Date Filter States
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "weekly" | "monthly" | "yearly" | "custom">("all");
  const [selectedWeek, setSelectedWeek] = useState<"week1" | "week2" | "week3" | "week4" | "week5">("week1");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All Brands");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [counsellorsRes, enquiriesRes, admissionsRes, brandsRes] = await Promise.all([
        fetch("/api/counsellors?role=crm"),
        fetch("/api/enquiries"),
        fetch("/api/admissions"),
        fetch("/api/brands")
      ]);
      const data = await counsellorsRes.json();
      const enqData = await enquiriesRes.json();
      const admData = await admissionsRes.json();
      const brandData = await brandsRes.json();

      const enquiries = (enqData && enqData.enquiries) ? enqData.enquiries : [];
      const admissions = (admData && (admData.admissions || admData.data)) ? (admData.admissions || admData.data) : [];
      
      setRawEnquiries(enquiries);
      setRawAdmissions(admissions);

      if (brandData?.success && Array.isArray(brandData.brands)) {
        setDbBrands(brandData.brands.map((b: any) => b.name));
      }

      if (data.success && data.counsellors && data.counsellors.length > 0) {
        const list = data.counsellors.map((c: any) => {
          const nameParts = (c.name || "").split(" ");
          const firstInitial = nameParts[0]?.[0] || "";
          const lastInitial = nameParts[1]?.[0] || "";
          const target = c.annualTarget || 500000;

          const nameLower = (c.name || "").toLowerCase().trim();
          const emailLower = (c.email || "").toLowerCase().trim();
          const idLower = String(c._id || "").toLowerCase().trim();

          const matchesCounsellor = (val: string) => {
            if (!val) return false;
            const low = val.toLowerCase().trim();
            return (
              low === nameLower ||
              low === emailLower ||
              low === idLower ||
              (nameLower && low.includes(nameLower)) ||
              (nameLower && nameLower.includes(low))
            );
          };

          const myEnquiries = enquiries.filter((e: any) => matchesCounsellor(e.assignedCrmAdvisor));
          const myAdmissions = admissions.filter((a: any) => matchesCounsellor(a.counsellor));

          const assignedLeadsCount = myEnquiries.length;
          const demosCount = myEnquiries.filter((e: any) => 
            e.isDemoScheduled || (e.demos && e.demos.length > 0) || (e.followUps || []).some((f: any) => f.typeOfContact === "Demo Class")
          ).length;
          const admittedEnquiriesCount = myEnquiries.filter((e: any) => e.status === "Admitted").length;

          const realAdmissionFeeToCollect = myAdmissions.reduce((sum: number, adm: any) => {
            const fee = Number(adm.finalFee || adm.courseFee || 0);
            return sum + (isNaN(fee) ? 0 : fee);
          }, 0);

          const realAdmissionRevenue = myAdmissions.reduce((sum: number, adm: any) => {
            const paid = adm.amountReceivedToday || Number(adm.finalFee || 0) - Number(adm.remainingBalance || 0);
            return sum + Math.max(Number(paid) || 0, 0);
          }, 0);

          const realAdmissionRemaining = myAdmissions.reduce((sum: number, adm: any) => {
            const rem = Number(adm.remainingBalance ?? (Number(adm.finalFee || 0) - (adm.amountReceivedToday || 0)));
            return sum + Math.max(Number(rem) || 0, 0);
          }, 0);

          const maxRealRevenue = Math.max(realAdmissionRevenue, c.currentRevenue || 0);
          const maxAdmissionsCount = Math.max(admittedEnquiriesCount, myAdmissions.length);

          const hasAssignedRecords = assignedLeadsCount > 0 || myAdmissions.length > 0;
          const revenue = hasAssignedRecords ? maxRealRevenue : (c.currentRevenue || 0);
          const admissionsNum = hasAssignedRecords ? maxAdmissionsCount : (c.admissionsRecorded || 0);
          const convRate = assignedLeadsCount > 0 ? ((maxAdmissionsCount / assignedLeadsCount) * 100).toFixed(1) : "0.0";

          return {
            id: c._id,
            registryId: `crm-${c._id}`,
            name: c.name || "Unknown",
            email: c.email || "",
            phone: c.phone || "",
            scope: c.brandScope || "All Brands",
            targetNum: target,
            revenueNum: revenue,
            admissionsNum: admissionsNum,
            assignedLeadsNum: assignedLeadsCount,
            demosNum: demosCount,
            totalFeeToCollectNum: realAdmissionFeeToCollect || target,
            feeRemainingNum: realAdmissionRemaining,
            convRate: `${convRate}%`,
            targetCollected: `₹${revenue.toLocaleString("en-IN")} / ₹${target.toLocaleString("en-IN")}`,
            percentage: `${((revenue / Math.max(target, 1)) * 100).toFixed(1)}%`,
            status: "ACTIVE",
            annualTarget: `₹${target.toLocaleString("en-IN")}`,
            revenueCollected: `₹${revenue.toLocaleString("en-IN")}`,
            joiningDate: c.joiningDate ? new Date(c.joiningDate).toISOString().split("T")[0] : "—",
            admissions: `${admissionsNum} Seats`,
            initials: `${firstInitial}${lastInitial}`.toUpperCase() || "CRM",
            scopeBadge: "CRM Advisor Scope",
            myAdmissions,
            myEnquiries
          };
        });

        list.sort((a: any, b: any) => b.revenueNum - a.revenueNum);

        setCounsellorList(list);
        if (list.length > 0) {
          setSelectedId((prev) => (prev && list.some((c: any) => c.id === prev) ? prev : list[0].id));
        } else {
          setSelectedId(null);
        }
      } else {
        setCounsellorList([]);
        setSelectedId(null);
      }
    } catch (err) {
      console.error("Failed to load CRM advisors data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Unique brands list
  const uniqueBrands = Array.from(
    new Set([...dbBrands, ...counsellorList.map((c) => c.scope).filter(Boolean)])
  );

  // Helper date filter checking function
  const isWithinTimeFilter = (dateStr?: string | Date) => {
    if (!dateStr) return false;
    const itemDate = new Date(dateStr);
    if (isNaN(itemDate.getTime())) return false;

    const now = new Date();

    if (timeFilter === "today") {
      return (
        itemDate.getDate() === now.getDate() &&
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    }

    if (timeFilter === "weekly") {
      if (itemDate.getMonth() !== selectedMonth || itemDate.getFullYear() !== selectedYear) {
        return false;
      }
      const day = itemDate.getDate();
      if (selectedWeek === "week1") return day >= 1 && day <= 7;
      if (selectedWeek === "week2") return day >= 8 && day <= 14;
      if (selectedWeek === "week3") return day >= 15 && day <= 21;
      if (selectedWeek === "week4") return day >= 22 && day <= 28;
      if (selectedWeek === "week5") return day >= 29;
      return true;
    }

    if (timeFilter === "monthly") {
      return (
        itemDate.getMonth() === selectedMonth &&
        itemDate.getFullYear() === selectedYear
      );
    }

    if (timeFilter === "yearly") {
      return itemDate.getFullYear() === selectedYear;
    }

    if (timeFilter === "custom") {
      if (customStartDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        if (itemDate < start) return false;
      }
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        if (itemDate > end) return false;
      }
      return true;
    }

    return true; // "all"
  };

  // Filtered Admissions & Enquiries across selected brand & date filter
  const filteredAdmissions = rawAdmissions.filter((adm: any) => {
    const matchesBrand =
      selectedBrand === "All Brands" || (adm.brand || "").toLowerCase() === selectedBrand.toLowerCase();
    const dateToUse = adm.admissionDate || adm.createdAt || adm.paymentDate || adm.date;
    return matchesBrand && isWithinTimeFilter(dateToUse);
  });

  const filteredEnquiries = rawEnquiries.filter((enq: any) => {
    const matchesBrand =
      selectedBrand === "All Brands" || (enq.brand || "").toLowerCase() === selectedBrand.toLowerCase();
    return matchesBrand && isWithinTimeFilter(enq.createdAt);
  });

  // Calculate top 4 Stat Blocks dynamically:
  let totalFeeShouldBeCollected = filteredAdmissions.reduce((sum: number, adm: any) => {
    const fee = Number(adm.finalFee || adm.courseFee || adm.totalFee || 0);
    return sum + (isNaN(fee) ? 0 : fee);
  }, 0);

  let totalCollection = filteredAdmissions.reduce((sum: number, adm: any) => {
    const paid = adm.amountReceivedToday ?? (Number(adm.finalFee || adm.courseFee || 0) - Number(adm.remainingBalance || 0));
    return sum + Math.max(Number(paid) || 0, 0);
  }, 0);

  let totalRegisteredStudents = filteredAdmissions.length;

  let totalFeeRemaining = filteredAdmissions.reduce((sum: number, adm: any) => {
    const rem = Number(adm.remainingBalance ?? (Number(adm.finalFee || 0) - (adm.amountReceivedToday || 0)));
    return sum + Math.max(Number(rem) || 0, 0);
  }, 0);

  // Fallback to counsellorList summary numbers if filteredAdmissions is empty for "all" mode
  if (totalFeeShouldBeCollected === 0 && totalCollection === 0 && counsellorList.length > 0 && timeFilter === "all") {
    totalFeeShouldBeCollected = counsellorList.reduce((sum, c) => sum + (c.totalFeeToCollectNum || c.targetNum || 500000), 0);
    totalCollection = counsellorList.reduce((sum, c) => sum + (c.revenueNum || 0), 0);
    totalRegisteredStudents = counsellorList.reduce((sum, c) => sum + (c.admissionsNum || 0), 0);
    totalFeeRemaining = counsellorList.reduce((sum, c) => sum + (c.feeRemainingNum || 0), 0);
  }

  const handleDeleteConfirm = async () => {
    if (!counsellorToDelete) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/counsellors?id=${counsellorToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCounsellorToDelete(null);
        await loadData();
      } else {
        alert(data.error || "Failed to delete CRM advisor");
      }
    } catch (err) {
      console.error("Error deleting CRM advisor:", err);
      alert("Failed to delete CRM advisor");
    } finally {
      setIsDeleting(false);
    }
  };

  const collectionPercentage = totalFeeShouldBeCollected > 0 
    ? ((totalCollection / totalFeeShouldBeCollected) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-4 flex-1 flex flex-col justify-start relative font-sans pb-16">
      <input type="file" ref={fileInputRef} className="hidden" />

      {/* Unified Header & Filter Dashboard Control Panel */}
      <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4 shrink-0">
        {/* Title & Primary Action Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
              CRM Overview & Metrics
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitor real-time fee collection, student enrollments, and onboard new CRM team members.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>+ Add CRM Executive</span>
          </button>
        </div>

        <div className="h-px bg-slate-100 w-full" />

        {/* Date Filter & Brand Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Mode Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date Filter:</span>
              <select
                value={timeFilter}
                onChange={(e: any) => setTimeFilter(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Sub-Filter: Weekly Selectors */}
            {timeFilter === "weekly" && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedWeek}
                  onChange={(e: any) => setSelectedWeek(e.target.value)}
                  className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                >
                  {weeksList.map((w) => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>

                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                >
                  {monthsList.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                >
                  {yearsList.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sub-Filter: Monthly Selectors */}
            {timeFilter === "monthly" && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                >
                  {monthsList.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                >
                  {yearsList.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sub-Filter: Yearly Selector */}
            {timeFilter === "yearly" && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
                >
                  {yearsList.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Sub-Filter: Custom Date Pickers */}
            {timeFilter === "custom" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            )}

            {/* Brand Scope Filter */}
            <div className="flex items-center gap-2 sm:border-l border-slate-200 sm:pl-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Brand:</span>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
              >
                <option value="All Brands">All Brands</option>
                {uniqueBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => loadData()}
            className="p-2 px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer ml-auto"
            title="Refresh Data"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top 4 Elevated Stat Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {/* Block 1: Total Fee Should Be Collected */}
        <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block select-none">
              Total Expected Fee
            </span>
            <div className="h-9 w-9 rounded-xl bg-slate-100 group-hover:bg-slate-200/70 text-slate-700 flex items-center justify-center font-bold text-sm transition-colors">
              ₹
            </div>
          </div>
          <span className="text-2xl font-extrabold tracking-tight block mt-2 text-slate-900">
            ₹{totalFeeShouldBeCollected.toLocaleString("en-IN")}
          </span>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Period Target</span>
            <span className="text-[10px] text-slate-400">Course fee totals</span>
          </div>
        </div>

        {/* Block 2: Total Collection */}
        <div className="bg-white/90 backdrop-blur-md border border-emerald-100/90 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block select-none">
              Total Collection
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm transition-colors group-hover:bg-emerald-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
              </svg>
            </div>
          </div>
          <span className="text-2xl font-extrabold tracking-tight block mt-2 text-emerald-600">
            ₹{totalCollection.toLocaleString("en-IN")}
          </span>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
              {collectionPercentage}% Collected
            </span>
            <span className="text-[10px] text-emerald-600/90 font-medium">Realized revenue</span>
          </div>
        </div>

        {/* Block 3: Total Registered Student */}
        <div className="bg-white/90 backdrop-blur-md border border-indigo-100/90 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block select-none">
              Registered Students
            </span>
            <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm transition-colors group-hover:bg-indigo-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
              </svg>
            </div>
          </div>
          <span className="text-2xl font-extrabold tracking-tight block mt-2 text-indigo-600">
            {totalRegisteredStudents} Students
          </span>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
              {filteredEnquiries.length} Total Leads
            </span>
            <span className="text-[10px] text-indigo-600/90 font-medium">Admissions enrolled</span>
          </div>
        </div>

        {/* Block 4: Fee Remaining & Active Team */}
        <div className="bg-white/90 backdrop-blur-md border border-rose-100/90 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block select-none">
              Fee Remaining
            </span>
            <div className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-sm transition-colors group-hover:bg-rose-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
          </div>
          <span className="text-2xl font-extrabold tracking-tight block mt-2 text-rose-600">
            ₹{totalFeeRemaining.toLocaleString("en-IN")}
          </span>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Pending Remainder</span>
            <span className="text-[10px] font-bold text-slate-500">{counsellorList.length} Active Advisors</span>
          </div>
        </div>
      </div>

      {/* Modals */}
      <RegisterCounsellorModal
        isOpen={isModalOpen}
        role="crm"
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          loadData();
        }}
      />

      <EditCounsellorModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setCounsellorToEdit(null);
        }}
        counsellor={counsellorToEdit}
        onSuccess={() => {
          setIsEditModalOpen(false);
          setCounsellorToEdit(null);
          loadData();
        }}
      />

      <TransferCounsellorModal
        isOpen={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setCounsellorToTransfer(null);
        }}
        sourceCounsellor={counsellorToTransfer}
        allCounsellors={counsellorList}
        onSuccess={() => {
          setIsTransferModalOpen(false);
          setCounsellorToTransfer(null);
          loadData();
        }}
      />

      <DeleteConfirmModal
        isOpen={!!counsellorToDelete}
        title="Delete Counsellor Profile"
        itemName={counsellorToDelete?.name || "this counsellor"}
        onClose={() => setCounsellorToDelete(null)}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
      />
    </div>
  );
}
