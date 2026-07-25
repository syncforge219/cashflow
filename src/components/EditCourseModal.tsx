"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/app/component/context/user-context";

interface EditCourseModalProps {
  isOpen: boolean;
  course: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditCourseModal({ isOpen, course, onClose, onSuccess }: EditCourseModalProps) {
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [dbBrands, setDbBrands] = useState<string[]>([]);
  const [discountLimitMode, setDiscountLimitMode] = useState<"INR" | "PERCENT">("INR");
  const [discountLimitValue, setDiscountLimitValue] = useState<number>(5000);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("Technology");
  const [duration, setDuration] = useState("");
  const [fee, setFee] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  const handleSwitchDiscountMode = (newMode: "INR" | "PERCENT") => {
    if (newMode === discountLimitMode) return;
    const numFee = parseFloat(String(fee).replace(/[^\d.]/g, "")) || 0;

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

  useEffect(() => {
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

  useEffect(() => {
    if (course && isOpen) {
      setName(course.name || "");
      setCode(course.code || "");
      setBrand(course.brand || "");
      setCategory(course.category || "Technology");
      setDuration(course.duration || "");
      
      const rawFeeNum = course.fee ? parseFloat(String(course.fee).replace(/[^\d.]/g, "")) : 0;
      setFee(rawFeeNum ? String(rawFeeNum) : "");
      
      setDiscountLimitValue(Number(course.maxDiscountLimit || 5000));
      setStatus(course.status || "ACTIVE");
      setErrorMessage("");
    }
  }, [course, isOpen]);

  if (!isOpen || !course) return null;

  const getBrandOptions = (): string[] => {
    if (user?.brandScope && user.role === "brand manager") {
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

    const numericFee = parseFloat(fee.replace(/[^\d.]/g, ""));
    const formattedFee = isNaN(numericFee)
      ? "₹ 0.00"
      : new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
        }).format(numericFee);

    const calculatedMaxDiscount =
      discountLimitMode === "PERCENT"
        ? Math.round((numericFee * discountLimitValue) / 100)
        : discountLimitValue;

    const payload = {
      name,
      code,
      brand: brand || brandOptions[0],
      category,
      duration,
      fee: formattedFee,
      maxDiscountLimit: calculatedMaxDiscount,
      status,
    };

    try {
      const response = await fetch(`/api/courses/${course._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (response.ok && resData.success) {
        onSuccess();
      } else {
        setErrorMessage(resData.error || resData.message || "Failed to update course");
      }
    } catch (error) {
      console.error("Error updating course:", error);
      setErrorMessage("Error updating course. Please check connection.");
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
        <div className="flex items-center justify-between border-b border-slate-100 p-4 shrink-0 bg-indigo-50/50">
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
            <div className="h-7 w-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                />
              </svg>
            </div>
            Edit Course Curriculum: <span className="text-indigo-600 font-black">{course.name}</span>
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
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
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
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                required
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
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              >
                <option value="Technology">Technology</option>
                <option value="Design">Design</option>
                <option value="Business">Business</option>
                <option value="Management">Management</option>
                <option value="Graphic Design">Graphic Design</option>
                <option value="Fashion Design">Fashion Design</option>
                <option value="Degree Program">Degree Program</option>
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Duration *
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 40 Hours, 6 Months, 36 Months"
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
                type="number"
                step="any"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="e.g. 18000"
                required
                className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 font-bold"
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
            </div>

            {/* Status */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Course Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
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
            className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? "Saving Changes..." : "Save Course Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
