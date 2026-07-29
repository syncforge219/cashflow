"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LeadSourceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSourceAdded?: (newSource: string) => void;
}

export default function LeadSourceManagerModal({
  isOpen,
  onClose,
  onSourceAdded,
}: LeadSourceManagerModalProps) {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchSources = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/lead-sources");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setSources(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch lead sources:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSources();
      setNewSourceName("");
      setErrorMsg("");
      setSuccessMsg("");
    }
  }, [isOpen]);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceName.trim()) {
      setErrorMsg("Lead source name cannot be empty.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/lead-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSourceName.trim() }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessMsg(`Lead Source "${json.data.name}" saved successfully!`);
        const addedName = json.data.name;
        setNewSourceName("");
        await fetchSources();
        if (onSourceAdded) {
          onSourceAdded(addedName);
        }
      } else {
        setErrorMsg(json.message || "Failed to add lead source.");
      }
    } catch (err: any) {
      console.error("Error adding lead source:", err);
      setErrorMsg(err.message || "Network error while saving lead source.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSource = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete lead source "${name}"?`)) return;

    try {
      const res = await fetch(`/api/lead-sources/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setSources((prev) => prev.filter((s) => s._id !== id));
      } else {
        alert(json.message || "Failed to delete lead source.");
      }
    } catch (err) {
      console.error("Error deleting lead source:", err);
      alert("Error deleting lead source.");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Lead Sources Manager</h3>
                <p className="text-[10px] font-semibold text-slate-400">Add & Manage custom lead acquisition channels</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form to Add Source */}
          <div className="p-4 border-b border-slate-100 bg-white shrink-0">
            <form onSubmit={handleAddSource} className="space-y-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Create New Lead Source <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="e.g. Instagram Ads, YouTube, Exhibition"
                  className="flex-1 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="submit"
                  disabled={isSubmitting || !newSourceName.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Add Source"}
                </button>
              </div>

              {errorMsg && (
                <div className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                  {successMsg}
                </div>
              )}
            </form>
          </div>

          {/* List of Existing Lead Sources */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1 mb-2">
              Saved Lead Sources ({sources.length})
            </h4>

            {loading ? (
              <div className="text-center py-8 text-xs font-semibold text-slate-400">Loading sources from database...</div>
            ) : sources.length === 0 ? (
              <div className="text-center py-8 text-xs font-semibold text-slate-400">No lead sources found in database.</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {sources.map((s) => (
                  <div
                    key={s._id || s.name}
                    className="flex items-center justify-between bg-white border border-slate-200/80 rounded-xl px-3.5 py-2.5 shadow-2xs hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                      <span className="text-xs font-bold text-slate-800">{s.name}</span>
                    </div>

                    {!s.isSystem && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSource(s._id, s.name)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                        title="Delete Lead Source"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-100 bg-white flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
