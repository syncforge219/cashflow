"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import BillingSetup from "@/components/billing/BillingSetup";

export default function BillingSetupPage() {
  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6">
        <BillingSetup />
      </div>
    </div>
  );
}
