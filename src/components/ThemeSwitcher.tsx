"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "@/app/component/context/theme-context";
import { motion, AnimatePresence } from "framer-motion";

interface ThemeSwitcherProps {
  compact?: boolean;
  className?: string;
}

export default function ThemeSwitcher({ compact = false, className = "" }: ThemeSwitcherProps) {
  const { theme, resolvedTheme, setTheme, availableThemes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeThemeObj = availableThemes.find((t) => t.id === theme) || availableThemes[0];

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ backgroundColor: "var(--card)", color: "var(--foreground)", borderColor: "var(--border)" }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-xs hover:border-primary transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-primary/20 ${
          compact ? "p-2 justify-center" : ""
        }`}
        title={`Current Theme: ${activeThemeObj.name}`}
      >
        <span className="text-sm leading-none">{activeThemeObj.icon}</span>
        {!compact && (
          <>
            <span className="truncate max-w-[95px]">{activeThemeObj.name}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                isOpen ? "rotate-180 text-primary" : ""
              }`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown Menu - 100% Opaque Solid Surface */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
              backgroundColor: "var(--popover)",
              color: "var(--popover-foreground)",
              borderColor: "var(--border)",
            }}
            className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl border p-2 shadow-2xl z-[9999] focus:outline-none"
          >
            {/* Header */}
            <div
              style={{ borderColor: "var(--border)" }}
              className="px-3 py-2 border-b mb-1.5 flex items-center justify-between"
            >
              <div>
                <h4 className="text-xs font-extrabold tracking-tight" style={{ color: "var(--foreground)" }}>
                  Appearance & Theme
                </h4>
                <p className="text-[10px] font-medium" style={{ color: "var(--muted-foreground)" }}>
                  Select global software palette
                </p>
              </div>
              <span
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-foreground)",
                  borderColor: "var(--border)",
                }}
                className="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase border"
              >
                {resolvedTheme}
              </span>
            </div>

            {/* Theme Options List */}
            <div className="space-y-1 max-h-80 overflow-y-auto pr-0.5">
              {availableThemes.map((t) => {
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTheme(t.id);
                      setIsOpen(false);
                    }}
                    style={{
                      backgroundColor: isSelected ? "var(--accent)" : "transparent",
                      borderColor: isSelected ? "var(--border)" : "transparent",
                      color: isSelected ? "var(--accent-foreground)" : "var(--foreground)",
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                      isSelected ? "font-bold shadow-xs" : "hover:bg-muted font-semibold"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <span className="text-lg leading-none shrink-0">{t.icon}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate">{t.name}</span>
                          {isSelected && (
                            <span
                              style={{
                                backgroundColor: "var(--primary)",
                                color: "var(--primary-foreground)",
                              }}
                              className="text-[9px] font-extrabold px-1.5 py-0.2 rounded"
                            >
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-normal truncate mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                          {t.description}
                        </p>
                      </div>
                    </div>

                    {/* Color Swatch Preview */}
                    <div
                      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
                      className="flex items-center gap-1 shrink-0 p-1 rounded-lg border"
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border shadow-2xs"
                        style={{ backgroundColor: t.colors.primary, borderColor: "var(--border)" }}
                        title="Primary color"
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full border shadow-2xs"
                        style={{ backgroundColor: t.colors.bg, borderColor: "var(--border)" }}
                        title="Background color"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
