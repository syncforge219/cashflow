"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import QuotationNav from "@/components/QuotationNav";
import QuotationForm from "@/components/QuotationForm";
import CfoSecurityGuard from "@/components/CfoSecurityGuard";

export default function EditQuotationPage() {
  const params = useParams();
  const id = params?.id as string;

  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadQuotation() {
      if (!id) return;
      try {
        const res = await fetch(`/api/quotations/${id}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setQuotation(data.data);
        } else {
          setError(data.error || "Quotation not found");
        }
      } catch (err: any) {
        setError("Error loading quotation: " + err.message);
      } finally {
        setLoading(false);
      }
    }

    loadQuotation();
  }, [id]);

  return (
    <CfoSecurityGuard>
      <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans transition-colors duration-200 relative">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <QuotationNav />

          <div className="p-6">
            {loading ? (
              <div className="p-8 text-center text-slate-400 font-bold">Loading quotation details...</div>
            ) : error ? (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl shadow-sm">
                {error}
              </div>
            ) : (
              <QuotationForm initialData={quotation} isEdit={true} />
            )}
          </div>
        </div>
      </div>
    </CfoSecurityGuard>
  );
}
