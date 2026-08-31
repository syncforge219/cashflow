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

export const THEME_PALETTES: Record<ResolvedThemeType, Record<string, string>> = {
  "classic-slate": {
    "--background": "#f8faff",
    "--foreground": "#0f172a",
    "--card": "#ffffff",
    "--card-foreground": "#0f172a",
    "--popover": "#ffffff",
    "--popover-foreground": "#0f172a",
    "--primary": "#4f46e5",
    "--primary-foreground": "#ffffff",
    "--secondary": "#f1f5f9",
    "--secondary-foreground": "#1e293b",
    "--muted": "#f8fafc",
    "--muted-foreground": "#64748b",
    "--accent": "#eef2ff",
    "--accent-foreground": "#4338ca",
    "--destructive": "#ef4444",
    "--destructive-foreground": "#ffffff",
    "--border": "#e2e8f0",
    "--input": "#ffffff",
    "--input-border": "#e2e8f0",
    "--ring": "#6366f1",
    "--sidebar": "#ffffff",
    "--sidebar-foreground": "#334155",
    "--sidebar-primary": "#4f46e5",
    "--sidebar-primary-foreground": "#ffffff",
    "--sidebar-accent": "#f1f5f9",
    "--sidebar-accent-foreground": "#0f172a",
    "--sidebar-border": "#e2e8f0",
    "--success": "#10b981",
    "--warning": "#f59e0b",
    "--error": "#ef4444",
    "--info": "#3b82f6",
  },
  "pure-light": {
    "--background": "#f1f5f9",
    "--foreground": "#090d16",
    "--card": "#ffffff",
    "--card-foreground": "#090d16",
    "--popover": "#ffffff",
    "--popover-foreground": "#090d16",
    "--primary": "#2563eb",
    "--primary-foreground": "#ffffff",
    "--secondary": "#e2e8f0",
    "--secondary-foreground": "#0f172a",
    "--muted": "#f1f5f9",
    "--muted-foreground": "#475569",
    "--accent": "#eff6ff",
    "--accent-foreground": "#1d4ed8",
    "--destructive": "#dc2626",
    "--destructive-foreground": "#ffffff",
    "--border": "#cbd5e1",
    "--input": "#ffffff",
    "--input-border": "#cbd5e1",
    "--ring": "#3b82f6",
    "--sidebar": "#ffffff",
    "--sidebar-foreground": "#1e293b",
    "--sidebar-primary": "#2563eb",
    "--sidebar-primary-foreground": "#ffffff",
    "--sidebar-accent": "#e2e8f0",
    "--sidebar-accent-foreground": "#090d16",
    "--sidebar-border": "#cbd5e1",
    "--success": "#059669",
    "--warning": "#d97706",
    "--error": "#dc2626",
    "--info": "#2563eb",
  },
  "deep-obsidian": {
    "--background": "#0b0f19",
    "--foreground": "#f8fafc",
    "--card": "#131b2e",
    "--card-foreground": "#f8fafc",
    "--popover": "#131b2e",
    "--popover-foreground": "#f8fafc",
    "--primary": "#6366f1",
    "--primary-foreground": "#ffffff",
    "--secondary": "#1e293b",
    "--secondary-foreground": "#f1f5f9",
    "--muted": "#1a233a",
    "--muted-foreground": "#94a3b8",
    "--accent": "#1e223f",
    "--accent-foreground": "#a5b4fc",
    "--destructive": "#ef4444",
    "--destructive-foreground": "#ffffff",
    "--border": "#243048",
    "--input": "#0f172a",
    "--input-border": "#283548",
    "--ring": "#818cf8",
    "--sidebar": "#0e1526",
    "--sidebar-foreground": "#cbd5e1",
    "--sidebar-primary": "#6366f1",
    "--sidebar-primary-foreground": "#ffffff",
    "--sidebar-accent": "#1e293b",
    "--sidebar-accent-foreground": "#ffffff",
    "--sidebar-border": "#1e293b",
    "--success": "#10b981",
    "--warning": "#f59e0b",
    "--error": "#f43f5e",
    "--info": "#38bdf8",
  },
  "cyber-sapphire": {
    "--background": "#060b18",
    "--foreground": "#f0f6fc",
    "--card": "#0c152b",
    "--card-foreground": "#f0f6fc",
    "--popover": "#0c152b",
    "--popover-foreground": "#f0f6fc",
    "--primary": "#0ea5e9",
    "--primary-foreground": "#ffffff",
    "--secondary": "#132448",
    "--secondary-foreground": "#e0f2fe",
    "--muted": "#0f1f3d",
    "--muted-foreground": "#7dd3fc",
    "--accent": "#0c284d",
    "--accent-foreground": "#38bdf8",
    "--destructive": "#f43f5e",
    "--destructive-foreground": "#ffffff",
    "--border": "#1e3a6a",
    "--input": "#081024",
    "--input-border": "#1e3a6a",
    "--ring": "#38bdf8",
    "--sidebar": "#091124",
    "--sidebar-foreground": "#93c5fd",
    "--sidebar-primary": "#0ea5e9",
    "--sidebar-primary-foreground": "#ffffff",
    "--sidebar-accent": "#132448",
    "--sidebar-accent-foreground": "#f0f6fc",
    "--sidebar-border": "#1e3a6a",
    "--success": "#06b6d4",
    "--warning": "#fb923c",
    "--error": "#f43f5e",
    "--info": "#0ea5e9",
  },
  "emerald-wealth": {
    "--background": "#05140f",
    "--foreground": "#ecfdf5",
    "--card": "#0a221a",
    "--card-foreground": "#ecfdf5",
    "--popover": "#0a221a",
    "--popover-foreground": "#ecfdf5",
    "--primary": "#10b981",
    "--primary-foreground": "#ffffff",
    "--secondary": "#13382c",
    "--secondary-foreground": "#a7f3d0",
    "--muted": "#0e2e23",
    "--muted-foreground": "#6ee7b7",
    "--accent": "#144234",
    "--accent-foreground": "#34d399",
    "--destructive": "#f87171",
    "--destructive-foreground": "#ffffff",
    "--border": "#1c4d3d",
    "--input": "#061811",
    "--input-border": "#1c4d3d",
    "--ring": "#34d399",
    "--sidebar": "#071b14",
    "--sidebar-foreground": "#a7f3d0",
    "--sidebar-primary": "#10b981",
    "--sidebar-primary-foreground": "#ffffff",
    "--sidebar-accent": "#13382c",
    "--sidebar-accent-foreground": "#ecfdf5",
    "--sidebar-border": "#1c4d3d",
    "--success": "#10b981",
    "--warning": "#fbbf24",
    "--error": "#f87171",
    "--info": "#2dd4bf",
  },
};

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

// Normalize legacy theme IDs to canonical IDs
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

  // Apply theme attributes and direct CSS variables to document.documentElement and body
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

    // 1. Set data-theme attribute on root html and body
    root.setAttribute("data-theme", effective);
    if (document.body) {
      document.body.setAttribute("data-theme", effective);
    }

    // 2. Manage 'dark' CSS class
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

    // 3. Directly inject CSS custom properties on document.documentElement.style for 100% instant certainty
    const palette = THEME_PALETTES[effective] || THEME_PALETTES["classic-slate"];
    Object.entries(palette).forEach(([varName, val]) => {
      root.style.setProperty(varName, val);
    });

    // 4. Update meta theme-color for mobile browsers
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
