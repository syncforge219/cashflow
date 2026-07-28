"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/app/component/context/user-context";

interface GoogleFormIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GoogleFormIntegrationModal({ isOpen, onClose }: GoogleFormIntegrationModalProps) {
  const { user } = useUser();
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("CADD MANTRA");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copiedQrUrl, setCopiedQrUrl] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/brands")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.brands)) {
            setBrands(data.brands);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  // Brand Filtering Criteria based on User Scope
  const isGlobalAdmin =
    !user?.brandScope ||
    user?.role === "admin" ||
    ["all", "all brands", "global", "*"].includes((user?.brandScope || "").toLowerCase().trim());

  const availableBrands = isGlobalAdmin
    ? brands
    : brands.filter((b) => {
        const userScope = (user?.brandScope || "").toLowerCase();
        const brandName = b.name.toLowerCase();
        return userScope.includes(brandName);
      });

  // Ensure selected brand matches allowed scope
  useEffect(() => {
    if (availableBrands.length > 0) {
      const exists = availableBrands.some(
        (b) => b.name.toUpperCase().trim() === selectedBrand.toUpperCase().trim()
      );
      if (!exists) {
        setSelectedBrand(availableBrands[0].name);
      }
    }
  }, [availableBrands, selectedBrand]);

  if (!isOpen) return null;

  const publicWebformUrl = `${origin}/public/enquiry/${encodeURIComponent(selectedBrand)}`;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicWebformUrl)}`;

  const copyToClipboard = (text: string, type: "link" | "qr") => {
    navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(selectedBrand);
      setTimeout(() => setCopiedLink(null), 2500);
    } else {
      setCopiedQrUrl(true);
      setTimeout(() => setCopiedQrUrl(false), 2500);
    }
  };

  const downloadQrCode = async () => {
    try {
      const response = await fetch(qrCodeImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedBrand.replace(/\s+/g, "_")}_Inquiry_QR.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed downloading QR code image", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[70] font-sans animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 shrink-0 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-t-3xl border-b border-indigo-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-xl shadow-inner">
              📝
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                Brand Forms & QR Code Generator
              </h3>
              <p className="text-xs text-indigo-300 font-medium">
                Generate brand-specific enquiry forms & QR codes for student admissions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 bg-slate-800/60 rounded-full border border-slate-700 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Brand Scope Banner & Selector */}
          <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Brand Selection
                </label>
                {!isGlobalAdmin && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                    🔒 Restricted to assigned brand scope ({user?.brandScope || "Your Brand"})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isGlobalAdmin
                  ? "Select any brand to generate its public enquiry form link and QR code."
                  : `Form and QR code generation is restricted to your assigned brand.`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedBrand}
                disabled={!isGlobalAdmin && availableBrands.length <= 1}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-extrabold text-indigo-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500/40 shadow-xs cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                {availableBrands.map((b) => (
                  <option key={b._id || b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* QR Code Generator & Direct Link Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            
            {/* QR Code Card */}
            <div className="bg-gradient-to-b from-indigo-50/50 to-white border border-indigo-100 rounded-2xl p-5 shadow-xs flex flex-col items-center justify-between text-center space-y-3">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase">
                  📱 Mobile Scan
                </span>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  {selectedBrand} QR Code
                </h4>
              </div>

              {/* QR Image Container */}
              <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-md flex items-center justify-center">
                <img
                  src={qrCodeImageUrl}
                  alt={`${selectedBrand} Inquiry QR Code`}
                  className="w-44 h-44 object-contain rounded-lg"
                />
              </div>

              <p className="text-[11px] font-medium text-slate-500">
                Scan with any smartphone camera to open the online enquiry form for <strong className="text-indigo-700">{selectedBrand}</strong>.
              </p>

              <div className="w-full flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={downloadQrCode}
                  className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12l4.5 4.5m0 0l4.5-4.5M12 3v13.5" />
                  </svg>
                  Download QR (PNG)
                </button>
              </div>
            </div>

            {/* Direct Form Link Card */}
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase">
                      Direct Form Link
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-800">
                      Public Webform Link ({selectedBrand})
                    </h4>
                  </div>
                  <a
                    href={publicWebformUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                  >
                    Open Page ↗
                  </a>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Share this public link directly via WhatsApp, email, or social media. Submitted leads are automatically saved in CoachFlow and assigned to <strong>{selectedBrand}</strong> sales executives.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicWebformUrl}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-semibold text-slate-700 outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(publicWebformUrl, "link")}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-xs cursor-pointer"
                  >
                    {copiedLink === selectedBrand ? "✔ Copied!" : "Copy Link"}
                  </button>
                </div>
              </div>

              {/* QR Image Link Copy */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Direct QR Image URL:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(qrCodeImageUrl, "qr")}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                >
                  {copiedQrUrl ? "✔ QR Image URL Copied!" : "Copy QR Image URL"}
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end rounded-b-3xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
