"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@/app/component/context/user-context";
import Sidebar from "@/components/Sidebar";
import CrmSidebar from "@/components/CrmSidebar";
import CrmDisplay from "@/components/CrmDisplay";
import ProfileDisplay from "@/components/ProfileDisplay";
import CommandPalette from "@/components/CommandPalette";

export default function CrmPage() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isCrmRoleOnly = user?.role === "crm";

  return (
    <div className="flex h-screen bg-slate-50/80 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/30 via-slate-50 to-slate-100/50 text-slate-800 overflow-hidden font-sans">
      {/* Navigation Sidebar: Admin Sidebar for Super Admin/Admin, CrmSidebar for CRM role */}
      {isCrmRoleOnly ? <CrmSidebar /> : <Sidebar />}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 space-y-6">
        <CrmDisplay />
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
