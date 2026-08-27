"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function QuotationNav() {
  const pathname = usePathname();

  const links = [
    { name: "Proforma Invoices", href: "/proforma-invoices" },
    { name: "+ Create Proforma Invoice", href: "/quotations/new" },
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
    </div>
  );
}
