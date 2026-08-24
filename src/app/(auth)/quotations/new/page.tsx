"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import QuotationNav from "@/components/QuotationNav";
import QuotationForm from "@/components/QuotationForm";
import CfoSecurityGuard from "@/components/CfoSecurityGuard";

export default function NewQuotationPage() {
  return (
    <CfoSecurityGuard>
      <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans transition-colors duration-200 relative">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <QuotationNav />

          <div className="p-6">
            <QuotationForm />
          </div>
        </div>
      </div>
    </CfoSecurityGuard>
  );
}
