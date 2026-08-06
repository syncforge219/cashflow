"use client";

import React, { useState, useEffect, useMemo } from "react";

interface PaymentBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterLabel?: string;
  startDate?: string | null;
  endDate?: string | null;
  brandScope?: string | null;
}

export default function PaymentBreakdownModal({
  isOpen,
  onClose,
  filterLabel = "Today",
  startDate,
  endDate,
  brandScope,
}: PaymentBreakdownModalProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModeFilter, setSelectedModeFilter] = useState("All Modes");
  const [selectedBrandFilter, setSelectedBrandFilter] = useState("All Brands");

  useEffect(() => {
    if (isOpen) {
      fetchPaymentsData();
    }
  }, [isOpen, startDate, endDate, filterLabel, brandScope]);

  const fetchPaymentsData = async () => {
    setIsLoading(true);
    try {
      let queryParams = new URLSearchParams();
      if (brandScope && brandScope !== "all" && brandScope !== "All Brands") {
        queryParams.append("brand", brandScope);
      }
      if (startDate && endDate) {
        queryParams.append("startDate", startDate);
        queryParams.append("endDate", endDate);
      } else if (filterLabel?.toLowerCase() === "today") {
        queryParams.append("filter", "today");
      } else if (filterLabel?.toLowerCase().includes("month")) {
        queryParams.append("filter", "thisMonth");
      }

      const res = await fetch(`/api/payments?${queryParams.toString()}`);
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        setPayments(json.data);
      } else {
        setPayments([]);
      }
    } catch (err) {
      console.error("Failed to fetch payment breakdown:", err);
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const availableBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    payments.forEach((p) => {
      const b = p.brand || p.admissionId?.brand;
      if (b) brandsSet.add(b);
    });
    return Array.from(brandsSet);
  }, [payments]);

  const availableModes = useMemo(() => {
    const modesSet = new Set<string>();
    payments.forEach((p) => {
      if (p.paymentMode) modesSet.add(p.paymentMode);
    });
    return Array.from(modesSet);
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const studentName = (p.studentName || p.admissionId?.fullName || "").toLowerCase();
      const admCode = (p.admissionId?.admissionId || "").toLowerCase();
      const receiptNo = (p.receiptNo || "").toLowerCase();
      const pBrand = (p.brand || p.admissionId?.brand || "").toLowerCase();
      const pCourse = (p.admissionId?.course || "").toLowerCase();
      const pMode = p.paymentMode || "";

      if (selectedBrandFilter !== "All Brands" && pBrand !== selectedBrandFilter.toLowerCase()) {
        return false;
      }

      if (selectedModeFilter !== "All Modes" && pMode !== selectedModeFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          studentName.includes(q) ||
          admCode.includes(q) ||
          receiptNo.includes(q) ||
          pBrand.includes(q) ||
          pCourse.includes(q) ||
          pMode.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [payments, searchQuery, selectedBrandFilter, selectedModeFilter]);

  const totalCollectedAmount = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0);
  }, [filteredPayments]);

  const exportToCSV = () => {
    if (filteredPayments.length === 0) return;
    const headers = ["Receipt #", "Student Name", "Admission ID", "Admission Date", "Brand", "Course", "Amount Paid (₹)", "Payment Mode", "Payment Date", "Company"];
    const rows = filteredPayments.map((p) => [
      p.receiptNo || "N/A",
      p.studentName || p.admissionId?.fullName || "N/A",
      p.admissionId?.admissionId || "N/A",
      p.admissionId?.admissionDate ? new Date(p.admissionId.admissionDate).toLocaleDateString("en-IN") : "N/A",
      p.brand || p.admissionId?.brand || "N/A",
      p.admissionId?.course || "N/A",
      p.amountReceived || 0,
      p.paymentMode || "N/A",
      p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-IN") : (p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "N/A"),
      p.company || "N/A"
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((val) => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Payments_Collection_${filterLabel.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300">
              💳
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                Period Collection Breakdown
                <span className="text-xs bg-blue-500/30 text-blue-200 px-2.5 py-0.5 rounded-full border border-blue-400/30 font-bold">
                  {filterLabel}
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Detailed audit of fee collections, student payment sources & brand allocations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Top Summary Metric Bar */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Total Collection Sum
            </span>
            <span className="text-xl font-black text-emerald-600">
              ₹{totalCollectedAmount.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Total Transactions
            </span>
            <span className="text-xl font-black text-indigo-600">
              {filteredPayments.length} <span className="text-xs font-semibold text-slate-500">Payments</span>
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Active Brand Filter
            </span>
            <span className="text-xs font-black text-slate-800 truncate block">
              {selectedBrandFilter !== "All Brands" ? selectedBrandFilter : brandScope || "All Brands"}
            </span>
          </div>
        </div>

        {/* Search & Dropdown Controls */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 bg-white">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="🔍 Search student, admission ID, receipt #, brand, or payment mode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-semibold text-slate-800"
            />
            <span className="absolute left-3 top-2 text-slate-400 text-xs">🔍</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {availableBrands.length > 0 && (
              <select
                value={selectedBrandFilter}
                onChange={(e) => setSelectedBrandFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="All Brands">All Brands</option>
                {availableBrands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}

            {availableModes.length > 0 && (
              <select
                value={selectedModeFilter}
                onChange={(e) => setSelectedModeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="All Modes">All Modes</option>
                {availableModes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={exportToCSV}
              disabled={filteredPayments.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
            >
              📊 Export CSV
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 font-medium text-xs animate-pulse">
              ⌛ Loading collection breakdown records...
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-medium text-xs">
              No fee collection transactions recorded for this period.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200/80 rounded-2xl shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Student & Admission</th>
                    <th className="py-3 px-4">Admission Date</th>
                    <th className="py-3 px-4">Brand & Course</th>
                    <th className="py-3 px-4">Amount Paid</th>
                    <th className="py-3 px-4">Payment Mode & Receipt</th>
                    <th className="py-3 px-4">Payment Date</th>
                    <th className="py-3 px-4">Company / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {filteredPayments.map((p) => {
                    const studentName = p.studentName || p.admissionId?.fullName || "Student";
                    const admId = p.admissionId?.admissionId || (typeof p.admissionId === "string" ? p.admissionId : "N/A");
                    const brandName = p.brand || p.admissionId?.brand || "CADD Mantra";
                    const courseName = p.admissionId?.course || "N/A";
                    const amount = Number(p.amountReceived) || 0;
                    const payDateVal = p.paymentDate || p.createdAt;
                    const dateStr = payDateVal
                      ? new Date(payDateVal).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "N/A";

                    return (
                      <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                        
                        {/* Student & Admission */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs shrink-0">
                              {studentName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-900 block text-xs">
                                {studentName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                {admId}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Admission Date */}
                        <td className="py-3.5 px-4">
                          {p.admissionId?.admissionDate ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-100">
                              🎓 {new Date(p.admissionId.admissionDate).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>

                        {/* Brand & Course */}
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold text-[10px] rounded-md border border-indigo-100 mb-0.5">
                            🏢 {brandName}
                          </span>
                          <span className="text-slate-600 block text-[11px] font-medium truncate max-w-[200px]">
                            {courseName}
                          </span>
                        </td>

                        {/* Amount Paid */}
                        <td className="py-3.5 px-4">
                          <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100 inline-block">
                            + ₹{amount.toLocaleString("en-IN")}
                          </span>
                        </td>

                        {/* Payment Mode & Receipt */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-md border border-slate-200">
                              💳 {p.paymentMode || "Cash"}
                            </span>
                          </div>
                          {p.receiptNo && (
                            <span className="text-[10px] font-mono text-slate-400 font-bold">
                              #{p.receiptNo}
                            </span>
                          )}
                        </td>

                        {/* Payment Date */}
                        <td className="py-3.5 px-4">
                          <span className="text-slate-700 font-bold text-xs block">
                            📅 {dateStr}
                          </span>
                        </td>

                        {/* Company / Remarks */}
                        <td className="py-3.5 px-4">
                          <span className="text-slate-600 text-xs block">
                            {p.company || "N/A"}
                          </span>
                          {p.remarks && (
                            <span className="text-[10px] text-slate-400 font-normal italic block truncate max-w-[150px]">
                              {p.remarks}
                            </span>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3.5 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-extrabold rounded-xl transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
