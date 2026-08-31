"use client";

import React, { useState, useEffect, useRef } from "react";
import { User, useUser } from "../app/component/context/user-context";
import { useTheme } from "../app/component/context/theme-context";
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
  const { theme, setTheme, availableThemes } = useTheme();

  const roleLower = (user.role || "").toLowerCase().trim();
  const isTechky =
    roleLower.includes("developer") ||
    roleLower.includes("engineer") ||
    roleLower.includes("tech lead");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editEmail, setEditEmail] = useState(user.email);
  const [editPhone, setEditPhone] = useState(user.phone || "");
  const [editPhotoUrl, setEditPhotoUrl] = useState(user.photoUrl || "");
  const [imgError, setImgError] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("PNG Image size must be less than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setEditPhotoUrl(result);
        setImgError(false);
        setIsEditingProfile(true);
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
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset password.");
      } else {
        setSuccess("Password updated successfully!");
        setOldPassword("");
        setNewPassword("");
      }
    } catch (err) {
      console.error(err);
      setError("A network error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const initialLetter = user.name ? user.name.charAt(0).toUpperCase() : "A";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 flex items-center justify-center p-4 z-50 ${
            isTechky ? "bg-slate-950/80 backdrop-blur-md" : "bg-slate-900/60 backdrop-blur-xs"
          }`}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`w-full max-w-md p-6 rounded-3xl space-y-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar ${
              isTechky
                ? "bg-[#0B0F19] border border-emerald-500/30 font-mono text-slate-100 shadow-[0_0_50px_rgba(0,0,0,0.9)]"
                : "bg-white border border-slate-200 font-sans text-slate-800 shadow-2xl"
            }`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between border-b pb-3 ${isTechky ? "border-slate-800" : "border-slate-100"}`}>
              <h3 className={`text-xs font-black uppercase tracking-wider ${isTechky ? "text-emerald-400" : "text-slate-400"}`}>
                {isTechky ? "// USER_PROFILE_CONSOLE" : "User Profile"}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className={`p-1 transition-colors ${isTechky ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Profile Card Header */}
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                <div
                  className={`h-14 w-14 rounded-full font-black text-lg flex items-center justify-center shadow-md overflow-hidden ${
                    isTechky
                      ? "bg-gradient-to-br from-emerald-500 to-cyan-600 text-slate-950 border border-emerald-400"
                      : "bg-indigo-600 text-white border border-indigo-500"
                  }`}
                >
                  {(editPhotoUrl.trim() || user.photoUrl) && !imgError ? (
                    <img
                      src={editPhotoUrl.trim() || user.photoUrl}
                      alt={user.name}
                      onClick={() => setIsPreviewOpen(true)}
                      className="h-full w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      title="Click to view full image"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <span>{initialLetter}</span>
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
                  title="Upload PNG Profile Picture"
                  className={`absolute -bottom-1 -right-1 rounded-full p-1 shadow border transition-transform hover:scale-110 cursor-pointer ${
                    isTechky
                      ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-slate-950"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white border-white"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 min-w-0">
                {isEditingProfile ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Full Name"
                    className={`w-full text-sm font-black leading-tight border rounded-md px-2 py-1 mb-1 focus:outline-none ${
                      isTechky
                        ? "bg-slate-950 border-slate-800 text-white focus:border-emerald-500/50"
                        : "bg-white border-slate-200 text-slate-800 focus:ring-1 focus:ring-indigo-500/50"
                    }`}
                  />
                ) : (
                  <h4 className={`text-base font-black truncate ${isTechky ? "text-white" : "text-slate-800"}`}>
                    {user.name}
                  </h4>
                )}
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md mt-1 inline-block ${
                    isTechky
                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                      : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                  }`}
                >
                  {user.role}
                </span>
              </div>
            </div>

            {/* Contact Info List */}
            <div
              className={`border rounded-2xl p-4 space-y-3 ${
                isTechky ? "bg-[#050811] border-slate-800/90" : "bg-slate-50 border-slate-100"
              }`}
            >
              {isEditingProfile && (
                <div className={`border-b pb-3 ${isTechky ? "border-slate-800" : "border-slate-200/60"}`}>
                  <div className="flex justify-between items-center text-xs mb-2">
                    <span className={`font-bold uppercase tracking-wider text-[10px] ${isTechky ? "text-slate-400" : "text-slate-400"}`}>
                      Profile Photo (PNG / JPEG)
                    </span>
                    {editPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditPhotoUrl("");
                          setImgError(false);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300 uppercase cursor-pointer"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer ${
                        isTechky
                          ? "bg-slate-900 text-emerald-400 border border-emerald-500/30 hover:bg-slate-850"
                          : "bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      Select Image
                    </button>
                    {editPhotoUrl ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        ✓ Selected
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">No image selected</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center text-xs">
                <span className={`font-bold uppercase tracking-wider text-[10px] ${isTechky ? "text-slate-500" : "text-slate-400"}`}>
                  EMAIL ADDRESS
                </span>
                {isEditingProfile ? (
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className={`w-1/2 border rounded-md px-2 py-1 text-xs focus:outline-none ${
                      isTechky
                        ? "bg-slate-950 border-slate-800 text-white focus:border-emerald-500/50"
                        : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                ) : (
                  <span className={`font-bold select-all ${isTechky ? "text-cyan-300" : "text-slate-700"}`}>{user.email}</span>
                )}
              </div>

              <div className={`border-t ${isTechky ? "border-slate-800/80" : "border-slate-100"}`}></div>

              <div className="flex justify-between items-center text-xs">
                <span className={`font-bold uppercase tracking-wider text-[10px] ${isTechky ? "text-slate-500" : "text-slate-400"}`}>
                  MOBILE NUMBER
                </span>
                {isEditingProfile ? (
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className={`w-1/2 border rounded-md px-2 py-1 text-xs focus:outline-none ${
                      isTechky
                        ? "bg-slate-950 border-slate-800 text-white focus:border-emerald-500/50"
                        : "bg-white border-slate-200 text-slate-800"
                    }`}
                  />
                ) : (
                  <span className={`font-bold ${isTechky ? "text-slate-200" : "text-slate-700"}`}>{user.phone || "Not set"}</span>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                {isEditingProfile ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      disabled={profileLoading}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                        isTechky
                          ? "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                          : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateProfile}
                      disabled={profileLoading}
                      className={`text-xs font-black px-3 py-1.5 rounded-lg ${
                        isTechky
                          ? "bg-gradient-to-r from-emerald-500 to-cyan-600 text-slate-950 hover:from-emerald-400 hover:to-cyan-500 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                          : "bg-indigo-600 text-white hover:bg-indigo-500"
                      }`}
                    >
                      {profileLoading ? "Saving..." : "Save"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(true)}
                    className={`text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                      isTechky ? "text-emerald-400 hover:text-emerald-300" : "text-indigo-600 hover:text-indigo-500"
                    }`}
                  >
                    [EDIT_PROFILE]
                  </button>
                )}
              </div>
            </div>

            {/* Appearance & Themes Section */}
            <div className={`space-y-3 border-t pt-4 ${isTechky ? "border-slate-800" : "border-slate-100"}`}>
              <div className="flex items-center justify-between">
                <h5 className={`text-xs font-black uppercase tracking-wider ${isTechky ? "text-slate-400" : "text-slate-400"}`}>
                  {isTechky ? "// THEME_APPEARANCE" : "Appearance & Theme"}
                </h5>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase">
                  {theme}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {availableThemes.map((t) => {
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={`flex flex-col p-2.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                        isSelected
                          ? isTechky
                            ? "bg-emerald-950/40 border-emerald-400/80 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                            : "bg-indigo-50/80 border-indigo-300 shadow-xs"
                          : isTechky
                          ? "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-base leading-none">{t.icon}</span>
                        <div className="flex items-center gap-1">
                          <span
                            className="w-3 h-3 rounded-full border border-slate-300 shadow-2xs"
                            style={{ backgroundColor: t.colors.primary }}
                          />
                          <span
                            className="w-3 h-3 rounded-full border border-slate-300 shadow-2xs"
                            style={{ backgroundColor: t.colors.bg }}
                          />
                        </div>
                      </div>
                      <span className={`text-xs font-extrabold truncate ${isSelected ? (isTechky ? "text-emerald-300" : "text-indigo-950") : (isTechky ? "text-slate-200" : "text-slate-800")}`}>
                        {t.name}
                      </span>
                      <span className="text-[9px] text-slate-400 truncate mt-0.5">
                        {t.category.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reset Password Section */}
            <form onSubmit={handleResetPassword} className={`space-y-3.5 border-t pt-4 ${isTechky ? "border-slate-800" : "border-slate-100"}`}>
              <h5 className={`text-xs font-black uppercase tracking-wider ${isTechky ? "text-slate-400" : "text-slate-400"}`}>
                {isTechky ? "// RESET_PASSWORD" : "Reset Password"}
              </h5>

              {error && (
                <div className={`border rounded-xl p-3 text-xs font-semibold ${isTechky ? "bg-rose-950/80 border-rose-500/30 text-rose-300" : "bg-rose-50 border-rose-100 text-rose-600"}`}>
                  {error}
                </div>
              )}
              {success && (
                <div className={`border rounded-xl p-3 text-xs font-semibold ${isTechky ? "bg-emerald-950/80 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-100 text-emerald-600"}`}>
                  {success}
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className={`block text-[9px] font-black uppercase tracking-wider mb-1 ${isTechky ? "text-slate-400" : "text-slate-400"}`}>
                    Old Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    disabled={isLoading}
                    placeholder="Enter current password"
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                      isTechky
                        ? "bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-emerald-500/50"
                        : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-1 focus:ring-indigo-500/50"
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-[9px] font-black uppercase tracking-wider mb-1 ${isTechky ? "text-slate-400" : "text-slate-400"}`}>
                    New Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    placeholder="Enter new password (min. 6 chars)"
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                      isTechky
                        ? "bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-emerald-500/50"
                        : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-1 focus:ring-indigo-500/50"
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full font-black text-xs uppercase tracking-wider rounded-xl py-2.5 shadow-sm transition-all cursor-pointer ${
                    isTechky
                      ? "bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                      : "bg-slate-800 hover:bg-slate-700 text-white"
                  }`}
                >
                  {isLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>

            {/* Logout Action */}
            <div className={`border-t pt-4 ${isTechky ? "border-slate-800" : "border-slate-100"}`}>
              <button
                type="button"
                onClick={logout}
                className={`w-full text-xs font-black uppercase tracking-wider rounded-xl py-3 transition-all text-center cursor-pointer ${
                  isTechky
                    ? "bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10"
                }`}
              >
                Logout
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Full Screen Image Preview Lightbox */}
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

            <div className="pt-3 pb-1 text-center font-mono">
              <p className="text-sm font-bold text-white">{user.name}</p>
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mt-0.5">{user.role}</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
