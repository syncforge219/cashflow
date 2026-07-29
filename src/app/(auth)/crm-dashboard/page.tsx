"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "../../component/context/user-context";
import { useRouter } from "next/navigation";
import CrmSidebar from "@/components/CrmSidebar";
import CrmDisplay from "@/components/CrmDisplay";
import ProfileDisplay from "@/components/ProfileDisplay";
import CommandPalette from "@/components/CommandPalette";

export default function CrmDashboardPage() {
  const { user, logout } = useUser();
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.role === "counsellor") {
        router.replace("/counsellor-dashboard");
      } else if (user.role === "brand manager") {
        router.replace("/manager-dashboard");
      } else if (user.role === "teacher") {
        router.replace("/teacher-dashboard");
      } else if (user.role === "cfo" || user.role === "finance manager" || user.role === "finance executive") {
        router.replace("/cfo-dashboard");
      }
    }
  }, [user, router]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50/80 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/30 via-slate-50 to-slate-100/50 text-slate-800 overflow-hidden font-sans">
      {/* Dedicated CRM Navigation Sidebar */}
      <CrmSidebar />

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Sticky Header Bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-3.5 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="text-slate-400">CoachFlow</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-bold text-sm">Executive Dashboard</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Bar with Ctrl+K */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex items-center gap-3 px-3.5 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100/80 text-slate-400 text-xs transition-all shadow-2xs group cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-slate-500 font-medium hidden sm:inline">Search financials & leads...</span>
              <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-bold text-slate-500 shadow-2xs">CTRL + K</kbd>
            </button>

            {/* Vertical Divider */}
            <div className="h-6 w-px bg-slate-200/80 mx-1"></div>

            {/* Profile Badge (Clicking opens ProfileDisplay modal) */}
            <div
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2.5 p-1 pr-2 rounded-xl hover:bg-slate-100/70 transition-all cursor-pointer group"
              title="Click to view & edit Profile"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">
                  {user?.name || "Chaitanya Singhal"}
                </p>
                <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">
                  {user?.role ? user.role.toUpperCase() : "SUPER ADMIN"}
                </p>
              </div>

              {user?.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name || "Profile"}
                  className="h-8 w-8 rounded-lg object-cover ring-2 ring-indigo-500/20 group-hover:ring-indigo-500 transition-all shadow-2xs"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-extrabold text-xs shadow-2xs">
                  {user?.name ? user.name.substring(0, 2).toUpperCase() : "CS"}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Body: Blocks & CRM Management */}
        <main className="flex-1 px-6 py-6 space-y-6">
          <CrmDisplay />
        </main>
      </div>

      {/* Profile Dialog Box Component */}
      <ProfileDisplay
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        logout={logout}
      />

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
