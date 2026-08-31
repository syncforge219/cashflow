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
        var theme = localStorage.getItem(key) || 'default';
        var root = document.documentElement;
        var isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        var effective = theme;
        if (theme === 'system') {
          effective = isSystemDark ? 'dark' : 'default';
        }
        
        root.setAttribute('data-theme', effective);
        if (effective === 'dark' || effective === 'modern' || effective === 'emerald') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      } catch (e) {
        document.documentElement.setAttribute('data-theme', 'default');
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
