"use client";

import React, { useState, useEffect } from "react";

export default function SoftwareDevelopersDisplay() {
  const [developers, setDevelopers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    brandScope: "All Brands",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchDevelopers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/software-developers");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setDevelopers(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch developers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevelopers();
  }, []);

  const handleCreateDeveloper = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/software-developers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAddModalOpen(false);
        setFormData({ name: "", email: "", phone: "", password: "", brandScope: "All Brands" });
        fetchDevelopers();
      } else {
        setErrorMsg(data.error || "Failed to create developer");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDevelopers = developers.filter(
    (dev) =>
      dev.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.phone?.includes(searchQuery)
  );

  return (
    <div className="space-y-6 flex-1 flex flex-col font-mono text-slate-100">
      {/* Top Tech Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <span className="p-2 bg-emerald-950/80 border border-emerald-500/30 rounded-xl text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
              </svg>
            </span>
            // SOFTWARE_DEVELOPER_ROSTER
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl font-medium">
            Manage engineering personnel, platform credentials, system access roles, and software developer accounts.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
            </svg>
            <input
              type="text"
              placeholder="Filter developer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs border border-slate-800 rounded-xl bg-slate-950/90 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-48 sm:w-64 transition-all"
            />
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-black bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 rounded-xl px-4 py-2 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Provision Developer
          </button>
        </div>
      </div>

      {/* Cyber Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-emerald-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">TOTAL_ENGINEERS</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{developers.length}</span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">Engineering</span>
          </div>
        </div>

        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-emerald-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">ACTIVE_ACCOUNTS</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400">{developers.length}</span>
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">100% ONLINE</span>
          </div>
        </div>

        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-cyan-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">TECH_STACK</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-cyan-400">Next.js + TS</span>
            <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded">Fullstack</span>
          </div>
        </div>

        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-emerald-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">SECURITY_LEVEL</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400">Dev Root</span>
            <span className="text-[10px] font-bold text-slate-300 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded">Super Admin</span>
          </div>
        </div>
      </div>

      {/* Developers List Roster Grid */}
      <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-5 shadow-xl flex-1">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div>
            <h2 className="text-base font-black text-white">// REGISTERED_DEVELOPERS_GRID</h2>
            <p className="text-xs text-slate-400 font-medium">List of software developers registered in MongoDB cluster</p>
          </div>
          <span className="text-xs font-bold bg-slate-900 text-emerald-400 border border-slate-800 px-3 py-1 rounded-lg">
            {filteredDevelopers.length} Developer{filteredDevelopers.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm font-medium text-slate-500 animate-pulse">Loading software developers...</div>
        ) : filteredDevelopers.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-300">No software developers found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Click "Provision Developer" to register software engineers and technical team members.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDevelopers.map((dev) => (
              <div
                key={dev._id}
                className="bg-[#050811] border border-slate-800 hover:border-emerald-500/40 rounded-xl p-4 shadow-xl transition-all flex flex-col justify-between hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]"
              >
                <div>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-slate-950 font-black flex items-center justify-center shrink-0 shadow-md text-sm">
                      {dev.name ? dev.name.charAt(0).toUpperCase() : "D"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-slate-100 truncate">{dev.name}</h3>
                      <span className="text-[9px] font-black bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 rounded px-2 py-0.5 uppercase tracking-wider inline-block mt-0.5">
                        {dev.role || "Software Developer"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-emerald-400 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                      <span className="truncate text-cyan-300">{dev.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-500 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.596-5.48-4.18-7.076-7.076l1.293-.97c.362-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25z" />
                      </svg>
                      <span className="text-slate-300">{dev.phone || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>SCOPE: {dev.brandScope || "All Brands"}</span>
                  <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 rounded px-2 py-0.5">
                    [ONLINE]
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cyber Add Developer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#0B0F19] border border-emerald-500/30 rounded-2xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white">// PROVISION_SOFTWARE_DEVELOPER</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-500 hover:text-slate-300 p-1 rounded-lg">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateDeveloper} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Alex Johnson"
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. dev@company.com"
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 border border-slate-800 rounded-xl hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-black text-slate-950 bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 rounded-xl disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                >
                  {submitting ? "Provisioning..." : "Create Developer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
