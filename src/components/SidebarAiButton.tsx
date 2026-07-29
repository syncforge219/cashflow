"use client";

import React from "react";
import { motion } from "framer-motion";

interface SidebarAiButtonProps {
  isCollapsed?: boolean;
}

export default function SidebarAiButton({ isCollapsed = false }: SidebarAiButtonProps) {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("toggle-ai-assistant"));
  };

  return (
    <div className="px-3 py-2 shrink-0 select-none">
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className={`w-full group relative flex items-center ${
          isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
        } bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white rounded-2xl shadow-md shadow-indigo-500/25 border border-purple-300/40 cursor-pointer transition-all duration-200`}
        title="✨ Open Lead2Ledger AI Assistant"
      >
        <div className="relative flex items-center justify-center shrink-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5 text-purple-200 group-hover:rotate-12 transition-transform duration-300"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
            />
          </svg>
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
          </span>
        </div>

        {!isCollapsed && (
          <div className="flex items-center justify-between flex-1 min-w-0">
            <span className="text-xs font-black tracking-wider uppercase truncate">
              ✨ Lead2Ledger AI
            </span>
            <span className="bg-white/20 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded text-white tracking-widest">
              AI
            </span>
          </div>
        )}
      </motion.button>
    </div>
  );
}
