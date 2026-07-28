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
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
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

        // Filter for Brand scope if user has brandScope restrictions (and is not super admin)
        let finalDisplayList = list;
        if (user?.role !== "super admin" && user?.role !== "admin" && user?.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All") {
          const allowedBrands = user.brandScope.split(/[,/|]/).map((b) => b.trim().toLowerCase()).filter(Boolean);
          finalDisplayList = list.filter((c: any) => {
            const cBrands = (c.scope || "").split(/[,/|]/).map((b: string) => b.trim().toLowerCase()).filter(Boolean);
            if (cBrands.some((cb: string) => ["all", "all brands", "global", "*"].includes(cb))) return true;
            return cBrands.some((cb: string) => allowedBrands.includes(cb));
          });
        }

        setCounsellorList(finalDisplayList);
        if (finalDisplayList.length > 0) {
          setSelectedId((prev) => (prev && finalDisplayList.some((c: any) => c.id === prev) ? prev : finalDisplayList[0].id));
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

    const targetBrandLower = selectedBrand.toLowerCase().trim();
    const cBrands = (c.scope || "").split(/[,/|]/).map((b: string) => b.trim().toLowerCase()).filter(Boolean);
    const matchesBrand =
      selectedBrand === "All Brands" ||
      cBrands.some((cb: string) => cb === targetBrandLower || cb === "all" || cb === "all brands");

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

  const collectionPercentage = totalFeeShouldBeCollected > 0 
    ? ((totalCollection / totalFeeShouldBeCollected) * 100).toFixed(1)
    : "0.0";

  const handleEditCounsellor = (counsellor: any) => {
    setCounsellorToEdit(counsellor);
    setIsEditModalOpen(true);
  };

  const handleTransferData = (counsellor: any) => {
    setCounsellorToTransfer(counsellor);
    setIsTransferModalOpen(true);
  };

  return (
    <div className="space-y-6 relative font-sans">
      <input type="file" ref={fileInputRef} className="hidden" />

      {/* Header Row with Add CRM Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-white/60 backdrop-blur-md p-4 px-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            CRM Executive Directory & Performance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Key fee metrics, student lead routing, yearly collections, and active CRM executive performance
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>+ Add CRM Executive</span>
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

      {/* Search & Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search CRM Executive by name, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-semibold pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="All Brands">All Brands</option>
            {uniqueBrands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="All Status">All Status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </div>
      </div>

      {/* Main Split Layout: Left List of CRM Executives + Right Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: CRM Executive Cards List */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs font-semibold text-slate-400">
              Loading CRM Executive directory...
            </div>
          ) : filteredCounsellors.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs font-semibold text-slate-400">
              No CRM Executives found matching your search.
            </div>
          ) : (
            filteredCounsellors.map((c) => {
              const isSelected = c.id === selectedId;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`bg-white border rounded-2xl p-4 shadow-xs cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10"
                      : "border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-xs shadow-xs">
                        {c.initials}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          {c.name}
                          <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 rounded px-1.5 py-0.5 font-semibold">
                            {c.scope}
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{c.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                      {c.status}
                    </span>
                  </div>

                  {/* Revenue Progress */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                      <span>Annual Revenue Collected</span>
                      <span className="text-indigo-600 font-extrabold">{c.percentage}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                        style={{ width: c.percentage }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                      <span>Collected: {c.revenueCollected}</span>
                      <span>Target: {c.annualTarget}</span>
                    </div>
                  </div>

                  {/* Badges & Action Buttons */}
                  <div className="mt-3 pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                    <div className="flex gap-2 text-[10px] font-semibold text-slate-500">
                      <span className="bg-slate-100 rounded px-1.5 py-0.5">Leads: {c.assignedLeadsNum}</span>
                      <span className="bg-slate-100 rounded px-1.5 py-0.5">Seats: {c.admissionsNum}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCounsellor(c);
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTransferData(c);
                        }}
                        className="text-[10px] font-bold text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors"
                      >
                        Transfer
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCounsellorToDelete({ id: c.id, name: c.name });
                        }}
                        className="text-[10px] font-bold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected CRM Executive Full Detail Panel */}
        <div className="lg:col-span-3">
          {selectedCounsellor ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-6 sticky top-4">
              {/* Header Info */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-5">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-indigo-600/20">
                    {selectedCounsellor.initials}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      {selectedCounsellor.name}
                      <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-2 py-0.5">
                        {selectedCounsellor.scope}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {selectedCounsellor.email} • {selectedCounsellor.phone || "No Phone"}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      Joined: {selectedCounsellor.joiningDate} • Registry ID: {selectedCounsellor.registryId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditCounsellor(selectedCounsellor)}
                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 font-bold text-xs rounded-xl hover:bg-indigo-100 transition-colors"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => handleTransferData(selectedCounsellor)}
                    className="px-3 py-1.5 bg-amber-50 text-amber-600 font-bold text-xs rounded-xl hover:bg-amber-100 transition-colors"
                  >
                    Transfer Leads
                  </button>
                </div>
              </div>

              {/* 4 Quick Performance Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Leads</span>
                  <p className="text-xl font-extrabold text-slate-900 mt-1">{selectedCounsellor.assignedLeadsNum}</p>
                </div>
                <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Demos Conducted</span>
                  <p className="text-xl font-extrabold text-indigo-700 mt-1">{selectedCounsellor.demosNum}</p>
                </div>
                <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Admissions Enrolled</span>
                  <p className="text-xl font-extrabold text-emerald-700 mt-1">{selectedCounsellor.admissionsNum}</p>
                </div>
                <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-100">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Conversion Rate</span>
                  <p className="text-xl font-extrabold text-amber-700 mt-1">{selectedCounsellor.convRate}</p>
                </div>
              </div>

              {/* Revenue vs Target Progress */}
              <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>Target Revenue Collection</span>
                  <span className="text-indigo-600 font-extrabold">{selectedCounsellor.percentage} Achieved</span>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: selectedCounsellor.percentage }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 font-semibold pt-1">
                  <span>Collected: {selectedCounsellor.revenueCollected}</span>
                  <span>Target: {selectedCounsellor.annualTarget}</span>
                </div>
              </div>

              {/* Recent Assigned Student Enquiries */}
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3">
                  Assigned Student Enquiries ({selectedCounsellor.myEnquiries?.length || 0})
                </h4>
                {selectedCounsellor.myEnquiries?.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium italic">No student enquiries currently assigned to this CRM Executive.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selectedCounsellor.myEnquiries?.slice(0, 10).map((enq: any) => (
                      <div key={enq._id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{enq.studentFullName}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{enq.primaryPhoneMobile} • {enq.targetCourse}</p>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                          enq.status === 'Admitted' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {enq.status || 'New'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs font-semibold text-slate-400">
              Select a CRM Executive from the list to view detailed performance metrics.
            </div>
          )}
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
