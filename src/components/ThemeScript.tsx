import React from "react";

/**
 * Inline pre-hydration script placed in <head>
 * Immediately applies saved theme from localStorage to <html> before React renders
 * Guarantees zero flash of incorrect theme (FOUC) and sets CSS custom properties directly.
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
        if (document.body) document.body.setAttribute('data-theme', effective);

        if (effective === 'deep-obsidian' || effective === 'cyber-sapphire' || effective === 'emerald-wealth') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }

        var palettes = {
          'classic-slate': {
            '--background': '#f8faff',
            '--foreground': '#0f172a',
            '--card': '#ffffff',
            '--card-foreground': '#0f172a',
            '--popover': '#ffffff',
            '--popover-foreground': '#0f172a',
            '--primary': '#4f46e5',
            '--primary-foreground': '#ffffff',
            '--secondary': '#f1f5f9',
            '--secondary-foreground': '#1e293b',
            '--muted': '#f8fafc',
            '--muted-foreground': '#64748b',
            '--border': '#e2e8f0',
            '--input': '#ffffff',
            '--sidebar': '#ffffff',
            '--sidebar-foreground': '#334155',
            '--sidebar-primary': '#4f46e5',
            '--sidebar-border': '#e2e8f0'
          },
          'pure-light': {
            '--background': '#f1f5f9',
            '--foreground': '#090d16',
            '--card': '#ffffff',
            '--card-foreground': '#090d16',
            '--popover': '#ffffff',
            '--popover-foreground': '#090d16',
            '--primary': '#2563eb',
            '--primary-foreground': '#ffffff',
            '--secondary': '#e2e8f0',
            '--secondary-foreground': '#0f172a',
            '--muted': '#f1f5f9',
            '--muted-foreground': '#475569',
            '--border': '#cbd5e1',
            '--input': '#ffffff',
            '--sidebar': '#ffffff',
            '--sidebar-foreground': '#1e293b',
            '--sidebar-primary': '#2563eb',
            '--sidebar-border': '#cbd5e1'
          },
          'deep-obsidian': {
            '--background': '#0b0f19',
            '--foreground': '#f8fafc',
            '--card': '#131b2e',
            '--card-foreground': '#f8fafc',
            '--popover': '#131b2e',
            '--popover-foreground': '#f8fafc',
            '--primary': '#6366f1',
            '--primary-foreground': '#ffffff',
            '--secondary': '#1e293b',
            '--secondary-foreground': '#f1f5f9',
            '--muted': '#1a233a',
            '--muted-foreground': '#94a3b8',
            '--border': '#243048',
            '--input': '#0f172a',
            '--sidebar': '#0e1526',
            '--sidebar-foreground': '#cbd5e1',
            '--sidebar-primary': '#6366f1',
            '--sidebar-border': '#1e293b'
          },
          'cyber-sapphire': {
            '--background': '#060b18',
            '--foreground': '#f0f6fc',
            '--card': '#0c152b',
            '--card-foreground': '#f0f6fc',
            '--popover': '#0c152b',
            '--popover-foreground': '#f0f6fc',
            '--primary': '#0ea5e9',
            '--primary-foreground': '#ffffff',
            '--secondary': '#132448',
            '--secondary-foreground': '#e0f2fe',
            '--muted': '#0f1f3d',
            '--muted-foreground': '#7dd3fc',
            '--border': '#1e3a6a',
            '--input': '#081024',
            '--sidebar': '#091124',
            '--sidebar-foreground': '#93c5fd',
            '--sidebar-primary': '#0ea5e9',
            '--sidebar-border': '#1e3a6a'
          },
          'emerald-wealth': {
            '--background': '#05140f',
            '--foreground': '#ecfdf5',
            '--card': '#0a221a',
            '--card-foreground': '#ecfdf5',
            '--popover': '#0a221a',
            '--popover-foreground': '#ecfdf5',
            '--primary': '#10b981',
            '--primary-foreground': '#ffffff',
            '--secondary': '#13382c',
            '--secondary-foreground': '#a7f3d0',
            '--muted': '#0e2e23',
            '--muted-foreground': '#6ee7b7',
            '--border': '#1c4d3d',
            '--input': '#061811',
            '--sidebar': '#071b14',
            '--sidebar-foreground': '#a7f3d0',
            '--sidebar-primary': '#10b981',
            '--sidebar-border': '#1c4d3d'
          }
        };

        var selectedPalette = palettes[effective] || palettes['classic-slate'];
        for (var prop in selectedPalette) {
          root.style.setProperty(prop, selectedPalette[prop]);
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
