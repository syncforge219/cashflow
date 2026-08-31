"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@/app/component/context/user-context";
import { extractDominantColor, applyBrandTheme } from "@/lib/theme";

interface SidebarBrandHeaderProps {
  isCollapsed?: boolean;
  subtitle?: string;
}

export default function SidebarBrandHeader({
  isCollapsed = false,
  subtitle,
}: SidebarBrandHeaderProps) {
  const { user, login } = useUser();
  const [localLogo, setLocalLogo] = useState<string>("");
  const [localAppName, setLocalAppName] = useState<string>("");
  const [imgError, setImgError] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedLogo = localStorage.getItem("app_brand_logo");
    if (savedLogo) setLocalLogo(savedLogo);
    const savedName = localStorage.getItem("app_custom_name");
    if (savedName) setLocalAppName(savedName);
  }, []);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const brandLogo = localLogo || user?.brandLogo || "";
  const currentAppName = user?.customAppName || localAppName || "Lead2Ledger";

  // --- LOGO UPLOAD & RESET HANDLERS ---
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Brand logo size must be less than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        setLocalLogo(result);
        setImgError(false);

        const themeColor = await extractDominantColor(result);
        applyBrandTheme(themeColor);

        try {
          localStorage.setItem("app_brand_logo", result);
        } catch (_) {}

        try {
          const res = await fetch("/api/auth/update-profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brandLogo: result }),
          });
          const data = await res.json();
          if (res.ok && data.user) {
            login(data.user);
          }
        } catch (err) {
          console.error("Failed to save brand logo to MongoDB", err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalLogo("");
    setImgError(false);
    localStorage.removeItem("app_brand_logo");
    if (fileInputRef.current) fileInputRef.current.value = "";
    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandLogo: "" }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        login(data.user);
      }
    } catch (err) {
      console.error("Failed to reset brand logo", err);
    }
  };

  // --- EDIT APP NAME HANDLERS ---
  const startEditing = () => {
    setNameInput(currentAppName);
    setIsEditingName(true);
  };

  const cancelEditing = () => {
    setIsEditingName(false);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setIsEditingName(false);
      return;
    }

    setIsSavingName(true);
    setLocalAppName(trimmed);
    try {
      localStorage.setItem("app_custom_name", trimmed);
    } catch (_) {}

    try {
      const res = await fetch("/api/auth/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customAppName: trimmed }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        login(data.user);
      }
    } catch (err) {
      console.error("Failed to save custom app name to MongoDB", err);
    } finally {
      setIsSavingName(false);
      setIsEditingName(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  return (
    <>
      {/* Hidden File Input for Brand Logo */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png, image/jpeg, image/webp, image/svg+xml"
        onChange={handleLogoUpload}
        className="hidden"
      />

      {/* Brand Header */}
      <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-2.5"} mb-6 relative group px-1`}>
        {/* Logo Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Click to upload custom Brand Logo (PNG/JPEG)"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border shadow-2xs shrink-0 overflow-hidden group/logo hover:ring-2 hover:ring-primary hover:ring-offset-1 transition-all cursor-pointer"
        >
          {brandLogo && !imgError ? (
            <img
              src={brandLogo}
              alt="Brand Logo"
              className="h-full w-full object-contain p-1"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-primary text-primary-foreground font-extrabold text-xs">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.9c2.785 0 5.5-.413 8.084-1.205a60.43 60.43 0 0 0-.49-6.347m-15.344 0C4.3 7.299 8 7 12 7s7.7 2.999 7.75 3.147m-15.344 0C3.46 11.584 3 13.088 3 14.7c0 1.71.533 3.32 1.455 4.654M19.75 10.147c.79 1.437 1.25 3.1 1.25 4.853 0 1.612-.46 3.116-1.205 4.454M12 2.25V5.25m0 0a3 3 0 100 6 3 3 0 0 0 0-6Z" />
              </svg>
            </div>
          )}

          {/* Camera Overlay Icon on Hover */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/logo:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
          </div>
        </button>

        {/* App Name Section (Shown when expanded) */}
        {!isCollapsed && (
          <div className="flex-1 min-w-0 flex flex-col justify-center relative group/name">
            {isEditingName ? (
              <div className="flex items-center gap-1.5 w-full">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="App Name"
                  disabled={isSavingName}
                  className="w-full px-2 py-1 text-sm font-bold text-foreground bg-card border border-primary rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={isSavingName}
                  title="Save App Name"
                  className="p-1 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors cursor-pointer shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={isSavingName}
                  title="Cancel"
                  className="p-1 text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 border border-border rounded-md transition-colors cursor-pointer shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full group/title">
                <div 
                  onClick={startEditing} 
                  className="flex items-center gap-1.5 cursor-pointer select-none group-hover/title:text-primary transition-colors truncate"
                  title="Click to edit App Name"
                >
                  <span className="text-xl font-extrabold tracking-tight text-sidebar-foreground group-hover/title:text-sidebar-primary transition-colors truncate">
                    {currentAppName}
                  </span>
                  
                  {/* Pencil Edit Icon on Hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing();
                    }}
                    title="Edit App Name"
                    className="p-0.5 text-sidebar-foreground/60 hover:text-sidebar-primary opacity-0 group-hover/title:opacity-100 transition-all rounded hover:bg-sidebar-accent shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                </div>

                {brandLogo && (
                  <button
                    type="button"
                    onClick={handleResetLogo}
                    title="Reset logo to default"
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 px-1 py-0.5 rounded hover:bg-rose-500/10 opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0"
                  >
                    Reset Logo
                  </button>
                )}
              </div>
            )}

            {subtitle && !isEditingName && (
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none mt-0.5">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
