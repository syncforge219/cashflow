"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useUser } from "@/app/component/context/user-context";
import LeadSourceManagerModal from "@/components/LeadSourceManagerModal";
import CourseMultiSelect from "@/components/CourseMultiSelect";

interface EditEnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updatedLead: any) => void;
  lead: any;
}

export default function EditEnquiryModal({ isOpen, onClose, onSuccess, lead }: EditEnquiryModalProps) {
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [counsellors, setCounsellors] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [leadSources, setLeadSources] = useState<any[]>([]);
  const [isLeadSourceModalOpen, setIsLeadSourceModalOpen] = useState(false);

  // Form State
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [isLookingForJob, setIsLookingForJob] = useState(false);
  const [expectedCourseFee, setExpectedCourseFee] = useState("₹0");

  const [formData, setFormData] = useState({
    studentFullName: "",
    primaryPhoneMobile: "",
    parentsPhoneNumber: "",
    emailAddress: "",
    currentCity: "",
    status: "",
    priorityLevel: "",
    assignedCrmAdvisor: "",
    leadSource: "",
    remarks: "",
  });

  const cleanPhoneDigits = (phone: string) => {
    if (!phone) return "";
    return String(phone).replace(/^\+?91\s?/, "").replace(/\D/g, "").slice(0, 10);
  };

  const userRole = (user?.role || (user as any)?.crmRole || "").toLowerCase().trim();
  const isSuperAdmin =
    userRole === "super admin" ||
    userRole === "super_admin" ||
    userRole === "director";

  useEffect(() => {
    if (isOpen) {
      fetch("/api/counsellors")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.counsellors) {
            setCounsellors(data.counsellors);
          }
        })
        .catch(console.error);

      fetch("/api/brands")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.brands) {
            setBrands(data.brands);
          }
        })
        .catch(console.error);

      fetch("/api/courses")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setCourses(data.data);
          }
        })
        .catch(console.error);

      fetch("/api/lead-sources")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setLeadSources(data.data);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (lead && isOpen) {
      setFormData({
        studentFullName: lead.studentFullName || "",
        primaryPhoneMobile: cleanPhoneDigits(lead.primaryPhoneMobile || ""),
        parentsPhoneNumber: cleanPhoneDigits(lead.parentsPhoneNumber || ""),
        emailAddress: lead.emailAddress || "",
        currentCity: lead.currentCity || "",
        status: lead.status || "New",
        priorityLevel: lead.priorityLevel || "Medium",
        assignedCrmAdvisor: lead.assignedCrmAdvisor || "",
        leadSource: lead.leadSource || "Website",
        remarks: lead.remarks || "",
      });

      const initialBrand = lead.targetBrand || lead.brand || (user?.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All" ? user.brandScope : "") || "";
      setSelectedBrand(initialBrand);

      const jobFlag = Boolean(
        lead.isLookingForJob ||
        lead.targetCourse === "Looking for Job" ||
        (Array.isArray(lead.courses) && lead.courses.includes("Looking for Job"))
      );
      setIsLookingForJob(jobFlag);

      let initialCourses: string[] = [];
      if (!jobFlag) {
        if (Array.isArray(lead.courses) && lead.courses.length > 0) {
          initialCourses = lead.courses.map((c: any) => String(c).trim()).filter(Boolean);
        } else if (Array.isArray(lead.targetCourses) && lead.targetCourses.length > 0) {
          initialCourses = lead.targetCourses.map((c: any) => String(c).trim()).filter(Boolean);
        } else if (lead.targetCourse && lead.targetCourse !== "Looking for Job") {
          initialCourses = String(lead.targetCourse).split(",").map(c => c.trim()).filter(Boolean);
        }
      }
      setSelectedCourses(initialCourses);
      setExpectedCourseFee(lead.expectedCourseFee || "₹0");
    }
  }, [lead, isOpen, user?.brandScope]);

  const filteredCourses = useMemo(() => {
    const brandToFilter = selectedBrand;
    if (!brandToFilter || brandToFilter === "All" || brandToFilter === "All Brands") return courses;
    const target = brandToFilter.toLowerCase().replace(/[^a-z0-9]/g, "");
    return courses.filter((c: any) => {
      if (!c.brand) return false;
      const b = String(c.brand).toLowerCase().replace(/[^a-z0-9]/g, "");
      return b === target || b.includes(target) || target.includes(b);
    });
  }, [courses, selectedBrand]);

  const filteredCounsellors = useMemo(() => {
    if (!selectedBrand || selectedBrand === "All Brands" || selectedBrand === "All") return counsellors;
    const target = selectedBrand.toLowerCase().trim();
    return counsellors.filter((c: any) => {
      if (!c.brandScope) return false;
      const scope = String(c.brandScope).toLowerCase().trim();
      if (scope === "all" || scope === "all brands" || scope === "global" || scope === "*") return true;
      const parts = scope.split(/[,/|]/).map((p: string) => p.trim());
      return parts.some((p: string) => p === target || p.includes(target) || target.includes(p));
    });
  }, [counsellors, selectedBrand]);

  if (!isOpen || !lead) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleCourseSelectionChange = (newSelected: string[]) => {
    setSelectedCourses(newSelected);

    let totalFee = 0;
    newSelected.forEach((cName) => {
      const found = filteredCourses.find((c: any) => c.name === cName) || courses.find((c: any) => c.name === cName);
      if (found && found.fee) {
        const num = parseFloat(String(found.fee).replace(/[^0-9.]/g, "")) || 0;
        totalFee += num;
      }
    });

    if (totalFee > 0) {
      setExpectedCourseFee(`₹${totalFee.toLocaleString("en-IN")}`);
    } else {
      setExpectedCourseFee("₹0");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!formData.studentFullName.trim()) {
      alert("Student Name is required.");
      setIsSubmitting(false);
      return;
    }

    if (!isLookingForJob && selectedCourses.length === 0) {
      alert("Please select at least one Target Course or mark the lead as Looking for Job.");
      setIsSubmitting(false);
      return;
    }

    const primaryClean = cleanPhoneDigits(formData.primaryPhoneMobile);
    const parentsClean = cleanPhoneDigits(formData.parentsPhoneNumber);

    const payload: any = {
      ...formData,
      primaryPhoneMobile: primaryClean ? `+91 ${primaryClean}` : "",
      parentsPhoneNumber: parentsClean ? `+91 ${parentsClean}` : "",
      targetBrand: selectedBrand,
      expectedCourseFee: expectedCourseFee,
    };

    if (isLookingForJob) {
      payload.isLookingForJob = true;
      payload.courses = ["Looking for Job"];
      payload.targetCourses = ["Looking for Job"];
      payload.targetCourse = "Looking for Job";
      payload.expectedCourseFee = "₹0";
    } else {
      payload.isLookingForJob = false;
      payload.courses = selectedCourses;
      payload.targetCourses = selectedCourses;
      payload.targetCourse = selectedCourses.join(", ");
    }

    try {
      const leadId = lead._id || (lead.allEnquiries && lead.allEnquiries[0]?._id);
      if (!leadId) {
        alert("Enquiry ID is missing. Cannot update.");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`/api/enquiries/${leadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        if (onSuccess) onSuccess(result.enquiry);
        else onClose();
      } else {
        const errorData = await response.json();
        console.error("Failed to update enquiry:", errorData.message);
        alert("Failed to update enquiry: " + (errorData.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Error submitting form");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[70] animate-fade-in font-sans">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 shrink-0 bg-gradient-to-r from-amber-50/90 to-amber-100/50 border-b border-amber-200/70 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shadow-xs">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-amber-950 flex items-center gap-2">
                Modify Prospect Enquiry
                {lead?.enquiryId && (
                  <span className="bg-amber-200/90 text-amber-900 text-[10px] px-2.5 py-0.5 rounded-lg uppercase tracking-wider font-mono font-extrabold border border-amber-300 shadow-2xs">
                    {lead.enquiryId}
                  </span>
                )}
              </h3>
              <p className="text-xs font-medium text-amber-800/80">
                Update course interest, brand assignment, counselling details, or contact info.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 bg-white border border-slate-200 rounded-full hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Section 1: Course & Brand Requirements */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-amber-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
                Course & Brand Routing
              </h4>

              {/* Looking for Job Toggle */}
              <label className="flex items-center gap-2 px-3 py-1 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isLookingForJob}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsLookingForJob(checked);
                    if (checked) {
                      setSelectedCourses([]);
                      setExpectedCourseFee("₹0");
                    }
                  }}
                  className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer accent-amber-600"
                />
                <span className="text-xs font-bold text-amber-900">
                  💼 Lead is Looking for Job
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Target Brand
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                >
                  <option value="">-- Select a Brand --</option>
                  {brands.map((b) => (
                    <option key={b._id || b.name} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Target Course(s) {!isLookingForJob && <span className="text-rose-500">*</span>}
                  </label>
                  {isLookingForJob ? (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                      Looking for Job
                    </span>
                  ) : selectedCourses.length > 0 ? (
                    <span className="text-[10px] font-extrabold text-indigo-600">
                      {selectedCourses.length} Selected
                    </span>
                  ) : null}
                </div>
                <CourseMultiSelect
                  courses={filteredCourses}
                  selectedCourses={selectedCourses}
                  onChange={handleCourseSelectionChange}
                  disabled={isLookingForJob}
                  placeholder={isLookingForJob ? "Disabled: Looking for Job marked" : "-- Select Target Course(s) --"}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Expected Course Fee
                </label>
                <input
                  type="text"
                  value={expectedCourseFee}
                  onChange={(e) => setExpectedCourseFee(e.target.value)}
                  disabled={isLookingForJob}
                  placeholder="e.g. ₹25,000"
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Assigned Counsellor {selectedBrand ? `(${selectedBrand})` : ""}
                </label>
                <select
                  name="assignedCrmAdvisor"
                  value={formData.assignedCrmAdvisor}
                  onChange={handleChange}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                >
                  <option value="">-- Select Sales Executive / Counsellor --</option>
                  {formData.assignedCrmAdvisor && !filteredCounsellors.some((c: any) => c.name === formData.assignedCrmAdvisor) && (
                    <option value={formData.assignedCrmAdvisor}>
                      {formData.assignedCrmAdvisor} (Currently Assigned)
                    </option>
                  )}
                  {filteredCounsellors.map((c: any) => (
                    <option key={c._id || c.name} value={c.name}>
                      {c.name} {c.brandScope ? `(${c.brandScope})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Student Demographics */}
          <div>
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              Student Demographics
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Student Name <span className="text-rose-500">*</span>
                </label>
                <input
                  name="studentFullName"
                  value={formData.studentFullName}
                  onChange={handleChange}
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Phone Mobile
                </label>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500/50 bg-white">
                  <span className="inline-flex items-center px-2.5 bg-slate-50 text-slate-600 font-bold text-xs border-r border-slate-200 select-none">
                    +91
                  </span>
                  <input
                    name="primaryPhoneMobile"
                    value={formData.primaryPhoneMobile}
                    onChange={(e) => {
                      const cleaned = cleanPhoneDigits(e.target.value);
                      setFormData((prev) => ({ ...prev, primaryPhoneMobile: cleaned }));
                    }}
                    type="tel"
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full text-xs font-semibold text-slate-700 px-3 py-2.5 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Parents Phone Number
                </label>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500/50 bg-white">
                  <span className="inline-flex items-center px-2.5 bg-slate-50 text-slate-600 font-bold text-xs border-r border-slate-200 select-none">
                    +91
                  </span>
                  <input
                    name="parentsPhoneNumber"
                    value={formData.parentsPhoneNumber}
                    onChange={(e) => {
                      const cleaned = cleanPhoneDigits(e.target.value);
                      setFormData((prev) => ({ ...prev, parentsPhoneNumber: cleaned }));
                    }}
                    type="tel"
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full text-xs font-semibold text-slate-700 px-3 py-2.5 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Email Address
                </label>
                <input
                  name="emailAddress"
                  value={formData.emailAddress}
                  onChange={handleChange}
                  type="email"
                  placeholder="e.g. rahul@domain.com"
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Current City
                </label>
                <input
                  name="currentCity"
                  value={formData.currentCity}
                  onChange={handleChange}
                  type="text"
                  placeholder="e.g. Lucknow"
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Status & Pipeline */}
          <div>
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
              Pipeline & Classification
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Pipeline Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                >
                  <option value="New">New</option>
                  <option value="Active">Active</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Demo Scheduled">Demo Scheduled</option>
                  <option value="Demo Attended">Demo Attended</option>
                  <option value="Enrolled">Enrolled</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Priority Level
                </label>
                <select
                  name="priorityLevel"
                  value={formData.priorityLevel}
                  onChange={handleChange}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Lead Source
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsLeadSourceModalOpen(true)}
                    className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    + Add Source
                  </button>
                </div>
                <select
                  name="leadSource"
                  value={formData.leadSource}
                  onChange={handleChange}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                >
                  {leadSources.length > 0 ? (
                    leadSources.map((ls) => (
                      <option key={ls._id || ls.name} value={ls.name}>
                        {ls.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Google Ads">Google Ads</option>
                      <option value="Meta Ads">Meta Ads</option>
                      <option value="Website">Website</option>
                      <option value="Seminar">Seminar</option>
                      <option value="Hoarding">Hoarding</option>
                      <option value="Reference">Reference</option>
                      <option value="Paper Ads">Paper Ads</option>
                      <option value="Internet Search">Internet Search</option>
                      <option value="Direct Walkin">Direct Walkin</option>
                      <option value="Call on Database">Call on Database</option>
                    </>
                  )}
                  {formData.leadSource && !leadSources.some((ls) => ls.name === formData.leadSource) && (
                    <option value={formData.leadSource}>{formData.leadSource}</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Remarks */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Remarks & Interaction Notes
            </label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows={3}
              placeholder="Record any notes regarding the student's updated enquiry, queries, or discussion..."
              className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-y"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200 bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors shadow-2xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-sm shadow-amber-600/20 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Saving Changes...</span>
              </>
            ) : (
              "Save Enquiry Changes"
            )}
          </button>
        </div>
      </form>

      <LeadSourceManagerModal
        isOpen={isLeadSourceModalOpen}
        onClose={() => setIsLeadSourceModalOpen(false)}
        onSourceAdded={(newSrc) => {
          setLeadSources((prev) => {
            if (prev.some((s) => s.name.toLowerCase() === newSrc.toLowerCase())) return prev;
            return [...prev, { name: newSrc }];
          });
          setFormData((prev) => ({ ...prev, leadSource: newSrc }));
        }}
      />
    </div>
  );
}
