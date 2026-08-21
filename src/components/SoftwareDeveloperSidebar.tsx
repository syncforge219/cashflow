"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/app/component/context/user-context";
import SidebarBrandHeader from "@/components/SidebarBrandHeader";

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  isLogout?: boolean;
  onClick?: () => void;
  badge?: string;
}

interface SidebarGroup {
  category: string;
  items: SidebarItem[];
}

export default function SoftwareDeveloperSidebar() {
  const pathname = usePathname();
  const { user, logout } = useUser();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const effectiveCollapsed = isPinned ? false : isCollapsed && !isHovered;

  const groups: SidebarGroup[] = [
    {
      category: "DEVELOPER WORKSPACE",
      items: [
        {
          name: "Developer Workspace",
          href: "/software-developer",
          badge: "Active",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
            </svg>
          ),
        },
        {
          name: "Developer Roster",
          href: "/software-developers",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6 0 3.375 3.375 0 0 1 6 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          ),
        },
      ],
    },
    {
      category: "ALL DASHBOARDS",
      items: [
        {
          name: "Admin Dashboard",
          href: "/admin-dashboard",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
            </svg>
          ),
        },
        {
          name: "CFO Dashboard",
          href: "/cfo-dashboard",
          icon: (
            <span className="font-extrabold text-[15px] leading-none h-5 w-5 flex items-center justify-center select-none text-emerald-600">
              ₹
            </span>
          ),
        },
        {
          name: "Manager Dashboard",
          href: "/manager-dashboard",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5zM9 14.25a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
            </svg>
          ),
        },
        {
          name: "Teacher Dashboard",
          href: "/teacher-dashboard",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-5.25 6.557c0 1.5 1.5 2.25 5.25 2.25s5.25-.75 5.25-2.25" />
            </svg>
          ),
        },
        {
          name: "Counsellor Dashboard",
          href: "/counsellor-dashboard",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          ),
        },
        {
          name: "CRM Dashboard",
          href: "/crm-dashboard",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          ),
        },
      ],
    },
    {
      category: "SYSTEM & ACCOUNT",
      items: [
        {
          name: "Logout",
          href: "#",
          isLogout: true,
          onClick: logout,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`h-screen bg-slate-900 border-r border-slate-800 text-white flex flex-col py-5 font-sans transition-all duration-300 ease-in-out shrink-0 z-40 relative group/sidebar shadow-2xl ${
        effectiveCollapsed ? "w-20 px-3" : "w-64 px-4"
      }`}
    >
      {/* Sidebar Pin Button */}
      <button
        onClick={() => setIsPinned(!isPinned)}
        className="absolute right-2 top-3 p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-all opacity-0 group-hover/sidebar:opacity-100 z-50 cursor-pointer"
        title={isPinned ? "Unpin sidebar" : "Pin sidebar expanded"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={isPinned ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          className={`w-4 h-4 transition-transform ${isPinned ? "text-indigo-400 rotate-45" : "text-slate-400"}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Brand Header */}
      <div className="py-2 border-b border-slate-800 shrink-0">
        <SidebarBrandHeader isCollapsed={effectiveCollapsed} subtitle="Developer Portal" />
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 space-y-6 overflow-y-auto py-4 custom-scrollbar">
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-2">
            {!effectiveCollapsed ? (
              <h3 className="px-3 text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase select-none">
                {group.category}
              </h3>
            ) : (
              <div className="border-t border-slate-800 my-1 mx-2" />
            )}

            <div className="space-y-1">
              {group.items.map((item, itemIdx) => {
                const isActive = pathname === item.href;

                if (item.isLogout) {
                  return (
                    <button
                      key={itemIdx}
                      onClick={item.onClick || logout}
                      className={`w-full flex items-center ${
                        effectiveCollapsed ? "justify-center" : "gap-3 px-3"
                      } py-2.5 text-xs font-extrabold rounded-xl transition-all duration-200 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 cursor-pointer`}
                      title={effectiveCollapsed ? item.name : undefined}
                    >
                      <span className="text-rose-400 group-hover:text-rose-300 transition-colors shrink-0">
                        {item.icon}
                      </span>
                      {!effectiveCollapsed && <span>{item.name}</span>}
                    </button>
                  );
                }

                return (
                  <Link
                    key={itemIdx}
                    href={item.href}
                    className={`group flex items-center justify-between ${
                      effectiveCollapsed ? "justify-center px-0" : "px-3"
                    } py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    }`}
                    title={effectiveCollapsed ? item.name : undefined}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`shrink-0 ${
                          isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-300"
                        }`}
                      >
                        {item.icon}
                      </span>
                      {!effectiveCollapsed && <span className="truncate">{item.name}</span>}
                    </div>

                    {!effectiveCollapsed && item.badge && (
                      <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Developer Profile Footer */}
      {user && !effectiveCollapsed && (
        <div className="pt-3 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-3 p-2.5 bg-slate-800/70 rounded-xl border border-slate-700/60">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-md">
              {(user.name || "Dev").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{user.name || "Developer"}</p>
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wide block">
                {user.role || "Software Developer"}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
