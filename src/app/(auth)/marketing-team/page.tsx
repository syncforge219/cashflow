"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { MARKETING_TITLES, DEFAULT_MARKETING_TITLE, MARKETING_ROLE } from "@/lib/roles";

interface MarketingUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  createdAt?: string;
}

interface Stats {
  spend: number;
  leads: number;
  admissions: number;
  costPerLead: number | null;
}

const inr = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const field =
  "w-full text-sm px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40";
const label = "block text-xs font-bold text-slate-600 mb-1";

const emptyForm = { name: "", email: "", password: "", phone: "", designation: DEFAULT_MARKETING_TITLE as string, custom: false };

/**
 * Admin page under People: the marketing team, their titles and this month's lead/spend figures.
 * Uses the admin-only /api/users endpoints and /api/marketing/summary (admins may pass ?userId).
 */
export default function MarketingTeamPage() {
  const [users, setUsers] = useState<MarketingUser[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/users?role=marketing")
      .then((r) => r.json())
      .then(async (d) => {
        if (cancelled) return;
        if (!d.success) {
          setError(d.error || "Could not load the marketing team.");
          return;
        }
        const team: MarketingUser[] = (d.data || []).filter((u: any) => /^marketing[\s_-]*executive$/i.test(u.role || ""));
        setUsers(team);
        const entries = await Promise.all(
          team.map(async (u) => {
            const s = await fetch(`/api/marketing/summary?userId=${u._id}`).then((r) => r.json()).catch(() => null);
            return [u._id, s?.success ? s.data.totals : null] as const;
          })
        );
        if (!cancelled) setStats(Object.fromEntries(entries.filter(([, v]) => v)) as Record<string, Stats>);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (u: MarketingUser) => {
    const title = u.designation || DEFAULT_MARKETING_TITLE;
    setEditingId(u._id);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      phone: u.phone || "",
      designation: title,
      custom: !(MARKETING_TITLES as readonly string[]).includes(title),
    });
    setFormError("");
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!editingId && form.password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: MARKETING_ROLE,
          designation: form.designation.trim(),
          brandScope: "All Brands",
          ...(form.password ? { password: form.password } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not save.");
      setModalOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u: MarketingUser) => {
    if (!confirm(`Remove ${u.name}'s login? Their leads and spend history stay in the system.`)) return;
    const data = await (await fetch(`/api/users?id=${u._id}`, { method: "DELETE" })).json();
    if (!data.success) setError(data.error || "Could not remove the user.");
    setReloadKey((k) => k + 1);
  };

  const teamTotals = Object.values(stats).reduce(
    (t, s) => ({ spend: t.spend + (s.spend || 0), leads: t.leads + (s.leads || 0), admissions: t.admissions + (s.admissions || 0) }),
    { spend: 0, leads: 0, admissions: 0 }
  );

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Marketing Team</h1>
            <p className="text-xs text-slate-500 mt-0.5 max-w-xl">
              Marketing users can add leads, set up the Justdial / Facebook connectors and log spend. They cannot see
              finances, admissions or other staff&apos;s leads. Figures below are for this month.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/marketing-dashboard"
              className="text-xs font-bold bg-white border border-slate-200 hover:bg-slate-50 rounded-xl px-4 py-2"
            >
              📊 Spend &amp; leads dashboard
            </Link>
            <button
              onClick={openAdd}
              className="text-xs font-bold bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl px-4 py-2 shadow-md cursor-pointer"
            >
              📣 Add Marketing User
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold rounded-xl px-4 py-2.5">{error}</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { k: "Team members", v: users.length },
            { k: "Spend this month", v: inr(teamTotals.spend) },
            { k: "Leads this month", v: teamTotals.leads },
            { k: "Cost per lead", v: teamTotals.leads ? inr(teamTotals.spend / teamTotals.leads) : "—" },
          ].map((c) => (
            <div key={c.k} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{c.k}</div>
              <div className="text-xl font-black mt-1">{loaded ? c.v : "…"}</div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-extrabold">
                <tr>
                  <th className="text-left px-4 py-2.5">Name / title</th>
                  <th className="text-left px-4 py-2.5">Contact</th>
                  <th className="text-right px-4 py-2.5">Spend</th>
                  <th className="text-right px-4 py-2.5">Leads</th>
                  <th className="text-right px-4 py-2.5">Cost / lead</th>
                  <th className="text-right px-4 py-2.5">Admissions</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {loaded && users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      No marketing users yet. Use <b>Add Marketing User</b> to create one.
                    </td>
                  </tr>
                )}
                {users.map((u) => {
                  const s = stats[u._id];
                  return (
                    <tr key={u._id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="font-bold">{u.name}</div>
                        <div className="text-xs font-semibold text-fuchsia-600">{u.designation || DEFAULT_MARKETING_TITLE}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div>{u.email}</div>
                        <div>{u.phone || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-right">{inr(s?.spend)}</td>
                      <td className="px-4 py-3 text-right">{s?.leads ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-bold">{inr(s?.costPerLead)}</td>
                      <td className="px-4 py-3 text-right">{s?.admissions ?? "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit(u)} className="text-xs font-bold text-indigo-600 hover:underline mr-3 cursor-pointer">
                          Edit
                        </button>
                        <button onClick={() => remove(u)} className="text-xs font-bold text-rose-600 hover:underline cursor-pointer">
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
          >
            <h2 className="text-base font-black">{editingId ? "Edit marketing user" : "Add marketing user"}</h2>
            <div>
              <label className={label}>Full name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} />
            </div>
            <div>
              <label className={label}>Email (login) *</label>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
            </div>
            <div>
              <label className={label}>{editingId ? "New password (leave blank to keep)" : "Password *"}</label>
              <input
                type="password"
                autoComplete="new-password"
                minLength={editingId ? undefined : 6}
                required={!editingId}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className={label}>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} />
            </div>
            <div>
              <label className={label}>Marketing title *</label>
              <select
                value={form.custom ? "__other" : form.designation}
                onChange={(e) =>
                  e.target.value === "__other"
                    ? setForm({ ...form, custom: true, designation: "" })
                    : setForm({ ...form, custom: false, designation: e.target.value })
                }
                className={field}
              >
                {MARKETING_TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="__other">Other (type a title)…</option>
              </select>
              {form.custom && (
                <input
                  required
                  maxLength={80}
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  placeholder="e.g. Google Ads Specialist"
                  className={`${field} mt-2`}
                />
              )}
              <p className="text-[11px] text-slate-500 mt-1">All marketing titles have the same, limited access.</p>
            </div>
            {formError && <p className="text-sm font-semibold text-rose-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-bold rounded-xl border border-slate-300 cursor-pointer">
                Cancel
              </button>
              <button disabled={saving} className="px-4 py-2 text-sm font-bold rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white disabled:opacity-50 cursor-pointer">
                {saving ? "Saving…" : editingId ? "Save changes" : "Create user"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
