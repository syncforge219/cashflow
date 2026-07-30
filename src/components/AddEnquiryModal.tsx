"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/app/component/context/user-context";
import LeadSourceManagerModal from "@/components/LeadSourceManagerModal";
import CourseMultiSelect from "@/components/CourseMultiSelect";

interface AddEnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultBrand?: string;
}

export default function AddEnquiryModal({ isOpen, onClose, onSuccess, defaultBrand }: AddEnquiryModalProps) {
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [counsellors, setCounsellors] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [leadSources, setLeadSources] = useState<any[]>([]);
  const [selectedLeadSource, setSelectedLeadSource] = useState<string>("Google Ads");
  const [isLeadSourceModalOpen, setIsLeadSourceModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedAdvisor, setSelectedAdvisor] = useState("");
  const [expectedCourseFee, setExpectedCourseFee] = useState("₹0");
  const [isDemoScheduled, setIsDemoScheduled] = useState(false);
  const [isFollowUpScheduled, setIsFollowUpScheduled] = useState(false);
  const [primaryPhone, setPrimaryPhone] = useState("+91 ");
  const [parentsPhone, setParentsPhone] = useState("+91 ");

  useEffect(() => {
    if (isOpen) {
      setPrimaryPhone("+91 ");
      setParentsPhone("+91 ");
      setIsFollowUpScheduled(false);
      setSelectedCourses([]);
      setExpectedCourseFee("₹0");
      // Auto-select brand if defaultBrand or user's brandScope is available
      const userBrand = (user?.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All") ? user.brandScope : "";
      const initialBrand = (defaultBrand && defaultBrand !== "All Brands" && defaultBrand !== "All")
        ? defaultBrand
        : userBrand;
      setSelectedBrand(initialBrand);
      setSelectedAdvisor("");

      fetch("/api/counsellors")
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setCounsellors(data.counsellors);
          }
        })
        .catch(console.error);

      fetch("/api/brands")
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setBrands(data.brands);
          }
        })
        .catch(console.error);

      fetch("/api/courses")
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setCourses(data.data);
          }
        })
        .catch(console.error);

      fetch("/api/teachers")
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setTeachers(data.teachers || data.data || []);
          }
        })
        .catch(console.error);

      fetch("/api/lead-sources")
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.data)) {
            setLeadSources(data.data);
          }
        })
        .catch(console.error);
    }
  }, [isOpen, defaultBrand, user?.brandScope]);

  const activeBrandForCounsellors = useMemo(() => {
    if (selectedBrand && selectedBrand !== "All Brands" && selectedBrand !== "All") {
      return selectedBrand;
    }
    if (defaultBrand && defaultBrand !== "All Brands" && defaultBrand !== "All") {
      return defaultBrand;
    }
    if (user?.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All") {
      return user.brandScope;
    }
    return "";
  }, [selectedBrand, defaultBrand, user?.brandScope]);

  const filteredTeachers = teachers.filter((t) => {
    const brandToFilter = selectedBrand || activeBrandForCounsellors;
    if (!brandToFilter) return true;
    if (!t.brandScope || t.brandScope === "All Brands" || t.brandScope === "All") return true;
    return t.brandScope.toLowerCase().trim() === brandToFilter.toLowerCase().trim();
  });

  const filteredCounsellors = useMemo(() => {
    if (!activeBrandForCounsellors) return counsellors;
    const target = activeBrandForCounsellors.toLowerCase().trim();
    return counsellors.filter((c: any) => {
      if (!c.brandScope) return false;
      const scope = String(c.brandScope).toLowerCase().trim();
      if (scope === "all" || scope === "all brands" || scope === "global" || scope === "*") return true;
      const parts = scope.split(/[,/|]/).map((p: string) => p.trim());
      return parts.some((p: string) => p === target || p.includes(target) || target.includes(p));
    });
  }, [counsellors, activeBrandForCounsellors]);

  const filteredCourses = useMemo(() => {
    const brandToFilter = selectedBrand || activeBrandForCounsellors;
    if (!brandToFilter) return courses;
    const target = brandToFilter.toLowerCase().replace(/[^a-z0-9]/g, "");
    return courses.filter((c: any) => {
      if (!c.brand) return false;
      const b = String(c.brand).toLowerCase().replace(/[^a-z0-9]/g, "");
      return b === target || b.includes(target) || target.includes(b);
    });
  }, [courses, selectedBrand, activeBrandForCounsellors]);

  const handlePrimaryPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/^\+?91\s?/, "").replace(/\D/g, "").slice(0, 10);
    setPrimaryPhone("+91 " + digits);
  };

  const handleParentsPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/^\+?91\s?/, "").replace(/\D/g, "").slice(0, 10);
    setParentsPhone("+91 " + digits);
  };

  // Removed if (!isOpen) return null; to handle AnimatePresence

  const handleCourseSelectionChange = (newSelected: string[]) => {
    setSelectedCourses(newSelected);

    let totalFee = 0;
    newSelected.forEach((cName) => {
      const found = filteredCourses.find((c: any) => c.name === cName);
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

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    const studentFullName = String(data.studentFullName || "").trim();
    if (!studentFullName) {
      alert("Student Full Name is required.");
      setIsSubmitting(false);
      return;
    }

    if (selectedCourses.length === 0) {
      alert("Please select at least one course.");
      setIsSubmitting(false);
      return;
    }

    if (data.primaryPhoneMobile) {
      const cleanPrimary = String(data.primaryPhoneMobile).trim().replace(/^\+?91\s?/, '');
      data.primaryPhoneMobile = cleanPrimary ? `+91 ${cleanPrimary}` : "";
    }
    if (data.parentsPhoneNumber) {
      const cleanParents = String(data.parentsPhoneNumber).trim().replace(/^\+?91\s?/, '');
      data.parentsPhoneNumber = cleanParents ? `+91 ${cleanParents}` : "";
    }

    // Attach multi-selected courses array and string fallback
    (data as any).courses = selectedCourses;
    (data as any).targetCourses = selectedCourses;
    (data as any).targetCourse = selectedCourses.join(", ");
    (data as any).expectedCourseFee = expectedCourseFee;

    // Ensure boolean value for the toggles
    data.isDemoScheduled = isDemoScheduled as any;
    data.isFollowUpScheduled = isFollowUpScheduled as any;

    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        if (onSuccess) onSuccess();
        else onClose();
      } else {
        const errorData = await response.json();
        console.error("Failed to save enquiry:", errorData.message);
        alert("Failed to save enquiry: " + errorData.message);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("Error submitting form");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans"
        >
          <motion.form 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onSubmit={handleSubmit} 
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 shrink-0">
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-indigo-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            Register New Client Lead (Enquiry)
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-8">

          {/* SECTION 1 */}
          <div>
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4">Section 1: Demographics</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Student Full Name <span className="text-rose-500">*</span>
                </label>
                <input name="studentFullName" type="text" required placeholder="e.g. Rahul Sharma" className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Primary Phone Mobile</label>
                <input 
                  name="primaryPhoneMobile" 
                  type="tel" 
                  value={primaryPhone}
                  onChange={handlePrimaryPhoneChange}
                  placeholder="e.g. +91 9876500000"
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email Address</label>
                <input name="emailAddress" type="email" placeholder="e.g. rahul@domain.com" className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Current City</label>
                <input name="currentCity" type="text" placeholder="e.g. New Delhi" className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" />
              </div>
            </div>
          </div>

          {/* SECTION 2 */}
          <div>
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4">Section 2: Business Routing</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Target Brand</label>
                <select 
                  name="targetBrand" 
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    setSelectedAdvisor("");
                  }}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                >
                  <option value="">-- Select a Brand --</option>
                  {brands.map(b => (
                    <option key={b._id || b.name} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Target Course(s) <span className="text-rose-500">*</span>
                  </label>
                  {selectedCourses.length > 0 && (
                    <span className="text-[10px] font-extrabold text-indigo-600">
                      Total Fee: {expectedCourseFee}
                    </span>
                  )}
                </div>
                <CourseMultiSelect
                  courses={filteredCourses}
                  selectedCourses={selectedCourses}
                  onChange={handleCourseSelectionChange}
                  placeholder="-- Search & Select Course(s) --"
                />
              </div>
              {user?.role === "counsellor" ? (
                <input type="hidden" name="assignedCrmAdvisor" value={user.name} />
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Assigned Sales Executive {activeBrandForCounsellors ? `(${filteredCounsellors.length} for ${activeBrandForCounsellors})` : ""}
                    </label>
                    {user?.name && (
                      <button
                        type="button"
                        onClick={() => setSelectedAdvisor(user.name)}
                        className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 hover:bg-indigo-100 transition-colors"
                      >
                        ⚡ Assign to Myself ({user.name})
                      </button>
                    )}
                  </div>
                  <select 
                    name="assignedCrmAdvisor" 
                    value={selectedAdvisor}
                    onChange={(e) => setSelectedAdvisor(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  >
                    <option value="">{activeBrandForCounsellors ? `-- Select Advisor for ${activeBrandForCounsellors} --` : "-- Select Advisor --"}</option>
                    {user?.name && (
                      <option value={user.name}>⭐ Assign to Myself ({user.name})</option>
                    )}
                    {filteredCounsellors
                      .filter((c) => c.name !== user?.name)
                      .map((c) => (
                        <option key={c._id} value={c.name}>
                          {c.name} {c.brandScope ? `(${c.brandScope})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lead Source</label>
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
                  value={selectedLeadSource}
                  onChange={(e) => setSelectedLeadSource(e.target.value)}
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
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Expected Course Fee (read-only)</label>
                <input name="expectedCourseFee" type="text" value={expectedCourseFee} readOnly className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 bg-slate-50" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Priority Level</label>
                <select name="priorityLevel" defaultValue="Medium" className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50">
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3 */}
          <div>
            <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4">Section 3: Remarks & Strategy Notes</h4>
            <div>
              <textarea name="remarks" placeholder="Provide deep client context here e.g. 'Highly interested in Saturday cohorts, requested installment flexibility...'" rows={3} className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-y"></textarea>
            </div>
          </div>

          {/* SECTION 4 */}
          <div className="border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                  Section 4: Next Follow-Up Task
                </h4>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  Toggle ON to schedule a specific follow-up call & reminder for this enquiry.
                </p>
              </div>

              {/* Follow-up Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isFollowUpScheduled}
                  onChange={(e) => setIsFollowUpScheduled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-2.5 text-xs font-bold text-slate-700">
                  {isFollowUpScheduled ? "Scheduled" : "Off"}
                </span>
              </label>
            </div>

            {isFollowUpScheduled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/80"
              >
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Follow-up Date</label>
                  <input
                    name="followUpDate"
                    type="date"
                    className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    defaultValue={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Follow-up Time</label>
                  <input
                    name="followUpTime"
                    type="time"
                    className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    defaultValue="10:00"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Follow-up Type</label>
                  <select name="followUpType" className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50">
                    <option value="Phone Call">Phone Call</option>
                    <option value="WhatsApp Message">WhatsApp Message</option>
                    <option value="In-Person Meeting">In-Person Meeting</option>
                    <option value="Email">Email</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Follow-up Priority</label>
                  <select name="followUpPriority" defaultValue="Medium" className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50">
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Reminder</label>
                  <select name="reminder" className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50">
                    <option value="None">None</option>
                    <option value="15 Minutes Before">15 Minutes Before</option>
                    <option value="1 Hour Before">1 Hour Before</option>
                    <option value="1 Day Before">1 Day Before</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Follow-up Notes</label>
                  <textarea name="followUpNotes" placeholder="Discuss fee structure, answer doubts, send brochure, schedule demo class" rows={2} className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-y"></textarea>
                </div>
              </motion.div>
            )}
          </div>

          {/* SECTION 5 */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Section 5: Schedule Demo Class</h4>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={isDemoScheduled}
                    onChange={(e) => setIsDemoScheduled(e.target.checked)}
                  />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${isDemoScheduled ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isDemoScheduled ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <span className="ml-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest select-none">
                  {isDemoScheduled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>
            
            <div className={`grid grid-cols-2 gap-4 transition-opacity ${!isDemoScheduled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Demo Date *</label>
                <input 
                  name="demoDate" 
                  type="date" 
                  required={isDemoScheduled} 
                  disabled={!isDemoScheduled}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:bg-slate-100" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Demo Time *</label>
                <input 
                  name="demoTime" 
                  type="time" 
                  required={isDemoScheduled}
                  disabled={!isDemoScheduled}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:bg-slate-100" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Demo Mode *</label>
                <select 
                  name="demoMode" 
                  required={isDemoScheduled}
                  disabled={!isDemoScheduled}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:bg-slate-100"
                >
                  <option value="Online (Zoom / Google Meet)">Online (Zoom / Google Meet)</option>
                  <option value="In-Person Classroom">In-Person Classroom</option>
                  <option value="Recorded Demo Session">Recorded Demo Session</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Assigned Teacher for Demo {selectedBrand ? `(${selectedBrand})` : ""}
                </label>
                <select 
                  name="demoTeacher" 
                  disabled={!isDemoScheduled}
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:bg-slate-100"
                >
                  <option value="">-- Select Teacher --</option>
                  {filteredTeachers.map((t) => (
                    <option key={t._id || t.name} value={t.name}>
                      {t.name} {t.brandScope ? `(${t.brandScope})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Demo Notes</label>
                <textarea 
                  name="demoNotes" 
                  disabled={!isDemoScheduled}
                  placeholder="Any specific topics requested by the student for the demo class..." 
                  rows={2} 
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-y disabled:bg-slate-100"
                ></textarea>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-4 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 rounded-xl transition-all disabled:opacity-50">
            {isSubmitting ? "Saving..." : "Create Client Lead"}
          </button>
        </div>
          </motion.form>
        </motion.div>
      )}

      <LeadSourceManagerModal
        isOpen={isLeadSourceModalOpen}
        onClose={() => setIsLeadSourceModalOpen(false)}
        onSourceAdded={(newSrc) => {
          setLeadSources((prev) => {
            if (prev.some((s) => s.name.toLowerCase() === newSrc.toLowerCase())) return prev;
            return [...prev, { name: newSrc }];
          });
          setSelectedLeadSource(newSrc);
        }}
      />
    </AnimatePresence>
  );
}
