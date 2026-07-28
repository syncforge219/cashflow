"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ProfileDisplay from "@/components/ProfileDisplay";
import { useUser } from "@/app/component/context/user-context";
import Student360Modal from "@/components/Student360Modal";

export default function Student360PortalPage() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [students, setStudents] = useState<any[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [selectedCompany, setSelectedCompany] = useState("All Companies");
  const [selectedFeeStatus, setSelectedFeeStatus] = useState("All");

  // Selected Student for 360 Modal
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [is360ModalOpen, setIs360ModalOpen] = useState(false);

  // Role validation
  const userRole = (user?.role || "").toLowerCase();
  const isAuthorized =
    userRole === "admin" ||
    userRole === "super admin" ||
    userRole === "super_admin" ||
    userRole === "brand_manager" ||
    userRole === "brand-manager" ||
    userRole === "brand manager";

  const isBrandManager = userRole === "brand_manager" || userRole === "brand-manager" || userRole === "brand manager";

  useEffect(() => {
    if (isBrandManager && user?.brandScope && user?.brandScope !== "All Brands" && user?.brandScope !== "All") {
      setSelectedBrand(user.brandScope);
    }
  }, [userRole, user?.brandScope]);

  const fetchStudentsData = async () => {
    setIsLoading(true);
    try {
      let url = "/api/admissions";
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
        setStudents(json.data);

        // Extract unique brands & companies
        const bSet = new Set<string>();
        const cSet = new Set<string>();
        json.data.forEach((s: any) => {
          if (s.brand) bSet.add(s.brand);
          if (s.companyAssigned) cSet.add(s.companyAssigned);
        });
        setBrands(Array.from(bSet));
        setCompanies(Array.from(cSet));
      }
    } catch (err) {
      console.error("Failed to fetch students for 360 portal:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchStudentsData();
    }
  }, [isAuthorized, selectedBrand]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudentsData();
  };

  const openStudent360 = (id: string) => {
    setSelectedStudentId(id);
    setIs360ModalOpen(true);
  };

  // Filter students locally for instant reactivity
  const filteredStudents = students.filter((s) => {
    if (selectedCompany !== "All Companies" && s.companyAssigned !== selectedCompany) {
      return false;
    }
    const remBal = Number(s.remainingBalance) || 0;
    if (selectedFeeStatus === "Balance Due" && remBal <= 0) return false;
    if (selectedFeeStatus === "Fully Paid" && remBal > 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (s.fullName || "").toLowerCase().includes(q);
      const matchId = (s.admissionId || "").toLowerCase().includes(q);
      const matchMobile = (s.mobileNumber || "").toLowerCase().includes(q);
      const matchParent = (s.parentPhone || s.parentsPhoneNumber || "").toLowerCase().includes(q);
      const matchCourse = (s.course || "").toLowerCase().includes(q);
      return matchName || matchId || matchMobile || matchParent || matchCourse;
    }
    return true;
  });

  // Calculate Metrics
  const totalBilledFee = filteredStudents.reduce((acc, s) => acc + (Number(s.finalFee) || 0), 0);
  const totalRemainingBalance = filteredStudents.reduce((acc, s) => acc + (Number(s.remainingBalance) || 0), 0);
  const totalCollectedFee = Math.max(0, totalBilledFee - totalRemainingBalance);

  if (!isAuthorized && !isLoading) {
    return (
      <div className="flex h-screen bg-[#f8faff] text-slate-800 font-sans">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white border border-rose-200 rounded-3xl p-8 max-w-md text-center shadow-xl">
            <div className="h-16 w-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 font-black text-2xl">
              🔒
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">Access Restricted</h2>
            <p className="text-xs font-semibold text-slate-500 mb-6">
              The Student 360 Portal is visible only to authorized Administrators and Brand Managers.
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
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/80 pb-4 mb-6 shrink-0">
          <div>
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 select-none">
              <span>CoachFlow</span>
              <span>/</span>
              <span className="text-slate-600 font-bold">Student 360 Portal</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mt-1 flex items-center gap-2">
              <span>Student 360 Directory & Management</span>
              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-200">
                Admin & Brand Manager Portal
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchStudentsData()}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-indigo-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span>Refresh Directory</span>
            </button>
            <ProfileDisplay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} logout={logout} />
          </div>
        </header>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Enrolled Students</span>
            <div className="text-2xl font-black text-indigo-600 mt-1">{filteredStudents.length} Students</div>
            <span className="text-[10px] font-semibold text-slate-400">Filtered 360 Records</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Agreed Billed Revenue</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">₹{totalBilledFee.toLocaleString("en-IN")}</div>
            <span className="text-[10px] font-semibold text-slate-400">Total Contract Fees</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Fee Collected</span>
            <div className="text-2xl font-black text-blue-600 mt-1">₹{totalCollectedFee.toLocaleString("en-IN")}</div>
            <span className="text-[10px] font-semibold text-slate-400">Recd via UPI/Cash/Bank</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Outstanding Balance</span>
            <div className="text-2xl font-black text-rose-600 mt-1">₹{totalRemainingBalance.toLocaleString("en-IN")}</div>
            <span className="text-[10px] font-semibold text-slate-400">Pending Installments</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 mb-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-96">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search 360 by student name, ID, phone, email, course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-semibold"
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400 absolute left-3 top-2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
              </svg>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-500">Brand:</span>
              <select
                value={selectedBrand}
                disabled={isBrandManager && Boolean(user?.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All")}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 cursor-pointer disabled:opacity-60"
              >
                <option value="All Brands">All Brands</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-500">Company:</span>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 cursor-pointer"
              >
                <option value="All Companies">All Companies</option>
                {companies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-500">Fee Status:</span>
              <select
                value={selectedFeeStatus}
                onChange={(e) => setSelectedFeeStatus(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 cursor-pointer"
              >
                <option value="All">All Fee Statuses</option>
                <option value="Balance Due">Balance Due</option>
                <option value="Fully Paid">Fully Paid</option>
              </select>
            </div>
          </div>
        </div>

        {/* Student 360 Table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 pr-4 min-w-[170px]">Student & ID</th>
                  <th className="pb-3 pr-4 min-w-[120px]">Mobile & Parent</th>
                  <th className="pb-3 pr-3 min-w-[130px]">Course & Batch</th>
                  <th className="pb-3 pr-3 min-w-[100px]">Brand Tag</th>
                  <th className="pb-3 pr-3 min-w-[100px]">Company</th>
                  <th className="pb-3 px-3 text-right min-w-[90px]">Agreed Fee</th>
                  <th className="pb-3 px-3 text-right min-w-[90px]">Balance Due</th>
                  <th className="pb-3 text-center min-w-[120px]">Fee Progress</th>
                  <th className="pb-3 text-right min-w-[110px]">360 Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 font-semibold text-slate-600">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                      Loading Student 360 Directory...
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                      No matching student records found.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const finalFee = Number(s.finalFee) || 0;
                    const remBal = Number(s.remainingBalance) || 0;
                    const paid = Math.max(0, finalFee - remBal);
                    const pct = finalFee > 0 ? Math.min(100, Math.round((paid / finalFee) * 100)) : 0;

                    return (
                      <tr
                        key={s._id}
                        onClick={() => openStudent360(s._id)}
                        className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0 uppercase border border-indigo-200">
                              {s.fullName ? s.fullName.substring(0, 2) : "ST"}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {s.fullName || "Unnamed Student"}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">{s.admissionId || "ADM-N/A"}</div>
                            </div>
                          </div>
                        </td>

                        <td className="pr-4 text-slate-700">
                          <div className="font-bold">{s.mobileNumber || "-"}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            Parent: {s.parentName || s.parentsFullName || "-"}
                          </div>
                        </td>

                        <td className="pr-3 text-slate-700">
                          <div className="font-bold text-slate-800">{s.course || "-"}</div>
                          <div className="text-[10px] text-slate-400">{s.batch || "General Batch"}</div>
                        </td>

                        <td className="pr-3">
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border border-indigo-100 whitespace-nowrap">
                            {s.brand || "Default"}
                          </span>
                        </td>

                        <td className="pr-3 text-slate-600 font-bold text-[11px] truncate max-w-[100px]">
                          {s.companyAssigned || "-"}
                        </td>

                        <td className="px-3 text-right font-black text-slate-900 whitespace-nowrap">
                          ₹{finalFee.toLocaleString("en-IN")}
                        </td>

                        <td className="px-3 text-right whitespace-nowrap">
                          {remBal > 0 ? (
                            <span className="font-black text-rose-600">₹{remBal.toLocaleString("en-IN")}</span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border border-emerald-200">
                              Paid
                            </span>
                          )}
                        </td>

                        <td className="px-3 text-center">
                          <div className="w-24 mx-auto">
                            <div className="flex justify-between text-[9px] font-extrabold text-slate-500 mb-1">
                              <span>{pct}%</span>
                              <span>₹{paid.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all rounded-full ${
                                  pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-rose-500"
                                }`}
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>

                        <td className="text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openStudent360(s._id);
                            }}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-extrabold text-[11px] rounded-lg border border-indigo-200/80 transition-all cursor-pointer shadow-xs"
                          >
                            View 360°
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Render 360° Modal Drawer */}
        <Student360Modal
          admissionId={selectedStudentId}
          isOpen={is360ModalOpen}
          onClose={() => setIs360ModalOpen(false)}
          onRefresh={() => fetchStudentsData()}
          canEdit={isAuthorized}
        />
      </div>
    </div>
  );
}
