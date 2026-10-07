"use client";

import React, { useEffect } from "react";

/** fetch wrapper: returns parsed JSON, throws with the API's error message. */
export async function billingApi<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON error page
  }
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || json?.message || `Request failed (${res.status})`);
  }
  return json as T;
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/50 flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-3xl" : "max-w-xl"} max-h-[90vh] flex flex-col`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-4">{children}</div>
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex items-center justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, children, required }: { label: string; hint?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-700 mb-1">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 disabled:bg-slate-100 disabled:text-slate-500";

export function Badge({ tone, children }: { tone: "green" | "slate" | "amber" | "indigo" | "rose"; children: React.ReactNode }) {
  const cls = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  }[tone];
  return <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-extrabold uppercase whitespace-nowrap ${cls}`}>{children}</span>;
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-lg transition-colors cursor-pointer ${props.className || ""}`}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer ${props.className || ""}`}
    />
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{message}</div>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center text-slate-500 text-sm font-semibold">
        {children}
      </td>
    </tr>
  );
}

export const thClass = "py-2.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-wider";
export const tdClass = "py-3 px-4 align-top";
