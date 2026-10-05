"use client";

import { toDateKey } from "@/lib/dates";
import React, { useState, useEffect, useCallback } from "react";

interface FormMapping {
  formId: string;
  formName: string;
  course: string;
  brand: string;
  counselorName: string;
}

interface MetaForm {
  id: string;
  name: string;
  status?: string;
  leadsCount?: number;
}

interface FacebookLeadsIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  counsellorsList: any[];
  dbLeadSources: any[];
  brandsList?: any[];
  onConfigSaved?: () => void;
}

type Tab = "connection" | "routing" | "test" | "pull" | "logs";

const LEAD_STAGES = ["New / Fresh Inquiry", "Hot Lead", "Follow-up Required", "Admitted", "Closed / Lost"];
const inputCls =
  "w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1877F2]";
const labelCls = "text-xs font-extrabold text-slate-700";

const counsellorName = (c: any) => `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.name || c.email;
const emptyMapping = (): FormMapping => ({ formId: "", formName: "", course: "", brand: "", counselorName: "" });

function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <label className={labelCls}>{label}</label>
      <div className="flex gap-2">
        <input readOnly value={value} className={`${inputCls} font-mono`} />
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="shrink-0 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg cursor-pointer"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#1877F2]"
      />
      {label}
    </label>
  );
}

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DUPLICATE: "bg-amber-50 text-amber-700 border-amber-200",
  FAILED: "bg-rose-50 text-rose-700 border-rose-200",
  UNAUTHORIZED: "bg-slate-100 text-slate-700 border-slate-300",
};

export default function FacebookLeadsIntegrationModal({
  isOpen,
  onClose,
  counsellorsList,
  dbLeadSources,
  brandsList: initialBrandsList,
  onConfigSaved,
}: FacebookLeadsIntegrationModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("connection");

  // Connection
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [graphApiVersion, setGraphApiVersion] = useState("v26.0");
  const [verifyToken, setVerifyToken] = useState("");
  const [pageAccessToken, setPageAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [hasPageAccessToken, setHasPageAccessToken] = useState(false);
  const [hasAppSecret, setHasAppSecret] = useState(false);

  // Defaults & automation
  const [leadSource, setLeadSource] = useState("Meta Ads");
  const [leadStage, setLeadStage] = useState("New / Fresh Inquiry");
  const [defaultBrand, setDefaultBrand] = useState("CADD MANTRA");
  const [counselorName, setCounselorName] = useState("");
  const [defaultCourse, setDefaultCourse] = useState("");
  const [sendWelcomeWhatsApp, setSendWelcomeWhatsApp] = useState(true);
  const [sendAdminAlertWhatsApp, setSendAdminAlertWhatsApp] = useState(true);
  const [createFollowUpTask, setCreateFollowUpTask] = useState(true);

  const [formMappings, setFormMappings] = useState<FormMapping[]>([]);
  const [stats, setStats] = useState<any>({});

  // Lookups
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [brandsList, setBrandsList] = useState<any[]>(initialBrandsList || []);
  const [sourcesList, setSourcesList] = useState<any[]>(dbLeadSources || []);

  // Meta connection check
  const [connection, setConnection] = useState<any | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Test lead
  const [testName, setTestName] = useState("Aarav Sharma");
  const [testPhone, setTestPhone] = useState("+91 98765 43210");
  const [testEmail, setTestEmail] = useState("aarav.sharma@example.com");
  const [testCity, setTestCity] = useState("Lucknow");
  const [testCourse, setTestCourse] = useState("");
  const [testFormId, setTestFormId] = useState("");
  const [testSendWhatsApp, setTestSendWhatsApp] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Pull sync
  const [pullSince, setPullSince] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toDateKey(d);
  });
  const [isPulling, setIsPulling] = useState(false);
  const [pullResult, setPullResult] = useState<any | null>(null);

  // Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsSearch, setLogsSearch] = useState("");
  const [logsStatus, setLogsStatus] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadConfig = useCallback(() => {
    fetch("/api/facebook-integration")
      .then((res) => res.json())
      .then((result) => {
        if (!result.success || !result.data) {
          if (result.error) setBanner({ type: "error", message: result.error });
          return;
        }
        const d = result.data;
        setPageId(d.pageId || "");
        setPageName(d.pageName || "");
        setGraphApiVersion(d.graphApiVersion || "v26.0");
        setVerifyToken(d.verifyToken || "");
        setHasPageAccessToken(Boolean(d.hasPageAccessToken));
        setHasAppSecret(Boolean(d.hasAppSecret));
        setPageAccessToken("");
        setAppSecret("");
        setLeadSource(d.leadSource || "Meta Ads");
        setLeadStage(d.leadStage || "New / Fresh Inquiry");
        setDefaultBrand(d.defaultBrand || "CADD MANTRA");
        setCounselorName(d.counselorName || "");
        setDefaultCourse(d.defaultCourse || "");
        setSendWelcomeWhatsApp(d.sendWelcomeWhatsApp !== false);
        setSendAdminAlertWhatsApp(d.sendAdminAlertWhatsApp !== false);
        setCreateFollowUpTask(d.createFollowUpTask !== false);
        setFormMappings(Array.isArray(d.formMappings) ? d.formMappings : []);
        setStats(d.stats || {});
      })
      .catch((err) => setBanner({ type: "error", message: `Could not load settings: ${err.message}` }));
  }, []);

  const fetchLogs = useCallback((status: string = logsStatus) => {
    setIsLoadingLogs(true);
    const params = new URLSearchParams();
    if (logsSearch) params.set("search", logsSearch);
    if (status !== "ALL") params.set("status", status);
    fetch(`/api/facebook-integration/logs?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) setLogs(data.data);
      })
      .catch(console.error)
      .finally(() => setIsLoadingLogs(false));
  }, [logsSearch, logsStatus]);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/courses")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) setCoursesList(data.data);
        else if (Array.isArray(data.courses)) setCoursesList(data.courses);
      })
      .catch(console.error);
    fetch("/api/brands")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) setBrandsList(data.data);
        else if (data.success && Array.isArray(data.brands)) setBrandsList(data.brands);
      })
      .catch(console.error);
    fetch("/api/lead-sources")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) setSourcesList(data.data);
      })
      .catch(console.error);
    loadConfig();
  }, [isOpen, loadConfig]);

  if (!isOpen) return null;

  // The modal only renders client-side (closed on first render), so window is available here
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/enquiries/facebook-webhook`;

  const openTab = (tab: Tab, status?: string) => {
    setActiveTab(tab);
    if (status) setLogsStatus(status);
    if (tab === "logs") fetchLogs(status ?? logsStatus);
  };
  const isLocalOrigin = /localhost|127\.0\.0\.1/.test(origin);

  const handleSave = async (): Promise<boolean> => {
    setIsSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/api/facebook-integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          graphApiVersion,
          verifyToken,
          pageAccessToken,
          appSecret,
          leadSource,
          leadStage,
          defaultBrand,
          counselorName,
          defaultCourse,
          sendWelcomeWhatsApp,
          sendAdminAlertWhatsApp,
          createFollowUpTask,
          formMappings: formMappings.filter((m) => m.formId.trim()),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Save failed");
      setBanner({ type: "success", message: "✅ Facebook Lead Ads connector saved." });
      loadConfig();
      onConfigSaved?.();
      return true;
    } catch (err: any) {
      setBanner({ type: "error", message: err.message });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckConnection = async () => {
    setIsChecking(true);
    setConnection(null);
    try {
      // Save first so the check uses what is on screen
      if (!(await handleSave())) return;
      const data = await (await fetch("/api/facebook-integration/connect")).json();
      setConnection(data);
      if (data.success) {
        setPageName(data.page?.name || "");
      }
    } catch (err: any) {
      setConnection({ success: false, error: err.message });
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const data = await (await fetch("/api/facebook-integration/connect", { method: "POST" })).json();
      setBanner({ type: data.success ? "success" : "error", message: data.message || data.error });
      if (data.success) setConnection((c: any) => (c ? { ...c, leadgenSubscribed: true } : c));
    } catch (err: any) {
      setBanner({ type: "error", message: err.message });
    } finally {
      setIsSubscribing(false);
    }
  };

  const regenerateVerifyToken = () => {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    setVerifyToken(`fb-verify-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`);
  };

  const addFormsFromPage = () => {
    const forms: MetaForm[] = connection?.forms || [];
    const existing = new Set(formMappings.map((m) => m.formId));
    const added = forms
      .filter((f) => !existing.has(f.id))
      .map((f) => ({ ...emptyMapping(), formId: f.id, formName: f.name }));
    setFormMappings([...formMappings, ...added]);
    setBanner({
      type: "success",
      message: added.length
        ? `Added ${added.length} form(s). Pick a course/brand/counsellor for each, then Save.`
        : "All page forms are already mapped.",
    });
  };

  const updateMapping = (index: number, field: keyof FormMapping, value: string) => {
    setFormMappings(formMappings.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/facebook-integration/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: testName,
          phone: testPhone,
          email: testEmail,
          city: testCity,
          course: testCourse,
          formId: testFormId,
          sendLiveWhatsApp: testSendWhatsApp,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        loadConfig();
        onConfigSaved?.();
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    setPullResult(null);
    try {
      const res = await fetch("/api/facebook-integration/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since: pullSince }),
      });
      const data = await res.json();
      setPullResult(data);
      if (data.imported > 0) onConfigSaved?.();
      loadConfig();
    } catch (err: any) {
      setPullResult({ success: false, error: err.message });
    } finally {
      setIsPulling(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Clear failed and duplicate log entries? Successful imports are kept.")) return;
    const data = await (await fetch("/api/facebook-integration/logs", { method: "DELETE" })).json();
    setBanner({ type: data.success ? "success" : "error", message: data.message || data.error });
    fetchLogs();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "connection", label: "🔌 Connection" },
    { id: "routing", label: `🗺️ Form Routing (${formMappings.length})` },
    { id: "test", label: "🧪 Test Lead" },
    { id: "pull", label: "🔄 Pull Sync" },
    { id: "logs", label: "📜 Activity Logs" },
  ];

  const isConfigured = hasPageAccessToken && Boolean(pageId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] my-auto">
        {/* HEADER */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center text-2xl font-black shadow-inner">
              f
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight">Facebook & Instagram Lead Ads Connector</h2>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${
                    isConfigured
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? "bg-emerald-400" : "bg-amber-400"}`}></span>
                  {isConfigured ? `Connected${pageName ? ` · ${pageName}` : ""}` : "Not connected"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Leads from Meta Lead Ads forms become enquiries instantly, with course routing, tasks & WhatsApp alerts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-black rounded-lg cursor-pointer shadow-md disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "💾 Save Settings"}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {banner && (
          <div
            className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
              banner.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <span>{banner.message}</span>
            <button onClick={() => setBanner(null)} className="hover:opacity-70 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* TABS + STATS */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => openTab(t.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap cursor-pointer ${
                  activeTab === t.id ? "bg-[#1877F2] text-white" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="bg-white px-3 py-1 rounded-lg border border-slate-200">
              <span className="text-slate-400 font-bold text-[10px]">IMPORTED: </span>
              <span className="font-black text-slate-800">{stats.totalLeadsReceived || 0}</span>
            </div>
            {stats.lastLeadReceivedAt && (
              <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 hidden md:block">
                <span className="text-slate-400 font-bold text-[10px]">LAST LEAD: </span>
                <span className="font-bold text-slate-700">
                  {new Date(stats.lastLeadReceivedAt).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            {stats.failedLogsCount > 0 && (
              <button
                onClick={() => openTab("logs", "FAILED")}
                className="bg-rose-50 text-rose-700 px-3 py-1 rounded-lg border border-rose-200 font-bold cursor-pointer"
              >
                ⚠ {stats.failedLogsCount} failed
              </button>
            )}
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {activeTab === "connection" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Setup guide */}
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-black text-slate-800">Setup in 4 steps</h3>
                  <ol className="list-decimal pl-5 text-xs text-slate-700 space-y-1.5 font-medium">
                    <li>
                      In <b>Meta for Developers</b>, open your app → <b>Webhooks</b> → choose <b>Page</b> → paste the
                      Callback URL and Verify Token below → subscribe to the <b>leadgen</b> field.
                    </li>
                    <li>
                      Generate a long-lived <b>Page Access Token</b> for your page with permissions{" "}
                      <code className="text-[10px] bg-white px-1 rounded">leads_retrieval</code>,{" "}
                      <code className="text-[10px] bg-white px-1 rounded">pages_manage_metadata</code>,{" "}
                      <code className="text-[10px] bg-white px-1 rounded">pages_show_list</code>,{" "}
                      <code className="text-[10px] bg-white px-1 rounded">pages_read_engagement</code>,{" "}
                      <code className="text-[10px] bg-white px-1 rounded">ads_management</code>.
                    </li>
                    <li>Enter the Page ID, Page Access Token and App Secret here, then click <b>Check Connection</b>.</li>
                    <li>
                      Click <b>Subscribe Page</b>, map your forms in <b>Form Routing</b>, and send a test lead from
                      Meta&apos;s <b>Lead Ads Testing Tool</b>.
                    </li>
                  </ol>
                </div>

                <CopyRow
                  label="Webhook Callback URL"
                  value={webhookUrl}
                  hint={
                    isLocalOrigin
                      ? "⚠ This is a localhost address. Meta needs a public HTTPS URL — use your deployed domain."
                      : "Meta must be able to reach this over HTTPS."
                  }
                />
                <div className="space-y-1">
                  <CopyRow label="Verify Token" value={verifyToken || "(save to generate)"} />
                  <button
                    type="button"
                    onClick={regenerateVerifyToken}
                    className="text-[11px] font-bold text-[#1877F2] hover:underline cursor-pointer"
                  >
                    ↻ Generate a new token (then Save, and update it in Meta)
                  </button>
                </div>

                {/* Connection status */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleCheckConnection}
                      disabled={isChecking}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      {isChecking ? "Checking..." : "🔍 Save & Check Connection"}
                    </button>
                    <button
                      onClick={handleSubscribe}
                      disabled={isSubscribing || !connection?.success}
                      title={!connection?.success ? "Check the connection first" : ""}
                      className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-black rounded-lg cursor-pointer disabled:opacity-40"
                    >
                      {isSubscribing ? "Subscribing..." : "🔔 Subscribe Page to Leads"}
                    </button>
                  </div>
                  {connection && !connection.success && (
                    <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                      ✕ {connection.error}
                    </p>
                  )}
                  {connection?.success && (
                    <div className="text-xs space-y-1 text-slate-700">
                      <p>
                        ✅ Token valid for page <b>{connection.page?.name}</b> ({connection.page?.id})
                      </p>
                      <p>
                        {connection.leadgenSubscribed ? "✅" : "⚠"} Page lead notifications:{" "}
                        <b>{connection.leadgenSubscribed ? "subscribed" : "not subscribed — click Subscribe Page"}</b>
                      </p>
                      <p>
                        📋 {connection.forms?.length || 0} Lead Ads form(s) found
                        {connection.forms?.length > 0 && (
                          <button
                            onClick={() => {
                              addFormsFromPage();
                              setActiveTab("routing");
                            }}
                            className="ml-2 text-[#1877F2] font-bold hover:underline cursor-pointer"
                          >
                            → map them
                          </button>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Credentials + defaults */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelCls}>Facebook Page ID*</label>
                    <input value={pageId} onChange={(e) => setPageId(e.target.value.trim())} placeholder="e.g. 1234567890" className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Graph API Version</label>
                    <input value={graphApiVersion} onChange={(e) => setGraphApiVersion(e.target.value.trim())} className={inputCls} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className={labelCls}>Page Access Token*</label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={pageAccessToken}
                      onChange={(e) => setPageAccessToken(e.target.value)}
                      placeholder={hasPageAccessToken ? "Saved (leave blank to keep)" : "EAAG..."}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className={labelCls}>App Secret (recommended)</label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={appSecret}
                      onChange={(e) => setAppSecret(e.target.value)}
                      placeholder={hasAppSecret ? "Saved (leave blank to keep)" : "From App Settings → Basic"}
                      className={`${inputCls} font-mono`}
                    />
                    <p className="text-[11px] text-slate-500">
                      Used to verify that webhook calls really come from Meta (X-Hub-Signature-256).
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <h3 className="sm:col-span-2 text-sm font-black text-slate-800">Defaults for new enquiries</h3>
                  <div className="space-y-1">
                    <label className={labelCls}>Lead Source</label>
                    <select value={leadSource} onChange={(e) => setLeadSource(e.target.value)} className={inputCls}>
                      {!sourcesList.some((s: any) => (s.name || s.sourceName) === leadSource) && (
                        <option value={leadSource}>{leadSource}</option>
                      )}
                      {sourcesList.map((s: any) => (
                        <option key={s._id || s.name || s.sourceName} value={s.name || s.sourceName}>
                          {s.name || s.sourceName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Initial Lead Stage</label>
                    <select value={leadStage} onChange={(e) => setLeadStage(e.target.value)} className={inputCls}>
                      {LEAD_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Default Brand</label>
                    <select value={defaultBrand} onChange={(e) => setDefaultBrand(e.target.value)} className={inputCls}>
                      {!brandsList.some((b: any) => b.name === defaultBrand) && <option value={defaultBrand}>{defaultBrand}</option>}
                      {brandsList.map((b: any) => (
                        <option key={b._id || b.name} value={b.name}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Default Counsellor</label>
                    <select value={counselorName} onChange={(e) => setCounselorName(e.target.value)} className={inputCls}>
                      <option value="">HO (default)</option>
                      {counselorName && !counsellorsList.some((c) => counsellorName(c) === counselorName) && (
                        <option value={counselorName}>{counselorName}</option>
                      )}
                      {counsellorsList.map((c: any) => (
                        <option key={c._id || counsellorName(c)} value={counsellorName(c)}>
                          {counsellorName(c)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className={labelCls}>Default Course (when the form doesn&apos;t say)</label>
                    <select value={defaultCourse} onChange={(e) => setDefaultCourse(e.target.value)} className={inputCls}>
                      <option value="">General Course</option>
                      {coursesList.map((c: any) => (
                        <option key={c._id || c.code || c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap gap-x-5 gap-y-2 pt-1">
                    <Toggle label="Welcome WhatsApp to student" checked={sendWelcomeWhatsApp} onChange={setSendWelcomeWhatsApp} />
                    <Toggle label="WhatsApp alert to admin" checked={sendAdminAlertWhatsApp} onChange={setSendAdminAlertWhatsApp} />
                    <Toggle label="Create follow-up task" checked={createFollowUpTask} onChange={setCreateFollowUpTask} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "routing" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-600 max-w-2xl">
                  Route each Lead Ads form to a course, brand and counsellor. Leads from unmapped forms use the
                  answer to any &quot;course&quot; question on the form, or else the defaults from Connection.
                </p>
                <div className="flex gap-2">
                  {connection?.forms?.length > 0 && (
                    <button
                      onClick={addFormsFromPage}
                      className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer"
                    >
                      ⬇ Add forms from page
                    </button>
                  )}
                  <button
                    onClick={() => setFormMappings([...formMappings, emptyMapping()])}
                    className="px-3 py-2 bg-[#1877F2] text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    + Add form
                  </button>
                </div>
              </div>

              {formMappings.length === 0 ? (
                <div className="text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl p-8">
                  No forms mapped yet. Use <b>Check Connection</b> on the Connection tab to load your page&apos;s forms,
                  or add a Form ID manually.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-extrabold text-[10px] uppercase">
                      <tr>
                        <th className="text-left p-2">Form ID*</th>
                        <th className="text-left p-2">Form Name</th>
                        <th className="text-left p-2">Course</th>
                        <th className="text-left p-2">Brand</th>
                        <th className="text-left p-2">Counsellor</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formMappings.map((m, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="p-2 min-w-[140px]">
                            <input value={m.formId} onChange={(e) => updateMapping(i, "formId", e.target.value.trim())} className={`${inputCls} font-mono`} />
                          </td>
                          <td className="p-2 min-w-[160px]">
                            <input value={m.formName} onChange={(e) => updateMapping(i, "formName", e.target.value)} className={inputCls} />
                          </td>
                          <td className="p-2 min-w-[160px]">
                            <select value={m.course} onChange={(e) => updateMapping(i, "course", e.target.value)} className={inputCls}>
                              <option value="">Use form answer / default</option>
                              {m.course && !coursesList.some((c: any) => c.name === m.course) && <option value={m.course}>{m.course}</option>}
                              {coursesList.map((c: any) => (
                                <option key={c._id || c.code || c.name} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 min-w-[140px]">
                            <select value={m.brand} onChange={(e) => updateMapping(i, "brand", e.target.value)} className={inputCls}>
                              <option value="">Default brand</option>
                              {m.brand && !brandsList.some((b: any) => b.name === m.brand) && <option value={m.brand}>{m.brand}</option>}
                              {brandsList.map((b: any) => (
                                <option key={b._id || b.name} value={b.name}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 min-w-[160px]">
                            <select value={m.counselorName} onChange={(e) => updateMapping(i, "counselorName", e.target.value)} className={inputCls}>
                              <option value="">Default counsellor</option>
                              {m.counselorName && !counsellorsList.some((c) => counsellorName(c) === m.counselorName) && (
                                <option value={m.counselorName}>{m.counselorName}</option>
                              )}
                              {counsellorsList.map((c: any) => (
                                <option key={c._id || counsellorName(c)} value={counsellorName(c)}>
                                  {counsellorName(c)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2 text-right">
                            <button
                              onClick={() => setFormMappings(formMappings.filter((_, idx) => idx !== i))}
                              className="text-rose-600 hover:bg-rose-50 px-2 py-1 rounded font-bold cursor-pointer"
                              aria-label="Remove form mapping"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-slate-500">Remember to click 💾 Save Settings after editing mappings.</p>
            </div>
          )}

          {activeTab === "test" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Runs a fake lead through the real pipeline (routing, enquiry, task) without calling Meta. To test the
                  full webhook path, use Meta&apos;s <b>Lead Ads Testing Tool</b> after connecting.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelCls}>Full Name</label>
                    <input value={testName} onChange={(e) => setTestName(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Phone</label>
                    <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Email</label>
                    <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>City</label>
                    <input value={testCity} onChange={(e) => setTestCity(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>Course answer (optional)</label>
                    <input value={testCourse} onChange={(e) => setTestCourse(e.target.value)} placeholder="e.g. AutoCAD" className={inputCls} />
                  </div>
                  <div className="space-y-1">
                    <label className={labelCls}>As if from form</label>
                    <select value={testFormId} onChange={(e) => setTestFormId(e.target.value)} className={inputCls}>
                      <option value="">Unmapped form</option>
                      {formMappings
                        .filter((m) => m.formId)
                        .map((m) => (
                          <option key={m.formId} value={m.formId}>
                            {m.formName || m.formId}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <Toggle label="Send real WhatsApp messages for this test" checked={testSendWhatsApp} onChange={setTestSendWhatsApp} />
                <button
                  onClick={handleTest}
                  disabled={isTesting}
                  className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-black rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {isTesting ? "Running..." : "🧪 Send Test Lead"}
                </button>
              </div>
              <div>
                {testResult ? (
                  <div
                    className={`rounded-xl border p-4 text-xs space-y-1.5 ${
                      testResult.success
                        ? testResult.status === "DUPLICATE"
                          ? "bg-amber-50 border-amber-200 text-amber-900"
                          : "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-rose-50 border-rose-200 text-rose-900"
                    }`}
                  >
                    <p className="font-black text-sm">
                      {testResult.success ? (testResult.status === "DUPLICATE" ? "⚠ Duplicate" : "✅ Enquiry created") : "✕ Failed"}
                    </p>
                    <p>{testResult.message || testResult.error}</p>
                    {testResult.enquiryId && (
                      <p>
                        Enquiry ID: <b>{testResult.enquiryId}</b>
                      </p>
                    )}
                    {testResult.status === "SUCCESS" && (
                      <>
                        <p>Course: <b>{testResult.matchedCourse || "General Course"}</b></p>
                        <p>Brand: <b>{testResult.brand}</b></p>
                        <p>Counsellor: <b>{testResult.assignedCounselor}</b></p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="h-full min-h-[160px] flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
                    Result will appear here
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "pull" && (
            <div className="space-y-4 max-w-2xl">
              <p className="text-xs text-slate-600">
                Fetch leads directly from Meta — use this to import leads from before the webhook was connected, or to
                recover any that failed. Leads already imported are skipped automatically. Pulls from your mapped
                forms, or from every form on the page if none are mapped (up to 1,000 leads per run).
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <label className={labelCls}>Leads created since</label>
                  <input type="date" value={pullSince} onChange={(e) => setPullSince(e.target.value)} className={inputCls} />
                </div>
                <button
                  onClick={handlePull}
                  disabled={isPulling || !hasPageAccessToken}
                  className="px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-black rounded-lg cursor-pointer disabled:opacity-40"
                >
                  {isPulling ? "Pulling..." : "🔄 Pull Leads Now"}
                </button>
              </div>
              {!hasPageAccessToken && (
                <p className="text-xs text-amber-700 font-bold">Save a Page Access Token on the Connection tab first.</p>
              )}
              {stats.lastSyncAt && (
                <p className="text-[11px] text-slate-500">Last pull: {new Date(stats.lastSyncAt).toLocaleString("en-IN")}</p>
              )}
              {pullResult && (
                <div
                  className={`rounded-xl border p-4 text-xs space-y-1 ${
                    pullResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}
                >
                  <p className="font-bold">{pullResult.message || pullResult.error}</p>
                  {pullResult.formErrors?.length > 0 && (
                    <ul className="list-disc pl-5 text-rose-800">
                      {pullResult.formErrors.map((fe: any) => (
                        <li key={fe.formId}>
                          Form {fe.formId}: {fe.error}
                        </li>
                      ))}
                    </ul>
                  )}
                  {pullResult.limitReached && <p>Limit reached — run again to continue.</p>}
                </div>
              )}
            </div>
          )}

          {activeTab === "logs" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={logsSearch}
                  onChange={(e) => setLogsSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
                  placeholder="Search name, phone, lead ID, campaign..."
                  className={`${inputCls} max-w-xs`}
                />
                <select
                  value={logsStatus}
                  onChange={(e) => {
                    setLogsStatus(e.target.value);
                    fetchLogs(e.target.value);
                  }} className={`${inputCls} max-w-[160px]`}>
                  {["ALL", "SUCCESS", "DUPLICATE", "FAILED", "UNAUTHORIZED"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button onClick={() => fetchLogs()} className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg cursor-pointer">
                  {isLoadingLogs ? "Loading..." : "↻ Refresh"}
                </button>
                <button
                  onClick={handleClearLogs}
                  className="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer ml-auto"
                >
                  🧹 Clear failed/duplicate
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-extrabold text-[10px] uppercase">
                    <tr>
                      <th className="text-left p-2">Time</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Via</th>
                      <th className="text-left p-2">Lead</th>
                      <th className="text-left p-2">Campaign / Form</th>
                      <th className="text-left p-2">Enquiry</th>
                      <th className="text-left p-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400">
                          {isLoadingLogs ? "Loading..." : "No activity yet."}
                        </td>
                      </tr>
                    )}
                    {logs.map((log) => (
                      <tr key={log._id} className="border-t border-slate-100 align-top">
                        <td className="p-2 whitespace-nowrap text-slate-600">
                          {new Date(log.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${STATUS_STYLES[log.status] || ""}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="p-2 text-slate-600">{log.sourceType?.replace(/_/g, " ").toLowerCase()}</td>
                        <td className="p-2">
                          <div className="font-bold text-slate-800">{log.leadName || "—"}</div>
                          <div className="text-slate-500">{log.mobile}</div>
                        </td>
                        <td className="p-2 text-slate-600">
                          <div>{log.campaignName || "—"}</div>
                          <div className="text-[10px] text-slate-400">{log.formName || log.formId}</div>
                        </td>
                        <td className="p-2 font-mono font-bold text-slate-700">{log.enquiryId || "—"}</td>
                        <td className="p-2 max-w-[260px]">
                          <div className="text-slate-600 break-words">{log.errorDetails || log.responseMessage}</div>
                          <button onClick={() => setSelectedLog(log)} className="text-[#1877F2] text-[10px] font-bold hover:underline cursor-pointer">
                            View payload
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-[60] bg-slate-950/70 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-black">Lead payload · {selectedLog.leadgenId || "no lead ID"}</h3>
              <button onClick={() => setSelectedLog(null)} className="text-xs font-bold cursor-pointer">
                ✕
              </button>
            </div>
            <pre className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap break-all">
              {JSON.stringify(selectedLog.rawPayload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
