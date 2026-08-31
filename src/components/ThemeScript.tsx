import React from "react";

/**
 * Inline pre-hydration script placed in <head>
 * Immediately applies saved theme from localStorage to <html> before React renders
 * Guarantees zero flash of incorrect theme (FOUC).
 */
export default function ThemeScript() {
  const scriptContent = `
    (function() {
      try {
        var key = 'lead2ledger_theme_preference';
        var theme = localStorage.getItem(key) || 'classic-slate';
        var root = document.documentElement;
        var isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Normalize aliases
        if (theme === 'default') theme = 'classic-slate';
        if (theme === 'light') theme = 'pure-light';
        if (theme === 'dark') theme = 'deep-obsidian';
        if (theme === 'modern') theme = 'cyber-sapphire';
        if (theme === 'emerald') theme = 'emerald-wealth';

        var effective = theme;
        if (theme === 'system') {
          effective = isSystemDark ? 'deep-obsidian' : 'classic-slate';
        }
        
        root.setAttribute('data-theme', effective);
        if (effective === 'deep-obsidian' || effective === 'cyber-sapphire' || effective === 'emerald-wealth') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'classic-slate');
      }
    })();
  `;

  return (
    <script
      id="lead2ledger-theme-script"
      dangerouslySetInnerHTML={{ __html: scriptContent }}
    />
  );
}
