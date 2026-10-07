"use client";

import React, { useEffect, useState } from "react";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABELS, maskAccountNumber } from "@/lib/billing";
import { formatDate, todayKey } from "@/lib/dates";
import type { BillingBankAccount } from "./BankAccountsTab";
import type { BillingClient } from "./ClientsTab";
import { duePaise, inr, PAYMENT_MODES, type ServiceInvoiceDoc, type ServicePIDoc } from "./docTypes";
import { billingApi, ErrorNote, Field, inputClass, Modal, PrimaryButton, SecondaryButton } from "./ui";

interface PendingDoc {
  key: string;
  type: "PI" | "INVOICE";
  id: string;
  number: string;
  date: string;
  companyId: string;
  companyName: string;
  duePaise: number;
  totalPaise: number;
  businessType: string;
}

const toPending = (pis: ServicePIDoc[], invoices: ServiceInvoiceDoc[]): PendingDoc[] => [
  ...pis.map((p) => ({
    key: `PI:${p._id}`, type: "PI" as const, id: p._id, number: p.piNumber, date: p.piDate,
    companyId: String(p.companyId), companyName: p.company.name, duePaise: duePaise(p), totalPaise: p.totalPaise, businessType: p.businessType,
  })),
  ...invoices.map((i) => ({
    key: `INVOICE:${i._id}`, type: "INVOICE" as const, id: i._id, number: i.invoiceNumber, date: i.invoiceDate,
    companyId: String(i.companyId), companyName: i.company.name, duePaise: duePaise(i), totalPaise: i.totalPaise, businessType: i.businessType,
  })),
];

/**
 * Records money received. Opened from a PI / invoice row it is pre-filled; opened blank, staff pick
 * the client and then one of that client's unpaid documents.
 */
export default function ReceiptModal({
  clients,
  bankAccounts,
  preset,
  onClose,
  onSaved,
}: {
  clients: BillingClient[];
  bankAccounts: BillingBankAccount[];
  preset?: { clientId: string; docKey: string } | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [clientId, setClientId] = useState(preset?.clientId || "");
  const [pending, setPending] = useState<PendingDoc[] | null>(null);
  const [docKey, setDocKey] = useState(preset?.docKey || "");
  const [form, setForm] = useState({
    bankAccountId: "",
    receiptDate: todayKey(),
    amount: "",
    paymentMode: "NEFT",
    transactionRef: "",
    businessType: "DIGITAL_MARKETING",
    notes: "",
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Load the chosen client's unpaid PIs and Non-GST invoices
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    Promise.all([
      billingApi<{ data: ServicePIDoc[] }>(`/api/billing/pis?pending=1&clientId=${clientId}`),
      billingApi<{ data: ServiceInvoiceDoc[] }>(`/api/billing/invoices?pending=1&clientId=${clientId}`),
    ])
      .then(([p, i]) => {
        if (!cancelled) setPending(toPending(p.data, i.data));
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const doc = pending?.find((d) => d.key === docKey);
  const companyBanks = doc ? bankAccounts.filter((b) => String(b.companyId) === doc.companyId && b.status === "ACTIVE") : [];

  // When the document changes: default bank, full outstanding amount, its business type
  useEffect(() => {
    if (!doc) return;
    const banks = bankAccounts.filter((b) => String(b.companyId) === doc.companyId && b.status === "ACTIVE");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((f) => ({
      ...f,
      bankAccountId: (banks.find((b) => b.isDefault) || banks[0])?._id || "",
      amount: (doc.duePaise / 100).toFixed(2),
      businessType: doc.businessType || f.businessType,
    }));
  }, [doc?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!doc) return;
    setError("");
    setSaving(true);
    try {
      const json = await billingApi<{ message: string }>("/api/billing/receipts", {
        method: "POST",
        body: JSON.stringify({ linkedDocType: doc.type, docId: doc.id, ...form }),
      });
      onSaved(json.message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const activeClients = clients.filter((c) => (c.clientStatus || "ACTIVE") === "ACTIVE" || c._id === clientId);

  return (
    <Modal
      title="Record payment received"
      subtitle="Enter each amount once, when it is credited to the bank. This drives all collection reports."
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving || !doc || !form.bankAccountId || !form.amount}>
            {saving ? "Saving…" : "Save receipt"}
          </PrimaryButton>
        </>
      }
    >
      <ErrorNote message={error} />
      <Field label="Client" required>
        <select
          className={inputClass}
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setDocKey("");
            setPending(null);
          }}
        >
          <option value="">Select client</option>
          {activeClients.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      {clientId && (
        <Field label="Against" required>
          {pending === null ? (
            <p className="text-xs text-slate-400">Loading unpaid documents…</p>
          ) : pending.length === 0 ? (
            <p className="text-xs text-amber-700 font-bold">Nothing pending for this client. Create a PI (GST) or an invoice (Non-GST) first.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {pending.map((d) => (
                <label
                  key={d.key}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
                    docKey === d.key ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input type="radio" name="doc" checked={docKey === d.key} onChange={() => setDocKey(d.key)} />
                    <span>
                      <span className="font-mono font-bold text-sm text-slate-900">{d.number}</span>
                      <span className="block text-[11px] text-slate-500">
                        {d.type === "PI" ? "Proforma" : "Non-GST invoice"} · {formatDate(d.date)} · {d.companyName}
                      </span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-black text-sm text-rose-600">{inr(d.duePaise)} due</span>
                    {d.duePaise !== d.totalPaise && <span className="block text-[11px] text-slate-400">of {inr(d.totalPaise)}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </Field>
      )}

      {doc && (
        <>
          <Field label="Received in bank account" required hint={`Accounts of ${doc.companyName}`}>
            {companyBanks.length === 0 ? (
              <p className="text-xs text-rose-600 font-bold">{doc.companyName} has no active bank account. Add one in Billing Setup → Bank accounts.</p>
            ) : (
              <select className={inputClass} value={form.bankAccountId} onChange={(e) => set({ bankAccountId: e.target.value })}>
                {companyBanks.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.label} · {b.bankName} {maskAccountNumber(b.accountLast4)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date credited" required>
              <input type="date" className={inputClass} value={form.receiptDate} max={todayKey()} onChange={(e) => set({ receiptDate: e.target.value })} />
            </Field>
            <Field label="Amount received (₹)" required hint={`Up to ${inr(doc.duePaise)}`}>
              <input className={inputClass} inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mode">
              <select className={inputClass} value={form.paymentMode} onChange={(e) => set({ paymentMode: e.target.value })}>
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Transaction / cheque ref." required={form.paymentMode !== "CASH"}>
              <input className={`${inputClass} font-mono`} value={form.transactionRef} onChange={(e) => set({ transactionRef: e.target.value })} placeholder="UTR / UPI ref / cheque no." />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Business type">
              <select className={inputClass} value={form.businessType} onChange={(e) => set({ businessType: e.target.value })}>
                {BUSINESS_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {BUSINESS_TYPE_LABELS[b]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes">
              <input className={inputClass} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
            </Field>
          </div>
        </>
      )}
    </Modal>
  );
}
