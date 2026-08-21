"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import QuotationNav from "@/components/QuotationNav";
import QuotationForm from "@/components/QuotationForm";

export default function NewQuotationPage() {
  return (
    <div className="flex min-h-screen bg-[#050811] text-slate-100 font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <QuotationNav />

        <div className="p-6">
          <QuotationForm />
        </div>
      </div>
    </div>
  );
}
