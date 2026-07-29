"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useUser } from "@/app/component/context/user-context";
import SidebarBrandHeader from "@/components/SidebarBrandHeader";
import SidebarAiButton from "@/components/SidebarAiButton";

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  hasNotification?: boolean;
  onClick?: () => void;
}

interface SidebarGroup {
  category: string;
  items: SidebarItem[];
}

export default function CounsellorSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const effectiveCollapsed = isPinned ? false : isCollapsed && !isHovered;
  const { logout } = useUser();

  const groups: SidebarGroup[] = [
    {
      category: "Main",
      items: [
        {
          name: "Dashboard",
          href: "/counsellor-dashboard",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
            </svg>
          ),
        },
        {
          name: "Enquiries",
          href: "/counsellor-dashboard/followups",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          ),
        },
        {
          name: "Follow-ups",
          href: "/followups",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          name: "Admissions",
          href: "/counsellor-dashboard/admissions",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
            </svg>
          ),
        },
        {
          name: "Student 360",
          href: "/student-360",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm-3.75 7.5c0-1.554 1.256-2.812 2.812-2.812h.376c1.556 0 2.812 1.258 2.812 2.812v.187H6.75v-.187z" />
            </svg>
          ),
        },
        {
          name: "Fee Collection",
          href: "/counsellor-dashboard/finance",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          ),
        },
      ],
    },
    {
      category: "Tools",
      items: [
        {
          name: "My Tasks",
          href: "/counsellor-dashboard/tasks",
          hasNotification: true,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0018 4.5h-12A2.25 2.25 0 003.75 6.75v10.5a2.25 2.25 0 002.25 2.25h12a2.25 2.25 0 002.25-2.25V18.75z" />
            </svg>
          ),
        },
        {
          name: "Calendar",
          href: "/counsellor-dashboard/calendar",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          ),
        },
      ],
    },
    {
      category: "System",
      items: [
        {
          name: "Logout",
          href: "#",
          onClick: logout,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
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
      className={`bg-white border-r border-slate-200/80 h-screen flex flex-col py-6 font-sans transition-all duration-300 ease-in-out shrink-0 relative group/sidebar ${effectiveCollapsed ? "w-20 px-3" : "w-64 px-4 shadow-xl"
        }`}
    >
      {/* Pin / Lock Sidebar Toggle Button */}
      <button
        onClick={() => setIsPinned(!isPinned)}
        className="absolute right-2 top-3 p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 transition-all opacity-0 group-hover/sidebar:opacity-100 z-50 cursor-pointer"
        title={isPinned ? "Unpin sidebar (Auto-collapse on mouse exit)" : "Pin sidebar expanded"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={isPinned ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          className={`w-4 h-4 transition-transform ${isPinned ? "text-emerald-600 rotate-45" : "text-slate-400"}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Brand Header */}
      <SidebarBrandHeader isCollapsed={effectiveCollapsed} subtitle="Counsellor Portal" />

      {/* CashFlow AI Copilot Trigger */}
      <SidebarAiButton isCollapsed={effectiveCollapsed} />

      {/* Navigation Groups */}
      <nav className="flex-1 space-y-6 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.category} className="space-y-2">
            {!effectiveCollapsed ? (
              <h3 className="px-3 text-[10px] font-bold tracking-widest text-slate-400/90 uppercase select-none">
                {group.category}
              </h3>
            ) : (
              <div className="border-t border-slate-200/50 my-1 mx-2"></div>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <motion.li
                    key={item.name}
                    whileHover={{ scale: 1.02, x: 4 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <Link
                      href={item.href}
                      onClick={item.onClick ? (e) => { e.preventDefault(); item.onClick!(); } : undefined}
                      className={`group flex items-center ${effectiveCollapsed ? "justify-center" : "gap-3 px-3"} py-2.5 text-xs font-bold rounded-xl transition-all duration-200 relative ${isActive
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      title={effectiveCollapsed ? item.name : undefined}
                    >
                      <span className={`${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-700 transition-colors"} relative`}>
                        {item.icon}
                        {item.hasNotification && (
                          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-rose-500 rounded-full border border-white"></span>
                        )}
                      </span>
                      {!effectiveCollapsed && <span>{item.name}</span>}
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
            {!effectiveCollapsed && group.category !== "Tools" && (
              <div className="pt-2 border-b border-slate-200/50 mx-3"></div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
