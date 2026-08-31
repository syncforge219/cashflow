"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeType =
  | "classic-slate"
  | "pure-light"
  | "deep-obsidian"
  | "cyber-sapphire"
  | "emerald-wealth"
  | "system"
  | "default"
  | "light"
  | "dark"
  | "modern"
  | "emerald";

export type ResolvedThemeType =
  | "classic-slate"
  | "pure-light"
  | "deep-obsidian"
  | "cyber-sapphire"
  | "emerald-wealth";

export interface ThemeOption {
  id: "classic-slate" | "pure-light" | "deep-obsidian" | "cyber-sapphire" | "emerald-wealth" | "system";
  name: string;
  category: "light" | "dark" | "system";
  description: string;
  icon: string;
  colors: {
    bg: string;
    card: string;
    primary: string;
    border: string;
    text: string;
  };
}

export const AVAILABLE_THEMES: ThemeOption[] = [
  {
    id: "classic-slate",
    name: "Classic Slate",
    category: "light",
    description: "Original Lead2Ledger clean indigo & slate workspace",
    icon: "💎",
    colors: {
      bg: "#f8faff",
      card: "#ffffff",
      primary: "#4f46e5",
      border: "#e2e8f0",
      text: "#0f172a",
    },
  },
  {
    id: "pure-light",
    name: "Pure Light",
    category: "light",
    description: "Crisp high-contrast executive daylight theme",
    icon: "☀️",
    colors: {
      bg: "#f1f5f9",
      card: "#ffffff",
      primary: "#2563eb",
      border: "#cbd5e1",
      text: "#090d16",
    },
  },
  {
    id: "deep-obsidian",
    name: "Deep Obsidian",
    category: "dark",
    description: "Deep slate & luminous indigo for focused work",
    icon: "🌙",
    colors: {
      bg: "#0b0f19",
      card: "#131b2e",
      primary: "#6366f1",
      border: "#283548",
      text: "#f8fafc",
    },
  },
  {
    id: "cyber-sapphire",
    name: "Cyber Sapphire",
    category: "dark",
    description: "Midnight navy glass with radiant cyan glow",
    icon: "🌌",
    colors: {
      bg: "#060b18",
      card: "#0c152b",
      primary: "#0ea5e9",
      border: "#1e3a6a",
      text: "#f0f6fc",
    },
  },
  {
    id: "emerald-wealth",
    name: "Emerald Wealth",
    category: "dark",
    description: "Luxury dark pine with vibrant emerald financial accents",
    icon: "🌲",
    colors: {
      bg: "#05140f",
      card: "#0a221a",
      primary: "#10b981",
      border: "#1c4d3d",
      text: "#ecfdf5",
    },
  },
  {
    id: "system",
    name: "System Sync",
    category: "system",
    description: "Automatically matches your operating system appearance",
    icon: "💻",
    colors: {
      bg: "linear-gradient(135deg, #f8faff 50%, #0b0f19 50%)",
      card: "#ffffff",
      primary: "#4f46e5",
      border: "#e2e8f0",
      text: "#0f172a",
    },
  },
];

// Helper to normalize legacy theme IDs to canonical IDs
export function normalizeThemeId(id: string | null | undefined): "classic-slate" | "pure-light" | "deep-obsidian" | "cyber-sapphire" | "emerald-wealth" | "system" {
  if (!id) return "classic-slate";
  if (id === "default") return "classic-slate";
  if (id === "light") return "pure-light";
  if (id === "dark") return "deep-obsidian";
  if (id === "modern") return "cyber-sapphire";
  if (id === "emerald") return "emerald-wealth";
  if (AVAILABLE_THEMES.some((t) => t.id === id)) {
    return id as any;
  }
  return "classic-slate";
}

interface ThemeContextType {
  theme: "classic-slate" | "pure-light" | "deep-obsidian" | "cyber-sapphire" | "emerald-wealth" | "system";
  resolvedTheme: ResolvedThemeType;
  setTheme: (theme: ThemeType) => void;
  availableThemes: ThemeOption[];
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "lead2ledger_theme_preference";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<"classic-slate" | "pure-light" | "deep-obsidian" | "cyber-sapphire" | "emerald-wealth" | "system">("classic-slate");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedThemeType>("classic-slate");
  const [mounted, setMounted] = useState(false);

  // Helper to determine system theme resolution
  const getSystemTheme = (): ResolvedThemeType => {
    if (typeof window === "undefined") return "classic-slate";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "deep-obsidian" : "classic-slate";
  };

  // Apply theme attributes to document.documentElement and body
  const applyThemeToDOM = (activeTheme: string) => {
    if (typeof document === "undefined") return;

    const normalized = normalizeThemeId(activeTheme);
    const root = document.documentElement;
    let effective: ResolvedThemeType = "classic-slate";

    if (normalized === "system") {
      effective = getSystemTheme();
    } else {
      effective = normalized;
    }

    setResolvedTheme(effective);

    // Set data-theme attribute on root html and body
    root.setAttribute("data-theme", effective);
    if (document.body) {
      document.body.setAttribute("data-theme", effective);
    }

    // Manage 'dark' CSS class
    const isDarkTheme =
      effective === "deep-obsidian" ||
      effective === "cyber-sapphire" ||
      effective === "emerald-wealth";

    if (isDarkTheme) {
      root.classList.add("dark");
      if (document.body) document.body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      if (document.body) document.body.classList.remove("dark");
    }

    // Also update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const matched = AVAILABLE_THEMES.find((t) => t.id === effective);
    if (matched && matched.colors.bg.startsWith("#")) {
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", matched.colors.bg);
      } else {
        const meta = document.createElement("meta");
        meta.name = "theme-color";
        meta.content = matched.colors.bg;
        document.head.appendChild(meta);
      }
    }
  };

  // Initialize on mount
  useEffect(() => {
    setMounted(true);
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      const normalized = normalizeThemeId(savedTheme);
      setThemeState(normalized);
      applyThemeToDOM(normalized);
    } catch {
      applyThemeToDOM("classic-slate");
    }

    // Listen for OS system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      const currentSaved = localStorage.getItem(THEME_STORAGE_KEY);
      if (currentSaved === "system") {
        applyThemeToDOM("system");
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, []);

  const setTheme = (newTheme: ThemeType) => {
    const normalized = normalizeThemeId(newTheme);
    setThemeState(normalized);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalized);
    } catch (err) {
      console.error("Failed to save theme preference to localStorage:", err);
    }
    applyThemeToDOM(normalized);
  };

  const isDark =
    resolvedTheme === "deep-obsidian" ||
    resolvedTheme === "cyber-sapphire" ||
    resolvedTheme === "emerald-wealth";

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        availableThemes: AVAILABLE_THEMES,
        isDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
