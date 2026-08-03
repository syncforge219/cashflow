"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useUser } from "@/app/component/context/user-context";
import RegisterCounsellorModal from "./RegisterCounsellorModal";
import EditCounsellorModal from "./EditCounsellorModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import TransferCounsellorModal from "./TransferCounsellorModal";

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
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [selectedStatus, setSelectedStatus] = useState("All Status");

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [counsellorsRes, enquiriesRes, admissionsRes] = await Promise.all([
        fetch("/api/counsellors?role=crm"),
        fetch("/api/enquiries"),
        fetch("/api/admissions"),
      ]);
      const data = await counsellorsRes.json();
      const enqData = await enquiriesRes.json();
      const admData = await admissionsRes.json();

      const enquiries = (enqData && enqData.enquiries) ? enqData.enquiries : [];
      const admissions = (admData && (admData.admissions || admData.data)) ? (admData.admissions || admData.data) : [];

      setRawEnquiries(enquiries);
      setRawAdmissions(admissions);

      if (data?.success && Array.isArray(data.counsellors) && data.counsellors.length > 0) {
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

          const realEnquiryRevenue = myEnquiries.reduce((sum: number, e: any) => {
            if (e.status === "Admitted") {
              const fee = parseFloat(String(e.feesCollected || e.expectedConversionFee || "0").replace(/[^0-9.]/g, ""));
              return sum + (isNaN(fee) ? 0 : fee);
            }
            return sum;
          }, 0);

          const realAdmissionRevenue = myAdmissions.reduce((sum: number, adm: any) => {
            const paid = adm.amountReceivedToday || Number(adm.finalFee || 0) - Number(adm.remainingBalance || 0);
            return sum + Math.max(Number(paid) || 0, 0);
          }, 0);

          const maxRealRevenue = Math.max(realEnquiryRevenue, realAdmissionRevenue);
          const maxAdmissionsCount = Math.max(admittedEnquiriesCount, myAdmissions.length);

          const hasAssignedRecords = assignedLeadsCount > 0 || myAdmissions.length > 0;

          const revenue = hasAssignedRecords ? maxRealRevenue : (c.currentRevenue || 0);
          const admissionsNum = hasAssignedRecords ? maxAdmissionsCount : (c.admissionsRecorded || 0);
          const convRate = assignedLeadsCount > 0 ? ((maxAdmissionsCount / assignedLeadsCount) * 100).toFixed(1) : "0.0";

          return {
            id: c._id,
            registryId: `user-${c._id}`,
            name: c.name || "Unknown",
            email: c.email || "",
            phone: c.phone || "",
            scope: c.brandScope || "Cadd Mantra",
            targetNum: target,
            revenueNum: revenue,
            admissionsNum: admissionsNum,
            assignedLeadsNum: assignedLeadsCount,
            demosNum: demosCount,
            convRate: `${convRate}%`,
            targetCollected: `₹${revenue.toLocaleString("en-IN")} / ₹${target.toLocaleString("en-IN")}`,
            percentage: `${((revenue / Math.max(target, 1)) * 100).toFixed(1)}%`,
            status: "ACTIVE",
            annualTarget: `₹${target.toLocaleString("en-IN")}`,
            revenueCollected: `₹${revenue.toLocaleString("en-IN")}`,
            joiningDate: c.joiningDate ? new Date(c.joiningDate).toISOString().split("T")[0] : "—",
            admissions: `${admissionsNum} Seats`,
            initials: `${firstInitial}${lastInitial}`.toUpperCase() || "CU",
            scopeBadge: "CRM Executive Scope",
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
      console.error("Failed to load CRM dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const userRole = (user?.role || "").toLowerCase().trim();
  const isCrmRole = userRole === "crm" || userRole === "crm executive" || userRole === "crm_executive";

  const relevantAdmissions = isCrmRole && user?.name
    ? rawAdmissions.filter((adm: any) => {
        const cName = (adm.counsellor || "").toLowerCase().trim();
        const uName = (user.name || "").toLowerCase().trim();
        return cName && uName && (cName === uName || cName.includes(uName) || uName.includes(cName));
      })
    : rawAdmissions;

  const displayAdmissions = (isCrmRole && relevantAdmissions.length > 0) ? relevantAdmissions : rawAdmissions;

  // Financial metric calculations
  const totalFeeShouldBeCollected = displayAdmissions.reduce((sum: number, adm: any) => {
    const fee = Number(adm.finalFee || adm.courseFee || adm.totalFee || 0);
    return sum + (isNaN(fee) ? 0 : fee);
  }, 0);

  const totalCollection = displayAdmissions.reduce((sum: number, adm: any) => {
    const paid = adm.amountReceivedToday ?? (Number(adm.finalFee || adm.courseFee || 0) - Number(adm.remainingBalance || 0));
    return sum + Math.max(Number(paid) || 0, 0);
  }, 0);

  const totalRegisteredStudents = displayAdmissions.length;

  const totalFeeRemaining = displayAdmissions.reduce((sum: number, adm: any) => {
    const rem = Number(adm.remainingBalance ?? (Number(adm.finalFee || 0) - (adm.amountReceivedToday || 0)));
    return sum + Math.max(Number(rem) || 0, 0);
  }, 0);

  const collectionPercentage = totalFeeShouldBeCollected > 0
    ? ((totalCollection / totalFeeShouldBeCollected) * 100).toFixed(1)
    : "0.0";

  // Filtered list
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

  const selectedCounsellor = selectedId
    ? counsellorList.find((c) => c.id === selectedId)
    : null;

  const confirmDeleteCounsellor = async () => {
    if (!counsellorToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/counsellors/${counsellorToDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        setCounsellorToDelete(null);
        loadData();
      } else {
        alert(data.error || "Failed to delete counsellor");
      }
    } catch (err) {
      console.error("Error deleting counsellor:", err);
      alert("Error deleting counsellor.");
    } finally {
      setIsDeleting(false);
    }
  };

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
      {/* Top Header Row with Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-white/60 backdrop-blur-md p-4 px-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            CRM Dashboard & Key Metrics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Key fee metrics, registered student tracking, and CRM executive details
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap self-start md:self-auto">
          <Link
            href="/pending-collection"
            className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2.5 shadow-md shadow-amber-500/10 transition-all font-sans cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Pending Collection
          </Link>

          {!isCrmRole && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4 py-2.5 shadow-md shadow-indigo-600/10 transition-all font-sans cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              + New CRM Executive
            </button>
          )}
        </div>
      </div>

      {/* Top Financial Stat Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        {/* Block 1: Total Expected Fee */}
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

        {/* Block 3: Registered Students */}
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
              {rawEnquiries.length} Total Leads
            </span>
            <span className="text-[10px] text-indigo-600/90 font-medium">Admissions enrolled</span>
          </div>
        </div>

        {/* Block 4: Fee Remaining */}
        <Link
          href="/pending-collection"
          className="bg-white/90 backdrop-blur-md border border-rose-100/90 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all group block cursor-pointer"
        >
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
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 flex items-center gap-1 hover:underline">
              Pending Remainder &rarr;
            </span>
            <span className="text-[10px] font-bold text-slate-500">{counsellorList.length} Active Advisors</span>
          </div>
        </Link>
      </div>

      {/* Main Split Pane Layout (Total CRMs on Left, Details on Right - Hidden for CRM Role) */}
      {!isCrmRole && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column: Total CRMs List */}
          <div className="lg:col-span-2 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Total CRMs ({filteredCounsellors.length})
              </h2>
              <input
                type="text"
                placeholder="Search CRM..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs border border-slate-200 bg-white rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 w-36 sm:w-48 font-medium"
              />
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200/80 rounded-2xl gap-2 select-none text-slate-400">
                  <svg className="animate-spin h-6 w-6 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-xs font-semibold">Loading CRMs directory...</span>
                </div>
              ) : filteredCounsellors.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-white border border-slate-200/80 rounded-2xl gap-2 text-center">
                  <p className="text-xs font-bold text-slate-700">No CRM Executives Found</p>
                  <p className="text-[10px] text-slate-400">Click &quot;+ New CRM Executive&quot; to register a new CRM executive.</p>
                </div>
              ) : (
                filteredCounsellors.map((c) => {
                  const isSelected = c.id === selectedId;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`bg-white border rounded-2xl p-4 shadow-2xs cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-md"
                          : "border-slate-200/80 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-100 text-xs">
                            {c.initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-slate-800">{c.name}</span>
                              <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-500 font-bold rounded px-1.5 py-0.5">
                                {c.scope}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                              Email: {c.email} | Scope: {c.scope}
                            </span>
                          </div>
                        </div>

                        <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md px-1.5 py-0.5 uppercase">
                          {c.status}
                        </span>
                      </div>

                      <div className="border-t border-slate-100 my-2.5"></div>

                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span>
                          Target Collected: <span className="text-slate-700 font-extrabold">{c.targetCollected}</span>
                        </span>
                        <span className="text-indigo-600 font-extrabold">{c.percentage} Completed</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div
                          className="bg-indigo-600 h-full transition-all duration-300"
                          style={{ width: c.percentage }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Details of Selected CRM */}
          <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs flex flex-col justify-between max-h-[660px] overflow-y-auto">
            {selectedCounsellor ? (
              <div className="space-y-6">
                {/* Detail Header */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 flex items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-extrabold text-base shadow-md shadow-indigo-600/20">
                      {selectedCounsellor.initials}
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">{selectedCounsellor.name}</h2>
                      <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                        Registry ID:{" "}
                        <span className="font-mono text-slate-600 select-all">
                          {selectedCounsellor.registryId}
                        </span>
                      </span>
                      <span className="inline-block text-[9px] font-extrabold text-emerald-700 border border-emerald-200 bg-emerald-50/80 rounded-md px-2 py-0.5 mt-1">
                        {selectedCounsellor.scopeBadge}
                      </span>
                    </div>
                  </div>

                  {/* Edit, Transfer & Delete Action Buttons */}
                  <div className="flex items-center gap-2 select-none">
                    <button
                      onClick={() => handleTransferData(selectedCounsellor)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition-all shadow-2xs"
                      title="Transfer data of this CRM executive to another"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-3.5 w-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                        />
                      </svg>
                      Transfer Data
                    </button>

                    <button
                      onClick={() => handleEditCounsellor(selectedCounsellor)}
                      className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors border border-slate-200"
                      title="Edit CRM Profile"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                        />
                      </svg>
                    </button>

                    <button
                      onClick={() => setCounsellorToDelete({ id: selectedCounsellor.id, name: selectedCounsellor.name })}
                      className="p-1.5 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-colors border border-slate-200"
                      title="Delete CRM Profile"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Registry Credentials */}
                <div className="space-y-3">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block select-none">
                    REGISTRY CREDENTIALS
                  </label>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50/60 border border-slate-200/60 rounded-2xl p-4 text-xs font-semibold">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">EMPLOYEE ID</span>
                      <span className="font-extrabold text-indigo-600 block mt-1 select-all">{selectedCounsellor.id}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">BRAND CHANNEL ASSIGNMENT</span>
                      <span className="font-extrabold text-slate-800 block mt-1">{selectedCounsellor.scope}</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-200/50 pt-3">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">OFFICIAL EMAIL</span>
                      <span className="font-extrabold text-slate-800 block mt-1 select-all">{selectedCounsellor.email}</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-200/50 pt-3">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">PHONE MOBILE</span>
                      <span className="font-extrabold text-slate-800 block mt-1 select-all">{selectedCounsellor.phone || "—"}</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-200/50 pt-3">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">WORKSPACE STATUS</span>
                      <span className="font-extrabold text-emerald-600 block mt-1 uppercase">
                        {selectedCounsellor.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs font-semibold text-slate-400">
                Select a CRM Executive from the list to view detailed performance metrics.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <RegisterCounsellorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        role="crm"
        onSuccess={() => {
          setIsModalOpen(false);
          loadData();
        }}
      />

      {isEditModalOpen && (
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
      )}

      {isTransferModalOpen && (
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
      )}

      <DeleteConfirmModal
        isOpen={Boolean(counsellorToDelete)}
        title="Delete CRM Profile"
        itemName={counsellorToDelete?.name || "this CRM executive"}
        isLoading={isDeleting}
        onClose={() => setCounsellorToDelete(null)}
        onConfirm={confirmDeleteCounsellor}
      />
    </div>
  );
}

