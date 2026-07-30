"use client";

import React, { useState } from "react";
import { useUser } from "@/app/component/context/user-context";

interface AddCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddCourseModal({ isOpen, onClose, onSuccess }: AddCourseModalProps) {
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [dbBrands, setDbBrands] = React.useState<string[]>([]);
  const [discountLimitMode, setDiscountLimitMode] = useState<"INR" | "PERCENT">("INR");
  const [discountLimitValue, setDiscountLimitValue] = useState<number>(5000);
  const [formDataFee, setFormDataFee] = useState<string>("18000");

  const handleSwitchDiscountMode = (newMode: "INR" | "PERCENT") => {
    if (newMode === discountLimitMode) return;
    const numFee = parseFloat(String(formDataFee).replace(/[^\d.]/g, "")) || 0;

    if (newMode === "PERCENT") {
      if (numFee > 0 && discountLimitValue > 0) {
        const pct = parseFloat(((discountLimitValue / numFee) * 100).toFixed(2));
        setDiscountLimitValue(pct);
      }
    } else {
      if (numFee > 0 && discountLimitValue > 0) {
        const inr = Math.round((numFee * discountLimitValue) / 100);
        setDiscountLimitValue(inr);
      }
    }
    setDiscountLimitMode(newMode);
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const fetchBrands = async () => {
      try {
        const res = await fetch("/api/brands");
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.brands)) {
          const names = data.brands.map((b: any) => b.name).filter(Boolean);
          if (names.length > 0) setDbBrands(names);
        }
      } catch (err) {
        console.error("Failed fetching brands:", err);
      }
    };
    fetchBrands();
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine available brands based on logged-in user role & brandScope or DB registered brands
  const getBrandOptions = (): string[] => {
    const roleLower = (user?.role || "").toLowerCase().trim();
    const isBrandMgrRole =
      roleLower === "brand manager" ||
      roleLower === "brand_manager" ||
      roleLower === "brand-manager" ||
      roleLower === "centre head" ||
      roleLower === "centre_head" ||
      roleLower === "center head" ||
      roleLower === "center_head";
    if (user?.brandScope && isBrandMgrRole) {
      const userBrands = user.brandScope.split(",").map((b: string) => b.trim()).filter(Boolean);
      if (userBrands.length > 0) return userBrands;
    }
    if (user?.brandScope && user.role !== "super admin") {
      const userBrands = user.brandScope.split(",").map((b: string) => b.trim()).filter(Boolean);
      if (userBrands.length > 0) return userBrands;
    }
    return dbBrands.length > 0 ? dbBrands : ["Cadd Mantra", "Design Gateway"];
  };

  const brandOptions = getBrandOptions();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    // Format fee as standard currency representation, e.g. "₹ 18,000.00"
    const rawFee = data.fee as string;
    const numericFee = parseFloat(rawFee.replace(/[^\d.]/g, ""));
    const formattedFee = isNaN(numericFee)
      ? "₹ 0.00"
      : new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
        }).format(numericFee);

    const payload = {
      ...data,
      fee: formattedFee,
    };

    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        onSuccess();
      } else {
        setErrorMessage(resData.message || "Failed to create course");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setErrorMessage("Error submitting form. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 shrink-0">
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5 text-indigo-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
              />
            </svg>
            Add New Course Curriculum
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4 text-rose-500 shrink-0"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Course Name */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Course Name *
              </label>
              <input
                name="name"
                type="text"
                placeholder="e.g. AutoCAD, ETABS, Python Development"
                required
                className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>

            {/* Course Code */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Course Code *
              </label>
              <input
                name="code"
                type="text"
                placeholder="e.g. CM-CAD-09"
                required
                className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-mono"
              />
            </div>

            {/* Assigned Brand */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Assigned Brand *
              </label>
              <select
                name="brand"
                required
                defaultValue={brandOptions[0]}
                className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              >
                {brandOptions.map((brandName: string, idx: number) => (
                  <option key={idx} value={brandName}>
                    {brandName}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Category *
              </label>
              <select
                name="category"
                required
                className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              >
                <option value="Technology">Technology</option>
                <option value="Design">Design</option>
                <option value="Business">Business</option>
                <option value="Management">Management</option>
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Duration *
              </label>
              <input
                name="duration"
                type="text"
                placeholder="e.g. 40 Hours, 3 Months"
                required
                className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>

            {/* Fee */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Fee (INR) *
              </label>
              <input
                name="fee"
                type="text"
                value={formDataFee}
                onChange={(e) => setFormDataFee(e.target.value)}
                placeholder="e.g. 18000"
                required
                className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>

            {/* Max Discount Limit */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Max Allowed Discount Limit *
                </label>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleSwitchDiscountMode("INR")}
                    className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                      discountLimitMode === "INR" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    ₹ INR
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchDiscountMode("PERCENT")}
                    className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                      discountLimitMode === "PERCENT" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    % Percent
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  name="maxDiscountLimitInput"
                  type="number"
                  step="any"
                  value={discountLimitValue}
                  onChange={(e) => setDiscountLimitValue(Number(e.target.value))}
                  placeholder={discountLimitMode === "INR" ? "e.g. 5000" : "e.g. 15"}
                  required
                  className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 pr-12"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                  {discountLimitMode === "INR" ? "INR (₹)" : "% Off"}
                </span>
              </div>

              {/* Hidden field submitting converted numeric INR value */}
              <input
                type="hidden"
                name="maxDiscountLimit"
                value={
                  discountLimitMode === "PERCENT"
                    ? Math.round((parseFloat(String(formDataFee).replace(/[^\d.]/g, "") || "0") * discountLimitValue) / 100)
                    : discountLimitValue
                }
              />

              <p className="text-[10px] text-slate-400 font-medium mt-1">
                {discountLimitMode === "PERCENT"
                  ? `Equivalent to ₹${Math.round((parseFloat(String(formDataFee).replace(/[^\d.]/g, "") || "0") * discountLimitValue) / 100).toLocaleString('en-IN')} max cap on course fee.`
                  : "If counsellor gives discount > this limit, Admin approval notification will be triggered."}
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Initial Status
              </label>
              <select
                name="status"
                defaultValue="ACTIVE"
                className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-4 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 rounded-xl transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Course"}
          </button>
        </div>
      </form>
    </div>
  );
}
