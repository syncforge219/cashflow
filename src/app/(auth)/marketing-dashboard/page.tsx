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

function periodPresets() {
  const today = todayKey();
  const thisMonth = monthBoundsKey(today);
  const lastMonth = monthBoundsKey(addDaysKey(thisMonth.first, -1));
  return [
    { id: "month", label: "This Month", from: thisMonth.first, to: today },
    { id: "last", label: "Last Month", from: lastMonth.first, to: lastMonth.last },
    { id: "30", label: "Last 30 Days", from: addDaysKey(today, -29), to: today },
    { id: "90", label: "Last 90 Days", from: addDaysKey(today, -89), to: today },
  ];
}

export default function MarketingDashboardPage() {
  const { user, logout } = useUser();
  const [tab, setTab] = useState<Tab>("overview");
  const presets = useMemo(() => periodPresets(), []);
  const [selectedPreset, setSelectedPreset] = useState("month");
  const [from, setFrom] = useState(presets[0].from);
  const [to, setTo] = useState(presets[0].to);
  const [viewUserId, setViewUserId] = useState("");

  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [spend, setSpend] = useState<any[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [connector, setConnector] = useState<"justdial" | "facebook" | null>(null);
  const [fbConfig, setFbConfig] = useState<any>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams({ from, to });
    if (viewUserId) p.set("userId", viewUserId);
    return p.toString();
  }, [from, to, viewUserId]);

  const currentKey = `${query}|${reloadKey}`;
  const loading = loadedKey !== currentKey;
  const loadFbConfig = () => {
    fetch("/api/facebook-integration")
      .then((r) => r.json())
      .then((d) => d.success && setFbConfig(d.data))
      .catch(() => {});
  };

  const loadAll = () => {
    setReloadKey((k) => k + 1);
    loadFbConfig();
  };

  useEffect(() => {
    fetch("/api/marketing/lookups")
      .then((r) => r.json())
      .then((d) => d.success && setLookups(d.data))
      .catch(() => {});
    loadFbConfig();
  }, []);

  // Listen for Facebook OAuth redirect callbacks in the URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const fbConnected = sp.get("fb_connected");
    const fbPage = sp.get("fb_page");
    const fbErr = sp.get("fb_error");
    const fbModal = sp.get("fb_modal");

    if (fbConnected === "true") {
      setBanner({
        type: "success",
        text: `🎉 Successfully connected to Facebook! Active page: "${fbPage || "Lead Ads Page"}". Incoming leads are now syncing automatically.`,
      });
      setTab("connectors");
      loadFbConfig();
      const cleanUrl = window.location.pathname + (sp.get("tab") ? "?tab=" + sp.get("tab") : "");
      window.history.replaceState({}, "", cleanUrl);
    } else if (fbErr) {
      setBanner({
        type: "error",
        text: `❌ Facebook Connection Notice: ${fbErr}`,
      });
      setTab("connectors");
      if (fbModal === "true") {
        setConnector("facebook");
      }
      const cleanUrl = window.location.pathname + (sp.get("tab") ? "?tab=" + sp.get("tab") : "");
      window.history.replaceState({}, "", cleanUrl);
    } else if (sp.get("tab") === "connectors") {
      setTab("connectors");
    }
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
        if (!s.success) setBanner({ type: "error", text: s.error || "Could not load marketing figures." });
      })
      .catch((err) => !cancelled && setBanner({ type: "error", text: err.message }))
      .finally(() => !cancelled && setLoadedKey(`${query}|${reloadKey}`));
    return () => {
      cancelled = true;
    };
  }, [query, reloadKey]);

  const isAdmin = Boolean(lookups?.isAdmin);
  const totals = summary?.totals;

  const tabs: { id: Tab; label: string; icon: string; count?: number; hidden?: boolean }[] = [
    { id: "overview", label: "ROI & Analytics", icon: "📊" },
    { id: "add", label: "Add Lead", icon: "➕", hidden: isAdmin },
    { id: "leads", label: "My Leads", icon: "👥", count: leads.length },
    { id: "spend", label: "Spend Log", icon: "💸", count: spend.length },
    { id: "connectors", label: "Connectors", icon: "⚡", hidden: isAdmin },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-[#f8faff] to-indigo-50/20 text-slate-800 font-sans pb-16">
      {/* Top Accent Gradient Line */}
      <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 via-purple-600 to-pink-500 w-full" />

      {/* Glassmorphic Navbar */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black shadow-md shadow-indigo-500/20 text-lg">
              🎯
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900 tracking-tight">Marketing Command Center</h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Attribution
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {isAdmin ? "Super Admin global marketing intelligence & campaign attribution" : "Track campaign performance, acquisition costs, and student conversion"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl px-3.5 py-1.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "ME"}
              </div>
              <div className="text-left leading-tight pr-1">
                <div className="text-xs font-bold text-slate-800">{user?.name || "Marketing User"}</div>
                {(user as any)?.designation ? (
                  <div className="text-[10px] font-extrabold text-indigo-600">{(user as any).designation}</div>
                ) : (
                  <div className="text-[10px] font-semibold text-slate-400 capitalize">{user?.role || "Marketing"}</div>
                )}
              </div>
            </div>

            <button
              onClick={() => logout().then(() => (window.location.href = "/login"))}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-rose-600 rounded-xl border border-slate-200 bg-white hover:bg-rose-50/50 hover:border-rose-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Sign out of account"
            >
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Banner Alert Notification */}
        {banner && (
          <div
            className={`px-4 py-3 rounded-2xl text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in transition-all ${
              banner.type === "success"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200/80 shadow-emerald-500/5"
                : "bg-rose-50 text-rose-900 border border-rose-200/80 shadow-rose-500/5"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{banner.type === "success" ? "✅" : "⚠️"}</span>
              <span>{banner.text}</span>
            </div>
            <button
              onClick={() => setBanner(null)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-black/5 cursor-pointer transition-colors"
              aria-label="Dismiss banner"
            >
              ✕
            </button>
          </div>
        )}

        {/* Hero Banner with Modern Gradient */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 shadow-xl shadow-indigo-950/10 border border-indigo-900/40">
          <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none"></div>
          <div className="absolute right-32 -bottom-10 w-48 h-48 rounded-full bg-purple-500/15 blur-2xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold tracking-wide">
                <span>🚀</span> Growth & Campaign Intelligence
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {isAdmin ? "Campaign Overview & Marketing Performance" : `Welcome back, ${user?.name?.split(" ")[0] || "Marketer"}!`}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Analyze your channel return on investment, cost per lead (CPL), and customer acquisition cost (CAC).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {!isAdmin && (
                <button
                  onClick={() => setTab("add")}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-500/30 transition-all hover:scale-[1.02] cursor-pointer flex items-center gap-1.5"
                >
                  <span>➕</span>
                  <span>New Lead</span>
                </button>
              )}
              <button
                onClick={() => setTab("spend")}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-bold rounded-xl backdrop-blur-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>💸</span>
                <span>Log Spend</span>
              </button>
              <button
                onClick={loadAll}
                className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl transition-all cursor-pointer"
                title="Refresh metrics"
              >
                <span className={`inline-block ${loading ? "animate-spin" : ""}`}>🔄</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Controls & Tabs Toolbar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {tabs
              .filter((t) => !t.hidden)
              .map((t) => {
                const isActive = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                    {t.count !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                          isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>

          {/* Date & User Filtering */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            {isAdmin && (
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <span className="text-xs text-slate-400">👤</span>
                <select
                  value={viewUserId}
                  onChange={(e) => setViewUserId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="">All Marketing Staff</option>
                  {lookups?.marketingUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Presets Segmented Pills */}
            <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60 text-xs">
              {presets.map((p) => {
                const isSelected = selectedPreset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPreset(p.id);
                      setFrom(p.from);
                      setTo(p.to);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-white text-indigo-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Date Pickers */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-slate-400 font-semibold">📅</span>
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedPreset("custom");
                    setFrom(e.target.value);
                  }
                }}
                className="bg-transparent font-bold text-slate-700 text-xs focus:outline-none cursor-pointer"
              />
              <span className="text-slate-400 font-bold px-0.5">→</span>
              <input
                type="date"
                value={to}
                min={from}
                max={todayKey()}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedPreset("custom");
                    setTo(e.target.value);
                  }
                }}
                className="bg-transparent font-bold text-slate-700 text-xs focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {tab === "overview" && (
          <section className="space-y-6">
            {/* 6 Elegant KPI Metric Cards with Hover Gradients */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {[
                {
                  title: "Total Ad Spend",
                  value: inr(totals?.spend),
                  badge: "Ad Budget Outflow",
                  borderAccent: "border-l-4 border-purple-500",
                  hoverGradient: "hover:bg-gradient-to-br hover:from-purple-50/80 hover:via-indigo-50/40 hover:to-white",
                  pillClass: "text-purple-700 bg-purple-50 border-purple-200/60",
                  icon: "💳",
                },
                {
                  title: "Leads Generated",
                  value: totals?.leads ?? "—",
                  badge: "Inbound Pipeline",
                  borderAccent: "border-l-4 border-blue-500",
                  hoverGradient: "hover:bg-gradient-to-br hover:from-blue-50/80 hover:via-indigo-50/40 hover:to-white",
                  pillClass: "text-blue-700 bg-blue-50 border-blue-200/60",
                  icon: "👥",
                },
                {
                  title: "Cost Per Lead",
                  value: inr(totals?.costPerLead),
                  badge: "CPL Efficiency",
                  borderAccent: "border-l-4 border-emerald-500",
                  hoverGradient: "hover:bg-gradient-to-br hover:from-emerald-50/80 hover:via-teal-50/40 hover:to-white",
                  pillClass: "text-emerald-700 bg-emerald-50 border-emerald-200/60",
                  icon: "🎯",
                },
                {
                  title: "Admissions",
                  value: totals?.admissions ?? "—",
                  badge: "Enrolled Students",
                  borderAccent: "border-l-4 border-teal-500",
                  hoverGradient: "hover:bg-gradient-to-br hover:from-teal-50/80 hover:via-emerald-50/40 hover:to-white",
                  pillClass: "text-teal-700 bg-teal-50 border-teal-200/60",
                  icon: "🎓",
                },
                {
                  title: "Cost / Admission",
                  value: inr(totals?.costPerAdmission),
                  badge: "Customer Acquisition",
                  borderAccent: "border-l-4 border-amber-500",
                  hoverGradient: "hover:bg-gradient-to-br hover:from-amber-50/80 hover:via-orange-50/40 hover:to-white",
                  pillClass: "text-amber-800 bg-amber-50 border-amber-200/60",
                  icon: "💰",
                },
                {
                  title: "Conversion Rate",
                  value: totals?.conversionPct === null || totals?.conversionPct === undefined ? "—" : `${totals.conversionPct}%`,
                  badge: "Lead → Admission",
                  borderAccent: "border-l-4 border-fuchsia-500",
                  hoverGradient: "hover:bg-gradient-to-br hover:from-fuchsia-50/80 hover:via-purple-50/40 hover:to-white",
                  pillClass: "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200/60",
                  icon: "⚡",
                },
              ].map((card, idx) => (
                <div
                  key={idx}
                  className={`bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${card.borderAccent} ${card.hoverGradient}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {card.title}
                    </span>
                    <span className="text-sm">{card.icon}</span>
                  </div>

                  <div className="my-2.5">
                    <span className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                      {loading ? "…" : card.value}
                    </span>
                  </div>

                  <span className={`text-[9.5px] font-bold rounded-md px-2 py-0.5 w-fit border ${card.pillClass}`}>
                    {card.badge}
                  </span>
                </div>
              ))}
            </div>

            {/* Performance Breakdown Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SummaryTable
                title="Lead Source Performance"
                subtitle="Cost per lead and conversion across acquisition channels"
                icon="📡"
                rows={summary?.bySource || []}
              />
              <SummaryTable
                title="Campaign Attribution"
                subtitle="Performance breakdown by ad campaign tags"
                icon="📢"
                rows={summary?.byCampaign || []}
                empty="Add campaign names when logging leads or spend to view campaign ROI."
              />
            </div>

            {/* Insight Note */}
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-600">
              <span className="text-base text-indigo-600 mt-0.5">💡</span>
              <div className="space-y-0.5">
                <span className="font-bold text-indigo-900 block">Attribution & Cost Formula</span>
                <p>
                  Cost per lead = Total Spend ÷ Total Leads from the matching source in this period.
                  Ensure you log ad spend under the identical source name (e.g. &ldquo;Meta Ads&rdquo; or &ldquo;JustDial&rdquo;) to guarantee 100% accurate CPL and CAC calculations.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* TAB 2: ADD LEAD */}
        {tab === "add" && lookups && (
          <AddLeadForm
            lookups={lookups}
            onAdded={(msg) => {
              setBanner({ type: "success", text: msg });
              loadAll();
              setTab("leads");
            }}
            onError={(msg) => setBanner({ type: "error", text: msg })}
          />
        )}

        {/* TAB 3: MY LEADS */}
        {tab === "leads" && <LeadsTable leads={leads} showAddedBy={isAdmin} />}

        {/* TAB 4: SPEND LOG */}
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

        {/* TAB 5: CONNECTORS */}
        {tab === "connectors" && (
          <section className="space-y-6">
            <div className="grid md:grid-cols-2 gap-5">
              <ConnectorCard
                title="Justdial Inbound Webhook"
                badge="Automated Sync"
                icon="📞"
                accentColor="from-orange-500 to-amber-500"
                text="Stream incoming leads instantly from Justdial straight into your dashboard. Automatically tags the source as JustDial and credits your lead pipeline."
                features={["Instant SMS & Lead Ingestion", "Auto Course Assignment", "Live Webhook Health Check"]}
                onOpen={() => setConnector("justdial")}
              />
              <ConnectorCard
                title="Facebook & Instagram Lead Ads"
                badge="Meta Connector"
                icon="📸"
                accentColor="from-blue-600 via-indigo-600 to-fuchsia-600"
                text="Direct integration with Meta Graph API. Pull new form responses automatically without manual CSV exports and track exact cost per lead."
                features={["Instant Form Sync", "Direct Counsellor Assignment", "Retroactive Lead Pulling"]}
                isConnected={Boolean(fbConfig?.isConnected)}
                statusText={
                  fbConfig?.isConnected
                    ? `Active Page: ${fbConfig?.pageName || "(Connected)"}`
                    : undefined
                }
                onOpen={() => setConnector("facebook")}
                onConnect={() => {
                  if (fbConfig?.hasAppId && fbConfig?.hasAppSecret) {
                    window.location.href = `/api/facebook-integration/oauth/init?returnUrl=${encodeURIComponent("/marketing-dashboard?tab=connectors")}`;
                  } else {
                    setConnector("facebook");
                  }
                }}
                connectButtonText="Connect with Facebook"
              />
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex items-center gap-3.5 shadow-2xs">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg shrink-0">
                🔒
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                <span className="font-bold text-slate-800 block text-sm">Lead Ownership & Attribution Protection</span>
                Leads arriving through a connector configured with your credentials are automatically assigned to your marketing portfolio.
                Their source will be tagged as &ldquo;JustDial&rdquo; or &ldquo;Meta Ads&rdquo;.
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Integration Modals */}
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

// -------------------------------------------------------------
// SUB-COMPONENTS WITH ENHANCED STYLING
// -------------------------------------------------------------

function SummaryTable({
  title,
  subtitle,
  icon,
  rows,
  empty,
}: {
  title: string;
  subtitle: string;
  icon: string;
  rows: SummaryRow[];
  empty?: string;
}) {
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden flex flex-col justify-between">
      <div>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{icon}</span>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">{title}</h3>
              <p className="text-[11px] text-slate-500 font-medium">{subtitle}</p>
            </div>
          </div>
          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {rows.length} {rows.length === 1 ? "Channel" : "Channels"}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <div className="text-2xl">🔍</div>
            <p className="text-xs font-semibold text-slate-500">{empty || "No leads or spend recorded for this period."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/80 text-[10px] uppercase text-slate-400 font-extrabold border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3">Channel / Tag</th>
                  <th className="text-right px-4 py-3">Spend</th>
                  <th className="text-right px-4 py-3">Leads</th>
                  <th className="text-right px-4 py-3">CPL</th>
                  <th className="text-right px-4 py-3">Admissions</th>
                  <th className="text-right px-4 py-3">CAC</th>
                  <th className="text-right px-5 py-3">Conv %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                      <span>{r.label}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-slate-700">{inr(r.spend)}</td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-900">{r.leads}</td>
                    <td className="px-4 py-3.5 text-right font-extrabold text-emerald-600 bg-emerald-50/30">
                      {inr(r.costPerLead)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-800">{r.admissions}</td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-600">{inr(r.costPerAdmission)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {r.conversionPct === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={`font-black px-2 py-0.5 rounded-md text-[10px] ${
                            r.conversionPct >= 15
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : r.conversionPct >= 5
                              ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                              : "bg-amber-50 text-amber-700 border border-amber-200/60"
                          }`}
                        >
                          {r.conversionPct}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AddLeadForm({
  lookups,
  onAdded,
  onError,
}: {
  lookups: Lookups;
  onAdded: (m: string) => void;
  onError: (m: string) => void;
}) {
  const blank = {
    name: "",
    phone: "",
    email: "",
    city: "",
    brand: lookups.brands[0] || "",
    course: "",
    source: "",
    campaign: "",
    counsellor: "",
    notes: "",
  };
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
      onAdded(`Lead "${data.data.name}" registered successfully${data.data.enquiryId ? ` (${data.data.enquiryId})` : ""}.`);
      setF({ ...blank, brand: f.brand, source: f.source, campaign: f.campaign });
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all";
  const labelClass = "block text-[11px] font-extrabold text-slate-600 mb-1.5 uppercase tracking-wider";

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base font-bold shadow-2xs">
            📝
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">Manual Inbound Lead Entry</h3>
            <p className="text-[11px] text-slate-500 font-medium">Add walk-ins, phone calls, or direct promotional inquiries</p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Full Student Name *</label>
            <input required value={f.name} onChange={set("name")} placeholder="e.g. Rahul Sharma" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Mobile Number *</label>
            <input
              required
              inputMode="numeric"
              value={f.phone}
              onChange={set("phone")}
              placeholder="10-digit mobile number"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Email Address</label>
            <input type="email" value={f.email} onChange={set("email")} placeholder="student@example.com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>City / Location</label>
            <input value={f.city} onChange={set("city")} placeholder="e.g. Noida / Delhi" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Brand Scope *</label>
            <select value={f.brand} onChange={set("brand")} className={inputClass}>
              {lookups.brands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Course of Interest</label>
            <select value={f.course} onChange={set("course")} className={inputClass}>
              <option value="">General Inflow / Not Decided</option>
              {lookups.courses.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Lead Source *</label>
            <input
              required
              list="mk-sources"
              value={f.source}
              onChange={set("source")}
              placeholder="e.g. Meta Ads, Google Ads"
              className={inputClass}
            />
            <datalist id="mk-sources">
              {lookups.leadSources.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={labelClass}>Campaign Tag</label>
            <input
              value={f.campaign}
              onChange={set("campaign")}
              placeholder="e.g. AutoCAD Summer Promo"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Assign to Counsellor</label>
            <select value={f.counsellor} onChange={set("counsellor")} className={inputClass}>
              <option value="">Unassigned (Pooled for Team)</option>
              {lookups.counsellors.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className={labelClass}>Follow-up Notes / Query Details</label>
            <textarea
              value={f.notes}
              onChange={set("notes")}
              rows={3}
              placeholder="Any specific inquiry context, student requirements, or callback preferences..."
              className={inputClass}
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-50 cursor-pointer transition-all hover:scale-[1.01]"
          >
            {saving ? "Registering Lead…" : "Save & Add Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LeadsTable({ leads, showAddedBy }: { leads: any[]; showAddedBy: boolean }) {
  const [q, setQ] = useState("");
  const shown = leads.filter(
    (l) =>
      !q ||
      `${l.name} ${l.phone} ${l.source} ${l.campaign} ${l.course} ${l.brand}`
        .toLowerCase()
        .includes(q.toLowerCase())
  );

  return (
    <section className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2 max-w-sm w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
          <span className="text-slate-400 text-sm">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search leads by name, phone, channel..."
            className="w-full text-xs font-semibold text-slate-800 bg-transparent focus:outline-none"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">
              ✕
            </button>
          )}
        </div>

        <div className="text-xs font-bold text-slate-500">
          Showing <span className="text-slate-900 font-black">{shown.length}</span> of {leads.length} leads
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50/80 text-[10px] uppercase text-slate-400 font-extrabold border-b border-slate-100">
            <tr>
              <th className="text-left px-5 py-3">Date</th>
              <th className="text-left px-4 py-3">Student Contact</th>
              <th className="text-left px-4 py-3">Brand & Course</th>
              <th className="text-left px-4 py-3">Source Channel</th>
              <th className="text-left px-4 py-3">Campaign</th>
              <th className="text-center px-4 py-3">Converted</th>
              {showAddedBy && <th className="text-left px-5 py-3">Logged By</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-semibold">
                  No leads found matching your criteria.
                </td>
              </tr>
            ) : (
              shown.map((l) => (
                <tr key={l._id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-medium">
                    {formatDate(l.createdAt)}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-extrabold text-slate-900">{l.name}</div>
                    <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                      <span>{l.phone}</span>
                      <a
                        href={`https://wa.me/91${l.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-1 rounded font-bold"
                        title="Chat on WhatsApp"
                      >
                        WhatsApp
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 mb-0.5">
                      {l.brand}
                    </span>
                    <div className="text-[11px] text-slate-600 font-medium">{l.course || "General Inflow"}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      {l.source || "Direct"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600 font-medium">{l.campaign || "—"}</td>
                  <td className="px-4 py-3.5 text-center">
                    {l.converted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                        <span>✓</span> Admitted
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">In Pipeline</span>
                    )}
                  </td>
                  {showAddedBy && (
                    <td className="px-5 py-3.5 text-slate-600 font-bold text-[11px]">
                      {l.addedBy || "System Connector"}
                    </td>
                  )}
                </tr>
              ))
            )}
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
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });
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
      onChanged("Marketing spend logged successfully.");
    } catch (err: any) {
      onChanged(err.message || "Could not save spend entry.", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Are you sure you want to remove this spend entry?")) return;
    const data = await (await fetch(`/api/marketing/spend?id=${id}`, { method: "DELETE" })).json();
    onChanged(data.message || data.error, data.success ? "success" : "error");
  };

  const inputClass =
    "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all";
  const labelClass = "block text-[10px] font-extrabold text-slate-500 mb-1 uppercase tracking-wider";

  return (
    <section className="space-y-6">
      {canAdd && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-slate-100">
            <span className="text-base">💸</span>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">Record Campaign Ad Spend</h3>
          </div>

          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <div>
              <label className={labelClass}>Spend Date *</label>
              <input type="date" required value={f.date} max={todayKey()} onChange={set("date")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Ad Channel *</label>
              <input
                required
                list="mk-spend-sources"
                value={f.source}
                onChange={set("source")}
                placeholder="e.g. Meta Ads"
                className={inputClass}
              />
              <datalist id="mk-spend-sources">
                {lookups?.leadSources.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelClass}>Campaign Tag</label>
              <input value={f.campaign} onChange={set("campaign")} placeholder="e.g. Oct Promo" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Brand</label>
              <select value={f.brand} onChange={set("brand")} className={inputClass}>
                <option value="">All Brands</option>
                {lookups?.brands.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Amount (₹) *</label>
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={f.amount}
                onChange={set("amount")}
                placeholder="₹ Amount"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-md shadow-purple-600/20 disabled:opacity-50 cursor-pointer transition-all hover:scale-[1.01]"
            >
              {saving ? "Saving…" : "Save Spend"}
            </button>
          </form>
        </div>
      )}

      {/* Spend Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">Period Spend Audit</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold">Total Inflow Outlay:</span>
            <span className="text-base font-black text-slate-900 bg-purple-50 text-purple-700 border border-purple-200/80 px-3 py-0.5 rounded-xl">
              {inr(total)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/80 text-[10px] uppercase text-slate-400 font-extrabold border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-left px-4 py-3">Channel / Source</th>
                <th className="text-left px-4 py-3">Campaign Tag</th>
                <th className="text-left px-4 py-3">Brand</th>
                <th className="text-right px-4 py-3">Amount</th>
                {!canAdd && <th className="text-left px-4 py-3">Submitted By</th>}
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 font-semibold">
                    No marketing spend logged in this period.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-medium">
                      {formatDate(r.date)}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-800">{r.source}</td>
                    <td className="px-4 py-3.5 text-slate-600">{r.campaign || "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {r.brand || "All Brands"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-slate-900">{inr(r.amount)}</td>
                    {!canAdd && <td className="px-4 py-3.5 font-semibold text-slate-600">{r.userName}</td>}
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => remove(r._id)}
                        className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ConnectorCard({
  title,
  badge,
  icon,
  accentColor,
  text,
  features,
  isConnected,
  statusText,
  onOpen,
  onConnect,
  connectButtonText = "Connect with Facebook",
}: {
  title: string;
  badge: string;
  icon: string;
  accentColor: string;
  text: string;
  features: string[];
  isConnected?: boolean;
  statusText?: string;
  onOpen: () => void;
  onConnect?: () => void;
  connectButtonText?: string;
}) {
  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
      <div className={`h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r ${accentColor}`} />

      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl p-2 rounded-2xl bg-slate-50 border border-slate-200/60 shadow-2xs">{icon}</span>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">{title}</h3>
              <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">{badge}</span>
            </div>
          </div>
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Connected</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
              <span>Ready</span>
            </span>
          )}
        </div>

        {statusText && (
          <div className="mb-3 px-3 py-1.5 bg-blue-50/70 border border-blue-100 rounded-xl text-[11px] font-bold text-blue-800 flex items-center justify-between">
            <span>{statusText}</span>
          </div>
        )}

        <p className="text-xs text-slate-600 leading-relaxed mb-4">{text}</p>

        <ul className="space-y-1.5 mb-6 text-xs text-slate-700">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-emerald-500 font-bold">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        {onConnect && !isConnected && (
          <button
            onClick={onConnect}
            className="w-full py-2.5 bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-black rounded-xl shadow-md transition-all hover:scale-[1.01] cursor-pointer flex items-center justify-center gap-2"
          >
            <span className="w-4 h-4 rounded-full bg-white text-[#1877F2] font-black flex items-center justify-center text-[10px] leading-none">
              f
            </span>
            <span>{connectButtonText}</span>
            <span>→</span>
          </button>
        )}
        <button
          onClick={onOpen}
          className={`w-full py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-[1.01] cursor-pointer flex items-center justify-center gap-2 ${
            isConnected
              ? "bg-slate-900 hover:bg-slate-800 text-white"
              : onConnect
              ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
              : "bg-slate-900 hover:bg-slate-800 text-white"
          }`}
        >
          <span>{isConnected ? "Configure & Manage Integration" : "Configure Integration"}</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
