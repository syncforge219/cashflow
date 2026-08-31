"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../app/component/context/user-context";
import { useTheme } from "../app/component/context/theme-context";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { user: currentUser } = useUser();
  const { theme, setTheme, availableThemes } = useTheme();

  // Fetch users on mount
  useEffect(() => {
    if (isOpen) {
      Promise.all([
        fetch("/api/brand-managers").then(res => res.json().catch(() => ({}))),
        fetch("/api/counsellors").then(res => res.json().catch(() => ({})))
      ])
        .then(([bmData, cData]) => {
          const bms = bmData?.success ? (bmData.data || []) : [];
          const cls = cData?.success ? (cData.counsellors || cData.data || []) : [];
          
          // Map to a unified format
          const mappedBms = bms.map((u: any) => ({ ...u, role: "Centre Head" }));
          const mappedCls = cls.map((u: any) => ({ ...u, role: "Counsellor" }));
          
          setUsers([...mappedBms, ...mappedCls]);
        })
        .catch((err) => console.error("Failed to fetch users for command palette", err));

      // Auto-focus input when opened
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    } else {
      setQuery("");
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Filter Theme Commands
  const themeCommands = availableThemes
    .filter(
      (t) =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.id.toLowerCase().includes(query.toLowerCase()) ||
        query.toLowerCase().includes("theme") ||
        query.toLowerCase().includes("dark") ||
        query.toLowerCase().includes("light") ||
        query.toLowerCase().includes("mode") ||
        query.toLowerCase().includes("color")
    )
    .map((t) => ({
      ...t,
      type: "theme",
      _id: `theme-${t.id}`,
    }));

  // Filtering
  const filteredUsers = users.filter(u => u.name?.toLowerCase().includes(query.toLowerCase()) || u.role?.toLowerCase().includes(query.toLowerCase()));

  // Flatten items for keyboard navigation
  const allItems = [
    ...themeCommands,
    ...filteredUsers.map(u => ({ ...u, type: 'user' }))
  ];

  useEffect(() => {
    setActiveIndex(0); // Reset selection on query change
  }, [query]);

  // Handle Keyboard Navigation within Dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev < allItems.length - 1 ? prev + 1 : prev));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (allItems[activeIndex]) {
          handleSelect(allItems[activeIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, allItems, activeIndex, onClose]);

  const handleSelect = (item: any) => {
    if (item.type === 'theme') {
      setTheme(item.id);
    } else if (item.type === 'user') {
      alert(`Selected user: ${item.name}`);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 sm:px-0 font-sans">
      {/* Backdrop overlay */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-card text-foreground rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-border">

        {/* Search Input Area */}
        <div className="flex items-center px-4 py-3 border-b border-border">
          <svg className="w-5 h-5 text-primary mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 text-base"
            placeholder="Search commands, themes (e.g. 'dark', 'light'), or staff..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 bg-muted border border-border rounded px-2 py-0.5 text-[10px] font-bold text-muted-foreground select-none">
            ESC
          </kbd>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200">

          {allItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No results found for "{query}"</div>
          ) : (
            <div className="space-y-4 py-2">

              {/* Themes Section */}
              {themeCommands.length > 0 && (
                <div>
                  <h3 className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Theme Palette Actions</h3>
                  <div className="space-y-1">
                    {themeCommands.map((t) => {
                      const itemIndex = allItems.findIndex(i => i._id === t._id);
                      const isActive = itemIndex === activeIndex;
                      const isCurrent = theme === t.id;
                      return (
                        <div
                          key={t._id}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer select-none transition-colors ${isActive ? 'bg-primary/15 text-foreground' : 'hover:bg-muted text-foreground'}`}
                          onClick={() => handleSelect(allItems[itemIndex])}
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{t.icon}</span>
                            <div>
                              <div className="text-sm font-bold flex items-center gap-2">
                                Switch to {t.name} Theme
                                {isCurrent && (
                                  <span className="text-[9px] font-extrabold bg-primary text-primary-foreground px-1.5 py-0.2 rounded">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">{t.description}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs" style={{ backgroundColor: t.colors.primary }} />
                            <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-2xs" style={{ backgroundColor: t.colors.bg }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Staff Members Section */}
              {filteredUsers.length > 0 && (
                <div>
                  <h3 className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Staff Members</h3>
                  <div className="space-y-1">
                    {filteredUsers.slice(0, 5).map((user) => {
                      const itemIndex = allItems.findIndex(i => i._id === user._id);
                      const isActive = itemIndex === activeIndex;
                      return (
                        <div
                          key={user._id}
                          className={`flex items-center px-3 py-2.5 rounded-xl cursor-pointer select-none transition-colors ${isActive ? 'bg-indigo-50/80' : 'hover:bg-slate-50'}`}
                          onClick={() => handleSelect(allItems[itemIndex])}
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                        >
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${isActive ? 'bg-rose-100 text-rose-600' : 'bg-rose-50 text-rose-500'}`}>
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="ml-3 flex-1">
                            <div className={`text-sm font-bold ${isActive ? 'text-indigo-900' : 'text-slate-800'}`}>{user.name}</div>
                            <div className="text-xs text-slate-400">Role: {user.role?.toUpperCase()} • Email: {user.email || 'N/A'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between text-[10px] font-semibold text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-sm text-[9px]">↑↓</kbd> to navigate</span>
            <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-sm text-[9px]">Enter</kbd> to select</span>
            <span className="flex items-center gap-1"><kbd className="bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-sm text-[9px]">Esc</kbd> to close</span>
          </div>
          <div className="text-indigo-600 font-bold select-none">CoachFlow Assist</div>
        </div>
      </div>
    </div>
  );
}
