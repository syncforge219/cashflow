"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeType = "default" | "light" | "dark" | "modern" | "emerald" | "system";
export type ResolvedThemeType = "default" | "light" | "dark" | "modern" | "emerald";

export interface ThemeOption {
  id: ThemeType;
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
    id: "default",
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
    id: "light",
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
    id: "dark",
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
    id: "modern",
    name: "Cyber Sapphire",
    category: "dark",
    description: "Midnight navy glass with radiant cyan glow",
    icon: "🌌",
    colors: {
      bg: "#070d1e",
      card: "#0d1833",
      primary: "#0ea5e9",
      border: "#1e3a6a",
      text: "#f0f6fc",
    },
  },
  {
    id: "emerald",
    name: "Emerald Wealth",
    category: "dark",
    description: "Luxury dark pine with vibrant emerald financial accents",
    icon: "🌲",
    colors: {
      bg: "#05140f",
      card: "#0c241c",
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

interface ThemeContextType {
  theme: ThemeType;
  resolvedTheme: ResolvedThemeType;
  setTheme: (theme: ThemeType) => void;
  availableThemes: ThemeOption[];
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "lead2ledger_theme_preference";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>("default");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedThemeType>("default");
  const [mounted, setMounted] = useState(false);

  // Helper to determine system theme resolution
  const getSystemTheme = (): ResolvedThemeType => {
    if (typeof window === "undefined") return "default";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default";
  };

  // Apply theme attributes to document.documentElement
  const applyThemeToDOM = (activeTheme: ThemeType) => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    let effective: ResolvedThemeType = "default";

    if (activeTheme === "system") {
      effective = getSystemTheme();
    } else {
      effective = activeTheme as ResolvedThemeType;
    }

    setResolvedTheme(effective);

    // Set data-theme attribute
    root.setAttribute("data-theme", effective);

    // Manage 'dark' CSS class
    if (effective === "dark" || effective === "modern" || effective === "emerald") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
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
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeType | null;
      if (savedTheme && AVAILABLE_THEMES.some((t) => t.id === savedTheme)) {
        setThemeState(savedTheme);
        applyThemeToDOM(savedTheme);
      } else {
        applyThemeToDOM("default");
      }
    } catch {
      applyThemeToDOM("default");
    }

    // Listen for OS system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      const currentSaved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeType | null;
      if (currentSaved === "system" || !currentSaved) {
        applyThemeToDOM("system");
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, []);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (err) {
      console.error("Failed to save theme preference to localStorage:", err);
    }
    applyThemeToDOM(newTheme);
  };

  const isDark =
    resolvedTheme === "dark" || resolvedTheme === "modern" || resolvedTheme === "emerald";

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
