"use client";

import React, { useState } from "react";
import { formatDate } from "@/lib/dates";
import { inr, type ClientReceiptDoc } from "./docTypes";
import { Badge, billingApi, EmptyRow, ErrorNote, inputClass, PrimaryButton, tdClass, thClass } from "./ui";

export default function ReceiptsTab({
  receipts,
  isLoading,
  onNew,
  onChanged,
}: {
  receipts: ClientReceiptDoc[];
  isLoading: boolean;
  onNew: () => void;
  onChanged: (message?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const [error, setError] = useState("");

  const visible = receipts.filter((r) => {
    if (!showVoided && r.status === "VOIDED") return false;
    const q = search.trim().toLowerCase();
    return !q || [r.receiptNumber, r.clientName, r.linkedDocNumber, r.transactionRef, r.bankLabel].some((v) => (v || "").toLowerCase().includes(q));
  });
  const totalShown = visible.filter((r) => r.status === "ACTIVE").reduce((s, r) => s + r.amountPaise, 0);

  const voidReceipt = async (r: ClientReceiptDoc) => {
    const reason = window.prompt(`Void receipt ${r.receiptNumber} (${inr(r.amountPaise)} from ${r.clientName})?\n\nThe amount goes back to "due" on ${r.linkedDocNumber}. Reason (required):`);
    if (!reason?.trim()) return;
    setError("");
    try {
      const res = await billingApi<{ message: string }>(`/api/billing/receipts/${r._id}`, { method: "PATCH", body: JSON.stringify({ action: "VOID", reason }) });
      onChanged(res.message);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <input type="search" className={`${inputClass} w-72 py-1.5 text-xs`} placeholder="Search receipt, client, PI/invoice, UTR, bank…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search receipts" />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
            Show voided
          </label>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Total shown: <span className="font-black text-slate-900">{inr(totalShown)}</span>
          </span>
          <PrimaryButton onClick={onNew}>+ Record payment</PrimaryButton>
        </div>
      </div>
      <ErrorNote message={error} />

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto mt-2">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className={thClass}>Receipt</th>
              <th className={thClass}>Client</th>
              <th className={thClass}>Against</th>
              <th className={thClass}>Bank</th>
              <th className={thClass}>Mode / ref.</th>
              <th className={`${thClass} text-right`}>Amount</th>
              <th className={`${thClass} text-right`}> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <EmptyRow colSpan={7}>Loading receipts…</EmptyRow>
            ) : visible.length === 0 ? (
              <EmptyRow colSpan={7}>{receipts.length === 0 ? "No payments recorded yet." : "No receipts match."}</EmptyRow>
            ) : (
              visible.map((r) => (
                <tr key={r._id} className={r.status === "VOIDED" ? "opacity-50" : ""}>
                  <td className={tdClass}>
                    <div className="font-mono font-extrabold text-slate-900">{r.receiptNumber}</div>
                    <div className="text-[11px] text-slate-400">{formatDate(r.receiptDate)}</div>
                  </td>
                  <td className={tdClass}>
                    <div className="font-bold text-slate-800">{r.clientName}</div>
                    <div className="text-[11px] text-slate-400">{r.companyName}</div>
                  </td>
                  <td className={tdClass}>
                    <div className="font-mono">{r.linkedDocNumber}</div>
                    <div className="text-[11px] text-slate-400">{r.linkedDocType === "PI" ? "Proforma" : "Invoice"} · {r.gstApplicable ? "GST" : "Non-GST"}</div>
                  </td>
                  <td className={tdClass}>{r.bankLabel}</td>
                  <td className={tdClass}>
                    <div>{r.paymentMode}</div>
                    <div className="font-mono text-[11px] text-slate-400">{r.transactionRef || "—"}</div>
                  </td>
                  <td className={`${tdClass} text-right whitespace-nowrap font-black ${r.status === "VOIDED" ? "line-through text-slate-400" : "text-emerald-700"}`}>{inr(r.amountPaise)}</td>
                  <td className={`${tdClass} text-right`}>
                    {r.status === "VOIDED" ? (
                      <div>
                        <Badge tone="slate">Voided</Badge>
                        {r.voidReason && <div className="text-[10px] text-slate-500 mt-1">{r.voidReason}</div>}
                      </div>
                    ) : (
                      <button onClick={() => voidReceipt(r)} className="px-2 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer">
                        Void
                      </button>
                    )}
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
