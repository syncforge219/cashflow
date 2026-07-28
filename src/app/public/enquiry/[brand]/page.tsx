"use client";

import React, { useState, useEffect, use } from "react";

interface PublicEnquiryPageProps {
  params: Promise<{ brand: string }>;
}

export default function PublicBrandEnquiryPage({ params }: PublicEnquiryPageProps) {
  const resolvedParams = use(params);
  const rawBrand = decodeURIComponent(resolvedParams?.brand || "CADD MANTRA");
  const brandName = rawBrand.toUpperCase().trim();

  const [courses, setCourses] = useState<any[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submittedEnquiryId, setSubmittedEnquiryId] = useState("");

  const [formData, setFormData] = useState({
    studentFullName: "",
    primaryPhoneMobile: "",
    emailAddress: "",
    currentCity: "",
    targetCourse: "",
    remarks: "",
  });

  useEffect(() => {
    // Fetch courses available for this brand
    fetch("/api/courses")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const filtered = data.data.filter((c: any) => {
            if (!c.brand) return true;
            return c.brand.toUpperCase().trim() === brandName;
          });
          setCourses(filtered.length > 0 ? filtered : data.data);
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
        targetCourse: formData.targetCourse || "General Course",
        leadSource: "Online Inquiry Form",
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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        {/* Brand Badge */}
        <div className="flex justify-center mb-4">
          <span className="px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
            🏢 {brandName} Admissions & Inquiry Portal
          </span>
        </div>

        <h2 className="text-center text-3xl font-extrabold text-white tracking-tight">
          Admissions Inquiry Form
        </h2>
        <p className="mt-2 text-center text-xs font-semibold text-slate-400">
          Fill out the form below to get in touch with our expert academic counsellors for {brandName}.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl relative z-10">
        <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl sm:px-10">
          {isSubmitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-xl font-extrabold text-white">Inquiry Submitted Successfully!</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Thank you for reaching out to <strong className="text-indigo-400">{brandName}</strong>. Our academic team has received your details and will get in touch with you shortly.
              </p>

              {submittedEnquiryId && (
                <div className="inline-block bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-xl text-xs text-slate-400 font-mono">
                  Reference ID: <span className="text-white font-bold">{submittedEnquiryId}</span>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={() => {
                    setIsSubmitted(false);
                    setFormData({
                      studentFullName: "",
                      primaryPhoneMobile: "",
                      emailAddress: "",
                      currentCity: "",
                      targetCourse: "",
                      remarks: "",
                    });
                  }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
                >
                  Submit Another Inquiry
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold text-center">
                  {errorMessage}
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  name="studentFullName"
                  value={formData.studentFullName}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-500"
                />
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Mobile Number
                </label>
                <div className="flex rounded-xl border border-slate-700 overflow-hidden bg-slate-800/90 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                  <span className="inline-flex items-center px-3.5 bg-slate-800 text-slate-400 font-bold text-xs border-r border-slate-700 select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    name="primaryPhoneMobile"
                    value={formData.primaryPhoneMobile}
                    onChange={handlePhoneChange}
                    placeholder="9876543210"
                    maxLength={10}
                    className="w-full px-4 py-3 text-white text-xs font-medium outline-none bg-transparent placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Email & City Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="emailAddress"
                    value={formData.emailAddress}
                    onChange={handleChange}
                    placeholder="rahul@domain.com"
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Current City
                  </label>
                  <input
                    type="text"
                    name="currentCity"
                    value={formData.currentCity}
                    onChange={handleChange}
                    placeholder="e.g. New Delhi"
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Course Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Interested Course
                </label>
                <select
                  name="targetCourse"
                  value={formData.targetCourse}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="">-- Select a Course for {brandName} --</option>
                  {courses.map((c) => (
                    <option key={c._id || c.name} value={c.name}>
                      {c.name} {c.duration ? `(${c.duration})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Any Specific Questions / Notes
                </label>
                <textarea
                  name="remarks"
                  rows={3}
                  value={formData.remarks}
                  onChange={handleChange}
                  placeholder="Ask about batch timings, fee structures, or curriculum..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-500"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-extrabold rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
