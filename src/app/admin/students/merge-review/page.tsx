"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface RecordItem {
  type: "Enquiry" | "Admission";
  id: string;
  businessId: string;
  enquiryId: string | null;
  studentId: string | null;
  fullName: string;
  primaryPhone: string;
  email: string;
  parentName: string;
  parentPhone: string;
  guardian2Name: string;
  guardian2Phone: string;
  city: string;
  courses: string[];
  brand: string;
  date: string;
}

interface Cluster {
  clusterId: string;
  matchField: string;
  matchValue: string;
  hasDiscrepancy: boolean;
  discrepancyNote: string;
  records: RecordItem[];
}

export default function StudentMergeReviewPage() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Field selections for current cluster
  const [selectedFields, setSelectedFields] = useState<{
    fullName: string;
    primaryPhone: string;
    email: string;
    city: string;
    parentName: string;
    parentPhone: string;
  }>({
    fullName: "",
    primaryPhone: "",
    email: "",
    city: "",
    parentName: "",
    parentPhone: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Unmerge modal state
  const [unmergeModalOpen, setUnmergeModalOpen] = useState(false);
  const [unmergeRecordId, setUnmergeRecordId] = useState("");
  const [unmergeRecordType, setUnmergeRecordType] = useState<"Enquiry" | "Admission">("Admission");
  const [unmerging, setUnmerging] = useState(false);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/students/merge-candidates");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to load merge candidates");
      }
      setClusters(json.data?.clusters || []);
      setCurrentIndex(0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentCluster = clusters[currentIndex];

  useEffect(() => {
    if (currentCluster && currentCluster.records.length > 0) {
      const recs = currentCluster.records;
      // Default winning values from most comprehensive record (prefer Admission)
      const primaryRec = recs.find((r) => r.type === "Admission") || recs[0];
      setSelectedFields({
        fullName: primaryRec.fullName || recs[0].fullName || "",
        primaryPhone: primaryRec.primaryPhone || recs[0].primaryPhone || "",
        email: recs.find((r) => r.email)?.email || "",
        city: recs.find((r) => r.city)?.city || "",
        parentName: recs.find((r) => r.parentName)?.parentName || "",
        parentPhone: recs.find((r) => r.parentPhone)?.parentPhone || "",
      });
    }
  }, [currentIndex, currentCluster]);

  const handleConfirmMerge = async () => {
    if (!currentCluster) return;
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      const recordIds = currentCluster.records.map((r) => ({ type: r.type, id: r.id }));

      const res = await fetch("/api/students/merge-review/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordIds,
          winningValues: selectedFields,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Merge failed");

      setSuccessMsg(json.message);
      // Remove merged cluster
      const nextClusters = clusters.filter((_, idx) => idx !== currentIndex);
      setClusters(nextClusters);
      if (currentIndex >= nextClusters.length) {
        setCurrentIndex(Math.max(0, nextClusters.length - 1));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkDistinct = async () => {
    if (!currentCluster || currentCluster.records.length < 2) return;
    try {
      setSubmitting(true);
      setError(null);

      const rA = currentCluster.records[0];
      const rB = currentCluster.records[1];

      const res = await fetch("/api/students/merge-review/mark-distinct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordIdA: rA.id,
          recordIdB: rB.id,
          phoneOrEmail: currentCluster.matchValue,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to mark as distinct");

      setSuccessMsg("Records marked as distinct individuals.");
      const nextClusters = clusters.filter((_, idx) => idx !== currentIndex);
      setClusters(nextClusters);
      if (currentIndex >= nextClusters.length) {
        setCurrentIndex(Math.max(0, nextClusters.length - 1));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnmerge = async () => {
    if (!unmergeRecordId) return;
    try {
      setUnmerging(true);
      setError(null);

      const res = await fetch("/api/students/merge-review/unmerge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: unmergeRecordId,
          recordType: unmergeRecordType,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Unmerge failed");

      setSuccessMsg(json.message);
      setUnmergeModalOpen(false);
      setUnmergeRecordId("");
      fetchCandidates();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUnmerging(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Student Identity Merge Review
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Review suggested merge candidates. Select authoritative winning values per field before confirming.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setUnmergeModalOpen(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-lg text-sm font-semibold transition shadow-sm"
          >
            ↺ Unmerge a Record
          </button>
          <button
            onClick={fetchCandidates}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm font-semibold transition"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Error / Success Alerts */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-200 flex items-start gap-3">
            <span className="text-rose-400 font-bold">✕</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-200 flex items-start gap-3">
            <span className="text-emerald-400 font-bold">✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading merge candidates...</div>
        ) : clusters.length === 0 ? (
          <div className="p-12 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-xl font-bold text-slate-200">Merge Review Queue is Empty!</h3>
            <p className="text-slate-400 mt-2 max-w-md mx-auto text-sm">
              All potential phone and email collisions have been reviewed or automatically resolved. 100% of candidates have a unified Student record.
            </p>
          </div>
        ) : (
          <div>
            {/* Cluster Navigation Header */}
            <div className="mb-4 flex items-center justify-between text-sm text-slate-400">
              <span>
                Cluster <strong className="text-slate-200">{currentIndex + 1}</strong> of{" "}
                <strong className="text-slate-200">{clusters.length}</strong>
              </span>
              <div className="flex gap-2">
                <button
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => prev - 1)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded border border-slate-700 text-xs"
                >
                  Previous
                </button>
                <button
                  disabled={currentIndex === clusters.length - 1}
                  onClick={() => setCurrentIndex((prev) => prev + 1)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded border border-slate-700 text-xs"
                >
                  Next
                </button>
              </div>
            </div>

            {/* Candidate Card */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl mb-6">
              {/* Match Criteria Banner */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                    Match Found By:
                  </span>
                  <div className="text-lg font-bold text-blue-400">
                    {currentCluster.matchField.toUpperCase()}: {currentCluster.matchValue}
                  </div>
                </div>
                {currentCluster.hasDiscrepancy ? (
                  <div className="px-3 py-1.5 rounded-lg bg-amber-950/70 border border-amber-700/50 text-amber-300 text-xs font-medium">
                    ⚠️ {currentCluster.discrepancyNote}
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-700/50 text-emerald-300 text-xs font-medium">
                    ✓ Exact Name Match
                  </div>
                )}
              </div>

              {/* Side by side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {currentCluster.records.map((rec, rIdx) => (
                  <div
                    key={rec.id}
                    className="p-5 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                            rec.type === "Admission"
                              ? "bg-purple-900/60 text-purple-300 border border-purple-700/40"
                              : "bg-blue-900/60 text-blue-300 border border-blue-700/40"
                          }`}
                        >
                          {rec.type}
                        </span>
                        <span className="text-xs font-mono text-slate-400">{rec.businessId}</span>
                      </div>

                      <h4 className="text-lg font-bold text-slate-100 mb-2">{rec.fullName || "—"}</h4>

                      <div className="space-y-1.5 text-xs text-slate-300">
                        <div>
                          <strong className="text-slate-400">Phone:</strong> {rec.primaryPhone || "—"}
                        </div>
                        <div>
                          <strong className="text-slate-400">Email:</strong> {rec.email || "—"}
                        </div>
                        <div>
                          <strong className="text-slate-400">Parent:</strong> {rec.parentName || "—"}{" "}
                          {rec.parentPhone ? `(${rec.parentPhone})` : ""}
                        </div>
                        <div>
                          <strong className="text-slate-400">City:</strong> {rec.city || "—"}
                        </div>
                        <div>
                          <strong className="text-slate-400">Brand / Course:</strong> {rec.brand || "—"}{" "}
                          {rec.courses?.length ? `• ${rec.courses.join(", ")}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500">
                      Date: {rec.date ? new Date(rec.date).toLocaleDateString("en-IN") : "—"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Field by field Winning Values Selection */}
              <div className="bg-slate-950/60 rounded-xl p-6 border border-slate-800/70 mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 mb-4 flex items-center gap-2">
                  <span>🏆</span> Choose Winning Value per Field
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Canonical Full Name</label>
                    <select
                      value={selectedFields.fullName}
                      onChange={(e) => setSelectedFields({ ...selectedFields, fullName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    >
                      {Array.from(new Set(currentCluster.records.map((r) => r.fullName).filter(Boolean))).map(
                        (val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* Primary Phone */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Primary Phone</label>
                    <select
                      value={selectedFields.primaryPhone}
                      onChange={(e) => setSelectedFields({ ...selectedFields, primaryPhone: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    >
                      {Array.from(new Set(currentCluster.records.map((r) => r.primaryPhone).filter(Boolean))).map(
                        (val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Primary Email</label>
                    <select
                      value={selectedFields.email}
                      onChange={(e) => setSelectedFields({ ...selectedFields, email: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="">(None)</option>
                      {Array.from(new Set(currentCluster.records.map((r) => r.email).filter(Boolean))).map((val) => (
                        <option key={val} value={val}>
                          {val}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">City</label>
                    <select
                      value={selectedFields.city}
                      onChange={(e) => setSelectedFields({ ...selectedFields, city: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="">(None)</option>
                      {Array.from(new Set(currentCluster.records.map((r) => r.city).filter(Boolean))).map((val) => (
                        <option key={val} value={val}>
                          {val}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Parent Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Parent / Guardian Name</label>
                    <select
                      value={selectedFields.parentName}
                      onChange={(e) => setSelectedFields({ ...selectedFields, parentName: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="">(None)</option>
                      {Array.from(new Set(currentCluster.records.map((r) => r.parentName).filter(Boolean))).map(
                        (val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* Parent Phone */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Parent Phone</label>
                    <select
                      value={selectedFields.parentPhone}
                      onChange={(e) => setSelectedFields({ ...selectedFields, parentPhone: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    >
                      <option value="">(None)</option>
                      {Array.from(new Set(currentCluster.records.map((r) => r.parentPhone).filter(Boolean))).map(
                        (val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
                <button
                  disabled={submitting}
                  onClick={handleConfirmMerge}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-indigo-900/30 disabled:opacity-50"
                >
                  {submitting ? "Processing..." : "✓ Confirm Merge (Admin Only)"}
                </button>

                <div className="flex gap-3">
                  <button
                    disabled={submitting}
                    onClick={handleMarkDistinct}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-600/30 rounded-xl text-xs font-semibold transition"
                  >
                    Mark as Distinct Individuals
                  </button>
                  <button
                    disabled={submitting || currentIndex >= clusters.length - 1}
                    onClick={() => setCurrentIndex((p) => p + 1)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-xs font-semibold transition"
                  >
                    Skip for Later →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unmerge Modal */}
      {unmergeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-100 mb-2">Unmerge a Record</h3>
            <p className="text-slate-400 text-xs mb-4">
              Detach an Enquiry or Admission from its current Student and assign it a brand-new separate Student identity.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Record Type</label>
                <select
                  value={unmergeRecordType}
                  onChange={(e) => setUnmergeRecordType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                >
                  <option value="Admission">Admission</option>
                  <option value="Enquiry">Enquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Record ID (MongoDB _id)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 66a1b2c3..."
                  value={unmergeRecordId}
                  onChange={(e) => setUnmergeRecordId(e.target.value.trim())}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                disabled={unmerging}
                onClick={() => setUnmergeModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={unmerging || !unmergeRecordId}
                onClick={handleUnmerge}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs shadow-md disabled:opacity-50"
              >
                {unmerging ? "Detaching..." : "Confirm Unmerge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
