"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import QuotationNav from "@/components/QuotationNav";
import Link from "next/link";

interface QuotationItem {
  _id: string;
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        q: search,
        status: statusFilter,
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
  }, [search, statusFilter, page]);

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
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
      case "SENT":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "ACCEPTED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "REJECTED":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "EXPIRED":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  return (
    <div className="flex min-h-screen bg-[#050811] text-slate-100 font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <QuotationNav />

        <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                📋 Quotation Suite Dashboard
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage business quotations, calculate GST, auto-generate PDFs, and track sales pipeline
              </p>
            </div>

            <Link
              href="/quotations/new"
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>+ Create Quotation</span>
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
              <p className="text-lg font-black text-white">{stats.totalQuotations}</p>
            </div>
            <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Draft</span>
              <p className="text-lg font-black text-slate-300">{stats.draftQuotations}</p>
            </div>
            <div className="bg-[#0B0F19] border border-blue-500/20 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Sent</span>
              <p className="text-lg font-black text-blue-300">{stats.sentQuotations}</p>
            </div>
            <div className="bg-[#0B0F19] border border-emerald-500/20 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Accepted</span>
              <p className="text-lg font-black text-emerald-300">{stats.acceptedQuotations}</p>
            </div>
            <div className="bg-[#0B0F19] border border-rose-500/20 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Rejected</span>
              <p className="text-lg font-black text-rose-300">{stats.rejectedQuotations}</p>
            </div>
            <div className="bg-[#0B0F19] border border-amber-500/20 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Expired</span>
              <p className="text-lg font-black text-amber-300">{stats.expiredQuotations}</p>
            </div>
            <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-3.5 space-y-1 col-span-2">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Total Value</span>
              <p className="text-lg font-black text-white">₹{stats.totalValue.toLocaleString("en-IN")}</p>
            </div>
          </div>

          {/* Controls & Filter Bar */}
          <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-80">
              <input
                type="text"
                placeholder="Search quotation #, customer, PO..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#050811] border border-slate-800 text-white placeholder-slate-500 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              {["ALL", "DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    statusFilter === st
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                      : "bg-[#050811] text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Quotations Table */}
          <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#050811] text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Quotation #</th>
                    <th className="px-4 py-3.5">Customer</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5 text-right">Amount</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5">Created By</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Loading quotations...
                      </td>
                    </tr>
                  ) : quotations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No quotations found. Click <b>+ Create Quotation</b> or <b>🌱 Seed Sample Data</b>.
                      </td>
                    </tr>
                  ) : (
                    quotations.map((q) => (
                      <tr key={q._id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-white">
                          <Link href={`/quotations/${q._id}`} className="hover:text-indigo-400 transition-colors">
                            {q.quotationNumber}
                          </Link>
                          {q.poNumber && <div className="text-[10px] text-slate-500 font-normal">PO: {q.poNumber}</div>}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-200">{q.customerName}</td>
                        <td className="px-4 py-3.5 text-slate-400">
                          {q.date ? new Date(q.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                        </td>
                        <td className="px-4 py-3.5 text-right font-extrabold text-emerald-400">
                          ₹{Number(q.grandTotal || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <select
                            value={q.status}
                            onChange={(e) => handleStatusChange(q._id, e.target.value)}
                            className={`px-2 py-1 text-[10px] font-extrabold uppercase rounded-lg border bg-transparent cursor-pointer ${getStatusBadge(
                              q.status
                            )}`}
                          >
                            <option value="DRAFT" className="bg-slate-900 text-white">DRAFT</option>
                            <option value="SENT" className="bg-slate-900 text-white">SENT</option>
                            <option value="ACCEPTED" className="bg-slate-900 text-white">ACCEPTED</option>
                            <option value="REJECTED" className="bg-slate-900 text-white">REJECTED</option>
                            <option value="EXPIRED" className="bg-slate-900 text-white">EXPIRED</option>
                          </select>
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 text-[11px]">{q.createdBy || "Admin"}</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/quotations/${q._id}`}
                              className="px-2.5 py-1 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-colors"
                            >
                              Edit / View
                            </Link>

                            <a
                              href={`/api/quotations/${q._id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors"
                            >
                              PDF / Print
                            </a>

                            <button
                              onClick={() => handleDuplicate(q._id, q.quotationNumber)}
                              className="px-2.5 py-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors cursor-pointer"
                              title="Duplicate Quotation"
                            >
                              Duplicate
                            </button>

                            <button
                              onClick={() => handleDelete(q._id, q.quotationNumber)}
                              className="px-2 py-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 cursor-pointer"
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
              <div className="bg-[#050811] px-4 py-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1 text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg disabled:opacity-40 cursor-pointer"
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
  );
}
