"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import BatchDisplay from "@/components/BatchDisplay";

export default function BatchesPage() {
  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Main Content View */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6">
        <BatchDisplay />
      </div>
    </div>
  );
}
