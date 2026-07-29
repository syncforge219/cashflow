"use client";

import React, { useState } from "react";

interface AddBrandManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddBrandManagerModal({ isOpen, onClose, onSuccess }: AddBrandManagerModalProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "+91 ",
    photoUrl: "",
    brandScope: "All Brands",
    role: "cfo",
    password: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dbBrands, setDbBrands] = useState<{ name: string }[]>([]);

  React.useEffect(() => {
    if (!isOpen) return;
    const fetchBrands = async () => {
      try {
        const res = await fetch("/api/brands");
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.brands)) {
          setDbBrands(data.brands);
        }
      } catch (err) {
        console.error("Failed fetching brands:", err);
      }
    };
    fetchBrands();
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "+91 ",
        photoUrl: "",
        brandScope: "All Brands",
        role: "cfo",
        password: "",
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/^\+?91\s?/, "").replace(/\D/g, "").slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: "+91 " + digits }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const cleanDigits = formData.phone.replace(/^\+?91\s?/, "").replace(/\D/g, "");
    const payload = {
      ...formData,
      phone: cleanDigits ? `+91 ${cleanDigits}` : "",
    };

    try {
      const response = await fetch("/api/brand-managers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (onSuccess) onSuccess();
        onClose();
        // Reset form
        setFormData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "+91 ",
          photoUrl: "",
          brandScope: "All Brands",
          role: "cfo",
          password: "",
        });
      } else {
        alert(data.error || data.message || "Failed to provision user. Please try again.");
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert("An error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <span className="text-indigo-600 font-bold text-lg">+</span> Provision Centre Head Account
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            
            {/* First Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="John"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-slate-300"
                required
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Doe"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-slate-300"
                required
              />
            </div>

            {/* Corporate Email */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Corporate Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="manager@brand.com"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-slate-300 font-mono"
                required
              />
            </div>

            {/* Mobile Phone */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Mobile Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="e.g. +91 9988011223"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
              />
            </div>

            {/* Executive Role / Designation */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Executive Role <span className="text-rose-500">*</span>
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={(e) => {
                  const newRole = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    role: newRole,
                    brandScope: newRole === "cfo" ? "All Brands" : (dbBrands[0]?.name || "Cadd Mantra"),
                  }));
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer"
                required
              >
                <option value="cfo">💼 Chief Financial Officer (CFO / Finance Manager)</option>
                <option value="centre head">🏢 Centre Head / Brand Manager</option>
              </select>
            </div>

            {/* Corporate Brand Scope */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Corporate Brand Scope <span className="text-rose-500">*</span>
              </label>
              <select
                name="brandScope"
                value={formData.brandScope}
                disabled={formData.role === "cfo"}
                onChange={handleChange}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all appearance-none cursor-pointer disabled:bg-slate-100 disabled:opacity-75"
                required
              >
                <option value="All Brands">All Brands & Companies (Full Finance Authority)</option>
                {dbBrands.length > 0 ? (
                  dbBrands.map((b, idx) => (
                    <option key={idx} value={b.name}>{b.name}</option>
                  ))
                ) : (
                  <>
                    <option value="Cadd Mantra">Cadd Mantra</option>
                    <option value="Design Gateway">Design Gateway</option>
                  </>
                )}
              </select>
            </div>

            {/* Temporary Password */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                Temporary Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="CoachFlowTemp123!"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-slate-300 font-mono"
                required
              />
            </div>
          </div>

          <hr className="my-6 border-slate-100" />

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Registering..." : "Register Executive"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
