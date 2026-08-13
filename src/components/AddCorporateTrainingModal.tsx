"use client";

import React, { useState, useEffect, useRef } from "react";

interface AddCorporateTrainingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUser?: any;
}

export default function AddCorporateTrainingModal({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
}: AddCorporateTrainingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Data Sources
  const [brands, setBrands] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [counsellorsList, setCounsellorsList] = useState<any[]>([]);

  // Search & Dropdown State for Faculty
  const [facultySearch, setFacultySearch] = useState("");
  const [isFacultyDropdownOpen, setIsFacultyDropdownOpen] = useState(false);
  const facultyDropdownRef = useRef<HTMLDivElement>(null);

  // Search & Dropdown State for Sales Executive
  const [salesSearch, setSalesSearch] = useState("");
  const [isSalesDropdownOpen, setIsSalesDropdownOpen] = useState(false);
  const salesDropdownRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    contactPhone: "",
    contactEmail: "",
    trainingProgram: "",
    description: "",
    trainingMode: "Offline (Client Site)",
    numberOfParticipants: 15,
    location: "",
    faculty: "",
    facultyId: "",
    facultyEmail: "",
    facultyPhone: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    durationHours: "40 Hours",
    totalAmount: "",
    amountReceived: "0",
    paymentMode: "Bank Transfer / NEFT",
    initialPaymentRemarks: "Initial Advance / Registration Payment",
    brand: "",
    companyAssigned: "",
    salesExecutive: "",
    centreHead: "",
    status: "Scheduled",
    remarks: "",
  });

  const userRole = (currentUser?.role || "").toLowerCase().trim();
  const isCounsellor =
    userRole === "counsellor" ||
    userRole === "counselor" ||
    userRole.includes("counsellor") ||
    userRole.includes("counselor");

  const isCentreHead =
    userRole === "brand_manager" ||
    userRole === "brand-manager" ||
    userRole === "brand manager" ||
    userRole === "manager" ||
    userRole === "centre head" ||
    userRole === "centre_head" ||
    userRole === "center head" ||
    userRole === "center_head";

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (facultyDropdownRef.current && !facultyDropdownRef.current.contains(e.target as Node)) {
        setIsFacultyDropdownOpen(false);
      }
      if (salesDropdownRef.current && !salesDropdownRef.current.contains(e.target as Node)) {
        setIsSalesDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch Brands, Companies, Faculty & Counsellors on modal open
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg("");
    setFacultySearch("");
    setSalesSearch("");
    setIsFacultyDropdownOpen(false);
    setIsSalesDropdownOpen(false);

    // Set default sales exec & centre head from current user
    const defaultBrand = currentUser?.brandScope && currentUser.brandScope !== "All Brands" && currentUser.brandScope !== "All"
      ? currentUser.brandScope
      : "CADD MANTRA";

    setFormData((prev) => ({
      ...prev,
      brand: defaultBrand,
      salesExecutive: isCounsellor ? currentUser?.name || "" : prev.salesExecutive,
      centreHead: isCentreHead ? currentUser?.name || "" : prev.centreHead,
    }));

    if (isCounsellor && currentUser?.name) {
      setSalesSearch(currentUser.name);
    }

    // Fetch Brands
    fetch("/api/brands")
      .then((res) => res.json())
      .then((d) => {
        if (d.success && Array.isArray(d.brands)) {
          setBrands(d.brands.map((b: any) => b.name));
        }
      })
      .catch(console.error);

    // Fetch Companies
    fetch("/api/companies")
      .then((res) => res.json())
      .then((d) => {
        if (d.success && Array.isArray(d.companies)) {
          setCompanies(d.companies.map((c: any) => c.name));
          if (d.companies.length > 0 && !formData.companyAssigned) {
            setFormData((p) => ({ ...p, companyAssigned: d.companies[0].name }));
          }
        }
      })
      .catch(console.error);

    // Fetch Faculty / Teachers
    fetch("/api/teachers")
      .then((res) => res.json())
      .then((d) => {
        if (d.success && (d.teachers || d.data)) {
          const list = d.teachers || d.data || [];
          setFacultyList(list);
        }
      })
      .catch(console.error);

    // Fetch Counsellors
    fetch("/api/counsellors")
      .then((res) => res.json())
      .then((d) => {
        if (d.success && (d.counsellors || d.data)) {
          const list = d.counsellors || d.data || [];
          setCounsellorsList(list);
        }
      })
      .catch(console.error);
  }, [isOpen, currentUser]);

  const handleSelectFaculty = (f: any) => {
    const name = `${f.firstName || ""} ${f.lastName || ""}`.trim() || f.name;
    setFormData((prev) => ({
      ...prev,
      faculty: name,
      facultyId: f._id || "",
      facultyEmail: f.email || "",
      facultyPhone: f.phone || f.mobile || "",
    }));
    setFacultySearch(name);
    setIsFacultyDropdownOpen(false);
  };

  const handleCustomFacultyInput = (val: string) => {
    setFacultySearch(val);
    setFormData((prev) => ({
      ...prev,
      faculty: val,
      facultyId: "",
    }));
  };

  const handleSelectSalesExecutive = (c: any) => {
    const name = c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim();
    setFormData((prev) => ({
      ...prev,
      salesExecutive: name,
    }));
    setSalesSearch(name);
    setIsSalesDropdownOpen(false);
  };

  const filteredFaculty = facultyList.filter((f: any) => {
    const name = `${f.firstName || ""} ${f.lastName || ""}`.trim() || f.name || "";
    const email = f.email || "";
    const subject = f.subject || "";
    const q = facultySearch.toLowerCase().trim();
    return name.toLowerCase().includes(q) || email.toLowerCase().includes(q) || subject.toLowerCase().includes(q);
  });

  const filteredCounsellors = counsellorsList.filter((c: any) => {
    const name = c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim();
    const q = salesSearch.toLowerCase().trim();
    return name.toLowerCase().includes(q);
  });

  const totalAmtNum = Number(formData.totalAmount) || 0;
  const amountRcvdNum = Number(formData.amountReceived) || 0;
  const remainingBalance = Math.max(0, totalAmtNum - amountRcvdNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.companyName.trim()) {
      setErrorMsg("Please enter the Client Organization / Company Name.");
      return;
    }
    if (!formData.trainingProgram.trim()) {
      setErrorMsg("Please enter the Training Program or Course Title.");
      return;
    }
    if (!formData.faculty.trim()) {
      setErrorMsg("Please enter or select the Faculty / Lead Trainer Name.");
      return;
    }
    if (!formData.startDate) {
      setErrorMsg("Please select the Training Start Date.");
      return;
    }
    if (!formData.endDate) {
      setErrorMsg("Please select the Training End Date.");
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setErrorMsg("End Date cannot be earlier than Start Date.");
      return;
    }
    if (totalAmtNum <= 0) {
      setErrorMsg("Please specify a valid Total Agreed Commercial Amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/corporate-trainings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(data.error || "Failed to create Corporate Training.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto font-sans animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md shadow-indigo-600/30">
              🏢
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Add Corporate Training Program</span>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Enterprise B2B
                </span>
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Register a new corporate client training, assign faculty, dates & commercials.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2 animate-shake">
              <span className="text-base">⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Client Organization Details */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
              1. Client & Organization Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  Client / Organization Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Larsen & Toubro, Tata Motors, Infosys"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-800 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Contact Person / HR Lead</label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Sharma"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-semibold text-slate-800 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Contact Phone / Mobile</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-semibold text-slate-800 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Training Program, Faculty & Schedule */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-600"></span>
              2. Training Program, Faculty & Schedule
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  Training Program / Course Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Advanced BIM & Revit Architecture Masterclass"
                  value={formData.trainingProgram}
                  onChange={(e) => setFormData({ ...formData, trainingProgram: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-800 shadow-2xs"
                />
              </div>

              <div className="relative" ref={facultyDropdownRef}>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  Faculty / Lead Trainer <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Search or enter trainer name..."
                    value={facultySearch || formData.faculty}
                    onFocus={() => setIsFacultyDropdownOpen(true)}
                    onChange={(e) => {
                      handleCustomFacultyInput(e.target.value);
                      setIsFacultyDropdownOpen(true);
                    }}
                    className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-800 shadow-2xs text-xs"
                  />
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">👨‍🏫</span>
                  <button
                    type="button"
                    onClick={() => setIsFacultyDropdownOpen((prev) => !prev)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 transition-transform ${isFacultyDropdownOpen ? "rotate-180 text-indigo-600" : ""}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                </div>

                {/* Custom Styled Faculty Dropdown Menu */}
                {isFacultyDropdownOpen && (
                  <div className="absolute z-40 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto p-1.5 space-y-1 animate-fadeIn">
                    <div className="px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 flex justify-between items-center">
                      <span>Select Registered Faculty</span>
                      <span>{filteredFaculty.length} Found</span>
                    </div>

                    {filteredFaculty.length > 0 ? (
                      filteredFaculty.map((f: any) => {
                        const name = `${f.firstName || ""} ${f.lastName || ""}`.trim() || f.name;
                        const isSelected = formData.faculty.toLowerCase() === name.toLowerCase();
                        const initials = (f.firstName ? f.firstName[0] : "") + (f.lastName ? f.lastName[0] : "") || name.substring(0, 2);

                        return (
                          <div
                            key={f._id || name}
                            onClick={() => handleSelectFaculty(f)}
                            className={`px-3 py-2 rounded-xl flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                              isSelected
                                ? "bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-black"
                                : "hover:bg-slate-50 text-slate-700 font-bold"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`h-7 w-7 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 uppercase ${
                                isSelected ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700"
                              }`}>
                                {initials || "FC"}
                              </div>
                              <div className="truncate">
                                <div className="text-xs truncate">{name}</div>
                                {(f.subject || f.email) && (
                                  <div className="text-[10px] text-slate-400 font-semibold truncate">
                                    {f.subject || f.email}
                                  </div>
                                )}
                              </div>
                            </div>
                            {isSelected && <span className="text-indigo-600 font-black text-xs shrink-0">✓</span>}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 text-center text-slate-400 font-semibold text-xs">
                        No registered faculty found matching &quot;{facultySearch}&quot;
                      </div>
                    )}

                    {facultySearch.trim() && (
                      <div
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, faculty: facultySearch.trim(), facultyId: "" }));
                          setIsFacultyDropdownOpen(false);
                        }}
                        className="px-3 py-2 bg-indigo-50/60 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-200/60 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors mt-1"
                      >
                        <span>➕</span>
                        <span>Use &quot;{facultySearch.trim()}&quot; as custom trainer</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  Faculty Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-800 shadow-2xs cursor-pointer"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  Faculty End Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-800 shadow-2xs cursor-pointer"
                />
              </div>

              {/* Training Mode */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Training Mode</label>
                <select
                  value={formData.trainingMode}
                  onChange={(e) => setFormData({ ...formData, trainingMode: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-800 shadow-2xs cursor-pointer"
                >
                  <option value="Offline (Client Site)">Offline (Client Site)</option>
                  <option value="Offline (Centre / Campus)">Offline (Centre / Campus)</option>
                  <option value="Online Live Virtual">Online Live Virtual</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>

              {/* Duration Hours */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Duration / Total Hours</label>
                <input
                  type="text"
                  placeholder="e.g. 40 Hours / 5 Days"
                  value={formData.durationHours}
                  onChange={(e) => setFormData({ ...formData, durationHours: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-semibold text-slate-800 shadow-2xs"
                />
              </div>

              {/* Number of Participants */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Participants / Attendees</label>
                <input
                  type="number"
                  min={1}
                  value={formData.numberOfParticipants}
                  onChange={(e) => setFormData({ ...formData, numberOfParticipants: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-semibold text-slate-800 shadow-2xs"
                />
              </div>

              {/* Training Location / Venue */}
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Location / Venue</label>
                <input
                  type="text"
                  placeholder="e.g. Client Campus, Noida Sector 62"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-semibold text-slate-800 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Commercials, Fees & Advance Collection */}
          <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-emerald-950 uppercase tracking-wider flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                3. Agreed Commercials & Initial Fee Collection
              </h3>
              <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                Remaining Balance: ₹{remainingBalance.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                  Total Agreed Amount (INR) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-black text-slate-400">₹</span>
                  <input
                    type="number"
                    min={0}
                    required
                    placeholder="e.g. 150000"
                    value={formData.totalAmount}
                    onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                    className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-black text-slate-900 text-sm shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Advance Received Today (INR)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 font-black text-slate-400">₹</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={formData.amountReceived}
                    onChange={(e) => setFormData({ ...formData, amountReceived: e.target.value })}
                    className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-black text-slate-900 text-sm shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={formData.paymentMode}
                  onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-800 shadow-2xs cursor-pointer"
                >
                  <option value="Bank Transfer / NEFT">Bank Transfer / NEFT</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI">UPI / QR</option>
                  <option value="Cash">Cash</option>
                  <option value="Demand Draft">Demand Draft</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Brand Scope, Entity & Sales Executive */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-600"></span>
              4. Brand Scope, Billing Entity & Ownership
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Brand Scope</label>
                <select
                  value={formData.brand}
                  disabled={isCentreHead && Boolean(currentUser?.brandScope && currentUser.brandScope !== "All Brands" && currentUser.brandScope !== "All")}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-800 shadow-2xs cursor-pointer disabled:opacity-60"
                >
                  {brands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  {brands.length === 0 && <option value="CADD MANTRA">CADD MANTRA</option>}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Billing Company Entity</label>
                <select
                  value={formData.companyAssigned}
                  onChange={(e) => setFormData({ ...formData, companyAssigned: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-800 shadow-2xs cursor-pointer"
                >
                  {companies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  {companies.length === 0 && <option value="INSTITUTE OF CREATIVE STUDIES">INSTITUTE OF CREATIVE STUDIES</option>}
                </select>
              </div>

              <div className="relative" ref={salesDropdownRef}>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Sales Executive / Closer</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search or enter closer name..."
                    value={salesSearch || formData.salesExecutive}
                    onFocus={() => setIsSalesDropdownOpen(true)}
                    onChange={(e) => {
                      setSalesSearch(e.target.value);
                      setFormData((p) => ({ ...p, salesExecutive: e.target.value }));
                      setIsSalesDropdownOpen(true);
                    }}
                    className="w-full pl-8 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-800 shadow-2xs text-xs"
                  />
                  <span className="absolute left-2.5 top-2.5 text-slate-400 text-sm">👤</span>
                  <button
                    type="button"
                    onClick={() => setIsSalesDropdownOpen((prev) => !prev)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 transition-transform ${isSalesDropdownOpen ? "rotate-180 text-indigo-600" : ""}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                </div>

                {/* Custom Styled Sales Executive Dropdown Menu */}
                {isSalesDropdownOpen && (
                  <div className="absolute z-40 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-56 overflow-y-auto p-1.5 space-y-1 animate-fadeIn">
                    <div className="px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 flex justify-between items-center">
                      <span>Counsellors & Sales Team</span>
                      <span>{filteredCounsellors.length} Found</span>
                    </div>

                    {filteredCounsellors.length > 0 ? (
                      filteredCounsellors.map((c: any) => {
                        const name = c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim();
                        const isSelected = formData.salesExecutive.toLowerCase() === name.toLowerCase();

                        return (
                          <div
                            key={c._id || name}
                            onClick={() => handleSelectSalesExecutive(c)}
                            className={`px-3 py-2 rounded-xl flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                              isSelected
                                ? "bg-indigo-50 text-indigo-900 border border-indigo-200/80 font-black"
                                : "hover:bg-slate-50 text-slate-700 font-bold"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs">👤</span>
                              <div className="text-xs truncate">{name}</div>
                            </div>
                            {isSelected && <span className="text-indigo-600 font-black text-xs shrink-0">✓</span>}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 text-center text-slate-400 font-semibold text-xs">
                        No team member found matching &quot;{salesSearch}&quot;
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-1">Centre Head / Manager</label>
                <input
                  type="text"
                  placeholder="Centre Head"
                  value={formData.centreHead}
                  onChange={(e) => setFormData({ ...formData, centreHead: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-bold text-slate-800 shadow-2xs"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving Training...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>Confirm & Add Corporate Training</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
