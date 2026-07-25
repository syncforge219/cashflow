"use client";

import React, { useState, useEffect } from "react";
import RegisterBrandModal from "./RegisterBrandModal";
import DeleteConfirmModal from "./DeleteConfirmModal";

export default function BrandManagerDisplay() {
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [brandToEdit, setBrandToEdit] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState<any | null>(null);
  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [enquiriesList, setEnquiriesList] = useState<any[]>([]);

  const fetchBrands = async () => {
    try {
      const [brandsRes, enquiriesRes] = await Promise.all([
        fetch("/api/brands"),
        fetch("/api/enquiries")
      ]);
      const data = await brandsRes.json();
      const enqData = await enquiriesRes.json();

      if (enqData && enqData.enquiries) {
        setEnquiriesList(enqData.enquiries);
      }

      if (data.success && data.brands) {
        setBrandsList(data.brands);
        if (data.brands.length > 0 && !selectedBrandId) {
          setSelectedBrandId(data.brands[0].brandId);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const getBrandDetails = (b: any) => {
    const brandNameLower = (b.name || "").toLowerCase().trim();
    const brandEnquiries = enquiriesList.filter((e: any) => 
      (e.targetBrand || "").toLowerCase().trim() === brandNameLower ||
      (e.brand || "").toLowerCase().trim() === brandNameLower
    );

    const brandTotalLeads = Math.max(brandEnquiries.length, b.stats?.totalEnquiries || 0);
    const brandDemos = Math.max(
      brandEnquiries.filter((e: any) => e.isDemoScheduled || (e.demos && e.demos.length > 0) || e.status === "Demo Scheduled" || e.status === "Demo Attended").length,
      b.stats?.demosConducted || 0
    );
    const brandAdmissions = Math.max(
      brandEnquiries.filter((e: any) => e.status === "Admitted").length,
      b.stats?.admissionsCount || 0
    );

    const realRevenue = brandEnquiries.reduce((sum: number, e: any) => {
      if (e.status === "Admitted") {
        const fee = parseFloat(String(e.feesCollected || e.expectedCourseFee || "0").replace(/[^0-9.]/g, ""));
        return sum + (isNaN(fee) ? 0 : fee);
      }
      return sum;
    }, 0);

    const totalRev = Math.max(realRevenue, b.stats?.revenue || 0);
    const convRate = brandTotalLeads > 0 ? ((brandAdmissions / brandTotalLeads) * 100).toFixed(1) : (b.stats?.conversionRate || "0.0%");

    return {
      id: b.brandId,
      identity: b.brandId || b._id,
      name: b.name,
      initial: b.name.charAt(0).toUpperCase(),
      color: "bg-indigo-600 text-white",
      description: b.description || "No academic description listed.",
      revenue: `₹${totalRev.toLocaleString("en-IN")}`,
      counsellors: `${b.stats?.counsellorsCount || 1} Agents`,
      brandManagers: `${b.stats?.brandManagersCount || 1} Execs`,
      entities: `${b.stats?.entitiesCount || (b.companies || []).length} Linked`,
      entitiesCount: `${b.stats?.entitiesCount || (b.companies || []).length} Legal`,
      status: b.status || "ACTIVE",
      phone: b.phone || "+91 98110 12345",
      email: b.email || `contact@${b.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      website: b.website || `https://${b.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      legalEntities: b.legalEntities || [],
      brandTotalLeads,
      brandDemos,
      brandAdmissions,
      brandConvRate: typeof convRate === 'string' && convRate.includes('%') ? convRate : `${convRate}%`
    };
  };

  const selectedBrandRaw = brandsList.find((b) => b.brandId === selectedBrandId) || brandsList[0];
  const selectedBrand = selectedBrandRaw ? getBrandDetails(selectedBrandRaw) : null;

  const handleEditClick = () => {
    if (selectedBrandRaw) {
      setBrandToEdit(selectedBrandRaw);
      setIsModalOpen(true);
    }
  };

  const handleDeleteClick = () => {
    if (!selectedBrandRaw) return;
    setBrandToDelete(selectedBrandRaw);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!brandToDelete) return;
    
    try {
      const res = await fetch(`/api/brands/${brandToDelete._id}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        window.location.reload();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to delete brand");
      }
    } catch (error) {
      console.error(error);
      alert("Error deleting brand");
    } finally {
      setIsDeleteModalOpen(false);
      setBrandToDelete(null);
    }
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col justify-between">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">Brands Registry</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl font-medium">
            Build and monitor your academic & coaching brands, legal channels, and counsellors.
          </p>
        </div>

        {/* Header buttons */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl px-4 py-2 transition-all shadow-xs">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Import CSV
          </button>
          <button
            onClick={() => {
              setBrandToEdit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 shadow-sm transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Register New Brand
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        
        {/* Left Column: Brands Roster */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col gap-4 min-h-[500px]">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Academic Brands</h2>
              <p className="text-[10px] text-slate-400 font-medium">Select a brand to view analytics and manage legal entities</p>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                </svg>
              </button>
            </div>
          </div>

          {/* Cards List */}
          <div className="space-y-3 overflow-y-auto pr-1 pb-2">
            {loading ? (
              <div className="p-4 text-center text-sm text-slate-500">Loading brands...</div>
            ) : brandsList.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">No brands registered.</div>
            ) : brandsList.map((b) => {
              const brand = getBrandDetails(b);
              const isSelected = brand.id === selectedBrandId;
              return (
                <div
                  key={brand.id}
                  onClick={() => setSelectedBrandId(brand.id)}
                  className={`bg-white border rounded-xl p-4 shadow-xs cursor-pointer transition-all duration-200 ${
                    isSelected ? "border-indigo-500 ring-2 ring-indigo-500/10 shadow-md" : "border-slate-200/80 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 flex items-center justify-center rounded-xl font-extrabold text-base shrink-0 overflow-hidden shadow-xs ${brand.color}`}>
                        {b.logoUrl ? (
                          <img src={b.logoUrl} alt={brand.name} className="h-full w-full object-cover" />
                        ) : (
                          brand.initial
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-extrabold text-slate-800">{brand.name}</h3>
                          <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-bold px-1.5 py-0.5 rounded">
                            {brand.id}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5 line-clamp-1">{brand.description}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full px-2 py-0.5 uppercase tracking-wide shrink-0">
                      {brand.status}
                    </span>
                  </div>

                  <div className="border-t border-slate-100 my-3"></div>

                  <div className="grid grid-cols-3 gap-2 text-left">
                    <div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Revenue</span>
                      <span className="text-[11px] font-extrabold text-indigo-600 block mt-0.5">{brand.revenue}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Counsellors</span>
                      <span className="text-[11px] font-bold text-slate-700 block mt-0.5">{brand.counsellors}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Entities</span>
                      <span className="text-[11px] font-bold text-slate-700 block mt-0.5">{brand.entities}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Details Pane */}
        <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-start overflow-y-auto relative min-h-[500px] pb-14">
          
          {selectedBrand ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 flex items-center justify-center rounded-xl font-extrabold text-lg shadow-xs overflow-hidden ${selectedBrand.color}`}>
                  {selectedBrandRaw?.logoUrl ? (
                    <img src={selectedBrandRaw.logoUrl} alt={selectedBrand.name} className="h-full w-full object-cover" />
                  ) : (
                    selectedBrand.initial
                  )}
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-800 tracking-tight">{selectedBrand.name}</h2>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                    Brand Identity: <span className="font-mono text-slate-500 select-all">{selectedBrand.identity}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-1 border border-slate-100 rounded-lg p-0.5 bg-slate-50 shrink-0">
                <button onClick={handleEditClick} className="p-1.5 hover:bg-white hover:shadow-xs rounded text-slate-400 hover:text-indigo-600 transition-all" title="Edit Brand">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                  </svg>
                </button>
                <button onClick={handleDeleteClick} className="p-1.5 hover:bg-white hover:shadow-xs rounded text-slate-400 hover:text-rose-500 transition-all" title="Delete Brand">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Corporate Mission */}
            <div className="border border-slate-200/80 rounded-xl p-4 bg-slate-50/50">
              <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Corporate Mission</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                {selectedBrand.description}
              </p>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-indigo-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.596-5.48-4.18-7.076-7.076l1.293-.97c.362-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                <span className="text-[11px] font-semibold text-slate-600">{selectedBrand.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-indigo-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <span className="text-[11px] font-semibold text-slate-600 truncate">{selectedBrand.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-indigo-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                <span className="text-[11px] font-semibold text-slate-600 truncate">{selectedBrand.website}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-indigo-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="text-[11px] font-semibold text-slate-600">Corporate Head Office</span>
              </div>
            </div>

            {/* Brand Performance Dashboard */}
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Brand Performance Dashboard</h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="border border-slate-200 rounded-xl p-3 shadow-xs bg-white">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Total Enquiries
                  </span>
                  <span className="text-base font-extrabold text-slate-800 tracking-tight">{selectedBrand.brandTotalLeads || 0}</span>
                </div>
                <div className="border border-purple-100 bg-purple-50/50 rounded-xl p-3 shadow-xs">
                  <span className="text-[9px] font-bold text-purple-600 uppercase tracking-wider block mb-1">
                    Demos Conducted
                  </span>
                  <span className="text-base font-extrabold text-purple-700 tracking-tight">{selectedBrand.brandDemos || 0}</span>
                </div>
                <div className="border border-emerald-100 bg-emerald-50/50 rounded-xl p-3 shadow-xs">
                  <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                    Admissions
                  </span>
                  <span className="text-base font-extrabold text-emerald-700 tracking-tight">{selectedBrand.brandAdmissions || 0}</span>
                </div>
                <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-3 shadow-xs">
                  <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
                    Conversion Rate
                  </span>
                  <span className="text-base font-extrabold text-blue-700 tracking-tight">{selectedBrand.brandConvRate || "0.0%"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="border border-slate-200 rounded-xl p-3.5 shadow-xs bg-white hover:border-slate-300 transition-all">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-indigo-500"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
                    Connected Entities
                  </span>
                  <span className="text-lg font-extrabold text-slate-800 tracking-tight">{selectedBrand.entitiesCount}</span>
                </div>
                <div className="border border-slate-200 rounded-xl p-3.5 shadow-xs bg-white hover:border-slate-300 transition-all">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-indigo-500"><path strokeLinecap="round" strokeLinejoin="round" d="M15 8.25H9m6 3H9m3 6l-3-3h1.5a3 3 0 100-6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Total Revenue Collected
                  </span>
                  <span className="text-lg font-extrabold text-indigo-600 tracking-tight">{selectedBrand.revenue}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="border border-slate-200 rounded-xl p-3.5 shadow-xs bg-white hover:border-slate-300 transition-all">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-indigo-500"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                    Active Staff
                  </span>
                  <span className="text-lg font-extrabold text-slate-800 tracking-tight">{selectedBrand.counsellors}</span>
                </div>
                <div className="border border-slate-200 rounded-xl p-3.5 shadow-xs bg-white hover:border-slate-300 transition-all">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-purple-500"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-1.81.588l1.234 5.265c.15.64-.533 1.141-1.077.782l-4.72-3.13a.563.563 0 00-.616 0l-4.72 3.13c-.544.36-1.228-.142-1.077-.782l1.234-5.265a.563.563 0 00-.181-.588L2.345 10.386c-.38-.325-.178-.948.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
                    Centre Heads
                  </span>
                  <span className="text-lg font-extrabold text-slate-800 tracking-tight">{selectedBrand.brandManagers}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1.5">
                <span>Combined Entity Target Utilization</span>
                <span className="text-indigo-600 font-extrabold">{selectedBrand.brandConvRate || "100.0%"}</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5 border border-slate-200/50">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500 w-[75%]"></div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Connected Legal Entities</h4>
              <div className="space-y-2">
                {selectedBrand.legalEntities && selectedBrand.legalEntities.length > 0 ? (
                  selectedBrand.legalEntities.map((entity: any) => (
                    <div key={entity._id} className="flex items-center justify-between border border-slate-200/80 rounded-xl p-3 bg-white hover:border-slate-300 transition-all shadow-2xs">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">{entity.name}</span>
                          <span className="text-[9px] text-slate-400 font-mono block">GST: {entity.gst || "Registered"}</span>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-slate-700 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg">₹{(entity.annualCapacityCap || 2500000).toLocaleString()} Cap</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-slate-500 italic p-3 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50">
                    No legal entities linked to this brand yet.
                  </div>
                )}
              </div>
            </div>
            
          </div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-slate-500 font-medium">
              Select a brand to view details
            </div>
          )}

        </div>
      </div>

      {/* Modal for new brand */}
      <RegisterBrandModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} brandToEdit={brandToEdit} />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Brand"
        itemName={brandToDelete?.name || "this brand"}
      />
    </div>
  );
}
