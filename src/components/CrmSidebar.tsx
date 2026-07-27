"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useUser } from "@/app/component/context/user-context";
import SidebarBrandHeader from "@/components/SidebarBrandHeader";

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  isLogout?: boolean;
  onClick?: () => void;
}

interface SidebarGroup {
  category: string;
  items: SidebarItem[];
}

export default function CrmSidebar() {
  const pathname = usePathname();
  const { logout } = useUser();

  const groups: SidebarGroup[] = [
    {
      category: "Navigation",
      items: [
        {
          name: "Dashboard",
          href: "/crm-dashboard",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
            </svg>
          ),
        },
      ],
    },
    {
      category: "Account",
      items: [
        {
          name: "Logout",
          href: "#",
          isLogout: true,
          onClick: logout,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <aside className="w-64 flex flex-col h-screen bg-white/95 backdrop-blur-xl border-r border-slate-200/80 z-20 shadow-2xs shrink-0 select-none">
      {/* Brand Header */}
      <div className="pt-4 px-4 pb-2">
        <SidebarBrandHeader isCollapsed={false} />
      </div>

      {/* Navigation Group Items */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6 scrollbar-none">
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-2">
            <h3 className="px-3 text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
              {group.category}
            </h3>
            <div className="space-y-1">
              {group.items.map((item, itemIdx) => {
                const isActive = pathname === item.href || (pathname === "/crm" && item.href === "/crm-dashboard");
                if (item.isLogout) {
                  return (
                    <button
                      key={itemIdx}
                      onClick={item.onClick}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-rose-600 hover:bg-rose-50/80 hover:text-rose-700 cursor-pointer group"
                    >
                      <div className="flex items-center justify-center p-1.5 rounded-lg bg-rose-50 text-rose-500 group-hover:bg-rose-100 transition-colors">
                        {item.icon}
                      </div>
                      <span>{item.name}</span>
                    </button>
                  );
                }

                return (
                  <Link
                    key={itemIdx}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-indigo-500/30"
                        : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center p-1.5 rounded-lg transition-colors ${
                        isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.icon}
                    </div>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Role Tag */}
      <div className="p-3.5 m-3 border border-slate-200/60 rounded-2xl bg-gradient-to-b from-slate-50/80 to-slate-100/50 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div>
            <p className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wider leading-none">CRM Portal Active</p>
            <p className="text-[9px] font-semibold text-slate-400 mt-0.5">Realtime Data Sync</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
