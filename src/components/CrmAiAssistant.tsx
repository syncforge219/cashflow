"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LeadProfile from "./LeadProfile";
import { useUser } from "@/app/component/context/user-context";

interface Lead {
  _id: string;
  studentFullName: string;
  phone?: string;
  targetCourse?: string;
  status?: string;
  priorityLevel?: string;
  assignedCrmAdvisor?: string;
  enquiryId?: string;
  [key: string]: any;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  leads?: Lead[];
  stats?: any;
  timestamp: string;
}

export default function CrmAiAssistant() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedLeadForDrawer, setSelectedLeadForDrawer] = useState<Lead | null>(null);

  const roleLabel = (user?.role || "counsellor").toUpperCase();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      sender: "ai",
      text: `🧠 **Hello ${user?.name || "User"}! I am your Ultra-Reasoning AI Intelligence Engine.**\n\nOperating with **${roleLabel} Role Access**. Powered by Multi-Step Chain-of-Thought (CoT) analytical logic. Ask me complex **CRM analytics, financial strategy, or reasoning questions**!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || prompt;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setPrompt("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSend,
          userRole: user?.role || "counsellor",
          userName: user?.name || "",
          userEmail: user?.email || "",
          userBrandScope: user?.brandScope || ""
        })
      });

      const data = await res.json();
      if (res.ok) {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: data.answer || "I processed your request against authorized application data.",
          leads: data.leads || [],
          stats: data.stats,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: "⚠️ " + (data.error || "Failed to retrieve application data."),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, aiMsg]);
      }
    } catch (e: any) {
      console.error(e);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: "⚠️ Network error connecting to CRM AI Assistant service.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Helper to render bold markdown cleanly anywhere in lines
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} className="font-extrabold text-slate-900 bg-purple-100/70 px-1.5 py-0.5 rounded border border-purple-200/80">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* FLOATING DRAGGABLE LAUNCHER BUTTON */}
      <motion.div 
        drag
        dragMomentum={false}
        className="fixed bottom-6 right-6 z-50 cursor-grab active:cursor-grabbing touch-none select-none"
      >
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="group relative flex items-center gap-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white px-5 py-3.5 rounded-full shadow-[0_12px_35px_rgba(99,102,241,0.45)] hover:shadow-[0_15px_45px_rgba(99,102,241,0.6)] transition-all duration-300 border border-purple-300/40 cursor-pointer"
        >
          {/* Drag Handle Indicator */}
          <div className="text-purple-300 opacity-60 group-hover:opacity-100 text-xs font-mono select-none mr-0.5">
            ⠿
          </div>

          <div className="relative flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-purple-200 group-hover:rotate-12 transition-transform duration-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
          </div>
          <span className="text-xs font-black tracking-wider uppercase select-none">
            {isOpen ? "Close AI Copilot" : "✨ CashFlow AI"}
          </span>
        </motion.button>
      </motion.div>

      {/* FLOATING MODERN DRAGGABLE GLASSMORPHIC AI TAB WINDOW */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragMomentum={false}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="fixed bottom-24 right-6 z-50 w-[calc(100vw-2rem)] sm:w-[460px] h-[650px] max-h-[82vh] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_25px_70px_-15px_rgba(79,70,229,0.35)] border border-indigo-200/80 flex flex-col overflow-hidden select-none"
          >
            {/* DRAGGABLE HEADER BAR */}
            <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-purple-950 text-white p-4 sm:p-5 border-b border-indigo-500/20 flex items-center justify-between shrink-0 shadow-lg relative overflow-hidden cursor-grab active:cursor-grabbing">
              <div className="absolute -right-8 -top-8 w-28 h-28 bg-purple-500/15 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-center gap-3.5 z-10 pointer-events-none">
                <div className="h-11 w-11 bg-gradient-to-tr from-purple-600 via-indigo-500 to-emerald-400 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/30 border border-white/20 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold tracking-tight">CashFlow AI Assistant</h3>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-500/30 shadow-xs">
                      {roleLabel} Scope
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-200/80 font-medium mt-0.5 flex items-center gap-1.5">
                    <span className="text-indigo-400 font-mono text-[10px]">⠿ Drag anywhere</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                    {user?.role === "admin" ? "Full Access Scope" : (user?.role === "brand manager" || user?.role === "centre head") ? `Brand: ${user?.brandScope || "Assigned Brands"}` : `Assigned: ${user?.name || "Counsellor"}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 z-10 pointer-events-auto">
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-indigo-200 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                  title="Close AI Window"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* QUICK PROMPT SUGGESTIONS CHIPS */}
            <div className="bg-slate-50/90 border-b border-slate-200/80 p-2.5 overflow-x-auto flex items-center gap-2 shrink-0 scrollbar-none shadow-xs select-auto">
              {[
                { label: "📊 Executive Summary", query: "Give me the executive pipeline summary and big picture" },
                { label: "💹 Deep Financials", query: "Analyze total revenue, profit margin, payroll and operational expenses" },
                { label: "🎯 Funnel Analysis", query: "Analyze conversion funnel bottlenecks and lead drop reasons" },
                { label: "🔮 Forecast", query: "Forecast end of month admissions and revenue projection" },
                { label: "🏆 Team Leaderboard", query: "Show team performance leaderboard and counsellor rankings" },
                { label: "🔥 Hot Leads", query: "Show hot high priority leads" },
                { label: "❄️ Cold Leads", query: "Show stale cold inactive leads" },
                { label: "🎥 Demo Tracking", query: "Show demo class pipeline and today's demo sessions" },
                { label: "⏳ Pending Tasks", query: "Show all pending and overdue follow-up tasks" },
                { label: "🎓 Admissions", query: "Show admissions and fee collection summary" },
                { label: "🚨 Risk Alerts", query: "Show risk alerts and critical warnings in the pipeline" },
                { label: "🚀 Playbook", query: "Give me the best strategy to improve admission conversions" },
              ].map((chip, idx) => (
                <button
                  key={idx}
                  disabled={loading}
                  onClick={() => handleSend(chip.query)}
                  className="whitespace-nowrap px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-[11px] font-bold text-slate-700 hover:text-purple-700 transition-all shrink-0 shadow-2xs hover:scale-[1.02] active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* CHAT FEED */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-indigo-200/80 [&::-webkit-scrollbar-thumb]:rounded-full select-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl p-4 text-xs transition-all ${
                      msg.sender === "user"
                        ? "bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white shadow-md shadow-indigo-600/15 rounded-br-none"
                        : "bg-white border border-slate-200/90 text-slate-800 shadow-sm rounded-bl-none"
                    }`}
                  >
                    {/* TEXT CONTENT WITH CLEAN MARKDOWN PARSING */}
                    <div className="whitespace-pre-wrap leading-relaxed font-medium">
                      {msg.text.split("\n").map((line, i) => {
                        if (line.startsWith("- ") || line.startsWith("• ")) {
                          const cleanLine = line.replace(/^[-•]\s*/, "");
                          return (
                            <div key={i} className="flex items-start gap-2 my-1 pl-1">
                              <span className="text-purple-600 font-bold shrink-0 mt-0.5">•</span>
                              <span className="flex-1">{renderFormattedText(cleanLine)}</span>
                            </div>
                          );
                        }
                        return (
                          <p key={i} className="mb-1.5 last:mb-0">
                            {renderFormattedText(line)}
                          </p>
                        );
                      })}
                    </div>

                    {/* RENDER MATCHED STUDENT LEADS IF RETURNED */}
                    {msg.leads && msg.leads.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                            Authorized Student Profiles ({msg.leads.length})
                          </p>
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                            Live Data
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2.5">
                          {msg.leads.map((lead) => {
                            const initials = (lead.studentFullName || "ST")
                              .split(" ")
                              .map((n: string) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase();

                            const isHot = lead.priorityLevel === "High" || lead.priority === "High";

                            return (
                              <div
                                key={lead._id}
                                className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all flex items-center justify-between gap-3 group"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 bg-gradient-to-tr from-purple-100 to-indigo-100 text-purple-700 font-extrabold text-xs rounded-xl flex items-center justify-center border border-purple-200/60 shrink-0">
                                    {initials}
                                  </div>
                                  <div className="flex flex-col">
                                    <h5 className="text-xs font-extrabold text-slate-800 group-hover:text-purple-700 transition-colors flex items-center gap-1.5">
                                      {lead.studentFullName}
                                    </h5>
                                    <span className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                      {lead.targetCourse || "General Course"} {lead.phone ? `• ${lead.phone}` : ""}
                                    </span>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                        lead.status?.toLowerCase().includes("demo")
                                          ? "bg-purple-100 text-purple-700"
                                          : lead.status?.toLowerCase() === "admitted"
                                          ? "bg-emerald-100 text-emerald-700"
                                          : "bg-indigo-50 text-indigo-700"
                                      }`}>
                                        {lead.status || "New"}
                                      </span>
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                        isHot ? "bg-rose-100 text-rose-700" : "bg-amber-50 text-amber-700"
                                      }`}>
                                        {lead.priorityLevel || "Medium"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => setSelectedLeadForDrawer(lead)}
                                  className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[11px] font-bold rounded-xl transition-all shadow-sm hover:shadow-purple-500/20 shrink-0 cursor-pointer flex items-center gap-1"
                                >
                                  <span>View Profile</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <span className={`text-[9px] font-mono mt-2 block text-right ${msg.sender === "user" ? "text-indigo-200" : "text-slate-400"}`}>
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-3 text-purple-700 text-xs font-bold py-3 px-4 bg-white border border-purple-200/80 rounded-2xl max-w-[300px] shadow-sm animate-pulse">
                  <div className="h-4 w-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  AI Engine reasoning across {`{live CRM data}`}...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* FLOATING INPUT ACTION BAR */}
            <div className="p-3 bg-white border-t border-slate-200/90 flex items-center gap-2 shrink-0 shadow-lg select-auto">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder={`Ask AI or reasoning question in ${roleLabel} scope...`}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition-all bg-slate-50 focus:bg-white placeholder:text-slate-400"
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !prompt.trim()}
                className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl transition-all disabled:opacity-40 shadow-md shadow-purple-600/20 active:scale-95 cursor-pointer shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* LEAD PROFILE OVERLAY WHEN AI CARD VIEW IS CLICKED */}
      {selectedLeadForDrawer && (
        <LeadProfile
          lead={selectedLeadForDrawer}
          onClose={() => setSelectedLeadForDrawer(null)}
        />
      )}
    </>
  );
}
