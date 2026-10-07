"use client";

import React, { useState } from "react";
import { formatDate } from "@/lib/dates";
import { duePaise, inr, SALE_TYPE_LABELS, taxModeLabel, type ServiceInvoiceDoc } from "./docTypes";
import { Badge, EmptyRow, inputClass, PrimaryButton, tdClass, thClass } from "./ui";

type TypeFilter = "ALL" | "TAX_INVOICE" | "NON_GST_INVOICE";

export default function InvoicesTab({
  invoices,
  isLoading,
  onNewNonGst,
  onRecordPayment,
}: {
  invoices: ServiceInvoiceDoc[];
  isLoading: boolean;
  onNewNonGst: () => void;
  onRecordPayment: (inv: ServiceInvoiceDoc) => void;
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [search, setSearch] = useState("");

  const visible = invoices.filter((i) => {
    if (typeFilter !== "ALL" && i.invoiceType !== typeFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || [i.invoiceNumber, i.piNumber, i.client.name, i.client.gstin, i.company.name].some((v) => (v || "").toLowerCase().includes(q));
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <select className={`${inputClass} w-auto py-1.5 text-xs`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} aria-label="Invoice type">
            <option value="ALL">All invoices</option>
            <option value="TAX_INVOICE">Tax invoices (GST)</option>
            <option value="NON_GST_INVOICE">Non-GST invoices</option>
          </select>
          <input type="search" className={`${inputClass} w-64 py-1.5 text-xs`} placeholder="Search invoice / PI no., client…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search invoices" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Tax invoices are generated from paid PIs.</span>
          <PrimaryButton onClick={onNewNonGst}>+ New Non-GST invoice</PrimaryButton>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className={thClass}>Invoice</th>
              <th className={thClass}>Client</th>
              <th className={thClass}>Sale type</th>
              <th className={`${thClass} text-right`}>Taxable</th>
              <th className={`${thClass} text-right`}>Tax</th>
              <th className={`${thClass} text-right`}>Total</th>
              <th className={thClass}>Payment</th>
              <th className={`${thClass} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <EmptyRow colSpan={8}>Loading invoices…</EmptyRow>
            ) : visible.length === 0 ? (
              <EmptyRow colSpan={8}>{invoices.length === 0 ? "No invoices yet." : "No invoices match."}</EmptyRow>
            ) : (
              visible.map((inv) => (
                <tr key={inv._id}>
                  <td className={tdClass}>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-extrabold text-slate-900">{inv.invoiceNumber}</span>
                      <span title="Locked: cannot be edited">🔒</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {formatDate(inv.invoiceDate)} · {inv.company.name}
                      {inv.piNumber ? ` · from ${inv.piNumber}` : ""}
                    </div>
                  </td>
                  <td className={tdClass}>
                    <div className="font-bold text-slate-800">{inv.client.name}</div>
                    <div className="text-[11px] text-slate-400">{inv.client.gstin || "—"}</div>
                  </td>
                  <td className={tdClass}>
                    <Badge tone={inv.saleType === "REGISTERED" ? "indigo" : inv.saleType === "UNREGISTERED" ? "amber" : "slate"}>{SALE_TYPE_LABELS[inv.saleType]}</Badge>
                  </td>
                  <td className={`${tdClass} text-right whitespace-nowrap`}>{inr(inv.basePaise)}</td>
                  <td className={`${tdClass} text-right whitespace-nowrap`}>
                    <div>{inr(inv.taxPaise)}</div>
                    <div className="text-[10px] text-slate-400">{taxModeLabel(inv)}</div>
                  </td>
                  <td className={`${tdClass} text-right whitespace-nowrap font-bold text-slate-900`}>{inr(inv.totalPaise)}</td>
                  <td className={tdClass}>
                    {inv.paymentStatus === "PAID" ? (
                      <Badge tone="green">Paid</Badge>
                    ) : (
                      <>
                        <Badge tone={inv.paymentStatus === "PARTIALLY_PAID" ? "amber" : "rose"}>{inv.paymentStatus === "PARTIALLY_PAID" ? "Part paid" : "Unpaid"}</Badge>
                        <div className="text-[10px] text-rose-600 font-bold mt-1">{inr(duePaise(inv))} due</div>
                      </>
                    )}
                  </td>
                  <td className={`${tdClass} text-right whitespace-nowrap`}>
                    <div className="inline-flex items-center gap-1.5">
                      <a href={`/billing/print/invoice/${inv._id}`} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 text-xs font-bold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">
                        View / print
                      </a>
                      {inv.invoiceType === "NON_GST_INVOICE" && inv.paymentStatus !== "PAID" && (
                        <PrimaryButton onClick={() => onRecordPayment(inv)}>Record payment</PrimaryButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
