"use client";

import React, { useState, useEffect } from "react";
import SoftwareDeveloperSidebar from "@/components/SoftwareDeveloperSidebar";
import ProfileDisplay from "@/components/ProfileDisplay";
import { useUser } from "@/app/component/context/user-context";
import Link from "next/link";

export default function SoftwareDeveloperPage() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Terminal & Tech Console Interactive State
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    "[$] Initializing Lead2Ledger Dev Engine v2.0...",
    "[$] AUTH_SESSION: Verified (JWT Token Valid)",
    "[$] DATABASE: Connected to MongoDB Cluster [Latency: 12ms]",
    "[$] SECURITY: Role-based Developer Access Granted.",
    "[$] Type command or click quick tools below...",
  ]);
  const [cliInput, setCliInput] = useState("");
  const [pingStatus, setPingStatus] = useState("OK (12ms)");
  const [isPinging, setIsPinging] = useState(false);

  const handleRunCommand = (cmd: string) => {
    const cleanCmd = cmd.trim().toLowerCase();
    let response = "";

    if (cleanCmd === "help") {
      response = "Available Commands: status, user, env, ping, db, clear";
    } else if (cleanCmd === "status") {
      response = "SYS_STATUS: ONLINE | HEALTH: 100% | MEMORY: 42MB / 512MB";
    } else if (cleanCmd === "user") {
      response = `LOGGED_IN: ${user?.name} | EMAIL: ${user?.email} | ROLE: ${user?.role}`;
    } else if (cleanCmd === "env") {
      response = `APP_NAME: ${user?.customAppName || "Coach"} | BRAND_SCOPE: ${user?.brandScope || "All Brands"}`;
    } else if (cleanCmd === "ping") {
      response = "PING /api/software-developers -> 200 OK (11ms)";
    } else if (cleanCmd === "db") {
      response = "MONGO_URI: mongodb+srv://... [STATE: CONNECTED (1)]";
    } else if (cleanCmd === "clear") {
      setTerminalOutput(["[$] Terminal logs cleared."]);
      setCliInput("");
      return;
    } else {
      response = `Command not recognized: "${cmd}". Type 'help' for options.`;
    }

    setTerminalOutput((prev) => [...prev, `[$] ${cmd}`, `[>] ${response}`]);
    setCliInput("");
  };

  const runPingCheck = async () => {
    setIsPinging(true);
    const start = Date.now();
    try {
      const res = await fetch("/api/software-developers");
      const elapsed = Date.now() - start;
      if (res.ok) {
        setPingStatus(`200 OK (${elapsed}ms)`);
        setTerminalOutput((prev) => [
          ...prev,
          `[$] ping /api/software-developers -> 200 OK (${elapsed}ms)`,
        ]);
      } else {
        setPingStatus(`ERR ${res.status}`);
      }
    } catch (err) {
      setPingStatus("CONN_FAIL");
    } finally {
      setIsPinging(false);
    }
  };

  if (!user) return null;

  const roleLower = (user.role || "").toLowerCase().trim();

  // Role validation: check if logged-in user is a Software Developer or Super Admin
  const allowedDevRoles = [
    "super admin",
    "admin",
    "director",
    "software developer",
    "software_developer",
    "developer",
    "software engineer",
    "tech lead",
  ];

  const isSoftwareDeveloper = allowedDevRoles.includes(roleLower);
  const initialLetter = user.name ? user.name.charAt(0).toUpperCase() : "D";

  return (
    <div className="flex h-screen bg-[#050811] text-slate-100 overflow-hidden font-mono selection:bg-emerald-500 selection:text-slate-950 relative">
      {/* Ambient Techky Mesh Accents */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Software Developer Techky Sidebar */}
      <SoftwareDeveloperSidebar />

      {/* Main Developer Console Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 space-y-6 z-10 custom-scrollbar">
        {/* Tech Header Navbar */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-4 shrink-0">
          <div>
            <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-2 select-none tracking-widest">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>DEV_CONSOLE // PORTAL_v2.0</span>
            </div>
            <h1 className="text-xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
              <span className="text-emerald-400 font-extrabold">&gt;_</span> Software Developer Workspace
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Tech Status Pill */}
            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-slate-900/90 border border-emerald-500/30 rounded-xl text-xs">
              <span className="text-slate-400">API Latency:</span>
              <span className="text-emerald-400 font-bold">{pingStatus}</span>
            </div>

            <ProfileDisplay
              isOpen={isProfileOpen}
              onClose={() => setIsProfileOpen(false)}
              user={user}
              logout={logout}
            />

            <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-100">{user.name}</div>
                <div className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">
                  {user.role}
                </div>
              </div>
              <button
                onClick={() => setIsProfileOpen(true)}
                className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-slate-950 font-black flex items-center justify-center text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:scale-105 transition-all cursor-pointer border border-emerald-400/40"
              >
                {initialLetter}
              </button>
            </div>
          </div>
        </header>

        {/* RESTRICTED ACCESS SCREEN FOR NON-DEVELOPERS */}
        {!isSoftwareDeveloper ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="bg-[#0B0F19] border border-rose-500/30 rounded-2xl p-8 max-w-lg w-full text-center shadow-[0_0_40px_rgba(244,63,94,0.15)] space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto text-3xl shadow-inner">
                🔒
              </div>
              <div className="space-y-2">
                <span className="inline-block px-3 py-1 bg-rose-950/80 text-rose-300 text-[10px] font-black rounded-md uppercase tracking-widest border border-rose-500/30">
                  SECURITY_RESTRICTION_TRIGGERED
                </span>
                <h2 className="text-xl font-black text-white">
                  Super Admin & Software Developer Access Only
                </h2>
                <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-md mx-auto">
                  Access denied. This developer console requires an active session with role{" "}
                  <strong className="text-emerald-400">Software Developer</strong> or <strong className="text-emerald-400">Super Admin</strong>.
                </p>
              </div>

              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl text-left text-xs space-y-2 font-medium">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Current Identity:</span>
                  <span className="font-bold text-slate-200">{user.name} ({user.email})</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Current Role:</span>
                  <span className="font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30 uppercase text-[10px]">
                    {user.role || "Standard User"}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <Link
                  href="/"
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 text-xs font-black rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
                >
                  Return to Dashboard
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* SOFTWARE DEVELOPER ACCESS GRANTED - TECHKY WORKSPACE */
          <div className="space-y-6 flex-1">
            {/* Tech Cyber Developer Banner */}
            <div className="bg-[#090E1A] border border-emerald-500/30 p-6 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.6)] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden group">
              <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-emerald-500/10 via-cyan-500/5 to-transparent pointer-events-none" />

              <div className="flex items-center gap-5 z-10">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.3)] shrink-0 border border-emerald-300/40">
                  {initialLetter}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-white tracking-tight">{user.name}</h2>
                    <span className="px-2.5 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-black rounded-md uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      AUTHENTICATED_DEV
                    </span>
                  </div>
                  <p className="text-xs text-cyan-300/80 font-mono">{user.email}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-300 pt-1">
                    <span className="bg-slate-900/90 px-2.5 py-0.5 rounded-md border border-slate-800 text-slate-300">
                      ROLE: <strong className="text-emerald-400">{user.role}</strong>
                    </span>
                    <span className="bg-slate-900/90 px-2.5 py-0.5 rounded-md border border-slate-800 text-slate-300">
                      SCOPE: <strong className="text-cyan-400">{user.brandScope || "All Brands"}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="z-10 flex flex-wrap md:flex-col items-start md:items-end justify-between gap-3 border-t md:border-t-0 md:border-l border-slate-800/80 pt-4 md:pt-0 md:pl-6">
                <div className="text-left md:text-right">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Environment App</span>
                  <span className="text-sm font-black text-emerald-400">{user.customAppName || "Coach ERP"}</span>
                </div>
                <div className="text-left md:text-right">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">System Protocol</span>
                  <span className="text-xs font-bold text-cyan-400">Next.js App Router (TLS 1.3)</span>
                </div>
              </div>
            </div>

            {/* Main Interactive Developer Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Developer Profile Details Card */}
              <div className="lg:col-span-2 bg-[#090E1A] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 hover:border-emerald-500/30 transition-all">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <span className="text-emerald-400">&gt;</span> Logged-in Developer Profile & Identity
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">Verified system identity credentials and parameters</p>
                  </div>
                  <span className="text-[10px] font-black bg-emerald-950/80 text-emerald-300 px-3 py-1 rounded-md border border-emerald-500/30 uppercase tracking-widest">
                    SESSION_VALID
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1 hover:border-cyan-500/30 transition-all">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Full Name</span>
                    <span className="text-sm font-extrabold text-white">{user.name}</span>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1 hover:border-cyan-500/30 transition-all">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Email Address</span>
                    <span className="text-sm font-extrabold text-cyan-300">{user.email}</span>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1 hover:border-emerald-500/30 transition-all">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Assigned Role</span>
                    <span className="text-sm font-extrabold text-emerald-400">{user.role}</span>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1 hover:border-cyan-500/30 transition-all">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Phone Contact</span>
                    <span className="text-sm font-extrabold text-slate-300">{user.phone || "Not Specified"}</span>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1 hover:border-cyan-500/30 transition-all">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Brand Scope</span>
                    <span className="text-sm font-extrabold text-slate-200">{user.brandScope || "All Brands"}</span>
                  </div>

                  <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1 hover:border-cyan-500/30 transition-all">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Custom App Title</span>
                    <span className="text-sm font-extrabold text-slate-200">{user.customAppName || "Coach"}</span>
                  </div>
                </div>

                {/* Developer System Operations Matrix */}
                <div className="pt-2">
                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-3">
                    // PERMISSION_MATRIX & SUBSYSTEM_ACCESS
                  </h4>
                  <div className="border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-4">Module</th>
                          <th className="py-2.5 px-4">Authority</th>
                          <th className="py-2.5 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 font-semibold text-slate-300">
                        <tr>
                          <td className="py-3 px-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                            API Routes & Endpoints
                          </td>
                          <td className="py-3 px-4 font-bold text-white">Full Read / Write</td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 font-extrabold rounded border border-emerald-500/30 text-[10px]">
                              [GRANTED]
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                            MongoDB Models & Schemas
                          </td>
                          <td className="py-3 px-4 font-bold text-white">Schema Admin</td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 font-extrabold rounded border border-emerald-500/30 text-[10px]">
                              [GRANTED]
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
                            Developer Roster Management
                          </td>
                          <td className="py-3 px-4 font-bold text-white">Provision & Register</td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 font-extrabold rounded border border-cyan-500/30 text-[10px]">
                              [ACTIVE]
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Terminal & Tech Tools */}
              <div className="space-y-6">
                {/* Interactive CLI Terminal Window */}
                <div className="bg-[#04060C] border border-emerald-500/30 rounded-2xl overflow-hidden shadow-[0_0_25px_rgba(0,0,0,0.8)] flex flex-col">
                  {/* Terminal Header */}
                  <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
                      <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                      <span className="text-[10px] font-bold text-slate-400 ml-2">bash --dev-terminal</span>
                    </div>
                    <button
                      onClick={() => handleRunCommand("clear")}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Terminal Logs Window */}
                  <div className="p-4 h-48 overflow-y-auto text-xs space-y-1.5 font-mono text-emerald-400/90 bg-slate-950/90 custom-scrollbar">
                    {terminalOutput.map((line, idx) => (
                      <div key={idx} className={line.startsWith("[>]") ? "text-cyan-300 pl-2" : "text-emerald-400"}>
                        {line}
                      </div>
                    ))}
                  </div>

                  {/* Terminal Input Prompt */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (cliInput) handleRunCommand(cliInput);
                    }}
                    className="flex items-center bg-slate-900/80 px-3 py-2 border-t border-slate-800"
                  >
                    <span className="text-emerald-400 text-xs font-bold mr-2">&gt;</span>
                    <input
                      type="text"
                      value={cliInput}
                      onChange={(e) => setCliInput(e.target.value)}
                      placeholder="Type command (e.g. help, ping, status)..."
                      className="w-full bg-transparent text-xs text-white font-mono focus:outline-none placeholder-slate-600"
                    />
                  </form>
                </div>

                {/* Quick Action Tech Tool Buttons */}
                <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest border-b border-slate-800 pb-2">
                    // DEV_TOOLS_PANEL
                  </h4>

                  <div className="space-y-2 text-xs">
                    <button
                      onClick={runPingCheck}
                      disabled={isPinging}
                      className="w-full flex items-center justify-between p-3 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 rounded-xl font-bold text-emerald-300 transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span>⚡</span> Test API Ping Latency
                      </span>
                      <span>{isPinging ? "Testing..." : "Execute →"}</span>
                    </button>

                    <Link
                      href="/software-developers"
                      className="w-full flex items-center justify-between p-3 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 rounded-xl font-bold text-cyan-300 transition-all cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <span>👥</span> Developer Roster & Provisioning
                      </span>
                      <span>Open →</span>
                    </Link>
                  </div>
                </div>

                {/* Tech Stack Matrix */}
                <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest border-b border-slate-800 pb-2">
                    // TECH_STACK_MATRIX
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 font-bold">Framework</span>
                      <span className="text-cyan-400 font-bold">Next.js (App Router)</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 font-bold">Language</span>
                      <span className="text-emerald-400 font-bold">TypeScript 5.0</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 font-bold">Database</span>
                      <span className="text-emerald-400 font-bold">MongoDB Mongoose</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
