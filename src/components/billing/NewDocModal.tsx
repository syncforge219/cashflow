"use client";

import React, { useMemo, useState } from "react";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABELS } from "@/lib/billing";
import { computeTax, pickTaxMode } from "@/lib/billingTax";
import { monthBoundsKey, todayKey } from "@/lib/dates";
import { toPaise } from "@/lib/money";
import type { BillingCompany } from "./CompaniesTab";
import type { BillingClient } from "./ClientsTab";
import { inr } from "./docTypes";
import { billingApi, ErrorNote, Field, inputClass, Modal, PrimaryButton, SecondaryButton } from "./ui";

/**
 * New Proforma Invoice (GST companies) or new direct invoice (Non-GST companies).
 * Picking a client fills in its billing company, service description and usual amount.
 */
export default function NewDocModal({
  kind,
  clients,
  companies,
  onClose,
  onCreated,
}: {
  kind: "PI" | "NON_GST_INVOICE";
  clients: BillingClient[];
  companies: BillingCompany[];
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const wantedType = kind === "PI" ? "GST" : "NON_GST";
  const companyById = useMemo(() => new Map(companies.map((c) => [String(c._id), c])), [companies]);

  // Clients that can be billed this way: active, and mapped to at least one company of the right GST type
  const eligibleCompaniesOf = (c: BillingClient | undefined) =>
    (c?.billingCompanyIds || [])
      .map((co) => companyById.get(String(co._id || co)))
      .filter((co): co is BillingCompany => Boolean(co && co.status !== "INACTIVE" && co.gstType === wantedType));
  const eligibleClients = clients.filter((c) => (c.clientStatus || "ACTIVE") === "ACTIVE" && eligibleCompaniesOf(c).length > 0);

  const month = monthBoundsKey();
  const [clientId, setClientId] = useState(eligibleClients.length === 1 ? eligibleClients[0]._id : "");
  const client = eligibleClients.find((c) => c._id === clientId);
  const clientCompanies = eligibleCompaniesOf(client);

  const defaultCompanyFor = (c: BillingClient | undefined) => {
    const options = eligibleCompaniesOf(c);
    const def = options.find((co) => String(co._id) === String(c?.defaultBillingCompanyId?._id || ""));
    return (def || options[0])?._id || "";
  };

  const [form, setForm] = useState(() => ({
    companyId: defaultCompanyFor(client),
    docDate: todayKey(),
    billingPeriodFrom: month.first,
    billingPeriodTo: month.last,
    description: client?.serviceDescription || "",
    sacCode: "",
    amount: client?.defaultBillingAmount ? String(client.defaultBillingAmount) : "",
    businessType: "DIGITAL_MARKETING",
    notes: "",
  }));
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const pickClient = (id: string) => {
    const c = eligibleClients.find((x) => x._id === id);
    setClientId(id);
    const companyId = defaultCompanyFor(c);
    const company = companyById.get(String(companyId));
    set({
      companyId,
      description: c?.serviceDescription || form.description,
      amount: c?.defaultBillingAmount ? String(c.defaultBillingAmount) : form.amount,
      businessType: company?.businessTypes?.[0] || form.businessType,
    });
  };

  const company = companyById.get(String(form.companyId));
  const amountPaise = /^\d+(\.\d{1,2})?$/.test(form.amount.trim()) ? toPaise(form.amount) : 0;
  const preview =
    company && client
      ? computeTax(amountPaise, pickTaxMode(company.gstType, company.stateCode, client.stateCode), company.taxDefaults)
      : null;
  const prefixMissing =
    company && (kind === "PI" ? !company.invoiceSeries.piPrefix : !company.invoiceSeries.nonGstInvoicePrefix);

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      const common = {
        clientId,
        companyId: form.companyId,
        billingPeriodFrom: form.billingPeriodFrom,
        billingPeriodTo: form.billingPeriodTo,
        description: form.description,
        sacCode: form.sacCode,
        amount: form.amount,
        businessType: form.businessType,
        notes: form.notes,
      };
      const json = await billingApi<{ message: string }>(kind === "PI" ? "/api/billing/pis" : "/api/billing/invoices", {
        method: "POST",
        body: JSON.stringify(kind === "PI" ? { ...common, piDate: form.docDate } : { ...common, invoiceDate: form.docDate }),
      });
      onCreated(json.message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      wide
      title={kind === "PI" ? "New Proforma Invoice" : "New Non-GST Invoice"}
      subtitle={kind === "PI" ? "GST company. Once fully paid, generate the tax invoice from it." : "Non-GST company. Direct invoice, no tax, locked once created."}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving || !clientId || !form.companyId || amountPaise <= 0 || Boolean(prefixMissing)}>
            {saving ? "Creating…" : kind === "PI" ? "Create PI" : "Create invoice"}
          </PrimaryButton>
        </>
      }
    >
      <ErrorNote message={error} />
      {eligibleClients.length === 0 && (
        <ErrorNote
          message={`No active client is mapped to a ${kind === "PI" ? "GST" : "Non-GST"} company yet. Set this up in Billing Setup → Clients.`}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Client" required>
          <select className={inputClass} value={clientId} onChange={(e) => pickClient(e.target.value)}>
            <option value="">Select client</option>
            {eligibleClients.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
                {c.gstin ? ` · ${c.gstin}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bill from" required hint={clientCompanies.length > 1 ? "Client's default company is pre-selected" : undefined}>
          <select className={inputClass} value={form.companyId} onChange={(e) => set({ companyId: e.target.value })} disabled={!client}>
            {clientCompanies.length === 0 && <option value="">—</option>}
            {clientCompanies.map((co) => (
              <option key={co._id} value={co._id}>
                {co.name}
              </option>
            ))}
          </select>
          {prefixMissing && (
            <span className="block text-[11px] text-rose-600 font-bold mt-1">
              Set this company&apos;s {kind === "PI" ? "PI" : "invoice"} prefix in Billing Setup first.
            </span>
          )}
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label={kind === "PI" ? "PI date" : "Invoice date"} required>
          <input type="date" className={inputClass} value={form.docDate} max={todayKey()} onChange={(e) => set({ docDate: e.target.value })} />
        </Field>
        <Field label="Billing period from" required>
          <input type="date" className={inputClass} value={form.billingPeriodFrom} onChange={(e) => set({ billingPeriodFrom: e.target.value })} />
        </Field>
        <Field label="to" required>
          <input type="date" className={inputClass} value={form.billingPeriodTo} min={form.billingPeriodFrom} onChange={(e) => set({ billingPeriodTo: e.target.value })} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label="Service description" required>
            <input className={inputClass} value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Digital Marketing Services" />
          </Field>
        </div>
        <Field label="SAC code" hint={kind === "PI" ? "Printed on the tax invoice" : "Optional"}>
          <input className={`${inputClass} font-mono`} value={form.sacCode} onChange={(e) => set({ sacCode: e.target.value.replace(/\D/g, "") })} maxLength={8} placeholder="e.g. 998361" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹, before tax)" required>
          <input className={inputClass} inputMode="decimal" value={form.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="50000" />
        </Field>
        <Field label="Business type">
          <select className={inputClass} value={form.businessType} onChange={(e) => set({ businessType: e.target.value })}>
            {BUSINESS_TYPES.map((b) => (
              <option key={b} value={b}>
                {BUSINESS_TYPE_LABELS[b]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {preview && amountPaise > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Taxable value</span><span className="font-bold">{inr(preview.basePaise)}</span></div>
          {preview.taxMode === "CGST_SGST" && (
            <>
              <div className="flex justify-between"><span className="text-slate-500">CGST @ {preview.cgstRate}%</span><span>{inr(preview.cgstPaise)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">SGST @ {preview.sgstRate}%</span><span>{inr(preview.sgstPaise)}</span></div>
            </>
          )}
          {preview.taxMode === "IGST" && (
            <div className="flex justify-between">
              <span className="text-slate-500">IGST @ {preview.igstRate}% <span className="text-[11px]">(client in another state)</span></span>
              <span>{inr(preview.igstPaise)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 mt-1.5 pt-1.5"><span className="font-extrabold">Total</span><span className="font-black text-indigo-700">{inr(preview.totalPaise)}</span></div>
          {kind === "PI" && client && !client.stateCode && (
            <p className="text-[11px] text-amber-700 font-semibold mt-1.5">Client state not set; treated as same-state (CGST + SGST). Set it in Billing Setup if they are in another state.</p>
          )}
        </div>
      )}

      <Field label="Notes (printed)">
        <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>
    </Modal>
  );
}
