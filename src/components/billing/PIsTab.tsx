"use client";

import React, { useMemo, useState } from "react";
import { formatDate } from "@/lib/dates";
import { duePaise, inr, PI_STATUS_LABELS, piAgeWarning, taxModeLabel, type ServicePIDoc } from "./docTypes";
import { Badge, billingApi, EmptyRow, ErrorNote, inputClass, PrimaryButton, SecondaryButton, tdClass, thClass } from "./ui";

type View = "OPEN" | "TO_INVOICE" | "INVOICED" | "CANCELLED" | "ALL";

const statusTone = (s: ServicePIDoc["status"]) =>
  s === "PAID" ? "green" : s === "PARTIALLY_PAID" ? "amber" : s === "CANCELLED" ? "slate" : "indigo";

export default function PIsTab({
  pis,
  isLoading,
  onNew,
  onRecordPayment,
  onChanged,
}: {
  pis: ServicePIDoc[];
  isLoading: boolean;
  onNew: () => void;
  onRecordPayment: (pi: ServicePIDoc) => void;
  onChanged: (message?: string) => void;
}) {
  const [view, setView] = useState<View>("OPEN");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const inView = (p: ServicePIDoc, v: View) =>
    v === "ALL" ||
    (v === "OPEN" && ["GENERATED", "SENT", "PARTIALLY_PAID"].includes(p.status)) ||
    (v === "TO_INVOICE" && p.status === "PAID" && !p.taxInvoiceId) ||
    (v === "INVOICED" && Boolean(p.taxInvoiceId)) ||
    (v === "CANCELLED" && p.status === "CANCELLED");

  const counts = useMemo(() => {
    const c: Record<View, number> = { OPEN: 0, TO_INVOICE: 0, INVOICED: 0, CANCELLED: 0, ALL: pis.length };
    pis.forEach((p) => (["OPEN", "TO_INVOICE", "INVOICED", "CANCELLED"] as View[]).forEach((v) => inView(p, v) && c[v]++));
    return c;
  }, [pis]);

  const visible = pis.filter((p) => {
    if (!inView(p, view)) return false;
    const q = search.trim().toLowerCase();
    return !q || [p.piNumber, p.client.name, p.client.gstin, p.company.name].some((v) => (v || "").toLowerCase().includes(q));
  });

  const act = async (pi: ServicePIDoc, run: () => Promise<{ message?: string }>) => {
    setError("");
    setBusyId(pi._id);
    try {
      const res = await run();
      onChanged(res?.message);
    } catch (e: any) {
      setError(`${pi.piNumber}: ${e.message}`);
    } finally {
      setBusyId("");
    }
  };

  const markSent = (pi: ServicePIDoc) =>
    act(pi, () => billingApi(`/api/billing/pis/${pi._id}`, { method: "PATCH", body: JSON.stringify({ action: "MARK_SENT" }) }));

  const cancel = (pi: ServicePIDoc) => {
    const reason = window.prompt(`Cancel ${pi.piNumber} for ${pi.client.name}?\n\nReason (required):`);
    if (!reason?.trim()) return;
    act(pi, () => billingApi(`/api/billing/pis/${pi._id}`, { method: "PATCH", body: JSON.stringify({ action: "CANCEL", reason }) }));
  };

  const generateTaxInvoice = (pi: ServicePIDoc) => {
    if (!window.confirm(`Generate the tax invoice for ${pi.piNumber} (${inr(pi.totalPaise)})?\n\nThe invoice is numbered and locked; it cannot be edited afterwards.`)) return;
    act(pi, async () => {
      const res = await billingApi<{ message: string; data: { _id: string } }>(`/api/billing/pis/${pi._id}/tax-invoice`, { method: "POST", body: "{}" });
      window.open(`/billing/print/invoice/${res.data._id}`, "_blank");
      return res;
    });
  };

  const views: { key: View; label: string }[] = [
    { key: "OPEN", label: "Awaiting payment" },
    { key: "TO_INVOICE", label: "Paid · invoice due" },
    { key: "INVOICED", label: "Invoiced" },
    { key: "CANCELLED", label: "Cancelled" },
    { key: "ALL", label: "All" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto" role="tablist" aria-label="PI status">
          {views.map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap cursor-pointer ${
                view === v.key ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {v.label}{" "}
              <span className={`ml-1 px-1.5 rounded-full text-[10px] ${v.key === "TO_INVOICE" && counts.TO_INVOICE > 0 ? "bg-amber-200 text-amber-800" : "bg-slate-200 text-slate-600"}`}>
                {counts[v.key]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="search" className={`${inputClass} w-64 py-1.5 text-xs`} placeholder="Search PI no., client, GSTIN…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search PIs" />
          <PrimaryButton onClick={onNew}>+ New PI</PrimaryButton>
        </div>
      </div>
      <ErrorNote message={error} />

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto mt-2">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className={thClass}>PI</th>
              <th className={thClass}>Client</th>
              <th className={thClass}>Period</th>
              <th className={`${thClass} text-right`}>Total</th>
              <th className={`${thClass} text-right`}>Due</th>
              <th className={thClass}>Status</th>
              <th className={`${thClass} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <EmptyRow colSpan={7}>Loading PIs…</EmptyRow>
            ) : visible.length === 0 ? (
              <EmptyRow colSpan={7}>
                {pis.length === 0 ? "No proforma invoices yet. Create the first one with “+ New PI”." : view === "TO_INVOICE" ? "No paid PIs waiting for a tax invoice. 🎉" : "Nothing here."}
              </EmptyRow>
            ) : (
              visible.map((pi) => {
                const warning = piAgeWarning(pi);
                const due = duePaise(pi);
                const busy = busyId === pi._id;
                return (
                  <tr key={pi._id} className={pi.status === "CANCELLED" ? "opacity-50" : ""}>
                    <td className={tdClass}>
                      <div className="font-mono font-extrabold text-slate-900">{pi.piNumber}</div>
                      <div className="text-[11px] text-slate-400">{formatDate(pi.piDate)} · {pi.company.name}</div>
                    </td>
                    <td className={tdClass}>
                      <div className="font-bold text-slate-800">{pi.client.name}</div>
                      <div className="text-[11px] text-slate-400">{pi.client.gstin || "Unregistered"}</div>
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-slate-600`}>
                      {formatDate(pi.billingPeriodFrom)} – {formatDate(pi.billingPeriodTo)}
                    </td>
                    <td className={`${tdClass} text-right whitespace-nowrap`}>
                      <div className="font-bold text-slate-900">{inr(pi.totalPaise)}</div>
                      <div className="text-[10px] text-slate-400">{taxModeLabel(pi)}</div>
                    </td>
                    <td className={`${tdClass} text-right whitespace-nowrap font-bold ${due > 0 && pi.status !== "CANCELLED" ? "text-rose-600" : "text-slate-400"}`}>
                      {pi.status === "CANCELLED" ? "—" : inr(due)}
                    </td>
                    <td className={tdClass}>
                      <Badge tone={statusTone(pi.status)}>{PI_STATUS_LABELS[pi.status]}</Badge>
                      {pi.taxInvoiceId && <div className="text-[10px] text-emerald-700 font-bold mt-1">✓ Tax invoice issued</div>}
                      {warning && <div className="text-[10px] text-rose-600 font-black mt-1" title="GST expects the tax invoice within 30 days of the service">⚠ {warning}</div>}
                      {pi.status === "CANCELLED" && pi.cancelReason && <div className="text-[10px] text-slate-500 mt-1">{pi.cancelReason}</div>}
                    </td>
                    <td className={`${tdClass} text-right whitespace-nowrap`}>
                      <div className="inline-flex items-center gap-1.5">
                        <a href={`/billing/print/pi/${pi._id}`} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 text-xs font-bold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50">
                          View / print
                        </a>
                        {pi.status === "GENERATED" && (
                          <SecondaryButton disabled={busy} onClick={() => markSent(pi)}>Mark sent</SecondaryButton>
                        )}
                        {["GENERATED", "SENT", "PARTIALLY_PAID"].includes(pi.status) && (
                          <PrimaryButton disabled={busy} onClick={() => onRecordPayment(pi)}>Record payment</PrimaryButton>
                        )}
                        {pi.status === "PAID" && !pi.taxInvoiceId && (
                          <PrimaryButton disabled={busy} onClick={() => generateTaxInvoice(pi)} className="!bg-emerald-600 hover:!bg-emerald-700">
                            {busy ? "Generating…" : "Generate tax invoice"}
                          </PrimaryButton>
                        )}
                        {pi.taxInvoiceId && (
                          <a href={`/billing/print/invoice/${pi.taxInvoiceId}`} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50">
                            Tax invoice
                          </a>
                        )}
                        {["GENERATED", "SENT"].includes(pi.status) && pi.amountReceivedPaise === 0 && (
                          <button disabled={busy} onClick={() => cancel(pi)} className="px-2 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer">
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
