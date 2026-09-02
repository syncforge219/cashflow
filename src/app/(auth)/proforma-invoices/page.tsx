"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import QuotationNav from "@/components/QuotationNav";
import Link from "next/link";
import CfoSecurityGuard from "@/components/CfoSecurityGuard";

interface ProformaInvoiceItem {
  _id: string;
  piNumber: string;
  quotationNumber?: string;
  customerName: string;
  date: string;
  grandTotal: number;
  status: "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";
  createdBy?: string;
  billingCycle?: string;
}

interface Stats {
  totalPIs: number;
  draftPIs: number;
  issuedPIs: number;
  paidPIs: number;
  cancelledPIs: number;
  totalValue: number;
  currentMonthValue: number;
}

export default function ProformaInvoicesPage() {
  const [proformaInvoices, setProformaInvoices] = useState<ProformaInvoiceItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPIs: 0,
    draftPIs: 0,
    issuedPIs: 0,
    paidPIs: 0,
    cancelledPIs: 0,
    totalValue: 0,
    currentMonthValue: 0,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [billingCycleFilter, setBillingCycleFilter] = useState("ALL");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [customerList, setCustomerList] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProformaInvoices = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        q: search,
        status: statusFilter,
        billingCycle: billingCycleFilter,
        customer: customerFilter,
        page: page.toString(),
        limit: "10",
      });

      const res = await fetch(`/api/proforma-invoices?${query.toString()}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setProformaInvoices(data.data || []);
        if (data.stats) setStats(data.stats);
        if (data.pagination) setTotalPages(data.pagination.totalPages || 1);
        if (Array.isArray(data.customers)) {
          setCustomerList((prev) => {
            const combined = Array.from(new Set([...prev, ...data.customers])).sort((a, b) => a.localeCompare(b));
            return combined;
          });
        }
      }
    } catch (err) {
      console.error("Error loading proforma invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await fetch("/api/quotations/customers");
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.data)) {
          const names: string[] = data.data.map((c: any) => c.name?.trim()).filter(Boolean);
          setCustomerList((prev) => {
            const combined = Array.from(new Set([...prev, ...names])).sort((a, b) => a.localeCompare(b));
            return combined;
          });
        }
      } catch (err) {
        console.error("Error loading registered customers:", err);
      }
    }
    loadCustomers();
  }, []);

  useEffect(() => {
    fetchProformaInvoices();
  }, [search, statusFilter, billingCycleFilter, customerFilter, page]);

  const handleDelete = async (id: string, num: string) => {
    if (!confirm(`Are you sure you want to delete Proforma Invoice ${num}?`)) return;
    try {
      const res = await fetch(`/api/proforma-invoices?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchProformaInvoices();
      } else {
        alert("Delete failed: " + (data.error || "Error"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/proforma-invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchProformaInvoices();
      }
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "DRAFT":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "ISSUED":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "PAID":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "CANCELLED":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <CfoSecurityGuard>
      <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans transition-colors duration-200 relative">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <QuotationNav />

          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
            {/* Header Banner */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2 font-sans">
                  🧾 Proforma Invoices Directory
                </h1>
                <p className="text-slate-500 text-xs font-semibold mt-1">
                  Manage all issued proforma invoices, track payment status, and print PDFs.
                </p>
              </div>

              <Link
                href="/quotations"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                + Convert Quotation to PI
              </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                <span className="text-slate-400 font-extrabold text-[10px] uppercase tracking-wider block">Total Proforma Invoices</span>
                <span className="text-2xl font-black text-slate-900">{stats.totalPIs}</span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                <span className="text-slate-400 font-extrabold text-[10px] uppercase tracking-wider block">Issued</span>
                <span className="text-2xl font-black text-blue-600">{stats.issuedPIs}</span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                <span className="text-slate-400 font-extrabold text-[10px] uppercase tracking-wider block">Paid</span>
                <span className="text-2xl font-black text-emerald-600">{stats.paidPIs}</span>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                <span className="text-slate-400 font-extrabold text-[10px] uppercase tracking-wider block">Total Value</span>
                <span className="text-2xl font-black text-slate-900">₹{stats.totalValue.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3.5 shadow-sm">
              {/* Row 1: Search, Customer Filter & Billing Frequency Filter */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <input
                    type="text"
                    placeholder="Search PI #, Client Name, PO #..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
                  />
                  <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Client / Customer Filter Dropdown */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 shadow-xs">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">👤 Client:</span>
                    <select
                      value={customerFilter}
                      onChange={(e) => {
                        setCustomerFilter(e.target.value);
                        setPage(1);
                      }}
                      className="bg-transparent text-slate-800 font-bold text-xs py-1.5 focus:outline-none cursor-pointer max-w-[200px] truncate"
                    >
                      <option value="ALL">All Clients / Customers</option>
                      {customerList.map((cust) => (
                        <option key={cust} value={cust}>
                          {cust}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Billing Frequency Dropdown Filter */}
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 shadow-xs">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">🔄 Billing:</span>
                    <select
                      value={billingCycleFilter}
                      onChange={(e) => {
                        setBillingCycleFilter(e.target.value);
                        setPage(1);
                      }}
                      className="bg-transparent text-slate-800 font-bold text-xs py-1.5 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Frequencies</option>
                      <option value="ONE_TIME">One-Time / Fixed Price</option>
                      <option value="MONTHLY">Monthly Recurring</option>
                      <option value="QUARTERLY">Quarterly Billing</option>
                      <option value="HALF_YEARLY">Half-Yearly (6 Months)</option>
                      <option value="YEARLY">Yearly / Annual Contract</option>
                      <option value="CUSTOM">Custom Schedule</option>
                    </select>
                  </div>

                  {/* Reset Filters button */}
                  {(search || statusFilter !== "ALL" || billingCycleFilter !== "ALL" || customerFilter !== "ALL") && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("ALL");
                        setBillingCycleFilter("ALL");
                        setCustomerFilter("ALL");
                        setPage(1);
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-extrabold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 rounded-xl border border-rose-200/80 transition-all cursor-pointer flex items-center gap-1"
                      title="Clear all filters"
                    >
                      ✕ Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Status Filter Tabs */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2.5 border-t border-slate-100">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs font-bold text-slate-500">
                  <span className="px-2 text-[10px] uppercase">Status:</span>
                  {["ALL", "ISSUED", "PAID", "DRAFT", "CANCELLED"].map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        setStatusFilter(st);
                        setPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        statusFilter === st
                          ? "bg-white text-indigo-600 shadow-xs font-extrabold"
                          : "hover:text-slate-800"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                      <th className="px-4 py-3.5">PI Number</th>
                      <th className="px-4 py-3.5">Quotation Ref</th>
                      <th className="px-4 py-3.5">Client / Consignee</th>
                      <th className="px-4 py-3.5">Date</th>
                      <th className="px-4 py-3.5 text-right">Grand Total</th>
                      <th className="px-4 py-3.5 text-center">Status</th>
                      <th className="px-4 py-3.5">Created By</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-medium">
                          Loading proforma invoices...
                        </td>
                      </tr>
                    ) : proformaInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-medium">
                          No proforma invoices found. Click <b>+ Convert Quotation to PI</b> or convert from the Quotations page.
                        </td>
                      </tr>
                    ) : (
                      proformaInvoices.map((pi) => (
                        <tr key={pi._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3.5 font-mono">
                            <div className="font-bold text-slate-900">{pi.piNumber}</div>
                            {pi.billingCycle && (
                              <div className="text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                                Cycle: {pi.billingCycle}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-500">
                            {pi.quotationNumber || "-"}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-slate-800">
                            {pi.customerName}
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 font-medium whitespace-nowrap">
                            {pi.date ? new Date(pi.date).toLocaleDateString("en-IN") : "-"}
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-emerald-600">
                            ₹{Number(pi.grandTotal || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <select
                              value={pi.status}
                              onChange={(e) => handleStatusChange(pi._id, e.target.value)}
                              className={`px-2 py-1 text-[10px] font-extrabold uppercase rounded-lg border bg-white cursor-pointer shadow-xs ${getStatusBadge(
                                pi.status
                              )}`}
                            >
                              <option value="DRAFT">DRAFT</option>
                              <option value="ISSUED">ISSUED</option>
                              <option value="PAID">PAID</option>
                              <option value="CANCELLED">CANCELLED</option>
                            </select>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 text-[11px] font-medium">{pi.createdBy || "Admin"}</td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={`/api/proforma-invoices/${pi._id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                              >
                                PDF / Print
                              </a>

                              <button
                                onClick={() => handleDelete(pi._id, pi.piNumber)}
                                className="px-2 py-1 text-[11px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                                title="Delete Proforma Invoice"
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
    </CfoSecurityGuard>
  );
}
