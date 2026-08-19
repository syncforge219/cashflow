"use client";

import React, { useState, useEffect } from "react";

interface CourseMapping {
  course: string;
  justdialCategory: string;
  counselorName: string;
  brand?: string;
}

interface JustdialIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  counsellorsList: any[];
  dbLeadSources: any[];
  brandsList?: any[];
  onConfigSaved?: () => void;
}

export default function JustdialIntegrationModal({
  isOpen,
  onClose,
  counsellorsList,
  dbLeadSources,
  brandsList: initialBrandsList,
  onConfigSaved,
}: JustdialIntegrationModalProps) {
  const [activeTab, setActiveTab] = useState<"settings" | "mappings" | "test" | "pull" | "logs">("settings");

  // Configuration States
  const [connectorType, setConnectorType] = useState("Justdial Lead Connector Push API");
  const [leadSource, setLeadSource] = useState("JustDial");
  const [leadStage, setLeadStage] = useState("New / Fresh Inquiry");
  const [defaultBrand, setDefaultBrand] = useState("CADD MANTRA");
  const [counselorName, setCounselorName] = useState("HO - TARANG SINGHAL - SICCES PVT LTD");
  const [defaultCourse, setDefaultCourse] = useState("");
  const [apiKey, setApiKey] = useState("JD-CF-API-KEY-984729103847");
  const [requireApiKey, setRequireApiKey] = useState(false);
  const [autoAssignAdvisor, setAutoAssignAdvisor] = useState(true);
  const [sendWelcomeWhatsApp, setSendWelcomeWhatsApp] = useState(true);
  const [sendAdminAlertWhatsApp, setSendAdminAlertWhatsApp] = useState(true);
  const [createFollowUpTask, setCreateFollowUpTask] = useState(true);

  // Pull API states
  const [pullApiUrl, setPullApiUrl] = useState("");
  const [pullApiClientId, setPullApiClientId] = useState("");
  const [pullApiKey, setPullApiKey] = useState("");
  const [pullApiMobile, setPullApiMobile] = useState("");
  const [pullStartDate, setPullStartDate] = useState("");
  const [pullEndDate, setPullEndDate] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [pullSyncResult, setPullSyncResult] = useState<any | null>(null);

  // Mappings & Lists
  const [courseMappings, setCourseMappings] = useState<CourseMapping[]>([]);
  const [coursesList, setCoursesList] = useState<any[]>([]);
  const [brandsList, setBrandsList] = useState<any[]>(initialBrandsList || []);
  const [sourcesList, setSourcesList] = useState<any[]>(dbLeadSources || []);
  const [stats, setStats] = useState<any>({ totalLeadsReceived: 0, lastLeadReceivedAt: null });

  // Test Simulator states
  const [testName, setTestName] = useState("Aarav Sharma");
  const [testMobile, setTestMobile] = useState("9876543210");
  const [testEmail, setTestEmail] = useState("aarav.sharma@example.com");
  const [testCategory, setTestCategory] = useState("AutoCAD Course");
  const [testCity, setTestCity] = useState("Lucknow");
  const [testQuery, setTestQuery] = useState("Interested in weekend batches & syllabus details.");
  const [testSendWhatsApp, setTestSendWhatsApp] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Logs states
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsSearch, setLogsSearch] = useState("");
  const [logsStatusFilter, setLogsStatusFilter] = useState("ALL");
  const [selectedLogPayload, setSelectedLogPayload] = useState<any | null>(null);

  // Modal / Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Quick Add Lead Source inline state
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // 1. Fetch Courses
      fetch("/api/courses")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setCoursesList(data.data);
          } else if (Array.isArray(data.courses)) {
            setCoursesList(data.courses);
          }
        })
        .catch(console.error);

      // 2. Fetch Brands
      fetch("/api/brands")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setBrandsList(data.data);
          }
        })
        .catch(console.error);

      // 3. Fetch Lead Sources
      fetch("/api/lead-sources")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setSourcesList(data.data);
          }
        })
        .catch(console.error);

      // 4. Fetch Saved Justdial Config
      loadJustdialConfig();
    }
  }, [isOpen]);

  const loadJustdialConfig = () => {
    setIsLoading(true);
    fetch("/api/justdial-integration")
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data) {
          const d = result.data;
          setConnectorType(d.connectorType || "Justdial Lead Connector Push API");
          setLeadSource(d.leadSource || "JustDial");
          setLeadStage(d.leadStage || "New / Fresh Inquiry");
          setDefaultBrand(d.defaultBrand || "CADD MANTRA");
          setCounselorName(d.counselorName || "HO - TARANG SINGHAL - SICCES PVT LTD");
          setDefaultCourse(d.defaultCourse || "");
          setApiKey(d.apiKey || "JD-CF-API-KEY-984729103847");
          setRequireApiKey(Boolean(d.requireApiKey));
          setAutoAssignAdvisor(d.autoAssignAdvisor !== false);
          setSendWelcomeWhatsApp(d.sendWelcomeWhatsApp !== false);
          setSendAdminAlertWhatsApp(d.sendAdminAlertWhatsApp !== false);
          setCreateFollowUpTask(d.createFollowUpTask !== false);
          setPullApiUrl(d.pullApiUrl || "");
          setPullApiClientId(d.pullApiClientId || "");
          setPullApiKey(d.pullApiKey || "");
          setPullApiMobile(d.pullApiMobile || "");
          if (d.stats) setStats(d.stats);

          if (Array.isArray(d.courseMappings) && d.courseMappings.length > 0) {
            setCourseMappings(d.courseMappings);
          } else {
            setCourseMappings([
              { course: "", justdialCategory: "", counselorName: d.counselorName || "", brand: d.defaultBrand || "" },
            ]);
          }
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  };

  const fetchLogs = () => {
    setIsLoadingLogs(true);
    const params = new URLSearchParams();
    if (logsSearch) params.set("search", logsSearch);
    if (logsStatusFilter && logsStatusFilter !== "ALL") params.set("status", logsStatusFilter);

    fetch(`/api/justdial-integration/logs?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setLogs(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingLogs(false));
  };

  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
    }
  }, [activeTab, logsStatusFilter]);

  if (!isOpen) return null;

  const handleAddMappingRow = () => {
    setCourseMappings([
      ...courseMappings,
      { course: "", justdialCategory: "", counselorName: counselorName || "", brand: defaultBrand || "" },
    ]);
  };

  const handleRemoveMappingRow = (index: number) => {
    setCourseMappings(courseMappings.filter((_, idx) => idx !== index));
  };

  const handleMappingChange = (index: number, field: keyof CourseMapping, value: string) => {
    const updated = [...courseMappings];
    updated[index][field] = value;
    setCourseMappings(updated);
  };

  const handleQuickAddPreset = (categoryName: string, defaultCourseName: string) => {
    const matched = coursesList.find((c) => c.name.toLowerCase().includes(defaultCourseName.toLowerCase()));
    setCourseMappings([
      ...courseMappings.filter((m) => m.course || m.justdialCategory),
      {
        course: matched ? matched.name : defaultCourseName,
        justdialCategory: categoryName,
        counselorName: counselorName || "",
        brand: defaultBrand || "CADD MANTRA",
      },
    ]);
  };

  const generateRandomApiKey = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "JD-KEY-";
    for (let i = 0; i < 16; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setApiKey(key);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedbackBanner(null);
    try {
      const response = await fetch("/api/justdial-integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorType,
          leadSource,
          leadStage,
          defaultBrand,
          counselorName,
          defaultCourse,
          apiKey,
          requireApiKey,
          autoAssignAdvisor,
          sendWelcomeWhatsApp,
          sendAdminAlertWhatsApp,
          createFollowUpTask,
          pullApiUrl,
          pullApiClientId,
          pullApiKey,
          pullApiMobile,
          courseMappings: courseMappings.filter((m) => m.course && m.justdialCategory),
        }),
      });

      const resData = await response.json();
      if (resData.success) {
        setFeedbackBanner({
          type: "success",
          message: "✅ Justdial Connector configuration saved successfully!",
        });
        if (onConfigSaved) onConfigSaved();
        loadJustdialConfig();
        setTimeout(() => setFeedbackBanner(null), 5000);
      } else {
        setFeedbackBanner({ type: "error", message: `❌ Failed to save: ${resData.error}` });
      }
    } catch (err: any) {
      setFeedbackBanner({ type: "error", message: `❌ Error saving config: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!confirm("Are you sure you want to reset all Justdial Integration settings to default?")) return;
    try {
      await fetch("/api/justdial-integration", { method: "DELETE" });
      setFeedbackBanner({ type: "success", message: "Justdial settings reset to defaults." });
      loadJustdialConfig();
    } catch (err: any) {
      setFeedbackBanner({ type: "error", message: err.message });
    }
  };

  const handleAddCustomLeadSource = async () => {
    const clean = newSourceName.trim();
    if (!clean) return;
    try {
      const res = await fetch("/api/lead-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean }),
      });
      const data = await res.json();
      if (data.success) {
        setSourcesList((prev) => {
          if (prev.some((s) => s.name?.toLowerCase() === clean.toLowerCase())) return prev;
          return [...prev, { name: clean }];
        });
        setLeadSource(clean);
        setNewSourceName("");
        setIsAddingSource(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecuteTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/justdial-integration/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: testName,
          mobile: testMobile,
          email: testEmail,
          category: testCategory,
          city: testCity,
          query: testQuery,
          sendLiveWhatsApp: testSendWhatsApp,
          createTask: true,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.success && onConfigSaved) {
        onConfigSaved();
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleExecutePullSync = async () => {
    if (!pullApiUrl) {
      alert("Please specify a Justdial Pull API URL in the field above.");
      return;
    }
    setIsPulling(true);
    setPullSyncResult(null);
    try {
      const res = await fetch("/api/justdial-integration/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pullApiUrl,
          pullApiClientId,
          pullApiKey,
          pullApiMobile,
          startDate: pullStartDate,
          endDate: pullEndDate,
        }),
      });
      const data = await res.json();
      setPullSyncResult(data);
      if (data.success) {
        if (onConfigSaved) onConfigSaved();
        loadJustdialConfig();
      }
    } catch (err: any) {
      setPullSyncResult({ success: false, error: err.message });
    } finally {
      setIsPulling(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all Justdial activity logs?")) return;
    try {
      await fetch("/api/justdial-integration/logs", { method: "DELETE" });
      setLogs([]);
    } catch (err) {
      console.error(err);
    }
  };

  const webhookUrl = `${origin}/api/enquiries/justdial-webhook`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopiedApiKey(true);
    setTimeout(() => setCopiedApiKey(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* HEADER BAR */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 shadow-inner">
              <span className="text-lg font-black text-blue-400 tracking-tight">just</span>
              <span className="text-lg font-black text-orange-500 tracking-tight">dial</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Justdial Lead Connector & Routing Engine
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Auto-ingest, match courses, assign advisors & trigger WhatsApp alerts in real time
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("test")}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <span>🧪 Test Lead</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black rounded-lg transition-all cursor-pointer shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>💾 Save Settings</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNER */}
        {feedbackBanner && (
          <div
            className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
              feedbackBanner.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <span>{feedbackBanner.message}</span>
            <button onClick={() => setFeedbackBanner(null)} className="text-xs hover:opacity-70 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* STATS STRIP & NAVIGATION TABS */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "settings"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>⚙️ General Config</span>
            </button>
            <button
              onClick={() => setActiveTab("mappings")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "mappings"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🗺️ Course Mappings ({courseMappings.filter((m) => m.course).length})</span>
            </button>
            <button
              onClick={() => setActiveTab("test")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "test"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🧪 Webhook Simulator</span>
            </button>
            <button
              onClick={() => setActiveTab("pull")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "pull"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🔄 Pull API Sync</span>
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "logs"
                  ? "bg-orange-500 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>📜 Activity Logs</span>
            </button>
          </div>

          {/* Quick Stats Chips */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-slate-200">
              <span className="text-slate-400 font-bold text-[10px]">TOTAL INGESTED:</span>
              <span className="font-black text-slate-800">{stats.totalLeadsReceived || 0}</span>
            </div>
            {stats.lastLeadReceivedAt && (
              <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-slate-200 hidden md:flex">
                <span className="text-slate-400 font-bold text-[10px]">LAST LEAD:</span>
                <span className="font-bold text-slate-700">
                  {new Date(stats.lastLeadReceivedAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* MAIN BODY SCROLL AREA */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {isLoading ? (
            <div className="py-20 text-center text-slate-400 font-bold flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading Justdial Connector Configuration...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: GENERAL CONFIGURATION */}
              {activeTab === "settings" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left Form: Basic & Routing Properties */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                        📋 Ingestion & Default Lead Properties
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Connector Type */}
                        <div className="space-y-1">
                          <label className="text-xs font-extrabold text-slate-700">Connector Mode*</label>
                          <select
                            value={connectorType}
                            onChange={(e) => setConnectorType(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="Justdial Lead Connector Push API">Justdial Lead Connector Push API (Instant)</option>
                            <option value="Justdial Webhook Connector">Justdial Webhook Connector</option>
                            <option value="Justdial Pull API">Justdial Pull API (Periodic Sync)</option>
                          </select>
                        </div>

                        {/* Lead Source */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-extrabold text-slate-700">Lead Source Tag*</label>
                            <button
                              type="button"
                              onClick={() => setIsAddingSource(!isAddingSource)}
                              className="text-[10px] font-extrabold text-orange-600 hover:text-orange-700 cursor-pointer"
                            >
                              {isAddingSource ? "Cancel" : "+ New Source"}
                            </button>
                          </div>
                          {isAddingSource ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={newSourceName}
                                onChange={(e) => setNewSourceName(e.target.value)}
                                placeholder="e.g. Justdial Campaign 2026"
                                className="flex-1 bg-white border border-orange-300 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                              />
                              <button
                                type="button"
                                onClick={handleAddCustomLeadSource}
                                className="px-2.5 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                              >
                                Add
                              </button>
                            </div>
                          ) : (
                            <select
                              value={leadSource}
                              onChange={(e) => setLeadSource(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                            >
                              <option value="JustDial">JustDial</option>
                              {sourcesList.map((ls: any) => (
                                <option key={ls._id || ls.name || ls.sourceName} value={ls.name || ls.sourceName}>
                                  {ls.name || ls.sourceName}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Lead Stage */}
                        <div className="space-y-1">
                          <label className="text-xs font-extrabold text-slate-700">Initial Lead Stage*</label>
                          <select
                            value={leadStage}
                            onChange={(e) => setLeadStage(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="New / Fresh Inquiry">New / Fresh Inquiry</option>
                            <option value="Hot Lead">Hot Lead</option>
                            <option value="Follow-up Required">Follow-up Required</option>
                            <option value="Admitted">Admitted</option>
                            <option value="Closed / Lost">Closed / Lost</option>
                          </select>
                        </div>

                        {/* Default Target Brand */}
                        <div className="space-y-1">
                          <label className="text-xs font-extrabold text-slate-700">Default Target Brand*</label>
                          <select
                            value={defaultBrand}
                            onChange={(e) => setDefaultBrand(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="CADD MANTRA">CADD MANTRA</option>
                            <option value="DESIGN GATEWAY">DESIGN GATEWAY</option>
                            {brandsList.map((b: any) => (
                              <option key={b._id || b.name} value={b.name}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Counselor Name Fallback */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-extrabold text-slate-700">
                            Default Assigned Counselor / CRM Advisor*
                          </label>
                          <select
                            value={counselorName}
                            onChange={(e) => setCounselorName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="HO - TARANG SINGHAL - SICCES PVT LTD">
                              HO - TARANG SINGHAL - SICCES PVT LTD
                            </option>
                            {counsellorsList.map((c: any) => {
                              const nameStr = `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.name || c.email;
                              return (
                                <option key={c._id} value={nameStr}>
                                  {nameStr} {c.role ? `(${c.role})` : ""}
                                </option>
                              );
                            })}
                          </select>
                          <p className="text-[10px] text-slate-400">
                            Used when no category-specific counselor mapping is matched.
                          </p>
                        </div>

                        {/* Default Course Fallback */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-extrabold text-slate-700">
                            Default Course (Fallback when Justdial category is unrecognized)
                          </label>
                          <select
                            value={defaultCourse}
                            onChange={(e) => setDefaultCourse(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="">-- No Default Course (Leave blank or General) --</option>
                            {coursesList.map((crs: any) => (
                              <option key={crs._id || crs.code} value={crs.name}>
                                {crs.name} {crs.code ? `(${crs.code})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Automation Rules Card */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                        ⚡ Automation & Instant Triggers
                      </h3>

                      <div className="space-y-2.5">
                        <label className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={createFollowUpTask}
                            onChange={(e) => setCreateFollowUpTask(e.target.checked)}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                          />
                          <div>
                            <div className="text-xs font-extrabold text-slate-800">
                              Auto-create High Priority CRM Task
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Creates a "Lead Call" task in CRM due within 24 hours for the assigned counselor.
                            </div>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sendAdminAlertWhatsApp}
                            onChange={(e) => setSendAdminAlertWhatsApp(e.target.checked)}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                          />
                          <div>
                            <div className="text-xs font-extrabold text-slate-800">
                              Super Admin Instant WhatsApp Alert (MSG91)
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Dispatches template <code className="text-indigo-600 font-bold">enquiry_msg</code> to Super Admin immediately upon lead capture.
                            </div>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sendWelcomeWhatsApp}
                            onChange={(e) => setSendWelcomeWhatsApp(e.target.checked)}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                          />
                          <div>
                            <div className="text-xs font-extrabold text-slate-800">
                              Student Welcome WhatsApp Message (MSG91)
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Sends branded welcome message (<code className="text-indigo-600 font-bold">welcome_enquiry</code>) to the student's phone.
                            </div>
                          </div>
                        </label>

                        <label className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoAssignAdvisor}
                            onChange={(e) => setAutoAssignAdvisor(e.target.checked)}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                          />
                          <div>
                            <div className="text-xs font-extrabold text-slate-800">
                              Brand Centre Head Round-Robin Routing
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Automatically distributes unmapped leads evenly among active Centre Heads & Counsellors.
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Webhook Endpoint Card & API Security */}
                  <div className="lg:col-span-5 space-y-4">
                    {/* Live Webhook Card */}
                    <div className="bg-gradient-to-br from-orange-500 to-amber-600 text-white p-5 rounded-2xl shadow-md space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-md">
                          Justdial Webhook Push URL
                        </span>
                        <span className="text-[11px] font-bold text-amber-200">POST / GET</span>
                      </div>

                      <div className="bg-white text-slate-900 rounded-xl p-3 shadow-inner space-y-2">
                        <div className="text-[11px] font-mono font-bold break-all select-all text-slate-800">
                          {webhookUrl}
                        </div>
                        <button
                          type="button"
                          onClick={copyWebhookUrl}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {copiedWebhook ? <span>✅ URL Copied to Clipboard!</span> : <span>📋 Copy Push URL</span>}
                        </button>
                      </div>

                      <div className="text-[11px] text-amber-100 leading-relaxed font-medium">
                        💡 <strong>How to activate:</strong> Paste this URL into your Justdial Lead Connector dashboard or share it with your Justdial Key Account Manager. The endpoint automatically detects JSON and Form URL-Encoded requests.
                      </div>
                    </div>

                    {/* API Key Security Box */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                          🔒 API Key & Authentication
                        </h3>
                        <button
                          type="button"
                          onClick={generateRandomApiKey}
                          className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-700 cursor-pointer"
                        >
                          🎲 Generate New
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter API Key"
                            className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={copyApiKey}
                            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                            title="Copy Key"
                          >
                            {copiedApiKey ? "✓" : "📋"}
                          </button>
                        </div>

                        <label className="flex items-center gap-2 pt-1 text-xs font-bold text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={requireApiKey}
                            onChange={(e) => setRequireApiKey(e.target.checked)}
                            className="w-4 h-4 text-orange-600 rounded"
                          />
                          <span>Enforce API Key validation on incoming webhook hits</span>
                        </label>
                        <p className="text-[10px] text-slate-400">
                          Leave unchecked if Justdial push server does not support passing custom auth headers.
                        </p>
                      </div>
                    </div>

                    {/* Reset Config Box */}
                    <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-black text-slate-700">Reset Integration Settings</div>
                        <div className="text-[10px] text-slate-500">Restore factory defaults and clear mappings</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDeleteConfig}
                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        Reset Defaults
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: COURSE & COUNSELOR MAPPINGS */}
              {activeTab === "mappings" && (
                <div className="space-y-5">
                  {/* Quick Preset Buttons */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      ⚡ Quick Add Common Category Mappings:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { cat: "AutoCAD Training Course", crs: "AutoCAD" },
                        { cat: "Interior Design Course", crs: "Interior Design" },
                        { cat: "Revit Architecture Institute", crs: "Revit Architecture" },
                        { cat: "Full Stack Web Development", crs: "Full Stack Web Development" },
                        { cat: "3ds Max & V-Ray Classes", crs: "3ds Max" },
                        { cat: "Graphic Design Training", crs: "Graphic Design" },
                        { cat: "Civil CAD / Civil 3D Course", crs: "Civil 3D" },
                        { cat: "Python Programming Course", crs: "Python" },
                      ].map((item, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleQuickAddPreset(item.cat, item.crs)}
                          className="text-[11px] font-bold bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>+ {item.crs}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mapping Table Card */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-5 py-3 flex items-center justify-between">
                      <div className="font-black text-xs uppercase tracking-wider flex items-center gap-2">
                        <span>🗺️ Justdial Category to Internal Course & Advisor Routing</span>
                        <span className="bg-black/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                          {courseMappings.length} Rules
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddMappingRow}
                        className="text-xs font-black bg-white text-orange-700 hover:bg-orange-50 px-3 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
                      >
                        + Add Mapping Line
                      </button>
                    </div>

                    <div className="p-4 overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                        <thead>
                          <tr className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200 bg-slate-50/50">
                            <th className="py-2.5 px-3 w-[30%]">SYSTEM COURSE*</th>
                            <th className="py-2.5 px-3 w-[30%]">JUSTDIAL CATEGORY / KEYWORD*</th>
                            <th className="py-2.5 px-3 w-[22%]">ASSIGNED COUNSELOR</th>
                            <th className="py-2.5 px-3 w-[12%]">BRAND</th>
                            <th className="py-2.5 px-2 text-center w-[6%]">DEL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {courseMappings.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                                No course mappings configured yet. Click "+ Add Mapping Line" or use the quick buttons above.
                              </td>
                            </tr>
                          ) : (
                            courseMappings.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                {/* System Course */}
                                <td className="py-2 px-2">
                                  <select
                                    value={row.course}
                                    onChange={(e) => handleMappingChange(idx, "course", e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                  >
                                    <option value="">Select Course...</option>
                                    {coursesList.map((crs: any) => (
                                      <option key={crs._id || crs.code} value={crs.name}>
                                        {crs.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>

                                {/* Justdial Category */}
                                <td className="py-2 px-2">
                                  <input
                                    type="text"
                                    placeholder="e.g. Interior Design Course"
                                    value={row.justdialCategory}
                                    onChange={(e) => handleMappingChange(idx, "justdialCategory", e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                  />
                                </td>

                                {/* Assigned Counselor */}
                                <td className="py-2 px-2">
                                  <select
                                    value={row.counselorName}
                                    onChange={(e) => handleMappingChange(idx, "counselorName", e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                  >
                                    <option value="">Inherit Default ({counselorName})</option>
                                    <option value="HO - TARANG SINGHAL - SICCES PVT LTD">
                                      HO - TARANG SINGHAL - SICCES PVT LTD
                                    </option>
                                    {counsellorsList.map((c: any) => {
                                      const nameStr = `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.name || c.email;
                                      return (
                                        <option key={c._id} value={nameStr}>
                                          {nameStr}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </td>

                                {/* Target Brand */}
                                <td className="py-2 px-2">
                                  <select
                                    value={row.brand || defaultBrand}
                                    onChange={(e) => handleMappingChange(idx, "brand", e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                  >
                                    <option value="CADD MANTRA">CADD MANTRA</option>
                                    <option value="DESIGN GATEWAY">DESIGN GATEWAY</option>
                                    {brandsList.map((b: any) => (
                                      <option key={b._id || b.name} value={b.name}>
                                        {b.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>

                                {/* Remove */}
                                <td className="py-2 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMappingRow(idx)}
                                    className="w-7 h-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center text-sm"
                                    title="Delete line"
                                  >
                                    🗑️
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: LIVE TEST & WEBHOOK SIMULATOR */}
              {activeTab === "test" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Test Form */}
                  <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        🧪 Simulate Incoming Justdial Lead
                      </h3>
                      <span className="text-[10px] text-slate-400 font-bold">End-to-End Pipeline Test</span>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600">Student Name</label>
                          <input
                            type="text"
                            value={testName}
                            onChange={(e) => setTestName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-600">Mobile Number</label>
                          <input
                            type="text"
                            value={testMobile}
                            onChange={(e) => setTestMobile(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600">Justdial Category / Product</label>
                          <input
                            type="text"
                            value={testCategory}
                            onChange={(e) => setTestCategory(e.target.value)}
                            placeholder="e.g. AutoCAD Training Course"
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-600">City / Location</label>
                          <input
                            type="text"
                            value={testCity}
                            onChange={(e) => setTestCity(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600">Email Address</label>
                        <input
                          type="email"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600">Inquiry Remarks / Message</label>
                        <textarea
                          rows={2}
                          value={testQuery}
                          onChange={(e) => setTestQuery(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
                        ></textarea>
                      </div>

                      <label className="flex items-center gap-2 pt-1 text-xs font-bold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={testSendWhatsApp}
                          onChange={(e) => setTestSendWhatsApp(e.target.checked)}
                          className="w-4 h-4 text-orange-600 rounded"
                        />
                        <span>Dispatch Real WhatsApp Alerts during test (MSG91 Live)</span>
                      </label>

                      <button
                        type="button"
                        onClick={handleExecuteTest}
                        disabled={isTesting}
                        className="w-full py-3 bg-gradient-to-r from-orange-600 to-indigo-600 hover:from-orange-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                      >
                        {isTesting ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Simulating Lead Ingestion...</span>
                          </>
                        ) : (
                          <>
                            <span>🚀 Dispatch Test Lead to Webhook Pipeline</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Test Diagnostic Output */}
                  <div className="lg:col-span-6 space-y-4">
                    <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md h-full space-y-3 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                            📊 Live Diagnostic Report
                          </span>
                          {testResult && (
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                testResult.success
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              }`}
                            >
                              {testResult.success ? "200 OK - SUCCESS" : "FAILED"}
                            </span>
                          )}
                        </div>

                        {!testResult ? (
                          <div className="py-16 text-center text-slate-500 text-xs font-bold">
                            Click "Dispatch Test Lead" to verify category matching, counselor assignment, task creation & WhatsApp flow.
                          </div>
                        ) : (
                          <div className="space-y-3 text-xs">
                            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-bold">Created Enquiry ID:</span>
                                <span className="font-mono font-black text-emerald-400 text-sm">
                                  {testResult.diagnostics?.enquiryId || "N/A"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-bold">Matched Course:</span>
                                <span className="font-bold text-white">
                                  {testResult.diagnostics?.matchedCourse || "Default Course"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-bold">Assigned Counselor:</span>
                                <span className="font-bold text-amber-300">
                                  {testResult.diagnostics?.assignedCounselor || "N/A"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-bold">Target Brand:</span>
                                <span className="font-bold text-white">
                                  {testResult.diagnostics?.targetBrand || "CADD MANTRA"}
                                </span>
                              </div>
                            </div>

                            <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 font-mono text-[11px] text-slate-300 space-y-1">
                              <div className="text-[10px] text-slate-400 uppercase font-black">WhatsApp Alert Status:</div>
                              <div>Super Admin Alert: {testResult.diagnostics?.whatsappResults?.adminAlert}</div>
                              <div>Student Welcome: {testResult.diagnostics?.whatsappResults?.welcomeMsg}</div>
                            </div>

                            <div className="text-[11px] text-emerald-400 font-bold">
                              ✅ Lead successfully entered into database and logged in Activity Trail!
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
                        Simulation leads are marked with <code className="text-amber-400">[TEST SIMULATION]</code> in remarks.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: PULL API SYNC */}
              {activeTab === "pull" && (
                <div className="max-w-3xl mx-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
                  <div className="border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span>🔄 Justdial Pull API Sync</span>
                      <span className="text-xs font-bold text-slate-400 lowercase font-normal">(On-Demand & Scheduled Lead Sync)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      If your Justdial merchant contract provides a Pull API endpoint instead of a Push Webhook, configure the credentials below.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-extrabold text-slate-700">Justdial Pull API Endpoint URL*</label>
                      <input
                        type="url"
                        value={pullApiUrl}
                        onChange={(e) => setPullApiUrl(e.target.value)}
                        placeholder="https://leads.justdial.com/api/v1/leads"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-extrabold text-slate-700">Client / Vendor ID</label>
                        <input
                          type="text"
                          value={pullApiClientId}
                          onChange={(e) => setPullApiClientId(e.target.value)}
                          placeholder="e.g. JD12345"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-extrabold text-slate-700">Pull Secret / API Key</label>
                        <input
                          type="text"
                          value={pullApiKey}
                          onChange={(e) => setPullApiKey(e.target.value)}
                          placeholder="API Secret Key"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-extrabold text-slate-700">Registered Mobile</label>
                        <input
                          type="text"
                          value={pullApiMobile}
                          onChange={(e) => setPullApiMobile(e.target.value)}
                          placeholder="e.g. 9876543210"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600">Start Date (Optional)</label>
                        <input
                          type="date"
                          value={pullStartDate}
                          onChange={(e) => setPullStartDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600">End Date (Optional)</label>
                        <input
                          type="date"
                          value={pullEndDate}
                          onChange={(e) => setPullEndDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleExecutePullSync}
                      disabled={isPulling}
                      className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                      {isPulling ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          <span>Connecting & Fetching Leads...</span>
                        </>
                      ) : (
                        <>
                          <span>🔄 Fetch & Sync Justdial Leads Now</span>
                        </>
                      )}
                    </button>

                    {pullSyncResult && (
                      <div
                        className={`p-4 rounded-xl text-xs font-bold border ${
                          pullSyncResult.success
                            ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                            : "bg-rose-50 text-rose-900 border-rose-200"
                        }`}
                      >
                        <div>{pullSyncResult.message || pullSyncResult.error}</div>
                        {pullSyncResult.importedCount !== undefined && (
                          <div className="mt-1 text-[11px] text-slate-600 font-medium">
                            Imported: {pullSyncResult.importedCount} | Duplicates Skipped: {pullSyncResult.duplicatesCount}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: WEBHOOK ACTIVITY & AUDIT LOGS */}
              {activeTab === "logs" && (
                <div className="space-y-4">
                  {/* Logs Controls */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                      <input
                        type="text"
                        value={logsSearch}
                        onChange={(e) => setLogsSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
                        placeholder="Search by student name, phone, course, category..."
                        className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800"
                      />
                      <select
                        value={logsStatusFilter}
                        onChange={(e) => setLogsStatusFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="SUCCESS">SUCCESS</option>
                        <option value="DUPLICATE">DUPLICATE</option>
                        <option value="FAILED">FAILED</option>
                        <option value="UNAUTHORIZED">UNAUTHORIZED</option>
                      </select>
                      <button
                        type="button"
                        onClick={fetchLogs}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        Search
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={fetchLogs}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                      >
                        🔄 Refresh
                      </button>
                      <button
                        type="button"
                        onClick={handleClearLogs}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg cursor-pointer"
                      >
                        🗑️ Clear Logs
                      </button>
                    </div>
                  </div>

                  {/* Logs Table */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="p-4 overflow-x-auto">
                      {isLoadingLogs ? (
                        <div className="py-12 text-center text-slate-400 font-bold">Loading activity logs...</div>
                      ) : logs.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 font-semibold">
                          No incoming Justdial webhook hits recorded yet. Send a test lead from the "Webhook Simulator" tab!
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs border-collapse min-w-[750px]">
                          <thead>
                            <tr className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200 bg-slate-50/50">
                              <th className="py-2.5 px-3">TIMESTAMP</th>
                              <th className="py-2.5 px-3">STATUS</th>
                              <th className="py-2.5 px-3">LEAD NAME / PHONE</th>
                              <th className="py-2.5 px-3">CATEGORY / COURSE</th>
                              <th className="py-2.5 px-3">ASSIGNED ADVISOR</th>
                              <th className="py-2.5 px-3">ENQUIRY ID</th>
                              <th className="py-2.5 px-2 text-center">PAYLOAD</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {logs.map((log: any) => {
                              const statusColor =
                                log.status === "SUCCESS"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : log.status === "DUPLICATE"
                                  ? "bg-amber-100 text-amber-800"
                                  : log.status === "UNAUTHORIZED"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-rose-100 text-rose-800";

                              return (
                                <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                                    {new Date(log.timestamp || log.createdAt).toLocaleString("en-IN", {
                                      month: "short",
                                      day: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    })}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${statusColor}`}>
                                      {log.status}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-bold text-slate-800">{log.leadName || "N/A"}</div>
                                    <div className="text-[11px] text-slate-500 font-mono">{log.mobile || "N/A"}</div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-bold text-slate-800">{log.matchedCourse || "Unmapped"}</div>
                                    <div className="text-[10px] text-slate-400">{log.category || "No Category"}</div>
                                  </td>
                                  <td className="py-2.5 px-3 font-bold text-slate-700">
                                    {log.assignedCounselor || "Unassigned"}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                                    {log.enquiryId || "-"}
                                  </td>
                                  <td className="py-2.5 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedLogPayload(log)}
                                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded font-bold cursor-pointer"
                                    >
                                      👁️ View
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* RAW PAYLOAD MODAL */}
        {selectedLogPayload && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4 font-sans">
            <div className="bg-slate-900 text-white w-full max-w-2xl rounded-2xl p-5 space-y-4 border border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  🔍 Raw Ingested Payload & Diagnostics
                </h4>
                <button
                  onClick={() => setSelectedLogPayload(null)}
                  className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              <div className="text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                  <span>Status: <strong className="text-white">{selectedLogPayload.status}</strong></span>
                  <span>Method: <strong className="text-white">{selectedLogPayload.httpMethod}</strong></span>
                  <span>IP: <strong className="text-white">{selectedLogPayload.ip || "127.0.0.1"}</strong></span>
                </div>
                {selectedLogPayload.errorDetails && (
                  <div className="bg-rose-900/40 border border-rose-700/50 p-2.5 rounded-lg text-rose-300 text-xs font-mono">
                    {selectedLogPayload.errorDetails}
                  </div>
                )}
                <pre className="bg-black/50 p-3.5 rounded-xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-[300px] select-all border border-slate-800">
                  {JSON.stringify(selectedLogPayload.rawPayload || selectedLogPayload, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLogPayload(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
