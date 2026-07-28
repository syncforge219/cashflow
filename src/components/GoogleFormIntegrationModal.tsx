"use client";

import React, { useState, useEffect } from "react";

interface GoogleFormIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GoogleFormIntegrationModal({ isOpen, onClose }: GoogleFormIntegrationModalProps) {
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState("CADD MANTRA");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/brands")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.brands)) {
            setBrands(data.brands);
            if (data.brands.length > 0) {
              setSelectedBrand(data.brands[0].name);
            }
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const publicWebformUrl = `${origin}/public/enquiry/${encodeURIComponent(selectedBrand)}`;
  const webhookApiUrl = `${origin}/api/enquiries/google-form`;

  const appsScriptCode = `/**
 * Google Apps Script for linking Google Forms directly to CoachFlow
 * Instructions:
 * 1. Open your Google Form -> click 3 dots (top right) -> Script editor
 * 2. Replace all code in the script editor with this code
 * 3. Save, then click 'Triggers' (alarm icon on left) -> Add Trigger
 * 4. Choose 'onFormSubmit' function -> Select event type 'On form submit' -> Save!
 */

function onFormSubmit(e) {
  var WEBHOOK_URL = "${webhookApiUrl}";
  var TARGET_BRAND = "${selectedBrand}";

  var itemResponses = e.response.getItemResponses();
  var payload = {
    targetBrand: TARGET_BRAND,
    leadSource: "Google Form",
    remarks: "Submitted via Google Form"
  };

  for (var i = 0; i < itemResponses.length; i++) {
    var title = itemResponses[i].getItem().getTitle().toLowerCase();
    var response = itemResponses[i].getResponse();

    if (title.indexOf("name") !== -1) {
      payload.studentFullName = response;
    } else if (title.indexOf("mobile") !== -1 || title.indexOf("phone") !== -1) {
      payload.primaryPhoneMobile = response;
    } else if (title.indexOf("email") !== -1) {
      payload.emailAddress = response;
    } else if (title.indexOf("city") !== -1) {
      payload.currentCity = response;
    } else if (title.indexOf("course") !== -1) {
      payload.targetCourse = response;
    } else if (title.indexOf("remark") !== -1 || title.indexOf("note") !== -1 || title.indexOf("comment") !== -1) {
      payload.remarks = response;
    }
  }

  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    var res = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log("CoachFlow Google Form Response: " + res.getContentText());
  } catch (err) {
    Logger.log("CoachFlow Google Form Error: " + err.toString());
  }
}`;

  const copyToClipboard = (text: string, type: "link" | "script") => {
    navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(selectedBrand);
      setTimeout(() => setCopiedLink(null), 2500);
    } else {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[70] font-sans animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 shrink-0 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-xl">
              📝
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                Google Form & Brand Webform Integration
              </h3>
              <p className="text-xs text-indigo-300 font-medium">
                Connect external Google Forms & share brand-specific inquiry links to store leads directly in CoachFlow.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 bg-slate-800/60 rounded-full border border-slate-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Brand Selector */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Select Brand for Form Link & Integration
              </label>
              <p className="text-xs text-slate-500">
                Each brand has its own branded public lead form link and auto-assignment rules.
              </p>
            </div>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-extrabold text-indigo-900 bg-white outline-none focus:ring-2 focus:ring-indigo-500/40 shadow-xs cursor-pointer"
            >
              {brands.map((b) => (
                <option key={b._id || b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Option 1: Direct Public Webform */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase">
                  Option 1
                </span>
                <h4 className="text-sm font-extrabold text-slate-800">
                  Public Inquiry Form Link ({selectedBrand})
                </h4>
              </div>
              <a
                href={publicWebformUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
              >
                Open Form Page ↗
              </a>
            </div>
            <p className="text-xs text-slate-600">
              Share this link directly on social media, WhatsApp, or website buttons. Leads submitted here are automatically created and assigned to {selectedBrand} sales executives.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={publicWebformUrl}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-semibold text-slate-700 outline-none"
              />
              <button
                onClick={() => copyToClipboard(publicWebformUrl, "link")}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-xs"
              >
                {copiedLink === selectedBrand ? "✔ Copied!" : "Copy Link"}
              </button>
            </div>
          </div>

          {/* Option 2: Google Forms Apps Script */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase">
                  Option 2
                </span>
                <h4 className="text-sm font-extrabold text-slate-800">
                  Connect Google Form via Apps Script Webhook
                </h4>
              </div>
              <button
                onClick={() => copyToClipboard(appsScriptCode, "script")}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
              >
                {copiedScript ? "✔ Script Copied!" : "📋 Copy Google Apps Script"}
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="font-bold text-slate-800">Step-by-step instructions to link any Google Form:</p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                <li>Open your Google Form -&gt; click the <strong>3 dots menu</strong> (top right) -&gt; click <strong>Script editor</strong>.</li>
                <li>Delete any code in the editor and paste the copied Apps Script snippet below.</li>
                <li>Click <strong>Save</strong> (floppy icon), then click <strong>Triggers</strong> (alarm clock icon on the left menu).</li>
                <li>Click <strong>+ Add Trigger</strong> (bottom right) -&gt; Set function to <code>onFormSubmit</code> -&gt; Select event type: <strong>On form submit</strong> -&gt; Click <strong>Save</strong>!</li>
              </ol>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Google Apps Script Snippet for {selectedBrand}
              </label>
              <textarea
                readOnly
                rows={10}
                value={appsScriptCode}
                className="w-full p-4 rounded-xl border border-slate-800 bg-slate-900 text-emerald-400 font-mono text-[11px] outline-none shadow-inner leading-relaxed"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between rounded-b-3xl">
          <p className="text-xs text-slate-500 font-medium">
            Webhook Endpoint: <code className="text-indigo-600 font-mono">{webhookApiUrl}</code>
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-extrabold rounded-xl transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
