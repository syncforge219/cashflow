"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import QuotationNav from "@/components/QuotationNav";
import Link from "next/link";
import CfoSecurityGuard from "@/components/CfoSecurityGuard";
import ConvertToPoModal from "@/components/ConvertToPoModal";

interface QuotationItem {
  _id: string;
  category?: string;
  billingCycle?: string;
  quotationNumber: string;
  customerName: string;
  date: string;
  grandTotal: number;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  poNumber?: string;
  createdBy?: string;
}

interface Stats {
  totalQuotations: number;
  draftQuotations: number;
  sentQuotations: number;
  acceptedQuotations: number;
  rejectedQuotations: number;
  expiredQuotations: number;
  totalValue: number;
  currentMonthValue: number;
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalQuotations: 0,
    draftQuotations: 0,
    sentQuotations: 0,
    acceptedQuotations: 0,
    rejectedQuotations: 0,
    expiredQuotations: 0,
    totalValue: 0,
    currentMonthValue: 0,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedQuotationForPo, setSelectedQuotationForPo] = useState<QuotationItem | null>(null);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        q: search,
        status: statusFilter,
        category: categoryFilter,
        page: page.toString(),
        limit: "10",
      });

      const res = await fetch(`/api/quotations?${query.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setQuotations(data.data || []);
        if (data.stats) setStats(data.stats);
        if (data.pagination) setTotalPages(data.pagination.totalPages || 1);
      }
    } catch (err) {
      console.error("Error loading quotations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [search, statusFilter, categoryFilter, page]);

  const handleDuplicate = async (id: string, num: string) => {
    if (!confirm(`Duplicate quotation ${num}?`)) return;
    try {
      const res = await fetch(`/api/quotations/${id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        fetchQuotations();
      } else {
        alert("Failed to duplicate: " + (data.error || "Error"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleConvertToPi = async (id: string, num: string) => {
    if (!confirm(`Convert quotation ${num} to Proforma Invoice?`)) return;
    try {
      const res = await fetch(`/api/quotations/${id}/convert-to-pi`, { method: "POST" });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error("Non-JSON API response:", text);
        alert(`Conversion error (${res.status}): Server returned invalid response.`);
        return;
      }

      if (res.ok && data.success) {
        if (data.data?._id) {
          window.open(`/api/proforma-invoices/${data.data._id}/pdf`, "_blank");
        }
        fetchQuotations();
      } else {
        alert("Conversion failed: " + (data.error || "Error"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleDelete = async (id: string, num: string) => {
    if (!confirm(`Are you sure you want to delete quotation ${num}?`)) return;
    try {
      const res = await fetch(`/api/quotations?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchQuotations();
      } else {
        alert("Delete failed: " + (data.error || "Error"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchQuotations();
      }
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "DRAFT":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "SENT":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "ACCEPTED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "REJECTED":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "EXPIRED":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <CfoSecurityGuard>
      <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans transition-colors duration-200 relative">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <QuotationNav />

          <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2 font-sans">
                  📋 Quotation Suite Dashboard
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Manage business quotations, calculate GST, auto-generate PDFs, and track sales pipeline
                </p>
              </div>

              <Link
                href="/quotations/new"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                <span>+ Create Quotation</span>
              </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 space-y-1 shadow-sm">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Total</span>
                <p className="text-lg font-black text-slate-900">{stats.totalQuotations}</p>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 space-y-1 shadow-sm">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Draft</span>
                <p className="text-lg font-black text-slate-700">{stats.draftQuotations}</p>
              </div>
              <div className="bg-white border border-blue-200/80 rounded-2xl p-3.5 space-y-1 shadow-sm">
                <span className="text-[10px] font-extrabold text-blue-500 uppercase tracking-wider">Sent</span>
                <p className="text-lg font-black text-blue-700">{stats.sentQuotations}</p>
              </div>
              <div className="bg-white border border-emerald-200/80 rounded-2xl p-3.5 space-y-1 shadow-sm">
                <span className="text-[10px] font-extrabold text-emerald-500 uppercase tracking-wider">Accepted</span>
                <p className="text-lg font-black text-emerald-700">{stats.acceptedQuotations}</p>
              </div>
              <div className="bg-white border border-rose-200/80 rounded-2xl p-3.5 space-y-1 shadow-sm">
                <span className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider">Rejected</span>
                <p className="text-lg font-black text-rose-700">{stats.rejectedQuotations}</p>
              </div>
              <div className="bg-white border border-amber-200/80 rounded-2xl p-3.5 space-y-1 shadow-sm">
                <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider">Expired</span>
                <p className="text-lg font-black text-amber-700">{stats.expiredQuotations}</p>
              </div>
              <div className="bg-white border border-indigo-200/80 rounded-2xl p-3.5 space-y-1 shadow-sm col-span-2">
                <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-wider">Total Value</span>
                <p className="text-lg font-black text-indigo-700">₹{stats.totalValue.toLocaleString("en-IN")}</p>
              </div>
            </div>

            {/* Controls & Filter Bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="w-full md:w-72">
                <input
                  type="text"
                  placeholder="Search quotation #, customer, PO..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                />
              </div>

              {/* Status & Category Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs font-bold text-slate-500">
                  <span className="px-2 text-[10px] uppercase">Cat:</span>
                  {[
                    { key: "ALL", label: "All" },
                    { key: "SOFTWARE", label: "Software" },
                    { key: "DIGITAL_MARKETING", label: "Marketing" },
                    { key: "PRODUCT", label: "Products" },
                    { key: "SERVICE", label: "Services" },
                  ].map((cTab) => (
                    <button
                      key={cTab.key}
                      onClick={() => {
                        setCategoryFilter(cTab.key);
                        setPage(1);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${categoryFilter === cTab.key
                          ? "bg-white text-indigo-700 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      {cTab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs font-bold text-slate-500">
                  <span className="px-2 text-[10px] uppercase">Status:</span>
                  {["ALL", "DRAFT", "SENT", "ACCEPTED", "REJECTED"].map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        setStatusFilter(st);
                        setPage(1);
                      }}
                      className={`px-2 py-1 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${statusFilter === st
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quotations Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 font-sans">
                  <thead className="bg-slate-50/80 text-slate-500 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5">Quotation # & Category</th>
                      <th className="px-4 py-3.5">Customer</th>
                      <th className="px-4 py-3.5">Date</th>
                      <th className="px-4 py-3.5 text-right">Amount</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-4 py-3.5">Created By</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-medium">
                          Loading quotations...
                        </td>
                      </tr>
                    ) : quotations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-medium">
                          No quotations found. Click <b>+ Create Quotation</b>.
                        </td>
                      </tr>
                    ) : (
                      quotations.map((q) => (
                        <tr key={q._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-slate-900 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Link href={`/quotations/${q._id}`} className="hover:text-indigo-600 transition-colors">
                                {q.quotationNumber}
                              </Link>
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                                {(q.category || "PRODUCT").replace("_", " ")}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              {q.billingCycle && q.billingCycle !== "ONE_TIME" ? `Cycle: ${q.billingCycle}` : "One-Time"}
                              {q.poNumber ? ` • Ref: ${q.poNumber}` : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800">{q.customerName}</td>
                          <td className="px-4 py-3.5 text-slate-500 font-medium">
                            {q.date ? new Date(q.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-emerald-600">
                            ₹{Number(q.grandTotal || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <select
                              value={q.status}
                              onChange={(e) => handleStatusChange(q._id, e.target.value)}
                              className={`px-2 py-1 text-[10px] font-extrabold uppercase rounded-lg border bg-white cursor-pointer shadow-xs ${getStatusBadge(
                                q.status
                              )}`}
                            >
                              <option value="DRAFT">DRAFT</option>
                              <option value="SENT">SENT</option>
                              <option value="ACCEPTED">ACCEPTED</option>
                              <option value="REJECTED">REJECTED</option>
                              <option value="EXPIRED">EXPIRED</option>
                            </select>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 text-[11px] font-medium">{q.createdBy || "Admin"}</td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Link
                                href={`/quotations/${q._id}`}
                                className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                              >
                                Edit / View
                              </Link>

                              <a
                                href={`/api/quotations/${q._id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                              >
                                PDF / Print
                              </a>

                              <button
                                onClick={() => setSelectedQuotationForPo(q)}
                                className="px-2.5 py-1 text-[11px] font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg transition-colors cursor-pointer"
                                title="Convert Quotation to Purchase Order"
                              >
                                📦 Convert to PO
                              </button>

                              <button
                                onClick={() => handleConvertToPi(q._id, q.quotationNumber)}
                                className="px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                                title="Convert Quotation to Proforma Invoice"
                              >
                                🧾 Convert to PI
                              </button>

                              <button
                                onClick={() => handleDelete(q._id, q.quotationNumber)}
                                className="px-2 py-1 text-[11px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                title="Delete Quotation"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      Previous
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Convert Quotation to Purchase Order Modal */}
      <ConvertToPoModal
        isOpen={!!selectedQuotationForPo}
        onClose={() => setSelectedQuotationForPo(null)}
        quotation={selectedQuotationForPo}
        onSuccess={() => {
          fetchQuotations();
        }}
      />
    </CfoSecurityGuard>
  );
}
