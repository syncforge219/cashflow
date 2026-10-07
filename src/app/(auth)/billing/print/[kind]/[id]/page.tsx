"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatDate } from "@/lib/dates";
import { numberToIndianWords } from "@/lib/numberToWords";
import { stateByCode } from "@/lib/billing";
import { inr, type ServiceInvoiceDoc, type ServicePIDoc } from "@/components/billing/docTypes";
import { billingApi } from "@/components/billing/ui";

type Doc = (ServicePIDoc | ServiceInvoiceDoc) & {
  bank?: { bankName: string; accountHolderName: string; accountNumber: string; ifsc: string; branch: string; upiId: string } | null;
};

/**
 * Printable PI / invoice. "Print / Save as PDF" uses the browser, so the same page is used to share
 * a PDF with the client. Only the document itself is printed.
 */
export default function BillingPrintPage() {
  const params = useParams<{ kind: string; id: string }>();
  const kind = params.kind === "pi" ? "pi" : "invoice";
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    billingApi<{ data: Doc }>(kind === "pi" ? `/api/billing/pis/${params.id}` : `/api/billing/invoices/${params.id}`)
      .then((res) => setDoc(res.data))
      .catch((e) => setError(e.message));
  }, [kind, params.id]);

  if (error) return <div className="p-10 text-center text-rose-600 font-bold">{error}</div>;
  if (!doc) return <div className="p-10 text-center text-slate-400">Loading…</div>;

  const isPI = kind === "pi";
  const pi = doc as ServicePIDoc;
  const inv = doc as ServiceInvoiceDoc;
  const title = isPI ? "PROFORMA INVOICE" : inv.invoiceType === "TAX_INVOICE" ? "TAX INVOICE" : "INVOICE";
  const number = isPI ? pi.piNumber : inv.invoiceNumber;
  const date = isPI ? pi.piDate : inv.invoiceDate;
  const isGst = doc.company.gstType === "GST";
  const placeOfSupply = stateByCode(doc.client.stateCode);
  const cancelled = isPI && pi.status === "CANCELLED";

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #billing-doc, #billing-doc * { visibility: visible; }
          #billing-doc { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; margin: 0; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="max-w-[800px] mx-auto mb-4 flex items-center justify-between print:hidden px-2">
        <a href="/billing" className="text-sm font-bold text-indigo-600 hover:underline">← Back to billing</a>
        <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold rounded-lg cursor-pointer">
          Print / Save as PDF
        </button>
      </div>

      <div id="billing-doc" className="relative max-w-[800px] mx-auto bg-white shadow-lg p-10 text-[13px] text-slate-800 leading-relaxed">
        {cancelled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-7xl font-black text-rose-500/20 -rotate-12 border-8 border-rose-500/20 px-6">CANCELLED</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div>
            <div className="text-xl font-black text-slate-900">{doc.company.legalName || doc.company.name}</div>
            <div className="whitespace-pre-line text-slate-600 max-w-sm">{doc.company.address}</div>
            {doc.company.gstin && <div className="mt-1"><b>GSTIN:</b> <span className="font-mono">{doc.company.gstin}</span></div>}
            {doc.company.pan && <div><b>PAN:</b> <span className="font-mono">{doc.company.pan}</span></div>}
          </div>
          <div className="text-right">
            <div className="text-lg font-black tracking-wider text-slate-900">{title}</div>
            <table className="ml-auto mt-2 text-left">
              <tbody>
                <tr><td className="pr-3 text-slate-500">No.</td><td className="font-mono font-bold">{number}</td></tr>
                <tr><td className="pr-3 text-slate-500">Date</td><td className="font-bold">{formatDate(date)}</td></tr>
                {!isPI && inv.piNumber && <tr><td className="pr-3 text-slate-500">PI ref.</td><td className="font-mono">{inv.piNumber}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bill to */}
        <div className="grid grid-cols-2 gap-6 py-4 border-b border-slate-200">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Bill to</div>
            <div className="font-black text-slate-900">{doc.client.name}</div>
            <div className="text-slate-600">{[doc.client.address, doc.client.city, doc.client.pincode].filter(Boolean).join(", ")}</div>
            {doc.client.gstin && <div className="mt-1"><b>GSTIN:</b> <span className="font-mono">{doc.client.gstin}</span></div>}
          </div>
          <div className="text-right text-slate-600">
            {isGst && placeOfSupply && (
              <div><b>Place of supply:</b> {placeOfSupply.name} ({placeOfSupply.code})</div>
            )}
            <div><b>Billing period:</b> {formatDate(doc.billingPeriodFrom)} – {formatDate(doc.billingPeriodTo)}</div>
            {doc.client.email && <div>{doc.client.email}</div>}
            {doc.client.phone && <div>{doc.client.phone}</div>}
          </div>
        </div>

        {/* Line */}
        <table className="w-full mt-4 border border-slate-300">
          <thead className="bg-slate-100">
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-600">
              <th className="p-2 border-b border-slate-300 w-10">#</th>
              <th className="p-2 border-b border-slate-300">Description</th>
              {isGst && <th className="p-2 border-b border-slate-300 w-24">SAC</th>}
              <th className="p-2 border-b border-slate-300 text-right w-36">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 align-top">1</td>
              <td className="p-2">
                <div className="font-bold">{doc.description}</div>
                <div className="text-slate-500 text-[12px]">For the period {formatDate(doc.billingPeriodFrom)} to {formatDate(doc.billingPeriodTo)}</div>
              </td>
              {isGst && <td className="p-2 font-mono align-top">{doc.sacCode || "—"}</td>}
              <td className="p-2 text-right align-top font-bold">{inr(doc.basePaise)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-3">
          <table className="w-80">
            <tbody>
              <tr><td className="py-1 text-slate-600">{isGst ? "Taxable value" : "Sub-total"}</td><td className="py-1 text-right">{inr(doc.basePaise)}</td></tr>
              {doc.taxMode === "CGST_SGST" && (
                <>
                  <tr><td className="py-1 text-slate-600">CGST @ {doc.cgstRate}%</td><td className="py-1 text-right">{inr(doc.cgstPaise)}</td></tr>
                  <tr><td className="py-1 text-slate-600">SGST @ {doc.sgstRate}%</td><td className="py-1 text-right">{inr(doc.sgstPaise)}</td></tr>
                </>
              )}
              {doc.taxMode === "IGST" && (
                <tr><td className="py-1 text-slate-600">IGST @ {doc.igstRate}%</td><td className="py-1 text-right">{inr(doc.igstPaise)}</td></tr>
              )}
              <tr className="border-t-2 border-slate-800">
                <td className="py-1.5 font-black text-slate-900">Total</td>
                <td className="py-1.5 text-right font-black text-slate-900 text-base">{inr(doc.totalPaise)}</td>
              </tr>
              {(doc.amountReceivedPaise || 0) > 0 && !cancelled && (
                <>
                  <tr><td className="py-1 text-slate-600">Received</td><td className="py-1 text-right">{inr(doc.amountReceivedPaise)}</td></tr>
                  <tr><td className="py-1 font-bold">Balance due</td><td className="py-1 text-right font-bold">{inr(Math.max(0, doc.totalPaise - doc.amountReceivedPaise))}</td></tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-slate-700"><b>Amount in words:</b> {numberToIndianWords(doc.totalPaise / 100)}</div>
        {!isGst && <div className="mt-1 text-slate-500 text-[12px]">GST not applicable.</div>}
        {doc.notes && <div className="mt-3 text-slate-600 whitespace-pre-line"><b>Notes:</b> {doc.notes}</div>}

        {/* Payment details (PIs and unpaid invoices) */}
        {doc.bank && (isPI || (inv.paymentStatus && inv.paymentStatus !== "PAID")) && (
          <div className="mt-5 p-3 border border-slate-300 rounded">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Please pay to</div>
            <div className="grid grid-cols-2 gap-x-6">
              <div><b>Account name:</b> {doc.bank.accountHolderName || doc.company.legalName || doc.company.name}</div>
              <div><b>Bank:</b> {doc.bank.bankName}{doc.bank.branch ? `, ${doc.bank.branch}` : ""}</div>
              <div><b>A/c no.:</b> <span className="font-mono">{doc.bank.accountNumber}</span></div>
              <div><b>IFSC:</b> <span className="font-mono">{doc.bank.ifsc || "—"}</span></div>
              {doc.bank.upiId && <div><b>UPI:</b> {doc.bank.upiId}</div>}
            </div>
          </div>
        )}
        {isPI && (
          <div className="mt-3 text-[12px] text-slate-500">
            This is a proforma invoice and not a tax invoice. The GST tax invoice will be issued on receipt of payment.
          </div>
        )}

        {/* Signature */}
        <div className="mt-12 flex justify-end">
          <div className="text-center">
            <div className="font-bold">For {doc.company.legalName || doc.company.name}</div>
            <div className="h-14" />
            <div className="border-t border-slate-400 pt-1 text-slate-500 text-[12px] px-6">Authorised Signatory</div>
          </div>
        </div>
        {!isPI && <div className="mt-6 text-center text-[11px] text-slate-400">This is a computer-generated invoice.</div>}
      </div>
    </div>
  );
}
