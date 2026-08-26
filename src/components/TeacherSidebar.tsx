"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/app/component/context/user-context";
import SidebarBrandHeader from "@/components/SidebarBrandHeader";
import SidebarAiButton from "@/components/SidebarAiButton";

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

export default function TeacherSidebar() {
  const pathname = usePathname();
  const { user, logout } = useUser();
  const [isCollapsed, setIsCollapsed] = useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        if (window.innerWidth >= 768) {
          setIsCollapsed(false);
        } else {
          setIsCollapsed(true);
        }
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const groups: SidebarGroup[] = [
    {
      category: "MAIN",
      items: [
        {
          name: "Dashboard",
          href: "/teacher-dashboard",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
            </svg>
          ),
        },
        {
          name: "Schedule Calendar",
          href: "/teacher-dashboard/calendar",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          ),
        },
        {
          name: "Assign Batches",
          href: "/teacher-dashboard/batches",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a5.97 5.97 0 0 0-.942 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          ),
        },
        {
          name: "Student Attendance",
          href: "/attendance",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          ),
        },
        {
          name: "Staff Attendance",
          href: "/staff-attendance",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6 0 3.375 3.375 0 0 1 6 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          ),
        },
      ],
    },
    {
      category: "SYSTEM",
      items: [
        {
          name: "Logout",
          href: "#",
          isLogout: true,
          onClick: logout,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <aside
      className={`h-screen bg-white border-r border-slate-100 flex flex-col font-sans shrink-0 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="py-4 px-4 border-b border-slate-100 shrink-0">
        <SidebarBrandHeader isCollapsed={isCollapsed} subtitle="Teacher Portal" />
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 custom-scrollbar">
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-3">
            {!isCollapsed && (
              <div className="flex items-center gap-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 px-2">
                  {group.category}
                </h3>
                <div className="h-px bg-slate-100 flex-1"></div>
              </div>
            )}

            <div className="space-y-1">
              {group.items.map((item, itemIdx) => {
                const isActive = pathname === item.href;

                if (item.isLogout) {
                  return (
                    <button
                      key={itemIdx}
                      onClick={item.onClick || logout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <div className="shrink-0 text-rose-500 group-hover:text-rose-700 transition-colors">
                        {item.icon}
                      </div>
                      {!isCollapsed && (
                        <span className="text-sm font-semibold truncate text-rose-600 group-hover:text-rose-700 font-bold">
                          {item.name}
                        </span>
                      )}

                      {/* Tooltip for collapsed state */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs font-semibold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                          {item.name}
                        </div>
                      )}
                    </button>
                  );
                }

                return (
                  <Link
                    key={itemIdx}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                        : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
                    }`}
                  >
                    <div
                      className={`shrink-0 transition-colors ${
                        isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600"
                      }`}
                    >
                      {item.icon}
                    </div>
                    {!isCollapsed && (
                      <span className="text-sm font-semibold truncate">{item.name}</span>
                    )}

                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs font-semibold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                        {item.name}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Footer Card */}
      {user && !isCollapsed && (
        <div className="p-4 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl border border-slate-100">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
              {(user.name || "Teacher").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">{user.name || "Teacher"}</p>
              <p className="text-[10px] font-medium text-slate-400 truncate">{user.email || ""}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
