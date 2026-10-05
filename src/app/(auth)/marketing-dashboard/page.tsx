"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@/app/component/context/user-context";
import JustdialIntegrationModal from "@/components/JustdialIntegrationModal";
import FacebookLeadsIntegrationModal from "@/components/FacebookLeadsIntegrationModal";
import { todayKey, monthBoundsKey, addDaysKey, formatDate } from "@/lib/dates";

type Tab = "overview" | "add" | "leads" | "spend" | "connectors";

interface Lookups {
  brands: string[];
  courses: string[];
  leadSources: string[];
  counsellors: string[];
  marketingUsers: { id: string; name: string }[];
  isAdmin: boolean;
}

interface SummaryRow {
  key: string;
  label: string;
  spend: number;
  leads: number;
  admissions: number;
  costPerLead: number | null;
  costPerAdmission: number | null;
  conversionPct: number | null;
}

const inr = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const input =
  "w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const label = "block text-xs font-bold text-slate-600 mb-1";

function periodPresets() {
  const today = todayKey();
  const thisMonth = monthBoundsKey(today);
  const lastMonth = monthBoundsKey(addDaysKey(thisMonth.first, -1));
  return [
    { id: "month", label: "This month", from: thisMonth.first, to: today },
    { id: "last", label: "Last month", from: lastMonth.first, to: lastMonth.last },
    { id: "30", label: "Last 30 days", from: addDaysKey(today, -29), to: today },
    { id: "90", label: "Last 90 days", from: addDaysKey(today, -89), to: today },
  ];
}

