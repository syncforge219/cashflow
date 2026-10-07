"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useUser } from "@/app/component/context/user-context";
import { canManageBilling } from "@/lib/billing";
import CompaniesTab, { companySetupGaps, type BillingCompany } from "./CompaniesTab";
import BankAccountsTab, { type BillingBankAccount } from "./BankAccountsTab";
import ClientsTab, { type BillingClient } from "./ClientsTab";
import { billingApi, ErrorNote } from "./ui";

type TabKey = "companies" | "banks" | "clients";

export default function BillingSetup() {
  const { user } = useUser();
  const allowed = canManageBilling(user?.role);

  const [tab, setTab] = useState<TabKey>("companies");
  const [companies, setCompanies] = useState<BillingCompany[]>([]);
  const [accounts, setAccounts] = useState<BillingBankAccount[]>([]);
  const [clients, setClients] = useState<BillingClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [co, ba, cl] = await Promise.all([
        billingApi<{ data: BillingCompany[] }>("/api/billing/companies"),
        billingApi<{ data: BillingBankAccount[] }>("/api/billing/bank-accounts"),
        billingApi<{ data: BillingClient[] }>("/api/billing/clients"),
      ]);
      setCompanies(co.data);
      setAccounts(ba.data);
      setClients(cl.data);
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    // Data fetch on mount; state is set after the awaited requests resolve
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [allowed, load]);

  if (user && !allowed) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <h1 className="text-lg font-black text-slate-900">Billing Setup</h1>
        <p className="text-sm text-slate-500 mt-2">Only Admin, Director, CFO or Finance Manager can open billing setup.</p>
      </div>
    );
  }

  const activeCompanies = companies.filter((c) => c.status !== "INACTIVE");
  const readyCompanies = activeCompanies.filter((c) => companySetupGaps(c).length === 0).length;
  const activeClients = clients.filter((c) => (c.clientStatus || "ACTIVE") === "ACTIVE");
  const unmappedClients = activeClients.filter((c) => (c.billingCompanyIds || []).length === 0).length;

  const steps = [
    {
      key: "companies" as const,
      title: "1. Companies",
      done: activeCompanies.length > 0 && readyCompanies === activeCompanies.length,
      detail: `${readyCompanies} of ${activeCompanies.length} ready to bill`,
    },
    {
      key: "banks" as const,
      title: "2. Bank accounts",
      done: activeCompanies.length > 0 && activeCompanies.every((c) => c.activeBankAccounts > 0),
      detail: `${accounts.filter((a) => a.status === "ACTIVE").length} active account${accounts.length === 1 ? "" : "s"}`,
    },
    {
      key: "clients" as const,
      title: "3. Clients",
      done: activeClients.length > 0 && unmappedClients === 0,
      detail: unmappedClients > 0 ? `${unmappedClients} not mapped to a company` : `${activeClients.length} active client${activeClients.length === 1 ? "" : "s"}`,
    },
  ];

  return (
    <div className="max-w-7xl w-full mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-black text-slate-900">Billing Setup</h1>
        <p className="text-sm text-slate-500">One-time setup before raising PIs and invoices: your companies, the bank accounts they receive money in, and your clients.</p>
      </div>

      {/* Setup checklist doubles as the tab bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5" role="tablist" aria-label="Billing setup steps">
        {steps.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={tab === s.key}
            onClick={() => setTab(s.key)}
            className={`text-left px-4 py-3 rounded-2xl border transition-colors cursor-pointer ${
              tab === s.key ? "border-indigo-600 bg-white ring-2 ring-indigo-500/15" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-slate-900">{s.title}</span>
              {!isLoading && (
                <span className={`text-xs font-black ${s.done ? "text-emerald-600" : "text-amber-600"}`}>{s.done ? "✓ Done" : "To do"}</span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{isLoading ? "Loading…" : s.detail}</div>
          </button>
        ))}
      </div>

      <ErrorNote message={loadError} />

      {tab === "companies" && <CompaniesTab companies={companies} isLoading={isLoading} onChanged={load} />}
      {tab === "banks" && <BankAccountsTab accounts={accounts} companies={activeCompanies} isLoading={isLoading} onChanged={load} />}
      {tab === "clients" && <ClientsTab clients={clients} companies={companies} isLoading={isLoading} onChanged={load} />}
    </div>
  );
}
