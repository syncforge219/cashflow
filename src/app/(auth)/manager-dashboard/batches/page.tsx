"use client";

import React from "react";
import ManagerSidebar from "@/components/ManagerSidebar";
import BatchDisplay from "@/components/BatchDisplay";

export default function ManagerBatchesPage() {
  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      {/* Navigation Sidebar */}
      <ManagerSidebar />

      {/* Main Content View */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6">
        <BatchDisplay />
      </div>
    </div>
  );
}
