"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/app/component/context/user-context";

interface CfoSecurityGuardProps {
  children: React.ReactNode;
}

export default function CfoSecurityGuard({ children }: CfoSecurityGuardProps) {
  const { user } = useUser();
  const [isBlurred, setIsBlurred] = useState(false);
  const [warningMsg, setWarningMsg] = useState("");

  const isCfo =
    user?.role?.toLowerCase() === "cfo" ||
    user?.role?.toLowerCase() === "finance manager" ||
    user?.role?.toLowerCase() === "finance executive";

  useEffect(() => {
    if (!isCfo) return;

    // 1. Prevent Right Click / Context Menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showWarning("Right-click menu is disabled for confidential CFO records.");
    };

    // 2. Prevent Copy & Cut events
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      showWarning("Copying text is restricted for confidential CFO data.");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText("");
      }
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      showWarning("Cutting text is restricted for confidential CFO data.");
    };

    // 3. Prevent Keyboard Shortcuts: Ctrl+C, Ctrl+X, Ctrl+A, Ctrl+P, Ctrl+S, Ctrl+U, PrintScreen, Win+Shift+S
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // PrintScreen / Snipping Tool detection
      if (
        e.key === "PrintScreen" ||
        key === "printscreen" ||
        (isCmdOrCtrl && e.shiftKey && (key === "s" || key === "4" || key === "3")) ||
        (e.key === "S" && e.shiftKey && (e.metaKey || e.ctrlKey))
      ) {
        e.preventDefault();
        triggerBlurGuard("Screenshot / Snipping tool detected. Content protected.");
        return;
      }

      // Copy, Cut, Select All, Print, Save, Source Code
      if (isCmdOrCtrl && ["c", "x", "a", "p", "s", "u"].includes(key)) {
        e.preventDefault();
        showWarning(`Action (CTRL+${key.toUpperCase()}) is restricted on CFO Module.`);
        if (key === "c" && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText("");
        }
      }
    };

    // 4. Handle Window Blur / Visibility Change (Snipping tool focus steal protection)
    const handleWindowBlur = () => {
      triggerBlurGuard("Window focus lost — Screen protected.");
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.key === "PrtScn") {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText("");
        }
        triggerBlurGuard("PrintScreen detected — Clipboard cleared.");
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("copy", handleCopy);
    window.addEventListener("cut", handleCut);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("copy", handleCopy);
      window.removeEventListener("cut", handleCut);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [isCfo]);

  const showWarning = (msg: string) => {
    setWarningMsg(msg);
    setTimeout(() => setWarningMsg(""), 2500);
  };

  const triggerBlurGuard = (msg: string) => {
    setIsBlurred(true);
    setWarningMsg(msg);
    setTimeout(() => {
      setIsBlurred(false);
      setWarningMsg("");
    }, 1800);
  };

  if (!isCfo) {
    return <>{children}</>;
  }

  return (
    <div className="relative select-none" style={{ WebkitUserSelect: "none", userSelect: "none" }}>
      {/* Blurred Overlay Guard for Screenshots/Blur */}
      {isBlurred && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[9999] flex flex-col items-center justify-center text-white p-6 transition-all duration-200">
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl max-w-md text-center shadow-2xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-2xl font-bold">
              🔒
            </div>
            <h3 className="text-base font-extrabold text-white">CONFIDENTIAL CFO DATA</h3>
            <p className="text-xs text-slate-300 font-medium">
              {warningMsg || "Screenshots, snipping tools, and text copying are strictly disabled for client privacy."}
            </p>
          </div>
        </div>
      )}

      {/* Floating Warning Toast */}
      {warningMsg && !isBlurred && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-rose-950/90 text-rose-200 border border-rose-800 text-xs font-bold px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-rose-400 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span>{warningMsg}</span>
        </div>
      )}

      {children}
    </div>
  );
}
