"use client";

import React from "react";
import SoftwareDeveloperSidebar from "@/components/SoftwareDeveloperSidebar";
import SoftwareDevelopersDisplay from "@/components/SoftwareDevelopersDisplay";

export default function SoftwareDevelopersPage() {
  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      {/* Sidebar navigation */}
      <SoftwareDeveloperSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6">
        <SoftwareDevelopersDisplay />
      </div>
    </div>
  );
}
