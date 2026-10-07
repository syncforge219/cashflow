"use client";

import React, { useState } from "react";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABELS, INDIAN_STATES, isValidGstin, normalizeGstin, stateByCode, stateFromGstin } from "@/lib/billing";
import { Badge, billingApi, EmptyRow, ErrorNote, Field, inputClass, Modal, PrimaryButton, SecondaryButton, tdClass, thClass } from "./ui";

export interface BillingCompany {
  _id: string;
  name: string;
  legalName: string;
  gstin: string;
  address: string;
  status: string;
  gstType: "GST" | "NON_GST";
  gstTypeConfirmed: boolean;
  stateCode: string;
  businessTypes: string[];
  taxDefaults: { cgstRate: number; sgstRate: number; igstRate: number };
  invoiceSeries: { piPrefix: string; taxInvoicePrefix: string; nonGstInvoicePrefix: string };
  activeBankAccounts: number;
}

/** What still blocks this company from billing; shown so setup gaps are obvious. */
export function companySetupGaps(c: BillingCompany): string[] {
  const gaps: string[] = [];
  if (!c.gstTypeConfirmed) gaps.push("Confirm GST type");
  if (c.gstType === "GST" && !c.gstin) gaps.push("Add GSTIN");
  if (!c.stateCode) gaps.push("Set state");
  if (c.gstType === "GST" && (!c.invoiceSeries.piPrefix || !c.invoiceSeries.taxInvoicePrefix)) gaps.push("Set PI & tax invoice prefixes");
  if (c.gstType === "NON_GST" && !c.invoiceSeries.nonGstInvoicePrefix) gaps.push("Set invoice prefix");
  if (c.activeBankAccounts === 0) gaps.push("Add a bank account");
  return gaps;
}

