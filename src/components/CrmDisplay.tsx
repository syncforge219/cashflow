"use client";

import React, { useState, useEffect, useRef } from "react";
import RegisterCounsellorModal from "./RegisterCounsellorModal";
import EditCounsellorModal from "./EditCounsellorModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import TransferCounsellorModal from "./TransferCounsellorModal";
import { useUser } from "@/app/component/context/user-context";

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
  const [counsellorList, setCounsellorList] = useState<any[]>([]);
  const [rawEnquiries, setRawEnquiries] = useState<any[]>([]);
  const [rawAdmissions, setRawAdmissions] = useState<any[]>([]);
  const [dbBrands, setDbBrands] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month" | "year" | "all" | "custom">("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

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
    if (!dateStr) return true;
    const itemDate = new Date(dateStr);
    if (isNaN(itemDate.getTime())) return true;

    const now = new Date();

    if (timeFilter === "today") {
      return (
        itemDate.getDate() === now.getDate() &&
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    } else if (timeFilter === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return itemDate >= startOfWeek;
    } else if (timeFilter === "month") {
      return (
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    } else if (timeFilter === "year") {
      return itemDate.getFullYear() === now.getFullYear();
    } else if (timeFilter === "custom") {
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

  // Filtered Admissions & Enquiries across all brands or selected brand
  const filteredAdmissions = rawAdmissions.filter((adm: any) => {
    const matchesBrand =
      selectedBrand === "All Brands" || (adm.brand || "").toLowerCase() === selectedBrand.toLowerCase();
    const dateToUse = adm.admissionDate || adm.createdAt || adm.paymentDate;
    return matchesBrand && isWithinTimeFilter(dateToUse);
  });

  const filteredEnquiries = rawEnquiries.filter((enq: any) => {
    const matchesBrand =
      selectedBrand === "All Brands" || (enq.brand || "").toLowerCase() === selectedBrand.toLowerCase();
    return matchesBrand && isWithinTimeFilter(enq.createdAt);
  });

  // Calculate top 4 Stat Blocks dynamically:
  // 1. Total Fee Should Be Collected
  const totalFeeShouldBeCollected = filteredAdmissions.reduce((sum: number, adm: any) => {
    const fee = Number(adm.finalFee || adm.courseFee || 0);
    return sum + (isNaN(fee) ? 0 : fee);
  }, 0);

  // 2. Total Collection
  const totalCollection = filteredAdmissions.reduce((sum: number, adm: any) => {
    const paid = adm.amountReceivedToday || Number(adm.finalFee || 0) - Number(adm.remainingBalance || 0);
    return sum + Math.max(Number(paid) || 0, 0);
  }, 0);

  // 3. Total Registered Student
  const totalRegisteredStudents = filteredAdmissions.length;

  // 4. Fee Remaining
  const totalFeeRemaining = filteredAdmissions.reduce((sum: number, adm: any) => {
    const rem = Number(adm.remainingBalance ?? (Number(adm.finalFee || 0) - (adm.amountReceivedToday || 0)));
    return sum + Math.max(Number(rem) || 0, 0);
  }, 0);

  // Filtered Counsellors for Directory List
  const filteredCounsellors = counsellorList.filter((c) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      query === "" ||
      c.name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      c.scope.toLowerCase().includes(query) ||
      c.registryId.toLowerCase().includes(query);

    const matchesBrand =
      selectedBrand === "All Brands" || c.scope.toLowerCase() === selectedBrand.toLowerCase();

    const matchesStatus =
      selectedStatus === "All Status" || c.status.toLowerCase() === selectedStatus.toLowerCase();

    return matchesSearch && matchesBrand && matchesStatus;
  });

  const selectedCounsellor =
    counsellorList.find((c) => c.id === selectedId) || filteredCounsellors[0] || null;

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

  return (
    <div className="space-y-6 flex-1 flex flex-col justify-between relative font-sans">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            CRM Directory & Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Supervise CRM advisors, fee collection metrics, pending fee remainders, and registered students across all brands.
          </p>
        </div>
      </div>

      {/* Filter & Controls Bar */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Period:</span>
            <select
              value={timeFilter}
              onChange={(e: any) => setTimeFilter(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Range Pickers */}
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Brand:</span>
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

        {/* Search Bar */}
        <div className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="Search CRM executive..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4 absolute left-3 top-2.5 text-slate-400"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </div>
      </div>

      {/* Top 4 Elevated Stat Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {/* Block 1: Total Fee Should Be Collected */}
        <div className="bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block select-none">
              Total Fee Should Be Collected
            </span>
            <div className="h-8 w-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
              ₹
            </div>
          </div>
          <span className="text-2xl font-extrabold tracking-tight block mt-2 text-slate-900">
            ₹{totalFeeShouldBeCollected.toLocaleString("en-IN")}
          </span>
          <p className="text-[10px] text-slate-400 mt-1">Expected course fees in period</p>
        </div>

        {/* Block 2: Total Collection */}
        <div className="bg-white/90 backdrop-blur-md border border-emerald-100/80 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wider block select-none">
              Total Collection
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              ✓
            </div>
          </div>
          <span className="text-2xl font-extrabold tracking-tight block mt-2 text-emerald-600">
            ₹{totalCollection.toLocaleString("en-IN")}
          </span>
          <p className="text-[10px] text-emerald-600/90 mt-1 font-semibold">Actual fees collected</p>
        </div>

        {/* Block 3: Total Registered Student */}
        <div className="bg-white/90 backdrop-blur-md border border-indigo-100/80 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-600/80 uppercase tracking-wider block select-none">
              Total Registered Student
            </span>
            <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
              🎓
            </div>
          </div>
          <span className="text-2xl font-extrabold tracking-tight block mt-2 text-indigo-600">
            {totalRegisteredStudents} Students
          </span>
          <p className="text-[10px] text-indigo-600/90 mt-1 font-semibold">Admissions in selected view</p>
        </div>

        {/* Block 4: Fee Remaining */}
        <div className="bg-white/90 backdrop-blur-md border border-rose-100/80 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block select-none">
              Fee Remaining
            </span>
            <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
              ⏳
            </div>
          </div>
          <span className="text-2xl font-extrabold tracking-tight block mt-2 text-rose-600">
            ₹{totalFeeRemaining.toLocaleString("en-IN")}
          </span>
          <p className="text-[10px] text-rose-500 mt-1 font-semibold">Pending fee remainders</p>
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
