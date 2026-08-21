"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import QuotationNav from "@/components/QuotationNav";
import QuotationForm from "@/components/QuotationForm";

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
    <div className="flex min-h-screen bg-[#050811] text-slate-100 font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <QuotationNav />

        <div className="p-6">
          {loading ? (
            <div className="p-8 text-center text-slate-400 font-bold">Loading quotation details...</div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl">
              {error}
            </div>
          ) : (
            <QuotationForm initialData={quotation} isEdit={true} />
          )}
        </div>
      </div>
    </div>
  );
}
