"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface QuotationNavProps {
  module?: "quotations" | "proforma" | "po";
}

export default function QuotationNav({ module }: QuotationNavProps) {
  const pathname = usePathname();

  const currentModule =
    module ||
    (pathname.startsWith("/proforma-invoices")
      ? "proforma"
      : pathname.startsWith("/purchase-orders")
      ? "po"
      : "quotations");

  let links: { name: string; href: string }[] = [];

  if (currentModule === "proforma") {
    links = [
      { name: "Proforma Invoices", href: "/proforma-invoices" },
      { name: "+ Create Proforma Invoice", href: "/quotations/new" },
      { name: "Customers Master", href: "/quotations/customers" },
      { name: "Products Master", href: "/quotations/products" },
      { name: "Company Settings", href: "/quotations/settings" },
    ];
  } else if (currentModule === "po") {
    links = [
      { name: "Purchase Orders", href: "/purchase-orders" },
      { name: "+ Create PO", href: "/quotations" },
      { name: "Customers Master", href: "/quotations/customers" },
      { name: "Products Master", href: "/quotations/products" },
      { name: "Company Settings", href: "/quotations/settings" },
    ];
  } else {
    links = [
      { name: "Dashboard & Quotations", href: "/quotations" },
      { name: "+ Create Quotation", href: "/quotations/new" },
      { name: "Customers Master", href: "/quotations/customers" },
      { name: "Products Master", href: "/quotations/products" },
      { name: "Company Settings", href: "/quotations/settings" },
    ];
  }

  return (
    <div className="bg-white border-b border-slate-200/80 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-slate-800 shadow-sm">
      <div className="flex items-center gap-2 overflow-x-auto">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
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
