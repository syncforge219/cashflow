"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function QuotationNav() {
  const pathname = usePathname();
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  const handleSeedData = async () => {
    if (!confirm("This will initialize/reset sample company profile, customers, products, and 5 sample quotations. Continue?")) {
      return;
    }
    setSeeding(true);
    setSeedMsg("");
    try {
      const res = await fetch("/api/quotations/seed", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setSeedMsg("✓ Seeded sample data!");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        alert("Seed error: " + (data.error || "Failed"));
      }
    } catch (err: any) {
      alert("Error seeding: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  const links = [
    { name: "Dashboard & Quotations", href: "/quotations" },
    { name: "+ Create Quotation", href: "/quotations/new" },
    { name: "Customers Master", href: "/quotations/customers" },
    { name: "Products Master", href: "/quotations/products" },
    { name: "Company Settings", href: "/quotations/settings" },
  ];

  return (
    <div className="bg-white border-b border-slate-200/80 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-slate-800 shadow-sm">
      <div className="flex items-center gap-2 overflow-x-auto">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60"
              }`}
            >
              {link.name}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {seedMsg && <span className="text-xs font-bold text-emerald-600 animate-pulse">{seedMsg}</span>}
        <button
          onClick={handleSeedData}
          disabled={seeding}
          className="px-3.5 py-1.5 text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl transition-colors cursor-pointer shadow-sm"
        >
          {seeding ? "Seeding..." : "🌱 Seed Sample Data"}
        </button>
      </div>
    </div>
  );
}
