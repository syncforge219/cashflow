"use client";

import React, { useState, useEffect, use } from "react";
import CourseMultiSelect from "@/components/CourseMultiSelect";

interface PublicEnquiryPageProps {
  params: Promise<{ brand: string }>;
}

export default function PublicBrandEnquiryPage({ params }: PublicEnquiryPageProps) {
  const resolvedParams = use(params);
  const rawBrand = decodeURIComponent(resolvedParams?.brand || "CADD MANTRA");
  const brandName = rawBrand.toUpperCase().trim();

  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submittedEnquiryId, setSubmittedEnquiryId] = useState("");
  const [leadSources, setLeadSources] = useState<string[]>([
    "Website",
    "Google Ads",
    "Meta Ads",
    "Instagram",
    "Facebook",
    "Seminar",
    "Hoarding",
    "Reference / Friend",
    "Internet Search",
    "Paper Ads",
    "Direct Walkin",
    "Other",
  ]);

  const [formData, setFormData] = useState({
    studentFullName: "",
    primaryPhoneMobile: "",
    emailAddress: "",
    currentCity: "",
    leadSource: "Website",
    targetCourse: "",
    remarks: "",
  });

  useEffect(() => {
    // Fetch lead sources dynamically from DB
    fetch("/api/lead-sources")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const names = data.data.map((s: any) => (typeof s === "string" ? s : s.name)).filter(Boolean);
          if (names.length > 0) {
            setLeadSources(Array.from(new Set([...names, "Website", "Google Ads", "Meta Ads", "Reference / Friend", "Other"])));
          }
        }
      })
      .catch(console.error);

    // Fetch courses available strictly for this brand
    fetch(`/api/courses?brand=${encodeURIComponent(brandName)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const normTarget = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");
          const filtered = data.data.filter((c: any) => {
            if (!c.brand) return false;
            const normCourseBrand = String(c.brand).toLowerCase().replace(/[^a-z0-9]/g, "");
            return normCourseBrand === normTarget || normCourseBrand.includes(normTarget) || normTarget.includes(normCourseBrand);
          });
          filtered.sort((a: any, b: any) => (a.name || a.title || "").localeCompare(b.name || b.title || "", undefined, { sensitivity: "base", numeric: true }));
          setCourses(filtered);
        }
      })
      .catch(console.error);
  }, [brandName]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    setFormData((prev) => ({
      ...prev,
      primaryPhoneMobile: digits,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const payload = {
        studentFullName: formData.studentFullName,
        primaryPhoneMobile: formData.primaryPhoneMobile,
        emailAddress: formData.emailAddress,
        currentCity: formData.currentCity,
        targetBrand: brandName,
        courses: selectedCourses,
        targetCourses: selectedCourses,
        targetCourse: selectedCourses.length > 0 ? selectedCourses.join(", ") : "General Course",
        leadSource: formData.leadSource || "Website",
        remarks: formData.remarks,
      };

      const res = await fetch("/api/enquiries/google-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setSubmittedEnquiryId(data.enquiryId || "");
        setIsSubmitted(true);
      } else {
        setErrorMessage(data.error || "Failed to submit inquiry. Please try again.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Background Ambient Decorative Blurs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        {/* Brand Badge */}
        <div className="flex justify-center mb-4">
          <span className="px-4 py-1.5 rounded-full bg-indigo-100/80 border border-indigo-200 text-indigo-800 text-xs font-extrabold uppercase tracking-widest backdrop-blur-md shadow-xs flex items-center gap-2">
            <span>🏢</span> {brandName} Admissions & Inquiry Portal
          </span>
        </div>

        <h2 className="text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Admissions Inquiry Form
        </h2>
        <p className="mt-2 text-center text-xs font-bold text-slate-500 max-w-md mx-auto">
          Fill out the form below to connect with expert academic counsellors for {brandName}.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="bg-white/90 border border-slate-200/80 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl sm:px-10">
          {isSubmitted ? (
            <div className="text-center py-8 space-y-5">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">Inquiry Submitted Successfully!</h3>
              <p className="text-xs font-medium text-slate-600 max-w-md mx-auto leading-relaxed">
                Thank you for reaching out to <strong className="text-indigo-700">{brandName}</strong>. Our academic team has received your details and will contact you shortly.
              </p>

              {submittedEnquiryId && (
                <div className="inline-block bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs text-slate-600 font-mono shadow-2xs">
                  Reference ID: <span className="text-indigo-900 font-extrabold">{submittedEnquiryId}</span>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={() => {
                    setIsSubmitted(false);
                    setSelectedCourses([]);
                    setFormData({
                      studentFullName: "",
                      primaryPhoneMobile: "",
                      emailAddress: "",
                      currentCity: "",
                      leadSource: "Website",
                      targetCourse: "",
                      remarks: "",
                    });
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  Submit Another Inquiry
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center shadow-2xs">
                  {errorMessage}
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  name="studentFullName"
                  value={formData.studentFullName}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400 shadow-2xs"
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mobile Number
                </label>
                <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 shadow-2xs">
                  <span className="inline-flex items-center px-3.5 bg-slate-50 text-slate-600 font-extrabold text-xs border-r border-slate-200 select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    name="primaryPhoneMobile"
                    value={formData.primaryPhoneMobile}
                    onChange={handlePhoneChange}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full px-4 py-3 text-slate-800 text-xs font-medium outline-none bg-transparent placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Email & City Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="emailAddress"
                    value={formData.emailAddress}
                    onChange={handleChange}
                    placeholder="rahul@domain.com"
                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Current City
                  </label>
                  <input
                    type="text"
                    name="currentCity"
                    value={formData.currentCity}
                    onChange={handleChange}
                    placeholder="e.g. New Delhi"
                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400 shadow-2xs"
                  />
                </div>
              </div>

              {/* Inquiry Source Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  How Did You Hear About Us? (Inquiry Source)
                </label>
                <select
                  name="leadSource"
                  value={formData.leadSource}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all cursor-pointer shadow-2xs"
                >
                  <option value="">-- Select Source / Channel --</option>
                  {leadSources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>

              {/* Course Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Interested Course(s) {selectedCourses.length > 0 && `(${selectedCourses.length} selected)`}
                </label>
                <CourseMultiSelect
                  courses={courses}
                  selectedCourses={selectedCourses}
                  onChange={setSelectedCourses}
                  placeholder={`-- Search & Select Course(s) for ${brandName} --`}
                  showFees={false}
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Any Specific Questions / Notes
                </label>
                <textarea
                  name="remarks"
                  rows={3}
                  value={formData.remarks}
                  onChange={handleChange}
                  placeholder="Ask about batch timings, fee structures, or curriculum..."
                  className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-medium focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400 shadow-2xs"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-4 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transform hover:-translate-y-0.5"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting Inquiry...
                    </>
                  ) : (
                    <>Submit Inquiry for {brandName}</>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
