"use client";

import React, { useState, useEffect } from "react";
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

  // Dynamic registered softwares list
  const [registeredSoftwares, setRegisteredSoftwares] = useState<any[]>([]);

  useEffect(() => {
    async function loadSoftwares() {
      try {
        const res = await fetch("/api/softwares");
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setRegisteredSoftwares(data.data);
        }
      } catch (err) {
        console.error("Failed to load sidebar softwares:", err);
      }
    }
    loadSoftwares();
  }, []);

  const effectiveCollapsed = isPinned ? false : isCollapsed && !isHovered;

  const groups: SidebarGroup[] = [
    {
      category: "// DEV_WORKSPACE",
      items: [
        {
          name: "Developer Workspace",
          href: "/software-developer",
          badge: "v2.0",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
            </svg>
          ),
        },
        {
          name: "Developer Roster",
          href: "/software-developers",
          badge: "API",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-cyan-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6 0 3.375 3.375 0 0 1 6 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          ),
        },
        {
          name: "System Users",
          href: "/users",
          badge: "ALL",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a5.97 5.97 0 0 0-.943 3.197m12 0A11.955 11.955 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584M12 12.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
            </svg>
          ),
        },
        {
          name: "Add Software",
          href: "/softwares",
          badge: "NEW",
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 7.756a3.375 3.375 0 0 1 0 8.488M16.5 5.5a6 6 0 0 1 0 13m-11.25-13A6 6 0 0 0 2.25 12a6 6 0 0 0 3 5.25m3.75-10.5a3.375 3.375 0 0 0 0 8.488M8.25 12h7.5" />
            </svg>
          ),
        },
      ],
    },
    {
      category: "// SYSTEM_AUTH",
      items: [
        {
          name: "Term Session / Logout",
          href: "#",
          isLogout: true,
          onClick: logout,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-rose-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1 0 12.728 0M12 3v9" />
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
      className={`h-screen bg-[#080C14] border-r border-emerald-500/20 text-slate-100 flex flex-col py-5 font-mono transition-all duration-300 ease-in-out shrink-0 z-40 relative group/sidebar shadow-[0_0_40px_rgba(0,0,0,0.8)] ${
        effectiveCollapsed ? "w-20 px-3" : "w-64 px-4"
      }`}
    >
      {/* Sidebar Pin / Lock Button */}
      <button
        onClick={() => setIsPinned(!isPinned)}
        className="absolute right-2 top-3 p-1.5 rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-slate-800/80 transition-all opacity-0 group-hover/sidebar:opacity-100 z-50 cursor-pointer border border-transparent hover:border-cyan-500/30"
        title={isPinned ? "Unpin sidebar" : "Pin sidebar expanded"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={isPinned ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          className={`w-4 h-4 transition-transform ${isPinned ? "text-cyan-400 rotate-45" : "text-slate-500"}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Brand Header */}
      <div className="py-2 border-b border-slate-800/80 shrink-0">
        <SidebarBrandHeader isCollapsed={effectiveCollapsed} subtitle="[DEV_ENGINE_v2]" />
      </div>

      {/* Live System Status Pill */}
      {!effectiveCollapsed && (
        <div className="mt-4 px-3 py-2 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-[10px] flex items-center justify-between text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            SYS_STATUS: RUNNING
          </span>
          <span className="text-emerald-500 font-bold">100%</span>
        </div>
      )}

      {/* Navigation Groups */}
      <nav className="flex-1 space-y-6 overflow-y-auto py-5 custom-scrollbar">
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-2">
            {!effectiveCollapsed ? (
              <h3 className="px-3 text-[9px] font-black tracking-widest text-emerald-400/90 uppercase select-none">
                {group.category}
              </h3>
            ) : (
              <div className="border-t border-slate-800/80 my-2 mx-2" />
            )}

            <div className="space-y-1.5">
              {group.items.map((item, itemIdx) => {
                const isActive = pathname === item.href;

                if (item.isLogout) {
                  return (
                    <button
                      key={itemIdx}
                      onClick={item.onClick || logout}
                      className={`w-full flex items-center ${
                        effectiveCollapsed ? "justify-center" : "gap-3 px-3"
                      } py-2.5 text-xs font-bold rounded-xl transition-all duration-200 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 border border-rose-500/20 hover:border-rose-500/40 cursor-pointer shadow-[0_0_10px_rgba(244,63,94,0.1)]`}
                      title={effectiveCollapsed ? item.name : undefined}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      {!effectiveCollapsed && <span>{item.name}</span>}
                    </button>
                  );
                }

                return (
                  <React.Fragment key={itemIdx}>
                    <Link
                      href={item.href}
                      className={`group flex items-center justify-between ${
                        effectiveCollapsed ? "justify-center px-0" : "px-3"
                      } py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
                        isActive
                          ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 text-emerald-300 border border-emerald-500/40 shadow-[0_0_18px_rgba(16,185,129,0.2)]"
                          : "text-slate-400 hover:bg-slate-800/70 hover:text-cyan-300 border border-transparent hover:border-slate-700/60"
                      }`}
                      title={effectiveCollapsed ? item.name : undefined}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`shrink-0 transition-transform group-hover:scale-110 ${
                            isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-cyan-300"
                          }`}
                        >
                          {item.icon}
                        </span>
                        {!effectiveCollapsed && <span className="truncate">{item.name}</span>}
                      </div>

                      {!effectiveCollapsed && item.badge && (
                        <span className="text-[9px] font-black bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {item.badge}
                        </span>
                      )}
                    </Link>

                    {/* Dynamically List Registered Softwares under Add Software */}
                    {item.href === "/softwares" && !effectiveCollapsed && registeredSoftwares.length > 0 && (
                      <div className="ml-7 mt-1 space-y-1 border-l-2 border-emerald-500/30 pl-2.5 py-1">
                        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-2 mb-1">
                          REGISTERED_SOFTWARES ({registeredSoftwares.length})
                        </div>
                        {registeredSoftwares.map((soft) => (
                          <Link
                            key={soft._id}
                            href={`/softwares/${soft._id}`}
                            className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-emerald-300 hover:bg-slate-900/80 rounded-md transition-all group/soft"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <span className="text-emerald-500 font-mono text-[10px] group-hover/soft:translate-x-0.5 transition-transform">&gt;</span>
                              <span className="truncate">{soft.name}</span>
                            </span>
                            {soft.techUsed && soft.techUsed.length > 0 && (
                              <span className="text-[8px] font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-500/20 px-1 py-0.2 rounded shrink-0">
                                {soft.techUsed[0]}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Developer Profile Footer */}
      {user && !effectiveCollapsed && (
        <div className="pt-3 border-t border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 p-2.5 bg-slate-900/90 rounded-xl border border-emerald-500/20 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-slate-950 font-black text-xs flex items-center justify-center shrink-0 shadow-md">
              {(user.name || "DEV").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-slate-100 truncate">{user.name || "Developer"}</p>
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block truncate">
                {user.role || "SOFTWARE DEVELOPER"}
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
