"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/app/component/context/user-context";
import { canManageBilling } from "@/lib/billing";
import { todayKey } from "@/lib/dates";
import type { BillingCompany } from "./CompaniesTab";
import type { BillingBankAccount } from "./BankAccountsTab";
import type { BillingClient } from "./ClientsTab";
import { duePaise, inr, piAgeWarning, type ClientReceiptDoc, type ServiceInvoiceDoc, type ServicePIDoc } from "./docTypes";
import PIsTab from "./PIsTab";
import InvoicesTab from "./InvoicesTab";
import ReceiptsTab from "./ReceiptsTab";
import NewDocModal from "./NewDocModal";
import ReceiptModal from "./ReceiptModal";
import { billingApi, ErrorNote } from "./ui";

type TabKey = "pis" | "invoices" | "receipts";

export default function BillingWorkspace() {
  const { user } = useUser();
  const allowed = canManageBilling(user?.role);

  const [tab, setTab] = useState<TabKey>("pis");
  const [companies, setCompanies] = useState<BillingCompany[]>([]);
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [banks, setBanks] = useState<BillingBankAccount[]>([]);
  const [pis, setPis] = useState<ServicePIDoc[]>([]);
  const [invoices, setInvoices] = useState<ServiceInvoiceDoc[]>([]);
  const [receipts, setReceipts] = useState<ClientReceiptDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");

  const [newDoc, setNewDoc] = useState<"PI" | "NON_GST_INVOICE" | null>(null);
  const [receiptPreset, setReceiptPreset] = useState<{ clientId: string; docKey: string } | null | undefined>(undefined);

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [co, cl, ba, p, i, r] = await Promise.all([
        billingApi<{ data: BillingCompany[] }>("/api/billing/companies"),
        billingApi<{ data: BillingClient[] }>("/api/billing/clients"),
        billingApi<{ data: BillingBankAccount[] }>("/api/billing/bank-accounts"),
        billingApi<{ data: ServicePIDoc[] }>("/api/billing/pis"),
        billingApi<{ data: ServiceInvoiceDoc[] }>("/api/billing/invoices"),
        billingApi<{ data: ClientReceiptDoc[] }>("/api/billing/receipts"),
      ]);
      setCompanies(co.data);
      setClients(cl.data);
      setBanks(ba.data);
      setPis(p.data);
      setInvoices(i.data);
      setReceipts(r.data);
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [allowed, load]);

  const done = (message?: string) => {
    setNewDoc(null);
    setReceiptPreset(undefined);
    if (message) {
      setToast(message);
      setTimeout(() => setToast(""), 5000);
    }
    load();
  };

  if (user && !allowed) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <h1 className="text-lg font-black text-slate-900">Billing</h1>
        <p className="text-sm text-slate-500 mt-2">Only Admin, Director, CFO or Finance Manager can open billing.</p>
      </div>
    );
  }

  // Headline numbers
  const openPis = pis.filter((p) => ["GENERATED", "SENT", "PARTIALLY_PAID"].includes(p.status));
  const outstanding =
    openPis.reduce((s, p) => s + duePaise(p), 0) +
    invoices.filter((i) => i.invoiceType === "NON_GST_INVOICE" && i.paymentStatus !== "PAID").reduce((s, i) => s + duePaise(i), 0);
  const toInvoice = pis.filter((p) => p.status === "PAID" && !p.taxInvoiceId).length;
  const ageing = openPis.filter((p) => piAgeWarning(p)).length;
  const monthPrefix = todayKey().slice(0, 7); // IST month
  const receivedThisMonth = receipts
    .filter((r) => r.status === "ACTIVE" && String(r.receiptDate).slice(0, 7) === monthPrefix)
    .reduce((s, r) => s + r.amountPaise, 0);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "pis", label: "Proforma invoices", count: pis.length },
    { key: "invoices", label: "Invoices", count: invoices.length },
    { key: "receipts", label: "Receipts", count: receipts.filter((r) => r.status === "ACTIVE").length },
  ];

  return (
    <div className="max-w-7xl w-full mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-black text-slate-900">Billing</h1>
          <p className="text-sm text-slate-500">GST: PI → payment → tax invoice. Non-GST: direct invoice.</p>
        </div>
        <Link href="/billing-setup" className="text-xs font-bold text-indigo-600 hover:underline">
          Billing setup (companies, banks, clients) →
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Outstanding" value={inr(outstanding)} hint={`${openPis.length} open PI${openPis.length === 1 ? "" : "s"}`} tone="rose" />
        <Stat label="Received this month" value={inr(receivedThisMonth)} tone="emerald" />
        <Stat
          label="Paid PIs to invoice"
          value={String(toInvoice)}
          hint={toInvoice > 0 ? "Generate their tax invoices" : "All caught up"}
          tone={toInvoice > 0 ? "amber" : "slate"}
          onClick={() => setTab("pis")}
        />
        <Stat label="PIs unpaid 25+ days" value={String(ageing)} hint="GST: invoice within 30 days" tone={ageing > 0 ? "rose" : "slate"} />
      </div>

      {toast && <div className="mb-3 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold">✓ {toast}</div>}
      <ErrorNote message={loadError} />

      <div className="flex items-center gap-1 border-b border-slate-200 mb-4" role="tablist" aria-label="Billing">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-extrabold border-b-2 -mb-px cursor-pointer ${
              tab === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label} <span className="ml-1 text-[11px] text-slate-400">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "pis" && (
        <PIsTab
          pis={pis}
          isLoading={isLoading}
          onNew={() => setNewDoc("PI")}
          onRecordPayment={(pi) => setReceiptPreset({ clientId: String(pi.clientId), docKey: `PI:${pi._id}` })}
          onChanged={done}
        />
      )}
      {tab === "invoices" && (
        <InvoicesTab
          invoices={invoices}
          isLoading={isLoading}
          onNewNonGst={() => setNewDoc("NON_GST_INVOICE")}
          onRecordPayment={(inv) => setReceiptPreset({ clientId: String(inv.clientId), docKey: `INVOICE:${inv._id}` })}
        />
      )}
      {tab === "receipts" && <ReceiptsTab receipts={receipts} isLoading={isLoading} onNew={() => setReceiptPreset(null)} onChanged={done} />}

      {newDoc && <NewDocModal kind={newDoc} clients={clients} companies={companies} onClose={() => setNewDoc(null)} onCreated={done} />}
      {receiptPreset !== undefined && (
        <ReceiptModal clients={clients} bankAccounts={banks} preset={receiptPreset} onClose={() => setReceiptPreset(undefined)} onSaved={done} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "rose" | "emerald" | "amber" | "slate";
  onClick?: () => void;
}) {
  const color = { rose: "text-rose-600", emerald: "text-emerald-700", amber: "text-amber-600", slate: "text-slate-800" }[tone];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`text-left bg-white border border-slate-200 rounded-2xl px-4 py-3 ${onClick ? "hover:border-slate-300 cursor-pointer" : ""}`}>
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`text-xl font-black mt-0.5 ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </Tag>
  );
}
