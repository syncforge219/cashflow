"use client";

import React, { useState, useEffect, useRef } from "react";
import { User, useUser } from "../app/component/context/user-context";
import { motion, AnimatePresence } from "framer-motion";

interface ProfileDisplayProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  logout: () => Promise<void>;
}

export default function ProfileDisplay({ isOpen, onClose, user, logout }: ProfileDisplayProps) {
  if (!user) return null;
  const { login } = useUser();

  const roleLower = (user.role || "").toLowerCase().trim();
  const isTechky =
    roleLower.includes("developer") ||
    roleLower.includes("engineer") ||
    roleLower.includes("tech lead");

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"overview" | "security">("overview");

  // Password reset state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Profile edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  const [editPhone, setEditPhone] = useState(user.phone || "");
  const [editPhotoUrl, setEditPhotoUrl] = useState(user.photoUrl || "");
  const [imgError, setImgError] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Copy-to-clipboard state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Logout confirmation state
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyToClipboard = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setEditPhotoUrl(result);
        setImgError(false);
        setIsEditingProfile(true);
        setActiveTab("overview");
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (isOpen) {
      setEditName(user.name);
      setEditEmail(user.email);
      setEditPhone(user.phone || "");
      setEditPhotoUrl(user.photoUrl || "");
      setImgError(false);
      setIsEditingProfile(false);
      setError("");
      setSuccess("");
      setOldPassword("");
      setNewPassword("");
      setShowOldPassword(false);
      setShowNewPassword(false);
      setActiveTab("overview");
      setConfirmLogout(false);
      setIsLoggingOut(false);
    }
  }, [isOpen, user]);

  const handleUpdateProfile = async () => {
    setError("");
    setSuccess("");
    setProfileLoading(true);
    try {
      const response = await fetch("/api/auth/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, email: editEmail, phone: editPhone, photoUrl: editPhotoUrl }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to update profile.");
      } else {
        setSuccess("Profile updated successfully!");
        login(data.user);
        setIsEditingProfile(false);
        setTimeout(() => setSuccess(""), 4000);
      }
    } catch (err) {
      setError("A network error occurred. Please try again.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset password.");
      } else {
        setSuccess("Password updated successfully!");
        setOldPassword("");
        setNewPassword("");
        setTimeout(() => setSuccess(""), 4000);
      }
    } catch (err) {
      console.error(err);
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    if (!confirmLogout) {
      setConfirmLogout(true);
      return;
    }
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (e) {
      setIsLoggingOut(false);
    }
  };

  const initialLetter = user.name ? user.name.charAt(0).toUpperCase() : "U";

  // Role details badge helper
  const getRoleBadge = (role: string) => {
    const r = (role || "").toLowerCase();
    if (r.includes("super admin") || r.includes("super_admin")) {
      return { label: "Super Admin", icon: "👑", badgeClass: "bg-purple-100 text-purple-800 border-purple-200" };
    }
    if (r.includes("admin")) {
      return { label: "Administrator", icon: "⚡", badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200" };
    }
    if (r.includes("director")) {
      return { label: "Director", icon: "⭐", badgeClass: "bg-amber-100 text-amber-800 border-amber-200" };
    }
    if (r.includes("manager")) {
      return { label: "Manager", icon: "💼", badgeClass: "bg-blue-100 text-blue-800 border-blue-200" };
    }
    if (r.includes("counsellor") || r.includes("counselor")) {
      return { label: "Counsellor", icon: "🎯", badgeClass: "bg-teal-100 text-teal-800 border-teal-200" };
    }
    if (r.includes("cfo") || r.includes("finance")) {
      return { label: "Finance / CFO", icon: "💰", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    }
    if (r.includes("developer") || r.includes("engineer")) {
      return { label: "Software Engineer", icon: "💻", badgeClass: "bg-emerald-950 text-emerald-300 border-emerald-500/40" };
    }
    return { label: role, icon: "👤", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" };
  };

  const roleMeta = getRoleBadge(user.role);

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "", color: "bg-slate-200", textColor: "text-slate-400" };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8 && /[0-9]/.test(pass)) score += 1;
    if (/[A-Z]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score === 1) return { score: 1, label: "Weak", color: "bg-rose-500", textColor: "text-rose-500" };
    if (score === 2) return { score: 2, label: "Fair", color: "bg-amber-500", textColor: "text-amber-500" };
    if (score >= 3) return { score: 3, label: "Strong", color: "bg-emerald-500", textColor: "text-emerald-600" };
    return { score: 1, label: "Too short", color: "bg-rose-500", textColor: "text-rose-500" };
  };

  const passStrength = getPasswordStrength(newPassword);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className={`fixed inset-0 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto backdrop-blur-sm ${
            isTechky ? "bg-slate-950/85 backdrop-blur-md" : "bg-slate-900/60"
          }`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-[440px] rounded-3xl overflow-hidden shadow-2xl relative flex flex-col my-auto border transition-all ${
              isTechky
                ? "bg-[#0B0F19] border-emerald-500/30 font-mono text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.9)]"
                : "bg-white border-slate-200/80 font-sans text-slate-800"
            }`}
          >
            {/* Top Gradient Banner Header */}
            <div
              className={`relative h-28 px-5 pt-4 pb-3 flex items-start justify-between overflow-hidden shrink-0 ${
                isTechky
                  ? "bg-gradient-to-r from-emerald-950 via-slate-900 to-cyan-950 border-b border-emerald-500/20"
                  : "bg-gradient-to-tr from-indigo-600 via-purple-600 to-sky-500 text-white"
              }`}
            >
              {/* Subtle background ambient circles */}
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-purple-400/20 rounded-full blur-xl pointer-events-none" />

              {/* Title / Badge */}
              <div className="relative z-10 flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/15 text-white/90 flex items-center gap-1.5 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isTechky ? "TERMINAL_PROFILE" : "Account Profile"}
                </span>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="relative z-10 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white/90 hover:text-white backdrop-blur-md transition-all border border-white/10 cursor-pointer"
                title="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Profile Identity Section (Overlapping Avatar) */}
            <div className="px-5 pt-0 pb-4 relative">
              <div className="flex items-end justify-between -mt-12 mb-3">
                {/* Avatar with Camera Badge */}
                <div className="relative group shrink-0">
                  <div
                    className={`h-20 w-20 rounded-2xl p-0.5 shadow-xl flex items-center justify-center overflow-hidden border-2 transition-transform group-hover:scale-102 ${
                      isTechky
                        ? "bg-slate-900 border-emerald-400/60 shadow-emerald-950/50"
                        : "bg-white border-white shadow-slate-900/10"
                    }`}
                  >
                    {(editPhotoUrl.trim() || user.photoUrl) && !imgError ? (
                      <img
                        src={editPhotoUrl.trim() || user.photoUrl}
                        alt={user.name}
                        onClick={() => setIsPreviewOpen(true)}
                        className="h-full w-full object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                        title="Click to zoom preview"
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      <div className="h-full w-full rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black select-none shadow-inner">
                        {initialLetter}
                      </div>
                    )}
                  </div>

                  {/* Hidden File Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {/* Camera / Edit Icon Badge */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Change Profile Photo"
                    className={`absolute -bottom-1 -right-1 rounded-xl p-1.5 shadow-md border transition-all hover:scale-110 active:scale-95 cursor-pointer ${
                      isTechky
                        ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-slate-900"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white border-white shadow-indigo-600/30"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                    </svg>
                  </button>
                </div>

                {/* Quick Profile Actions */}
                <div className="flex items-center gap-2">
                  {!isEditingProfile && activeTab === "overview" && (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                        isTechky
                          ? "bg-slate-900 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/40"
                          : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                      Edit Details
                    </button>
                  )}
                </div>
              </div>

              {/* User Name & Badges */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`text-lg font-black tracking-tight leading-snug ${isTechky ? "text-white" : "text-slate-900"}`}>
                    {user.name}
                  </h3>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg border shadow-2xs ${
                      isTechky ? roleMeta.badgeClass : `${roleMeta.badgeClass}`
                    }`}
                  >
                    <span>{roleMeta.icon}</span>
                    <span>{roleMeta.label}</span>
                  </span>

                  {user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All" && (
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-lg border shadow-2xs ${
                        isTechky
                          ? "bg-cyan-950 text-cyan-300 border-cyan-500/40"
                          : "bg-blue-50 text-blue-700 border-blue-200/80"
                      }`}
                    >
                      <span>🏢</span>
                      <span>{user.brandScope}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Segmented Navigation Tabs */}
            <div className="px-5 pb-3">
              <div
                className={`p-1 rounded-2xl flex items-center gap-1 border ${
                  isTechky
                    ? "bg-slate-950 border-slate-800"
                    : "bg-slate-100/90 border-slate-200/80"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === "overview"
                      ? isTechky
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-xs"
                        : "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                      : isTechky
                      ? "text-slate-400 hover:text-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                  Profile Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("security")}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === "security"
                      ? isTechky
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-xs"
                        : "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                      : isTechky
                      ? "text-slate-400 hover:text-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  Password & Security
                </button>
              </div>
            </div>

            {/* Error / Success Feedback Alerts */}
            <div className="px-5">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    className={`mb-3 p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 overflow-hidden ${
                      isTechky
                        ? "bg-rose-950/80 border-rose-500/30 text-rose-300"
                        : "bg-rose-50 border-rose-200 text-rose-700"
                    }`}
                  >
                    <span className="text-sm shrink-0">⚠️</span>
                    <span className="flex-1">{error}</span>
                  </motion.div>
                )}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    className={`mb-3 p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 overflow-hidden ${
                      isTechky
                        ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-300"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    }`}
                  >
                    <span className="text-sm shrink-0">✅</span>
                    <span className="flex-1">{success}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tab Body Content */}
            <div className="px-5 pb-5 flex-1 space-y-4">
              {/* TAB 1: OVERVIEW & PROFILE */}
              {activeTab === "overview" && (
                <motion.div
                  key="tab-overview"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-3"
                >
                  {isEditingProfile ? (
                    /* Edit Profile Form */
                    <div
                      className={`p-4 rounded-2xl border space-y-3.5 ${
                        isTechky ? "bg-slate-950/60 border-slate-800" : "bg-slate-50/70 border-slate-200/80"
                      }`}
                    >
                      <div className="flex items-center justify-between border-b pb-2 border-slate-200/60">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                          Edit Personal Details
                        </span>
                        {editPhotoUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditPhotoUrl("");
                              setImgError(false);
                              if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                          >
                            Remove Photo
                          </button>
                        )}
                      </div>

                      <div className="space-y-2.5 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Full Name
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Enter full name"
                            className={`w-full text-xs font-semibold border rounded-xl px-3 py-2 focus:outline-none transition-all ${
                              isTechky
                                ? "bg-slate-900 border-slate-800 text-white focus:border-emerald-500"
                                : "bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Email Address
                          </label>
                          <input
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            placeholder="name@organization.com"
                            className={`w-full text-xs font-semibold border rounded-xl px-3 py-2 focus:outline-none transition-all ${
                              isTechky
                                ? "bg-slate-900 border-slate-800 text-white focus:border-emerald-500"
                                : "bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            }`}
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Mobile Phone Number
                          </label>
                          <input
                            type="tel"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="+91 9876543210"
                            className={`w-full text-xs font-semibold border rounded-xl px-3 py-2 focus:outline-none transition-all ${
                              isTechky
                                ? "bg-slate-900 border-slate-800 text-white focus:border-emerald-500"
                                : "bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => {
                            setEditName(user.name);
                            setEditEmail(user.email);
                            setEditPhone(user.phone || "");
                            setEditPhotoUrl(user.photoUrl || "");
                            setIsEditingProfile(false);
                          }}
                          disabled={profileLoading}
                          className="px-3.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleUpdateProfile}
                          disabled={profileLoading}
                          className={`px-4 py-1.5 text-xs font-bold rounded-xl text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                            isTechky
                              ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-black hover:opacity-90"
                              : "bg-indigo-600 hover:bg-indigo-700 active:scale-98 shadow-indigo-600/20"
                          }`}
                        >
                          {profileLoading ? (
                            <>
                              <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "Save Changes"
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Read-Only Profile Overview Cards */
                    <div className="space-y-2.5">
                      {/* Email Card */}
                      <div
                        className={`p-3.5 rounded-2xl border transition-all hover:shadow-xs flex items-center justify-between gap-3 ${
                          isTechky
                            ? "bg-slate-950/60 border-slate-800/90"
                            : "bg-slate-50/80 border-slate-200/70"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              isTechky ? "bg-emerald-950/80 text-emerald-400" : "bg-indigo-50 text-indigo-600"
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">
                              Email Address
                            </span>
                            <span className={`text-xs font-bold truncate block ${isTechky ? "text-cyan-300" : "text-slate-800"}`}>
                              {user.email}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => copyToClipboard(user.email, "email")}
                          className={`p-1.5 rounded-lg border text-xs transition-all cursor-pointer shrink-0 ${
                            copiedField === "email"
                              ? "bg-emerald-50 border-emerald-300 text-emerald-600"
                              : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300"
                          }`}
                          title="Copy Email"
                        >
                          {copiedField === "email" ? (
                            <span className="text-[10px] font-bold px-1 text-emerald-600">Copied!</span>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Phone Card */}
                      <div
                        className={`p-3.5 rounded-2xl border transition-all hover:shadow-xs flex items-center justify-between gap-3 ${
                          isTechky
                            ? "bg-slate-950/60 border-slate-800/90"
                            : "bg-slate-50/80 border-slate-200/70"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              isTechky ? "bg-emerald-950/80 text-emerald-400" : "bg-teal-50 text-teal-600"
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">
                              Mobile Number
                            </span>
                            <span className={`text-xs font-bold truncate block ${user.phone ? (isTechky ? "text-slate-100" : "text-slate-800") : "text-slate-400 italic"}`}>
                              {user.phone || "Not configured"}
                            </span>
                          </div>
                        </div>

                        {user.phone && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(user.phone || "", "phone")}
                            className={`p-1.5 rounded-lg border text-xs transition-all cursor-pointer shrink-0 ${
                              copiedField === "phone"
                                ? "bg-emerald-50 border-emerald-300 text-emerald-600"
                                : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300"
                            }`}
                            title="Copy Phone"
                          >
                            {copiedField === "phone" ? (
                              <span className="text-[10px] font-bold px-1 text-emerald-600">Copied!</span>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Brand Scope / Org Card */}
                      <div
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isTechky
                            ? "bg-slate-950/60 border-slate-800/90"
                            : "bg-slate-50/80 border-slate-200/70"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-xl shrink-0 ${
                              isTechky ? "bg-cyan-950/80 text-cyan-400" : "bg-purple-50 text-purple-600"
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block">
                              Organizational Scope
                            </span>
                            <span className={`text-xs font-bold truncate block ${isTechky ? "text-slate-100" : "text-slate-800"}`}>
                              {user.brandScope || "Global Super Admin Scope"}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          Verified
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* TAB 2: SECURITY & PASSWORD */}
              {activeTab === "security" && (
                <motion.div
                  key="tab-security"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <form onSubmit={handleResetPassword} className="space-y-3.5">
                    {/* Old Password */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Current Password *
                      </label>
                      <div className="relative">
                        <input
                          type={showOldPassword ? "text" : "password"}
                          required
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          disabled={isLoading}
                          placeholder="Enter your current password"
                          className={`w-full text-xs font-medium border rounded-xl pl-3 pr-10 py-2.5 focus:outline-none transition-all ${
                            isTechky
                              ? "bg-slate-900 border-slate-800 text-white focus:border-emerald-500"
                              : "bg-slate-50/80 border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5 cursor-pointer"
                        >
                          {showOldPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          New Password *
                        </label>
                        {newPassword && (
                          <span className={`text-[10px] font-bold ${passStrength.textColor}`}>
                            {passStrength.label}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={isLoading}
                          placeholder="Min. 6 characters"
                          className={`w-full text-xs font-medium border rounded-xl pl-3 pr-10 py-2.5 focus:outline-none transition-all ${
                            isTechky
                              ? "bg-slate-900 border-slate-800 text-white focus:border-emerald-500"
                              : "bg-slate-50/80 border-slate-200 text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5 cursor-pointer"
                        >
                          {showNewPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Password Strength Meter */}
                      {newPassword && (
                        <div className="mt-2 space-y-1">
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-1">
                            <div className={`h-full flex-1 rounded-full transition-all duration-300 ${passStrength.score >= 1 ? passStrength.color : "bg-slate-200"}`} />
                            <div className={`h-full flex-1 rounded-full transition-all duration-300 ${passStrength.score >= 2 ? passStrength.color : "bg-slate-200"}`} />
                            <div className={`h-full flex-1 rounded-full transition-all duration-300 ${passStrength.score >= 3 ? passStrength.color : "bg-slate-200"}`} />
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Use 8+ characters, including numbers and special symbols for max security.
                          </p>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || !oldPassword || !newPassword}
                      className={`w-full font-bold text-xs rounded-xl py-2.5 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                        isTechky
                          ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-black hover:opacity-90 shadow-emerald-950/40"
                          : "bg-slate-900 hover:bg-slate-800 text-white active:scale-99"
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                          </svg>
                          Update Password
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}
            </div>

            {/* Logout Footer Section */}
            <div
              className={`p-4 border-t flex items-center justify-between gap-3 ${
                isTechky ? "bg-slate-950 border-slate-800/80" : "bg-slate-50/70 border-slate-200/80"
              }`}
            >
              {confirmLogout ? (
                <div className="w-full flex items-center justify-between gap-2 animate-fade-in">
                  <span className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>Sign out of session?</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmLogout(false)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleLogoutClick}
                      disabled={isLoggingOut}
                      className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      {isLoggingOut ? "Signing out..." : "Yes, Sign Out"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Logged in as <strong>{user.name.split(" ")[0]}</strong></span>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogoutClick}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                      isTechky
                        ? "bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40"
                        : "bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 shadow-2xs"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Full Screen Image Lightbox */}
      {isPreviewOpen && (editPhotoUrl.trim() || user.photoUrl) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsPreviewOpen(false)}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4 z-[70] cursor-zoom-out"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-lg max-h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl p-3 shadow-2xl flex flex-col items-center justify-center overflow-hidden cursor-default"
          >
            <button
              type="button"
              onClick={() => setIsPreviewOpen(false)}
              className="absolute top-4 right-4 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full p-2 transition-colors z-10 shadow-lg cursor-pointer"
              title="Close Preview"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <img
              src={editPhotoUrl.trim() || user.photoUrl}
              alt={user.name}
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-2xl shadow-md"
            />

            <div className="pt-3 pb-1 text-center">
              <p className="text-sm font-bold text-white">{user.name}</p>
              <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mt-0.5">{user.role}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
