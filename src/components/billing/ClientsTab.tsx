"use client";

import React, { useMemo, useState } from "react";
import { BILLING_CYCLES, BILLING_CYCLE_LABELS, INDIAN_STATES, isValidGstin, normalizeGstin, stateByCode, stateFromGstin } from "@/lib/billing";
import { formatDate, toDateKey } from "@/lib/dates";
import type { BillingCompany } from "./CompaniesTab";
import { Badge, billingApi, EmptyRow, ErrorNote, Field, inputClass, Modal, PrimaryButton, SecondaryButton, tdClass, thClass } from "./ui";

export interface BillingClient {
  _id: string;
  name: string;
  contactPerson?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  isBillingClient?: boolean;
  services?: string[];
  serviceDescription?: string;
  clientStatus?: "ACTIVE" | "INACTIVE";
  billingCompanyIds?: { _id: string; name: string }[];
  defaultBillingCompanyId?: { _id: string; name: string } | null;
  billingCycle?: string;
  customCycleMonths?: number;
  workStartDate?: string | null;
  billingDay?: number;
  autoGeneratePI?: boolean;
  defaultBillingAmount?: number;
  billingNotes?: string;
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const cycleText = (c: BillingClient) => {
  if (c.billingCycle === "CUSTOM") return `Every ${c.customCycleMonths || "?"} months`;
  return BILLING_CYCLE_LABELS[(c.billingCycle || "MONTHLY") as keyof typeof BILLING_CYCLE_LABELS] || c.billingCycle;
};

export default function ClientsTab({
  clients,
  companies,
  isLoading,
  onChanged,
}: {
  clients: BillingClient[];
  companies: BillingCompany[];
  isLoading: boolean;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "INACTIVE" | "ALL">("ACTIVE");
  const [editing, setEditing] = useState<BillingClient | "new" | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter !== "ALL" && (c.clientStatus || "ACTIVE") !== statusFilter) return false;
      if (!q) return true;
      return [c.name, c.contactPerson, c.gstin, c.phone, c.email].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [clients, search, statusFilter]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-[260px]">
          <input
            type="search"
            className={`${inputClass} max-w-sm py-1.5 text-xs`}
            placeholder="Search client, GSTIN, phone or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search clients"
          />
          <select className={`${inputClass} w-auto py-1.5 text-xs`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Status">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ALL">All</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <SecondaryButton onClick={() => setIsPickerOpen(true)}>Add existing customer</SecondaryButton>
          <PrimaryButton onClick={() => setEditing("new")}>+ New client</PrimaryButton>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className={thClass}>Client</th>
              <th className={thClass}>GST</th>
              <th className={thClass}>Bills from</th>
              <th className={thClass}>Cycle</th>
              <th className={thClass}>Amount / cycle</th>
              <th className={thClass}>Auto PI</th>
              <th className={thClass}>Status</th>
              <th className={`${thClass} text-right`}> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <EmptyRow colSpan={8}>Loading clients…</EmptyRow>
            ) : visible.length === 0 ? (
              <EmptyRow colSpan={8}>
                {clients.length === 0 ? "No billing clients yet. Add a new client or enable billing for an existing quotation customer." : "No clients match."}
              </EmptyRow>
            ) : (
              visible.map((c) => (
                <tr key={c._id} className={c.clientStatus === "INACTIVE" ? "opacity-50" : ""}>
                  <td className={tdClass}>
                    <div className="font-extrabold text-slate-900">{c.name}</div>
                    <div className="text-[11px] text-slate-400">{[c.contactPerson, c.phone, c.email].filter(Boolean).join(" · ") || "No contact details"}</div>
                    {c.services && c.services.length > 0 && <div className="text-[11px] text-indigo-600 font-semibold mt-0.5">{c.services.join(", ")}</div>}
                  </td>
                  <td className={tdClass}>
                    {c.gstin ? <Badge tone="indigo">Registered</Badge> : <Badge tone="slate">Unregistered</Badge>}
                    {c.gstin && <div className="font-mono text-[11px] text-slate-500 mt-1">{c.gstin}</div>}
                    <div className="text-[11px] text-slate-400 mt-0.5">{stateByCode(c.stateCode)?.name || c.state || "State not set"}</div>
                  </td>
                  <td className={tdClass}>
                    {(c.billingCompanyIds || []).length === 0 ? (
                      <span className="text-amber-700 font-bold">Not mapped</span>
                    ) : (
                      (c.billingCompanyIds || []).map((co) => (
                        <div key={co._id} className="whitespace-nowrap">
                          {String(c.defaultBillingCompanyId?._id) === String(co._id) ? <span className="text-amber-500" title="Default">★ </span> : null}
                          {co.name}
                        </div>
                      ))
                    )}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap`}>
                    <div>{cycleText(c)}</div>
                    <div className="text-[11px] text-slate-400">on the {ordinal(c.billingDay || 1)}</div>
                    {c.workStartDate && <div className="text-[11px] text-slate-400">since {formatDate(c.workStartDate)}</div>}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap font-bold`}>
                    {c.defaultBillingAmount ? `₹${c.defaultBillingAmount.toLocaleString("en-IN")}` : <span className="text-slate-400 font-normal">—</span>}
                  </td>
                  <td className={tdClass}>{c.autoGeneratePI ? <Badge tone="green">On</Badge> : <Badge tone="slate">Off</Badge>}</td>
                  <td className={tdClass}>{(c.clientStatus || "ACTIVE") === "ACTIVE" ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Inactive</Badge>}</td>
                  <td className={`${tdClass} text-right`}>
                    <SecondaryButton onClick={() => setEditing(c)}>Edit</SecondaryButton>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isPickerOpen && (
        <ExistingCustomerPicker
          onClose={() => setIsPickerOpen(false)}
          onPick={(customer) => {
            setIsPickerOpen(false);
            setEditing(customer);
          }}
        />
      )}

      {editing && (
        <ClientModal
          client={editing === "new" ? null : editing}
          companies={companies}
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

/** Lists quotation customers that are not billing clients yet, to enable billing without re-typing them. */
function ExistingCustomerPicker({ onClose, onPick }: { onClose: () => void; onPick: (c: BillingClient) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BillingClient[] | null>(null);
  const [error, setError] = useState("");

  const search = async (term: string) => {
    setError("");
    try {
      const json = await billingApi<{ data: BillingClient[] }>(`/api/billing/clients?scope=all&q=${encodeURIComponent(term)}`);
      setResults(json.data.filter((c) => !c.isBillingClient));
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Modal
      title="Add existing customer"
      subtitle="Customers from Quotations that are not set up for billing yet."
      onClose={onClose}
      footer={<SecondaryButton onClick={onClose}>Close</SecondaryButton>}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(q);
        }}
        className="flex gap-2"
      >
        <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer name, GSTIN or phone" autoFocus />
        <PrimaryButton type="submit">Search</PrimaryButton>
      </form>
      <ErrorNote message={error} />
      {results !== null && (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <li className="p-4 text-sm text-slate-500 text-center">No matching customers without billing.</li>
          ) : (
            results.map((c) => (
              <li key={c._id}>
                <button type="button" onClick={() => onPick(c)} className="w-full text-left p-3 hover:bg-indigo-50 cursor-pointer">
                  <div className="font-bold text-sm text-slate-900">{c.name}</div>
                  <div className="text-[11px] text-slate-500">{[c.gstin, c.phone, c.email, c.city].filter(Boolean).join(" · ") || "No details"}</div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </Modal>
  );
}

function ClientModal({
  client,
  companies,
  onClose,
  onSaved,
}: {
  client: BillingClient | null;
  companies: BillingCompany[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const activeCompanies = companies.filter((c) => c.status !== "INACTIVE");
  const initialCompanyIds = (client?.billingCompanyIds || []).map((c) => String(c._id || c));
  const [form, setForm] = useState({
    name: client?.name || "",
    contactPerson: client?.contactPerson || "",
    phone: client?.phone || "",
    email: client?.email || "",
    address: client?.address || "",
    city: client?.city || "",
    pincode: client?.pincode || "",
    gstin: client?.gstin || "",
    stateCode: client?.stateCode || "",
    servicesText: (client?.services || []).join(", "),
    serviceDescription: client?.serviceDescription || "",
    clientStatus: client?.clientStatus || "ACTIVE",
    billingCompanyIds: initialCompanyIds.length ? initialCompanyIds : activeCompanies.length === 1 ? [activeCompanies[0]._id] : [],
    defaultBillingCompanyId: client?.defaultBillingCompanyId?._id
      ? String(client.defaultBillingCompanyId._id)
      : initialCompanyIds[0] || (activeCompanies.length === 1 ? activeCompanies[0]._id : ""),
    billingCycle: client?.billingCycle || "MONTHLY",
    customCycleMonths: client?.customCycleMonths ? String(client.customCycleMonths) : "",
    billingDay: String(client?.billingDay || 1),
    workStartDate: client?.workStartDate ? toDateKey(client.workStartDate) : "",
    defaultBillingAmount: client?.defaultBillingAmount ? String(client.defaultBillingAmount) : "",
    autoGeneratePI: client?.autoGeneratePI || false,
    billingNotes: client?.billingNotes || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const gstinTyped = normalizeGstin(form.gstin);
  const gstinInvalid = gstinTyped.length > 0 && !isValidGstin(gstinTyped);
  const gstinState = stateFromGstin(form.gstin);

  const toggleCompany = (id: string) => {
    const on = form.billingCompanyIds.includes(id);
    const next = on ? form.billingCompanyIds.filter((x) => x !== id) : [...form.billingCompanyIds, id];
    const nextDefault = next.includes(form.defaultBillingCompanyId) ? form.defaultBillingCompanyId : next[0] || "";
    set({ billingCompanyIds: next, defaultBillingCompanyId: nextDefault });
  };

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        contactPerson: form.contactPerson,
        phone: form.phone,
        email: form.email,
        address: form.address,
        city: form.city,
        pincode: form.pincode,
        gstin: form.gstin,
        stateCode: gstinState?.code || form.stateCode,
        services: form.servicesText.split(",").map((s) => s.trim()).filter(Boolean),
        serviceDescription: form.serviceDescription,
        clientStatus: form.clientStatus,
        billingCompanyIds: form.billingCompanyIds,
        defaultBillingCompanyId: form.defaultBillingCompanyId || null,
        billingCycle: form.billingCycle,
        customCycleMonths: form.billingCycle === "CUSTOM" ? form.customCycleMonths : "",
        billingDay: form.billingDay,
        workStartDate: form.workStartDate,
        defaultBillingAmount: form.defaultBillingAmount || 0,
        autoGeneratePI: form.autoGeneratePI,
        billingNotes: form.billingNotes,
      };
      await billingApi(client ? `/api/billing/clients/${client._id}` : "/api/billing/clients", {
        method: client ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const isEnabling = client && !client.isBillingClient;

  return (
    <Modal
      wide
      title={!client ? "New billing client" : isEnabling ? `Enable billing · ${client.name}` : `Edit ${client.name}`}
      subtitle="Saved once and reused for every PI and invoice."
      onClose={onClose}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton onClick={save} disabled={saving || gstinInvalid}>
            {saving ? "Saving…" : !client ? "Add client" : isEnabling ? "Enable billing" : "Save"}
          </PrimaryButton>
        </>
      }
    >
      <ErrorNote message={error} />

      <section className="space-y-3">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Client details</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client name" required>
            <input className={inputClass} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Registered business name" />
          </Field>
          <Field label="Contact person">
            <input className={inputClass} value={form.contactPerson} onChange={(e) => set({ contactPerson: e.target.value })} />
          </Field>
          <Field label="Mobile number">
            <input className={inputClass} value={form.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" />
          </Field>
          <Field label="Email">
            <input className={inputClass} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
        </div>
        <Field label="Address">
          <input className={inputClass} value={form.address} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="City">
            <input className={inputClass} value={form.city} onChange={(e) => set({ city: e.target.value })} />
          </Field>
          <Field label="PIN code">
            <input className={inputClass} value={form.pincode} onChange={(e) => set({ pincode: e.target.value })} inputMode="numeric" maxLength={6} />
          </Field>
          <Field label="State" hint={gstinState ? "From GSTIN" : undefined}>
            <select className={inputClass} value={gstinState?.code || form.stateCode} disabled={Boolean(gstinState)} onChange={(e) => set({ stateCode: e.target.value })}>
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="GSTIN" hint={gstinTyped ? (gstinInvalid ? undefined : "Registered client: B2B sale") : "Leave empty for an unregistered client (B2C sale)"}>
          <input className={`${inputClass} font-mono uppercase`} value={form.gstin} maxLength={15} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} />
          {gstinInvalid && <span className="block text-[11px] text-rose-600 font-bold mt-1">This doesn&apos;t look like a valid GSTIN</span>}
        </Field>
      </section>

      <section className="space-y-3 pt-2 border-t border-slate-100">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 pt-2">Billing</h3>
        <Field label="Bill from (our companies)" required hint="Tick every company that may invoice this client; ★ marks the one pre-selected on new PIs.">
          {activeCompanies.length === 0 ? (
            <p className="text-xs text-amber-700 font-bold">No active companies. Set them up in the Companies tab first.</p>
          ) : (
            <div className="space-y-1.5">
              {activeCompanies.map((co) => {
                const on = form.billingCompanyIds.includes(co._id);
                return (
                  <div key={co._id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${on ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200"}`}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
                      <input type="checkbox" checked={on} onChange={() => toggleCompany(co._id)} className="w-4 h-4" />
                      <span className="font-bold text-slate-800">{co.name}</span>
                      <Badge tone={co.gstType === "GST" ? "indigo" : "slate"}>{co.gstType === "GST" ? "GST" : "Non-GST"}</Badge>
                    </label>
                    {on && (
                      <button
                        type="button"
                        onClick={() => set({ defaultBillingCompanyId: co._id })}
                        className={`text-xs font-bold px-2 py-1 rounded cursor-pointer ${
                          form.defaultBillingCompanyId === co._id ? "text-amber-600" : "text-slate-400 hover:text-slate-700"
                        }`}
                        aria-pressed={form.defaultBillingCompanyId === co._id}
                      >
                        {form.defaultBillingCompanyId === co._id ? "★ Default" : "☆ Make default"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Services" hint="Comma-separated, e.g. SEO, Social Media">
            <input className={inputClass} value={form.servicesText} onChange={(e) => set({ servicesText: e.target.value })} />
          </Field>
          <Field label="Description on invoice">
            <input className={inputClass} value={form.serviceDescription} onChange={(e) => set({ serviceDescription: e.target.value })} placeholder="Digital Marketing Services" />
          </Field>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Field label="Billing cycle">
            <select className={inputClass} value={form.billingCycle} onChange={(e) => set({ billingCycle: e.target.value })}>
              {BILLING_CYCLES.map((b) => (
                <option key={b} value={b}>
                  {BILLING_CYCLE_LABELS[b]}
                </option>
              ))}
            </select>
          </Field>
          {form.billingCycle === "CUSTOM" ? (
            <Field label="Every (months)" required>
              <input className={inputClass} type="number" min={1} max={24} value={form.customCycleMonths} onChange={(e) => set({ customCycleMonths: e.target.value })} />
            </Field>
          ) : (
            <div />
          )}
          <Field label="Billing day" hint="1–28 of the month">
            <input className={inputClass} type="number" min={1} max={28} value={form.billingDay} onChange={(e) => set({ billingDay: e.target.value })} />
          </Field>
          <Field label="Work start date" required={form.autoGeneratePI}>
            <input className={inputClass} type="date" value={form.workStartDate} onChange={(e) => set({ workStartDate: e.target.value })} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 items-end">
          <Field label="Amount per cycle (₹, before tax)" required={form.autoGeneratePI} hint="Pre-fills new PIs">
            <input className={inputClass} type="number" min={0} step="0.01" value={form.defaultBillingAmount} onChange={(e) => set({ defaultBillingAmount: e.target.value })} />
          </Field>
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer pb-2">
            <input type="checkbox" checked={form.autoGeneratePI} onChange={(e) => set({ autoGeneratePI: e.target.checked })} className="w-4 h-4 mt-0.5" />
            <span>
              Auto-generate PI each cycle
              <span className="block text-[11px] text-slate-400">Takes effect once billing automation (Phase 3) is switched on</span>
            </span>
          </label>
        </div>

        <Field label="Billing notes">
          <textarea className={inputClass} rows={2} value={form.billingNotes} onChange={(e) => set({ billingNotes: e.target.value })} />
        </Field>

        {client?.isBillingClient && (
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.clientStatus === "ACTIVE"} onChange={(e) => set({ clientStatus: e.target.checked ? "ACTIVE" : "INACTIVE" })} className="w-4 h-4" />
            Active client (inactive clients can&apos;t be billed but keep their history)
          </label>
        )}
      </section>
    </Modal>
  );
}
