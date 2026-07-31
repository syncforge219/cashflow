"use client";

import React, { useState, useEffect } from "react";

interface CourseMapping {
  course: string;
  justdialCategory: string;
  counselorName: string;
}

interface JustdialIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  counsellorsList: any[];
  dbLeadSources: any[];
  onConfigSaved?: () => void;
}

export default function JustdialIntegrationModal({
  isOpen,
  onClose,
  counsellorsList,
  dbLeadSources,
  onConfigSaved,
}: JustdialIntegrationModalProps) {
  const [connectorType, setConnectorType] = useState("Justdial Lead Connector Push API");
  const [leadSource, setLeadSource] = useState("JustDial");
  const [leadStage, setLeadStage] = useState("New / Fresh Inquiry");
  const [counselorName, setCounselorName] = useState("HO - TARANG SINGHAL - SICCES PVT LTD");
  const [defaultCourse, setDefaultCourse] = useState("");
  const [apiKey, setApiKey] = useState("JD-CF-API-KEY-984729103847");
  const [apiLastUpdatedTime, setApiLastUpdatedTime] = useState("");
  const [courseMappings, setCourseMappings] = useState<CourseMapping[]>([]);
  const [coursesList, setCoursesList] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Fetch Courses List
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

      // Fetch Saved Justdial Config
      setIsLoading(true);
      fetch("/api/justdial-integration")
        .then((res) => res.json())
        .then((result) => {
          if (result.success && result.data) {
            const d = result.data;
            setConnectorType(d.connectorType || "Justdial Lead Connector Push API");
            setLeadSource(d.leadSource || "JustDial");
            setLeadStage(d.leadStage || "New / Fresh Inquiry");
            setCounselorName(d.counselorName || "HO - TARANG SINGHAL - SICCES PVT LTD");
            setDefaultCourse(d.defaultCourse || "");
            setApiKey(d.apiKey || "JD-CF-API-KEY-984729103847");
            if (d.apiLastUpdatedTime) {
              setApiLastUpdatedTime(new Date(d.apiLastUpdatedTime).toLocaleString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              }));
            } else {
              setApiLastUpdatedTime(new Date().toLocaleString("en-US"));
            }
            if (Array.isArray(d.courseMappings) && d.courseMappings.length > 0) {
              setCourseMappings(d.courseMappings);
            } else {
              setCourseMappings([
                { course: "", justdialCategory: "", counselorName: d.counselorName || "" },
              ]);
            }
          }
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddMappingRow = () => {
    setCourseMappings([
      ...courseMappings,
      { course: "", justdialCategory: "", counselorName: counselorName || "" },
    ]);
  };

  const handleRemoveMappingRow = (index: number) => {
    const updated = courseMappings.filter((_, idx) => idx !== index);
    setCourseMappings(updated);
  };

  const handleMappingChange = (index: number, field: keyof CourseMapping, value: string) => {
    const updated = [...courseMappings];
    updated[index][field] = value;
    setCourseMappings(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/justdial-integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorType,
          leadSource,
          leadStage,
          counselorName,
          defaultCourse,
          apiKey,
          courseMappings: courseMappings.filter((m) => m.course && m.justdialCategory),
        }),
      });

      const resData = await response.json();
      if (resData.success) {
        alert("✅ Justdial Lead Connector Integration saved successfully!");
        if (onConfigSaved) onConfigSaved();
        onClose();
      } else {
        alert(`❌ Failed to save: ${resData.error}`);
      }
    } catch (err: any) {
      alert(`❌ Error saving config: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!confirm("Are you sure you want to reset/delete the Justdial Integration settings?")) return;
    try {
      await fetch("/api/justdial-integration", { method: "DELETE" });
      alert("Justdial integration settings deleted.");
      onClose();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto font-sans">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* TOP HEADER BAR (Matching Screenshot) */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <span>Lead Connectors Integrations</span>
              <span className="text-orange-500 text-lg">🔊</span>
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDeleteConfig}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Delete
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black rounded-lg transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Back
            </button>
          </div>
        </div>

        {/* JUSTDIAL BRAND BANNER */}
        <div className="bg-white border-b border-slate-100 px-6 py-3.5 flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-blue-50/50 px-3 py-1.5 rounded-xl border border-blue-100">
            <span className="text-xl font-black text-blue-600 tracking-tighter">just</span>
            <span className="text-xl font-black text-orange-500 tracking-tighter">dial</span>
          </div>
          <span className="text-xs font-bold text-slate-500">India's No.1 local search engine</span>
        </div>

        {/* MAIN FORM GRID */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 font-bold">Loading Justdial Configuration...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LEFT COLUMN: CONFIGURATION FORM (5 Cols) */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* Connector Type */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-700">Connector Type*</label>
                  <select
                    value={connectorType}
                    onChange={(e) => setConnectorType(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="Justdial Lead Connector Push API">Justdial Lead Connector Push API</option>
                    <option value="Justdial Webhook Connector">Justdial Webhook Connector</option>
                    <option value="Justdial Pull API">Justdial Pull API</option>
                  </select>
                </div>

                {/* Lead Source */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-700">Lead Source*</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={leadSource}
                      onChange={(e) => setLeadSource(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="JustDial">JustDial</option>
                      {dbLeadSources.map((ls: any) => (
                        <option key={ls._id || ls.sourceName} value={ls.sourceName}>
                          {ls.sourceName}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="w-8 h-8 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-black text-sm flex items-center justify-center shrink-0"
                      title="Add New Lead Source"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Lead Stage */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-700">Lead Stage*</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={leadStage}
                      onChange={(e) => setLeadStage(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="New / Fresh Inquiry">New / Fresh Inquiry</option>
                      <option value="Hot Lead">Hot Lead</option>
                      <option value="Follow-up Required">Follow-up Required</option>
                      <option value="Admitted">Admitted</option>
                      <option value="Closed / Lost">Closed / Lost</option>
                    </select>
                    <button
                      type="button"
                      className="w-8 h-8 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-black text-sm flex items-center justify-center shrink-0"
                      title="Add New Lead Stage"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Counselor Name */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-700">Counselor Name*</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={counselorName}
                      onChange={(e) => setCounselorName(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="HO - TARANG SINGHAL - SICCES PVT LTD">HO - TARANG SINGHAL - SICCES PVT LTD</option>
                      {counsellorsList.map((c: any) => {
                        const nameStr = `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.email;
                        return (
                          <option key={c._id} value={nameStr}>
                            {nameStr}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      className="w-8 h-8 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-black text-sm flex items-center justify-center shrink-0"
                      title="Add Counselor"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Default Course */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-700">
                    Default Course (To be used when Course name does not match)*
                  </label>
                  <select
                    value={defaultCourse}
                    onChange={(e) => setDefaultCourse(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select Course...</option>
                    {coursesList.map((crs: any) => (
                      <option key={crs._id || crs.code} value={crs.name}>
                        {crs.name} ({crs.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* API Key */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-700">API Key</label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter Justdial API Key"
                    className="w-full bg-white border border-rose-300 focus:border-orange-500 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none ring-2 ring-rose-100"
                  />
                </div>

                {/* API Last Updated Time */}
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-700">API Last Updated Time</label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={apiLastUpdatedTime || new Date().toLocaleString("en-US")}
                      className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 focus:outline-none cursor-not-allowed pr-9"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-xs">📅</span>
                  </div>
                </div>

                {/* Webhook Endpoint Box */}
                <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-3.5 space-y-1.5 mt-2">
                  <div className="text-[11px] font-black text-orange-900 uppercase tracking-wider flex items-center justify-between">
                    <span>Justdial Webhook Push URL</span>
                    <button
                      type="button"
                      onClick={copyWebhookUrl}
                      className="text-[10px] bg-orange-600 hover:bg-orange-500 text-white font-extrabold px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      {copiedWebhook ? "Copied! ✓" : "Copy URL"}
                    </button>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full text-[11px] font-mono font-bold bg-white text-slate-800 px-2.5 py-1.5 rounded border border-orange-200 focus:outline-none select-all"
                  />
                  <p className="text-[10px] text-orange-700 font-medium leading-tight">
                    Provide this endpoint URL to your Justdial account manager or paste it into your Justdial Lead Connector webhook settings.
                  </p>
                </div>
              </div>

              {/* RIGHT COLUMN: COURSE MAPPING BOX (7 Cols) */}
              <div className="lg:col-span-7">
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  
                  {/* Orange Header Bar */}
                  <div className="bg-orange-600 text-white px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
                      <span>⚙️ COURSE MAPPING</span>
                      <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]" title="Map Justdial Category names to internal system courses and assigned counselors">
                        ?
                      </span>
                    </div>
                  </div>

                  {/* Mapping Table */}
                  <div className="p-4 overflow-x-auto space-y-4">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider border-b border-slate-200">
                          <th className="py-2 px-2 w-[34%]">COURSE*</th>
                          <th className="py-2 px-2 w-[34%]">JUST DIAL PRODUCT/CATEGORY NAME*</th>
                          <th className="py-2 px-2 w-[26%]">COUNSELOR NAME*</th>
                          <th className="py-2 px-2 text-center w-[6%]">REMOVE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {courseMappings.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-400 font-semibold">
                              No course mappings configured yet. Click "+ Add New Line" below.
                            </td>
                          </tr>
                        ) : (
                          courseMappings.map((row, idx) => (
                            <tr key={idx}>
                              {/* Internal Course */}
                              <td className="py-2 px-2">
                                <select
                                  value={row.course}
                                  onChange={(e) => handleMappingChange(idx, "course", e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                >
                                  <option value="">Select Course...</option>
                                  {coursesList.map((crs: any) => (
                                    <option key={crs._id || crs.code} value={crs.name}>
                                      {crs.name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Justdial Category Name */}
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  placeholder="e.g. Interior Design Course"
                                  value={row.justdialCategory}
                                  onChange={(e) => handleMappingChange(idx, "justdialCategory", e.target.value)}
                                  className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                />
                              </td>

                              {/* Counselor Name */}
                              <td className="py-2 px-2">
                                <select
                                  value={row.counselorName}
                                  onChange={(e) => handleMappingChange(idx, "counselorName", e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                >
                                  <option value="">Select Counselor...</option>
                                  <option value="HO - TARANG SINGHAL - SICCES PVT LTD">
                                    HO - TARANG SINGHAL - SICCES PVT LTD
                                  </option>
                                  {counsellorsList.map((c: any) => {
                                    const nameStr = `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.email;
                                    return (
                                      <option key={c._id} value={nameStr}>
                                        {nameStr}
                                      </option>
                                    );
                                  })}
                                </select>
                              </td>

                              {/* Remove Button */}
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMappingRow(idx)}
                                  className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer p-1"
                                  title="Remove Line"
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Add New Line Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleAddMappingRow}
                        className="text-xs font-extrabold text-orange-600 hover:text-orange-700 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>+ Add New Line</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
