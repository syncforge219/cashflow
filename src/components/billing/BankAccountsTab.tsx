"use client";

import React, { useState } from "react";
import { BANK_ACCOUNT_TYPES, BANK_ACCOUNT_TYPE_LABELS, maskAccountNumber } from "@/lib/billing";
import type { BillingCompany } from "./CompaniesTab";
import { Badge, billingApi, EmptyRow, ErrorNote, Field, inputClass, Modal, PrimaryButton, SecondaryButton, tdClass, thClass } from "./ui";

export interface BillingBankAccount {
  _id: string;
  companyId: string;
  companyName: string;
  label: string;
  bankName: string;
  accountHolderName: string;
  accountLast4: string;
  ifsc: string;
  branch: string;
  accountType: string;
  upiId: string;
  gstApplicable: boolean;
  isDefault: boolean;
  status: "ACTIVE" | "INACTIVE";
}

export default function BankAccountsTab({
  accounts,
  companies,
  isLoading,
  onChanged,
}: {
  accounts: BillingBankAccount[];
  companies: BillingCompany[];
  isLoading: boolean;
  onChanged: () => void;
}) {
  const [companyFilter, setCompanyFilter] = useState("");
  const [editing, setEditing] = useState<BillingBankAccount | "new" | null>(null);
  const [error, setError] = useState("");

  const visible = companyFilter ? accounts.filter((a) => String(a.companyId) === companyFilter) : accounts;

  const remove = async (a: BillingBankAccount) => {
    if (!window.confirm(`Remove "${a.label}" (${a.bankName} ${maskAccountNumber(a.accountLast4)})?\n\nIt will no longer be offered when entering receipts.`)) return;
    setError("");
    try {
      await billingApi(`/api/billing/bank-accounts/${a._id}`, { method: "DELETE" });
      onChanged();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-xs text-slate-500">Accounts that receive client payments. Each belongs to one company, so bank-wise and company-wise reports stay accurate.</p>
        <div className="flex items-center gap-2">
          <select className={`${inputClass} w-auto py-1.5 text-xs`} value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} aria-label="Filter by company">
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <PrimaryButton onClick={() => setEditing("new")} disabled={companies.length === 0}>
            + Add bank account
          </PrimaryButton>
        </div>
      </div>
      <ErrorNote message={error} />

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto mt-2">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className={thClass}>Account</th>
              <th className={thClass}>Company</th>
              <th className={thClass}>Bank / branch</th>
              <th className={thClass}>Account no.</th>
              <th className={thClass}>Type</th>
              <th className={thClass}>Income type</th>
              <th className={thClass}>Status</th>
              <th className={`${thClass} text-right`}> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <EmptyRow colSpan={8}>Loading bank accounts…</EmptyRow>
            ) : visible.length === 0 ? (
              <EmptyRow colSpan={8}>No bank accounts yet. Add the accounts your clients pay into.</EmptyRow>
            ) : (
              visible.map((a) => (
                <tr key={a._id} className={a.status === "INACTIVE" ? "opacity-50" : ""}>
                  <td className={tdClass}>
                    <div className="font-extrabold text-slate-900">
                      {a.label} {a.isDefault && <span className="text-amber-500" title="Default account for this company">★</span>}
                    </div>
                    {a.accountHolderName && <div className="text-[11px] text-slate-400">{a.accountHolderName}</div>}
                  </td>
                  <td className={tdClass}>{a.companyName}</td>
                  <td className={tdClass}>
                    <div className="font-bold text-slate-700">{a.bankName}</div>
                    <div className="text-[11px] text-slate-400">{[a.branch, a.ifsc].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className={`${tdClass} font-mono`}>{maskAccountNumber(a.accountLast4) || "—"}</td>
                  <td className={tdClass}>{BANK_ACCOUNT_TYPE_LABELS[a.accountType as keyof typeof BANK_ACCOUNT_TYPE_LABELS] || a.accountType}</td>
                  <td className={tdClass}>{a.gstApplicable ? <Badge tone="indigo">GST income</Badge> : <Badge tone="slate">Non-GST income</Badge>}</td>
                  <td className={tdClass}>{a.status === "ACTIVE" ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Inactive</Badge>}</td>
                  <td className={`${tdClass} text-right whitespace-nowrap space-x-1.5`}>
                    <SecondaryButton onClick={() => setEditing(a)}>Edit</SecondaryButton>
                    <button onClick={() => remove(a)} className="px-2 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer">
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <BankAccountModal
          account={editing === "new" ? null : editing}
          companies={companies}
          presetCompanyId={companyFilter}
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

function BankAccountModal({
  account,
  companies,
  presetCompanyId,
  onClose,
  onSaved,
}: {
  account: BillingBankAccount | null;
  companies: BillingCompany[];
  presetCompanyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialCompany = account ? String(account.companyId) : presetCompanyId || (companies.length === 1 ? companies[0]._id : "");
  const companyGst = (id: string) => companies.find((c) => c._id === id)?.gstType === "GST";
  const [form, setForm] = useState({
    companyId: initialCompany,
    label: account?.label || "",
    bankName: account?.bankName || "",
    accountHolderName: account?.accountHolderName || "",
    accountNumber: "",
    ifsc: account?.ifsc || "",
    branch: account?.branch || "",
    accountType: account?.accountType || "CURRENT",
    upiId: account?.upiId || "",
    gstApplicable: account ? account.gstApplicable : initialCompany ? companyGst(initialCompany) : true,
    isDefault: account?.isDefault || false,
    status: account?.status || "ACTIVE",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (account && !form.accountNumber.trim()) delete payload.accountNumber; // unchanged
      await billingApi(account ? `/api/billing/bank-accounts/${account._id}` : "/api/billing/bank-accounts", {
        method: account ? "PUT" : "POST",
        body: JSON.stringify(payload),
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
      title={account ? `Edit ${account.label}` : "Add bank account"}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? "Saving…" : account ? "Save" : "Add account"}
          </PrimaryButton>
        </>
      }
    >
      <ErrorNote message={error} />
      <Field label="Company (account owner)" required>
        <select
          className={inputClass}
          value={form.companyId}
          onChange={(e) => set({ companyId: e.target.value, gstApplicable: companyGst(e.target.value) })}
        >
          <option value="">Select company</option>
          {companies.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name} ({c.gstType === "GST" ? "GST" : "Non-GST"})
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account label" required hint="Short name shown in receipt entry">
          <input className={inputClass} value={form.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Main current account" />
        </Field>
        <Field label="Bank name" required>
          <input className={inputClass} value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} placeholder="Bank name" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Account number"
          required={!account}
          hint={account ? `Saved as ${maskAccountNumber(account.accountLast4) || "—"}. Leave empty to keep it.` : "Stored encrypted; only the last 4 digits are shown"}
        >
          <input className={`${inputClass} font-mono`} value={form.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} inputMode="numeric" autoComplete="off" />
        </Field>
        <Field label="IFSC">
          <input className={`${inputClass} font-mono uppercase`} value={form.ifsc} maxLength={11} onChange={(e) => set({ ifsc: e.target.value.toUpperCase() })} placeholder="11 characters" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account holder name">
          <input className={inputClass} value={form.accountHolderName} onChange={(e) => set({ accountHolderName: e.target.value })} />
        </Field>
        <Field label="Branch">
          <input className={inputClass} value={form.branch} onChange={(e) => set({ branch: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account type">
          <select className={inputClass} value={form.accountType} onChange={(e) => set({ accountType: e.target.value })}>
            {BANK_ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {BANK_ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="UPI ID">
          <input className={inputClass} value={form.upiId} onChange={(e) => set({ upiId: e.target.value })} placeholder="optional" />
        </Field>
      </div>
      <div className="space-y-2 pt-1">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={form.gstApplicable} onChange={(e) => set({ gstApplicable: e.target.checked })} className="w-4 h-4" />
          Money received here is GST-billed income
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => set({ isDefault: e.target.checked })} className="w-4 h-4" />
          Default account for this company (pre-selected in receipt entry)
        </label>
        {account && (
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.status === "ACTIVE"} onChange={(e) => set({ status: e.target.checked ? "ACTIVE" : "INACTIVE" })} className="w-4 h-4" />
            Active (inactive accounts are hidden from receipt entry)
          </label>
        )}
      </div>
    </Modal>
  );
}
