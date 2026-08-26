"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ConvertToPoModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: {
    _id: string;
    quotationNumber: string;
    customerName: string;
    grandTotal: number;
    termsAndConditions?: string[];
  } | null;
  onSuccess?: () => void;
}

export default function ConvertToPoModal({
  isOpen,
  onClose,
  quotation,
  onSuccess,
}: ConvertToPoModalProps) {
  const router = useRouter();
  const [supplierName, setSupplierName] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierGstin, setSupplierGstin] = useState("");
  const [terms, setTerms] = useState<string[]>([]);
  const [newTermInput, setNewTermInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (quotation) {
      if (Array.isArray(quotation.termsAndConditions) && quotation.termsAndConditions.length > 0) {
        setTerms(quotation.termsAndConditions);
      } else {
        // Fetch detailed quotation to get terms
        fetch(`/api/quotations/${quotation._id}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.data?.termsAndConditions) {
              setTerms(data.data.termsAndConditions);
            } else {
              setTerms([
                "GST CHARGE EXTRA",
                "TRANSPORTATION INCLUDED",
                "PAYMENT ADVANCE",
                "MATERIAL DELIVERED WITHIN 7 DAYS",
              ]);
            }
          })
          .catch(() => {
            setTerms([
              "GST CHARGE EXTRA",
              "TRANSPORTATION INCLUDED",
              "PAYMENT ADVANCE",
            ]);
          });
      }
    }
  }, [quotation]);

  if (!isOpen || !quotation) return null;

  const handleAddTerm = () => {
    if (!newTermInput.trim()) return;
    setTerms((prev) => [...prev, newTermInput.trim()]);
    setNewTermInput("");
  };

  const handleRemoveTerm = (index: number) => {
    setTerms((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateTerm = (index: number, val: string) => {
    setTerms((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierAddress.trim()) {
      setErrorMsg("Please enter the Supplier Address.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/quotations/${quotation._id}/convert-to-po`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: supplierName.trim(),
          supplierAddress: supplierAddress.trim(),
          supplierGstin: supplierGstin.trim().toUpperCase(),
          termsAndConditions: terms.filter((t) => t.trim() !== ""),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onClose();
        if (onSuccess) onSuccess();
        if (data.data?._id) {
          window.open(`/api/purchase-orders/${data.data._id}/pdf`, "_blank");
        }
        router.push("/purchase-orders");
      } else {
        setErrorMsg(data.error || "Failed to convert quotation to Purchase Order.");
      }
    } catch (err: any) {
      console.error("Conversion error:", err);
      setErrorMsg(err.message || "An error occurred during conversion.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
              Quotation Conversion Engine
            </div>
            <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              📦 Convert to Purchase Order
            </h3>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1 text-xs font-semibold">
            <div className="flex justify-between text-slate-500">
              <span>Quotation Reference:</span>
              <strong className="text-indigo-600 font-mono font-bold">{quotation.quotationNumber}</strong>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Client / Consignee:</span>
              <strong className="text-slate-800 font-bold">{quotation.customerName}</strong>
            </div>
            <div className="flex justify-between text-slate-500 pt-1 border-t border-slate-200">
              <span>Total Value:</span>
              <strong className="text-emerald-600 font-black text-sm">₹{Number(quotation.grandTotal || 0).toLocaleString("en-IN")}</strong>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl animate-in fade-in">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Supplier Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Supplier Name / Vendor (Optional)
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="e.g. SICCES PRIVATE LIMITED or Vendor Name"
              className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Supplier Address - REQUIRED */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Supplier Address <span className="text-rose-500">* Required</span>
            </label>
            <textarea
              rows={2}
              required
              value={supplierAddress}
              onChange={(e) => setSupplierAddress(e.target.value)}
              placeholder="Enter complete supplier / vendor office & dispatch address..."
              className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Supplier GSTIN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Supplier GSTIN (Optional)
            </label>
            <input
              type="text"
              value={supplierGstin}
              onChange={(e) => setSupplierGstin(e.target.value)}
              placeholder="e.g. 09AASCS4608K1ZP"
              className="w-full px-3.5 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase"
            />
          </div>

          {/* Terms and Conditions Section - EDITABLE HERE */}
          <div className="border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                📝 Terms & Conditions for Purchase Order
              </label>
              <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                Update or customize terms here
              </span>
            </div>

            <div className="space-y-2 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/80">
              {terms.map((term, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold text-xs">{idx + 1}.</span>
                  <input
                    type="text"
                    value={term}
                    onChange={(e) => handleUpdateTerm(idx, e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveTerm(idx)}
                    className="h-7 w-7 text-rose-500 hover:bg-rose-50 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center justify-center shrink-0"
                    title="Remove term"
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Add New Term Input */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newTermInput}
                  onChange={(e) => setNewTermInput(e.target.value)}
                  placeholder="Type a new term & condition..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTerm();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                />
                <button
                  type="button"
                  onClick={handleAddTerm}
                  className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? "Converting..." : "📦 Convert & Generate Purchase Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
