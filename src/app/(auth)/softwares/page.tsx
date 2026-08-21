"use client";

import React from "react";
import SoftwareDeveloperSidebar from "@/components/SoftwareDeveloperSidebar";
import SoftwaresDisplay from "@/components/SoftwaresDisplay";

export default function SoftwaresPage() {
  return (
    <div className="flex h-screen bg-[#050811] text-slate-100 overflow-hidden font-mono">
      {/* Software Developer Techky Sidebar */}
      <SoftwareDeveloperSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6">
        <SoftwaresDisplay />
      </div>
    </div>
  );
}
