"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import QuotationNav from "@/components/QuotationNav";
import QuotationForm from "@/components/QuotationForm";
import CfoSecurityGuard from "@/components/CfoSecurityGuard";

function NewQuotationContent() {
  const searchParams = useSearchParams();
  const typeParam = searchParams?.get("type") || searchParams?.get("mode");
  const isPo = typeParam === "po";

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans transition-colors duration-200 relative">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <QuotationNav module={isPo ? "po" : "quotations"} />

        <div className="p-6">
          <QuotationForm isPo={isPo} />
        </div>
      </div>
    </div>
  );
}

export default function NewQuotationPage() {
  return (
    <CfoSecurityGuard>
      <Suspense fallback={<div className="p-6 text-xs text-slate-400">Loading form...</div>}>
        <NewQuotationContent />
      </Suspense>
    </CfoSecurityGuard>
  );
}
