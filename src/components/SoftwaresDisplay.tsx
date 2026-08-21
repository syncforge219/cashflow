"use client";

import React, { useState, useEffect } from "react";

interface SoftwareItem {
  _id: string;
  name: string;
  domain: string;
  techUsed: string[];
  developerNames: string[];
  description?: string;
  status?: string;
  createdAt?: string;
}

export default function SoftwaresDisplay() {
  const [softwares, setSoftwares] = useState<SoftwareItem[]>([]);
  const [registeredDevs, setRegisteredDevs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State with Array fields
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [techInput, setTechInput] = useState("");
  const [techUsedList, setTechUsedList] = useState<string[]>([]);
  const [devInput, setDevInput] = useState("");
  const [developerNamesList, setDeveloperNamesList] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Active");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchSoftwares = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/softwares");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSoftwares(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch softwares:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDevRoster = async () => {
    try {
      const res = await fetch("/api/software-developers");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setRegisteredDevs(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch devs:", err);
    }
  };

  useEffect(() => {
    fetchSoftwares();
    fetchDevRoster();
  }, []);

  // Tech Array handlers
  const handleAddTechTag = () => {
    if (!techInput.trim()) return;
    const items = techInput.split(",").map((t) => t.trim()).filter(Boolean);
    const updated = Array.from(new Set([...techUsedList, ...items]));
    setTechUsedList(updated);
    setTechInput("");
  };

  const handleRemoveTechTag = (indexToRemove: number) => {
    setTechUsedList(techUsedList.filter((_, idx) => idx !== indexToRemove));
  };

  // Developer Array handlers
  const handleAddDevTag = (nameToAdd?: string) => {
    const val = nameToAdd || devInput;
    if (!val.trim()) return;
    const items = val.split(",").map((d) => d.trim()).filter(Boolean);
    const updated = Array.from(new Set([...developerNamesList, ...items]));
    setDeveloperNamesList(updated);
    setDevInput("");
  };

  const handleRemoveDevTag = (indexToRemove: number) => {
    setDeveloperNamesList(developerNamesList.filter((_, idx) => idx !== indexToRemove));
  };

  const handleCreateSoftware = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Software name is required.");
      return;
    }

    // Process any remaining items typed in input boxes before submitting
    let finalTech = [...techUsedList];
    if (techInput.trim()) {
      const pendingTech = techInput.split(",").map((t) => t.trim()).filter(Boolean);
      finalTech = Array.from(new Set([...finalTech, ...pendingTech]));
    }

    let finalDevs = [...developerNamesList];
    if (devInput.trim()) {
      const pendingDevs = devInput.split(",").map((d) => d.trim()).filter(Boolean);
      finalDevs = Array.from(new Set([...finalDevs, ...pendingDevs]));
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/softwares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          domain: domain.trim(),
          techUsed: finalTech,
          developerNames: finalDevs,
          description: description.trim(),
          status,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsModalOpen(false);
        // Reset form
        setName("");
        setDomain("");
        setTechInput("");
        setTechUsedList([]);
        setDevInput("");
        setDeveloperNamesList([]);
        setDescription("");
        setStatus("Active");
        fetchSoftwares();
      } else {
        setErrorMsg(data.error || "Failed to register software");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSoftware = async (id: string, softName: string) => {
    if (!confirm(`Are you sure you want to delete software "${softName}"?`)) return;

    try {
      const res = await fetch(`/api/softwares?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchSoftwares();
      } else {
        alert(data.error || "Failed to delete entry");
      }
    } catch (err) {
      console.error("Error deleting software:", err);
    }
  };

  const filteredSoftwares = softwares.filter((soft) => {
    const q = searchQuery.toLowerCase();
    return (
      soft.name.toLowerCase().includes(q) ||
      soft.domain.toLowerCase().includes(q) ||
      soft.techUsed.some((t) => t.toLowerCase().includes(q)) ||
      soft.developerNames.some((d) => d.toLowerCase().includes(q))
    );
  });

  // Calculate unique tech stacks and unique developers across all software
  const allTechs = Array.from(new Set(softwares.flatMap((s) => s.techUsed || [])));
  const allDevs = Array.from(new Set(softwares.flatMap((s) => s.developerNames || [])));

  return (
    <div className="space-y-6 flex-1 flex flex-col font-mono text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <span className="p-2 bg-emerald-950/80 border border-emerald-500/30 rounded-xl text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a3.375 3.375 0 0 1 0 8.488M16.5 5.5a6 6 0 0 1 0 13m-11.25-13A6 6 0 0 0 2.25 12a6 6 0 0 0 3 5.25m3.75-10.5a3.375 3.375 0 0 0 0 8.488M8.25 12h7.5" />
              </svg>
            </span>
            // SOFTWARE_PROJECTS_REGISTRY
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl font-medium">
            Register and manage software products, tech stacks, domains, and assigned developer teams.
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
              placeholder="Search by name, tech, dev..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs border border-slate-800 rounded-xl bg-slate-950/90 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-48 sm:w-64 transition-all"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 text-xs font-black bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 rounded-xl px-4 py-2 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Software
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-emerald-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">REGISTERED_SOFTWARES</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{softwares.length}</span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">Active Systems</span>
          </div>
        </div>

        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-cyan-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">TECH_STACK_VARIETIES</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-cyan-400">{allTechs.length}</span>
            <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded">Technologies</span>
          </div>
        </div>

        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-emerald-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">ASSIGNED_DEVELOPERS</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400">{allDevs.length}</span>
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">Engineers</span>
          </div>
        </div>

        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-emerald-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">DEPL_STATUS</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400">Production</span>
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">100% HEALTH</span>
          </div>
        </div>
      </div>

      {/* Software Projects List Catalog */}
      <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-5 shadow-xl flex-1">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div>
            <h2 className="text-base font-black text-white">// REGISTERED_SOFTWARE_CATALOG</h2>
            <p className="text-xs text-slate-400 font-medium">Software projects with tech stack arrays and developer assignments</p>
          </div>
          <span className="text-xs font-bold bg-slate-900 text-emerald-400 border border-slate-800 px-3 py-1 rounded-lg">
            {filteredSoftwares.length} System{filteredSoftwares.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm font-medium text-slate-500 animate-pulse">Loading software catalog...</div>
        ) : filteredSoftwares.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a3.375 3.375 0 0 1 0 8.488M16.5 5.5a6 6 0 0 1 0 13m-11.25-13A6 6 0 0 0 2.25 12a6 6 0 0 0 3 5.25m3.75-10.5a3.375 3.375 0 0 0 0 8.488M8.25 12h7.5" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-300">No software entries found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Click "Add Software" to register software products, technologies used, and developer teams.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSoftwares.map((soft) => (
              <div
                key={soft._id}
                className="bg-[#050811] border border-slate-800 hover:border-emerald-500/40 rounded-xl p-5 shadow-xl transition-all flex flex-col justify-between hover:shadow-[0_0_25px_rgba(16,185,129,0.1)] space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <h3 className="text-base font-black text-white truncate flex items-center gap-2">
                        <span className="text-emerald-400">&gt;</span> {soft.name}
                      </h3>
                      {soft.domain && (
                        <p className="text-xs text-cyan-400 font-mono flex items-center gap-1.5 truncate">
                          <span>🌐</span>
                          <a
                            href={soft.domain.startsWith("http") ? soft.domain : `https://${soft.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {soft.domain}
                          </a>
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-black bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 rounded px-2.5 py-1 uppercase tracking-wider shrink-0">
                      {soft.status || "Active"}
                    </span>
                  </div>

                  {soft.description && (
                    <p className="text-xs text-slate-400 font-medium mt-2 leading-relaxed">
                      {soft.description}
                    </p>
                  )}

                  {/* ARRAY 1: Tech Used Array Badges */}
                  <div className="mt-4 space-y-1.5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                      TECH_USED_ARRAY [{soft.techUsed?.length || 0}]
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {soft.techUsed && soft.techUsed.length > 0 ? (
                        soft.techUsed.map((tech, tIdx) => (
                          <span
                            key={tIdx}
                            className="text-[11px] font-bold bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 rounded-md px-2.5 py-0.5"
                          >
                            {tech}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-600 font-italic">No tech specified</span>
                      )}
                    </div>
                  </div>

                  {/* ARRAY 2: Developer Names Array Badges */}
                  <div className="mt-4 space-y-1.5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                      ASSIGNED_DEVELOPERS_ARRAY [{soft.developerNames?.length || 0}]
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {soft.developerNames && soft.developerNames.length > 0 ? (
                        soft.developerNames.map((devName, dIdx) => (
                          <span
                            key={dIdx}
                            className="text-[11px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 rounded-md px-2.5 py-0.5 flex items-center gap-1.5"
                          >
                            <span className="h-4 w-4 rounded-full bg-emerald-500/30 text-emerald-300 text-[9px] font-black flex items-center justify-center">
                              {devName.charAt(0).toUpperCase()}
                            </span>
                            {devName}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-600 font-italic">No developer assigned</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                  <span>
                    LOGGED: {soft.createdAt ? new Date(soft.createdAt).toLocaleDateString() : "Recent"}
                  </span>
                  <button
                    onClick={() => handleDeleteSoftware(soft._id, soft.name)}
                    className="text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer"
                  >
                    [DELETE_RECORD]
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cyber Add Software Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#0B0F19] border border-emerald-500/30 rounded-2xl max-w-lg w-full p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)] space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white">// REGISTER_NEW_SOFTWARE</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-300 p-1 rounded-lg">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateSoftware} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Software Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Lead2Ledger ERP Suite"
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Domain / URL</label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. https://lead2ledger.com"
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* ARRAY INPUT 1: Tech Used */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Technologies Used (Multiple Array Items)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={techInput}
                    onChange={(e) => setTechInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTechTag();
                      }
                    }}
                    placeholder="Type tech name (or comma separated)..."
                    className="flex-1 text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleAddTechTag}
                    className="px-3 py-2 text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40 rounded-xl hover:bg-cyan-900 cursor-pointer"
                  >
                    + Add Tech
                  </button>
                </div>

                {/* Tech Pills Preview */}
                {techUsedList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {techUsedList.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-cyan-950/90 text-cyan-300 border border-cyan-500/40 rounded-md px-2.5 py-1 flex items-center gap-1.5"
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTechTag(idx)}
                          className="text-cyan-400 hover:text-rose-400 font-black"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ARRAY INPUT 2: Developer Names */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Assigned Developers (Multiple Array Items)
                </label>

                {/* Quick Add from Roster Suggestions */}
                {registeredDevs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    <span className="text-[10px] text-slate-500 font-bold mr-1">Roster:</span>
                    {registeredDevs.map((dev) => (
                      <button
                        key={dev._id}
                        type="button"
                        onClick={() => handleAddDevTag(dev.name)}
                        className="text-[10px] bg-slate-900 hover:bg-emerald-950 text-slate-300 hover:text-emerald-300 border border-slate-800 rounded px-2 py-0.5 cursor-pointer"
                      >
                        + {dev.name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={devInput}
                    onChange={(e) => setDevInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddDevTag();
                      }
                    }}
                    placeholder="Type developer name (or comma separated)..."
                    className="flex-1 text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddDevTag()}
                    className="px-3 py-2 text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded-xl hover:bg-emerald-900 cursor-pointer"
                  >
                    + Add Dev
                  </button>
                </div>

                {/* Dev Pills Preview */}
                {developerNamesList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {developerNamesList.map((d, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 rounded-md px-2.5 py-1 flex items-center gap-1.5"
                      >
                        👤 {d}
                        <button
                          type="button"
                          onClick={() => handleRemoveDevTag(idx)}
                          className="text-emerald-400 hover:text-rose-400 font-black"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="System notes or scope details..."
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 border border-slate-800 rounded-xl hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-black text-slate-950 bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 rounded-xl disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                >
                  {submitting ? "Saving..." : "Register Software"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