export default function MarketingDashboardPage() {
  const { user, logout } = useUser();
  const [tab, setTab] = useState<Tab>("overview");
  const presets = useMemo(() => periodPresets(), []);
  const [from, setFrom] = useState(presets[0].from);
  const [to, setTo] = useState(presets[0].to);
  const [viewUserId, setViewUserId] = useState(""); // admins: filter by marketing user

  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [spend, setSpend] = useState<any[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [connector, setConnector] = useState<"justdial" | "facebook" | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({ from, to });
    if (viewUserId) p.set("userId", viewUserId);
    return p.toString();
  }, [from, to, viewUserId]);

  const currentKey = `${query}|${reloadKey}`;
  const loading = loadedKey !== currentKey;
  const loadAll = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    fetch("/api/marketing/lookups")
      .then((r) => r.json())
      .then((d) => d.success && setLookups(d.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/marketing/summary?${query}`).then((r) => r.json()),
      fetch(`/api/marketing/leads?${query}`).then((r) => r.json()),
      fetch(`/api/marketing/spend?${query}`).then((r) => r.json()),
    ])
      .then(([s, l, sp]) => {
        if (cancelled) return;
        if (s.success) setSummary(s.data);
        if (l.success) setLeads(l.data);
        if (sp.success) setSpend(sp.data);
        if (!s.success) setBanner({ type: "error", text: s.error || "Could not load your figures." });
      })
      .catch((err) => !cancelled && setBanner({ type: "error", text: err.message }))
      .finally(() => !cancelled && setLoadedKey(`${query}|${reloadKey}`));
    return () => {
      cancelled = true;
    };
  }, [query, reloadKey]);

  const isAdmin = Boolean(lookups?.isAdmin);
  const totals = summary?.totals;

  const tabs: { id: Tab; label: string; hidden?: boolean }[] = [
    { id: "overview", label: "📊 Cost & Results" },
    { id: "add", label: "➕ Add Lead", hidden: isAdmin },
    { id: "leads", label: `👥 My Leads (${leads.length})` },
    { id: "spend", label: "💸 Spend Log" },
    { id: "connectors", label: "🔌 Connectors", hidden: isAdmin },
  ];

  return (
    <div className="min-h-screen bg-[#f8faff] text-slate-800 font-sans">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black tracking-tight">Marketing Dashboard</h1>
          <p className="text-xs text-slate-500">
            {isAdmin ? "Admin view of marketing spend and leads" : "Your leads, spend and cost per lead"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600">{user?.name}</span>
          <button
            onClick={() => logout().then(() => (window.location.href = "/login"))}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 hover:bg-slate-50 cursor-pointer"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-5">
        {banner && (
          <div
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex justify-between ${
              banner.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            <span>{banner.text}</span>
            <button onClick={() => setBanner(null)} className="cursor-pointer" aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}

        {/* Period + tabs */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 overflow-x-auto">
            {tabs
              .filter((t) => !t.hidden)
              .map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap cursor-pointer ${
                    tab === t.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {isAdmin && (
              <select value={viewUserId} onChange={(e) => setViewUserId(e.target.value)} className={`${input} w-auto`}>
                <option value="">All marketing users</option>
                {lookups?.marketingUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}
            <select
              onChange={(e) => {
                const p = presets.find((x) => x.id === e.target.value);
                if (p) {
                  setFrom(p.from);
                  setTo(p.to);
                }
              }}
              defaultValue="month"
              className={`${input} w-auto`}
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className={`${input} w-auto`} />
            <span className="text-xs text-slate-400 pb-2.5">to</span>
            <input type="date" value={to} min={from} max={todayKey()} onChange={(e) => e.target.value && setTo(e.target.value)} className={`${input} w-auto`} />
          </div>
        </div>

        {tab === "overview" && (
          <section className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { k: "Total spend", v: inr(totals?.spend) },
                { k: "Leads", v: totals?.leads ?? "—" },
                { k: "Cost per lead", v: inr(totals?.costPerLead) },
                { k: "Admissions", v: totals?.admissions ?? "—" },
                { k: "Cost per admission", v: inr(totals?.costPerAdmission) },
                { k: "Lead → admission", v: totals?.conversionPct === null || totals?.conversionPct === undefined ? "—" : `${totals.conversionPct}%` },
              ].map((c) => (
                <div key={c.k} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{c.k}</div>
                  <div className="text-xl font-black mt-1">{loading ? "…" : c.v}</div>
                </div>
              ))}
            </div>
            <SummaryTable title="By lead source" rows={summary?.bySource || []} />
            <SummaryTable title="By campaign" rows={summary?.byCampaign || []} empty="Add a campaign name to your leads and spend entries to compare campaigns." />
            <p className="text-xs text-slate-500">
              Cost per lead = spend ÷ leads from the same source in this period. A spend entry only matches leads when the
              source name is the same (for example both &ldquo;Meta Ads&rdquo;).
            </p>
          </section>
        )}

        {tab === "add" && lookups && (
          <AddLeadForm
            lookups={lookups}
            onAdded={(msg) => {
              setBanner({ type: "success", text: msg });
              loadAll();
            }}
            onError={(msg) => setBanner({ type: "error", text: msg })}
          />
        )}

        {tab === "leads" && <LeadsTable leads={leads} showAddedBy={isAdmin} />}

        {tab === "spend" && (
          <SpendSection
            rows={spend}
            lookups={lookups}
            canAdd={!isAdmin}
            onChanged={(msg, type = "success") => {
              setBanner({ type, text: msg });
              loadAll();
            }}
          />
        )}

        {tab === "connectors" && (
          <section className="grid md:grid-cols-2 gap-4">
            <ConnectorCard
              title="Justdial"
              text="Paste the webhook URL and API key into your Justdial lead panel, map categories to courses, and test it."
              onOpen={() => setConnector("justdial")}
            />
            <ConnectorCard
              title="Facebook & Instagram Lead Ads"
              text="Connect your Facebook page, choose forms and courses, and pull earlier leads."
              onOpen={() => setConnector("facebook")}
            />
            <p className="md:col-span-2 text-xs text-slate-500">
              Leads that arrive through a connector you set up are counted as yours. Their source is set by the connector
              (&ldquo;JustDial&rdquo; / &ldquo;Meta Ads&rdquo;), so log spend under the same source names.
            </p>
          </section>
        )}
      </main>

      {lookups && (
        <>
          <JustdialIntegrationModal
            isOpen={connector === "justdial"}
            onClose={() => setConnector(null)}
            counsellorsList={lookups.counsellors.map((name) => ({ name }))}
            dbLeadSources={lookups.leadSources.map((name) => ({ name }))}
            brandsList={lookups.brands.map((name) => ({ name }))}
            onConfigSaved={loadAll}
          />
          <FacebookLeadsIntegrationModal
            isOpen={connector === "facebook"}
            onClose={() => setConnector(null)}
            counsellorsList={lookups.counsellors.map((name) => ({ name }))}
            dbLeadSources={lookups.leadSources.map((name) => ({ name }))}
            brandsList={lookups.brands.map((name) => ({ name }))}
            onConfigSaved={loadAll}
          />
        </>
      )}
    </div>
  );
}

function SummaryTable({ title, rows, empty }: { title: string; rows: SummaryRow[]; empty?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <h2 className="px-4 py-3 text-sm font-black border-b border-slate-100">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400">{empty || "No leads or spend in this period."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-extrabold">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-right px-4 py-2">Spend</th>
                <th className="text-right px-4 py-2">Leads</th>
                <th className="text-right px-4 py-2">Cost / lead</th>
                <th className="text-right px-4 py-2">Admissions</th>
                <th className="text-right px-4 py-2">Cost / admission</th>
                <th className="text-right px-4 py-2">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-bold">{r.label}</td>
                  <td className="px-4 py-2 text-right">{inr(r.spend)}</td>
                  <td className="px-4 py-2 text-right">{r.leads}</td>
                  <td className="px-4 py-2 text-right font-bold">{inr(r.costPerLead)}</td>
                  <td className="px-4 py-2 text-right">{r.admissions}</td>
                  <td className="px-4 py-2 text-right">{inr(r.costPerAdmission)}</td>
                  <td className="px-4 py-2 text-right">{r.conversionPct === null ? "—" : `${r.conversionPct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AddLeadForm({ lookups, onAdded, onError }: { lookups: Lookups; onAdded: (m: string) => void; onError: (m: string) => void }) {
  const blank = { name: "", phone: "", email: "", city: "", brand: lookups.brands[0] || "", course: "", source: "", campaign: "", counsellor: "", notes: "" };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/marketing/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Could not add the lead.");
      onAdded(`Lead "${data.data.name}" added${data.data.enquiryId ? ` (${data.data.enquiryId})` : ""}.`);
      setF({ ...blank, brand: f.brand, source: f.source, campaign: f.campaign });
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className={label}>Full name *</label>
        <input required value={f.name} onChange={set("name")} className={input} />
      </div>
      <div>
        <label className={label}>Mobile number *</label>
        <input required inputMode="numeric" value={f.phone} onChange={set("phone")} placeholder="10-digit mobile" className={input} />
      </div>
      <div>
        <label className={label}>Email</label>
        <input type="email" value={f.email} onChange={set("email")} className={input} />
      </div>
      <div>
        <label className={label}>City</label>
        <input value={f.city} onChange={set("city")} className={input} />
      </div>
      <div>
        <label className={label}>Brand</label>
        <select value={f.brand} onChange={set("brand")} className={input}>
          {lookups.brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>Course interested in</label>
        <select value={f.course} onChange={set("course")} className={input}>
          <option value="">General / not sure</option>
          {lookups.courses.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>Lead source *</label>
        <input required list="mk-sources" value={f.source} onChange={set("source")} placeholder="e.g. Meta Ads" className={input} />
        <datalist id="mk-sources">
          {lookups.leadSources.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div>
        <label className={label}>Campaign</label>
        <input value={f.campaign} onChange={set("campaign")} placeholder="e.g. AutoCAD October" className={input} />
      </div>
      <div>
        <label className={label}>Assign to counsellor</label>
        <select value={f.counsellor} onChange={set("counsellor")} className={input}>
          <option value="">Unassigned (team picks it up)</option>
          {lookups.counsellors.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="md:col-span-3">
        <label className={label}>Notes</label>
        <textarea value={f.notes} onChange={set("notes")} rows={2} className={input} />
      </div>
      <div className="md:col-span-3">
        <button disabled={saving} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 cursor-pointer">
          {saving ? "Adding…" : "Add lead"}
        </button>
      </div>
    </form>
  );
}

function LeadsTable({ leads, showAddedBy }: { leads: any[]; showAddedBy: boolean }) {
  const [q, setQ] = useState("");
  const shown = leads.filter((l) => !q || `${l.name} ${l.phone} ${l.source} ${l.campaign} ${l.course}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="p-3 border-b border-slate-100">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, source, campaign…" className={`${input} max-w-sm`} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-extrabold">
            <tr>
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-left px-4 py-2">Lead</th>
              <th className="text-left px-4 py-2">Brand / course</th>
              <th className="text-left px-4 py-2">Source</th>
              <th className="text-left px-4 py-2">Campaign</th>
              <th className="text-left px-4 py-2">Admitted</th>
              {showAddedBy && <th className="text-left px-4 py-2">Added by</th>}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No leads in this period.
                </td>
              </tr>
            )}
            {shown.map((l) => (
              <tr key={l._id} className="border-t border-slate-100">
                <td className="px-4 py-2 whitespace-nowrap">{formatDate(l.createdAt)}</td>
                <td className="px-4 py-2">
                  <div className="font-bold">{l.name}</div>
                  <div className="text-xs text-slate-500">{l.phone}</div>
                </td>
                <td className="px-4 py-2">
                  <div>{l.brand}</div>
                  <div className="text-xs text-slate-500">{l.course}</div>
                </td>
                <td className="px-4 py-2">{l.source || "—"}</td>
                <td className="px-4 py-2">{l.campaign || "—"}</td>
                <td className="px-4 py-2">{l.converted ? "✅ Yes" : "—"}</td>
                {showAddedBy && <td className="px-4 py-2">{l.addedBy || "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SpendSection({
  rows,
  lookups,
  canAdd,
  onChanged,
}: {
  rows: any[];
  lookups: Lookups | null;
  canAdd: boolean;
  onChanged: (m: string, type?: "success" | "error") => void;
}) {
  const blank = { date: todayKey(), source: "", campaign: "", brand: "", amount: "", notes: "" };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await (
        await fetch("/api/marketing/spend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(f),
        })
      ).json();
      if (!data.success) throw new Error(data.error);
      setF({ ...blank, source: f.source, campaign: f.campaign, brand: f.brand });
      onChanged("Spend saved.");
    } catch (err: any) {
      onChanged(err.message || "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this spend entry?")) return;
    const data = await (await fetch(`/api/marketing/spend?id=${id}`, { method: "DELETE" })).json();
    onChanged(data.message || data.error, data.success ? "success" : "error");
  };

  return (
    <section className="space-y-4">
      {canAdd && (
        <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div>
            <label className={label}>Date *</label>
            <input type="date" required value={f.date} max={todayKey()} onChange={set("date")} className={input} />
          </div>
          <div>
            <label className={label}>Source *</label>
            <input required list="mk-spend-sources" value={f.source} onChange={set("source")} placeholder="e.g. Meta Ads" className={input} />
            <datalist id="mk-spend-sources">
              {lookups?.leadSources.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={label}>Campaign</label>
            <input value={f.campaign} onChange={set("campaign")} className={input} />
          </div>
          <div>
            <label className={label}>Brand</label>
            <select value={f.brand} onChange={set("brand")} className={input}>
              <option value="">All brands</option>
              {lookups?.brands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Amount (₹) *</label>
            <input required type="number" min="1" step="0.01" value={f.amount} onChange={set("amount")} className={input} />
          </div>
          <button disabled={saving} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 cursor-pointer">
            {saving ? "Saving…" : "Add spend"}
          </button>
        </form>
      )}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-black flex justify-between">
          <span>Spend in this period</span>
          <span>{inr(total)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-extrabold">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-left px-4 py-2">Campaign</th>
                <th className="text-left px-4 py-2">Brand</th>
                <th className="text-right px-4 py-2">Amount</th>
                {!canAdd && <th className="text-left px-4 py-2">By</th>}
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No spend logged in this period.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r._id} className="border-t border-slate-100">
                  <td className="px-4 py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="px-4 py-2">{r.source}</td>
                  <td className="px-4 py-2">{r.campaign || "—"}</td>
                  <td className="px-4 py-2">{r.brand || "All"}</td>
                  <td className="px-4 py-2 text-right font-bold">{inr(r.amount)}</td>
                  {!canAdd && <td className="px-4 py-2">{r.userName}</td>}
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => remove(r._id)} className="text-rose-600 text-xs font-bold hover:underline cursor-pointer">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ConnectorCard({ title, text, onOpen }: { title: string; text: string; onOpen: () => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3">
      <h3 className="font-black">{title}</h3>
      <p className="text-sm text-slate-600 flex-1">{text}</p>
      <button onClick={onOpen} className="self-start px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer">
        Open connector settings
      </button>
    </div>
  );
}