export default function CompaniesTab({
  companies,
  isLoading,
  onChanged,
}: {
  companies: BillingCompany[];
  isLoading: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<BillingCompany | null>(null);

  return (
    <>
      <p className="text-xs text-slate-500 mb-3">
        The firms you raise invoices from. GST companies bill via Proforma Invoice → Tax Invoice; Non-GST companies raise direct invoices.
        Company names, PAN and address are edited on the Companies page.
      </p>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className={thClass}>Company</th>
              <th className={thClass}>GST</th>
              <th className={thClass}>State</th>
              <th className={thClass}>Business</th>
              <th className={thClass}>Tax rates</th>
              <th className={thClass}>Number series</th>
              <th className={thClass}>Setup</th>
              <th className={`${thClass} text-right`}> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <EmptyRow colSpan={8}>Loading companies…</EmptyRow>
            ) : companies.length === 0 ? (
              <EmptyRow colSpan={8}>No companies yet. Add them on the Companies page first.</EmptyRow>
            ) : (
              companies.map((c) => {
                const gaps = companySetupGaps(c);
                return (
                  <tr key={c._id} className={c.status === "INACTIVE" ? "opacity-50" : ""}>
                    <td className={tdClass}>
                      <div className="font-extrabold text-slate-900">{c.name}</div>
                      {c.legalName && c.legalName !== c.name && <div className="text-[11px] text-slate-400">{c.legalName}</div>}
                    </td>
                    <td className={tdClass}>
                      <Badge tone={c.gstType === "GST" ? "indigo" : "slate"}>{c.gstType === "GST" ? "GST" : "Non-GST"}</Badge>
                      {!c.gstTypeConfirmed && <div className="text-[10px] text-amber-600 font-bold mt-1">guessed, not confirmed</div>}
                      {c.gstin && <div className="font-mono text-[11px] text-slate-500 mt-1">{c.gstin}</div>}
                    </td>
                    <td className={tdClass}>{stateByCode(c.stateCode)?.name || <span className="text-slate-400">—</span>}</td>
                    <td className={tdClass}>
                      {c.businessTypes.length ? (
                        c.businessTypes.map((b) => BUSINESS_TYPE_LABELS[b as keyof typeof BUSINESS_TYPE_LABELS] || b).join(", ")
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap`}>
                      {c.gstType === "GST" ? (
                        <span className="text-slate-600">
                          CGST {c.taxDefaults.cgstRate}% · SGST {c.taxDefaults.sgstRate}% · IGST {c.taxDefaults.igstRate}%
                        </span>
                      ) : (
                        <span className="text-slate-400">No GST</span>
                      )}
                    </td>
                    <td className={`${tdClass} font-mono text-[11px] text-slate-600 whitespace-nowrap`}>
                      {c.gstType === "GST" ? (
                        <>
                          <div>PI: {c.invoiceSeries.piPrefix || "—"}</div>
                          <div>Tax inv: {c.invoiceSeries.taxInvoicePrefix || "—"}</div>
                        </>
                      ) : (
                        <div>Invoice: {c.invoiceSeries.nonGstInvoicePrefix || "—"}</div>
                      )}
                    </td>
                    <td className={tdClass}>
                      {gaps.length === 0 ? (
                        <Badge tone="green">Ready</Badge>
                      ) : (
                        <ul className="text-[11px] text-amber-700 font-semibold space-y-0.5">
                          {gaps.map((g) => (
                            <li key={g}>• {g}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <SecondaryButton onClick={() => setEditing(c)}>Edit billing</SecondaryButton>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <CompanyBillingModal
          company={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function CompanyBillingModal({ company, onClose, onSaved }: { company: BillingCompany; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    gstType: company.gstType,
    gstin: company.gstin,
    stateCode: company.stateCode,
    businessTypes: company.businessTypes,
    cgstRate: String(company.taxDefaults.cgstRate),
    sgstRate: String(company.taxDefaults.sgstRate),
    igstRate: String(company.taxDefaults.igstRate),
    piPrefix: company.invoiceSeries.piPrefix,
    taxInvoicePrefix: company.invoiceSeries.taxInvoicePrefix,
    nonGstInvoicePrefix: company.invoiceSeries.nonGstInvoicePrefix,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const gstinState = stateFromGstin(form.gstin);
  const gstinTyped = normalizeGstin(form.gstin);
  const gstinInvalid = gstinTyped.length > 0 && !isValidGstin(gstinTyped);

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      await billingApi(`/api/billing/companies/${company._id}`, {
        method: "PUT",
        body: JSON.stringify({
          gstType: form.gstType,
          gstin: form.gstin,
          stateCode: gstinState?.code || form.stateCode,
          businessTypes: form.businessTypes,
          taxDefaults: { cgstRate: Number(form.cgstRate), sgstRate: Number(form.sgstRate), igstRate: Number(form.igstRate) },
          invoiceSeries: { piPrefix: form.piPrefix, taxInvoicePrefix: form.taxInvoicePrefix, nonGstInvoicePrefix: form.nonGstInvoicePrefix },
        }),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Billing settings · ${company.name}`}
      subtitle="Used when raising PIs and invoices from this company."
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving || gstinInvalid}>
            {saving ? "Saving…" : "Save"}
          </PrimaryButton>
        </>
      }
    >
      <ErrorNote message={error} />

      <Field label="GST type" required>
        <div className="grid grid-cols-2 gap-2">
          {(["GST", "NON_GST"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set({ gstType: t })}
              className={`px-3 py-2.5 rounded-lg border text-left cursor-pointer ${
                form.gstType === t ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500/20" : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="text-sm font-extrabold text-slate-900">{t === "GST" ? "GST registered" : "Non-GST"}</div>
              <div className="text-[11px] text-slate-500">{t === "GST" ? "PI → Tax invoice with CGST/SGST or IGST" : "Direct invoice, no tax"}</div>
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="GSTIN" required={form.gstType === "GST"} hint={gstinInvalid ? undefined : "15 characters; the first 2 digits are the state code"}>
          <input
            className={`${inputClass} font-mono uppercase`}
            value={form.gstin}
            maxLength={15}
            onChange={(e) => set({ gstin: e.target.value.toUpperCase() })}
            placeholder={form.gstType === "GST" ? "Required" : "Optional"}
          />
          {gstinInvalid && <span className="block text-[11px] text-rose-600 font-bold mt-1">This doesn&apos;t look like a valid GSTIN</span>}
        </Field>
        <Field label="State" hint={gstinState ? "Taken from the GSTIN" : "Decides CGST+SGST vs IGST"}>
          <select
            className={inputClass}
            value={gstinState?.code || form.stateCode}
            disabled={Boolean(gstinState)}
            onChange={(e) => set({ stateCode: e.target.value })}
          >
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Business types" hint="What this company bills for. Used to split income in reports.">
        <div className="flex flex-wrap gap-2">
          {BUSINESS_TYPES.map((b) => {
            const on = form.businessTypes.includes(b);
            return (
              <button
                key={b}
                type="button"
                aria-pressed={on}
                onClick={() => set({ businessTypes: on ? form.businessTypes.filter((x) => x !== b) : [...form.businessTypes, b] })}
                className={`px-3 py-1.5 rounded-full border text-xs font-bold cursor-pointer ${
                  on ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {on ? "✓ " : ""}
                {BUSINESS_TYPE_LABELS[b]}
              </button>
            );
          })}
        </div>
      </Field>

      {form.gstType === "GST" && (
        <Field label="Default tax rates (%)" hint="Same state as client: CGST + SGST. Other state: IGST.">
          <div className="grid grid-cols-3 gap-2">
            {(["cgstRate", "sgstRate", "igstRate"] as const).map((k) => (
              <div key={k} className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500 w-10">{k.replace("Rate", "").toUpperCase()}</span>
                <input type="number" min={0} max={28} step={0.5} className={inputClass} value={form[k]} onChange={(e) => set({ [k]: e.target.value })} />
              </div>
            ))}
          </div>
        </Field>
      )}

      <Field
        label="Number series prefixes"
        hint={'Up to 6 letters, digits or "-". Each prefix must be unique across companies so invoice numbers never clash.'}
      >
        {form.gstType === "GST" ? (
          <div className="grid grid-cols-2 gap-2">
            <input className={`${inputClass} font-mono uppercase`} placeholder="PI prefix" value={form.piPrefix} maxLength={6} onChange={(e) => set({ piPrefix: e.target.value.toUpperCase() })} />
            <input
              className={`${inputClass} font-mono uppercase`}
              placeholder="Tax invoice prefix"
              value={form.taxInvoicePrefix}
              maxLength={6}
              onChange={(e) => set({ taxInvoicePrefix: e.target.value.toUpperCase() })}
            />
          </div>
        ) : (
          <input
            className={`${inputClass} font-mono uppercase`}
            placeholder="Invoice prefix"
            value={form.nonGstInvoicePrefix}
            maxLength={6}
            onChange={(e) => set({ nonGstInvoicePrefix: e.target.value.toUpperCase() })}
          />
        )}
      </Field>
    </Modal>
  );
}
