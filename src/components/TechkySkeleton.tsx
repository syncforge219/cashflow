"use client";

import React from "react";

export function TechkySkeleton() {
  return (
    <div className="flex h-screen bg-[#050811] text-slate-100 overflow-hidden font-mono selection:bg-emerald-500 selection:text-slate-950">
      {/* Dark Cyber Sidebar Skeleton */}
      <aside className="w-64 h-screen bg-[#080C14] border-r border-emerald-500/20 px-4 py-5 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          {/* Brand Header Skeleton */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="h-10 w-10 rounded-xl bg-slate-900 border border-emerald-500/30 animate-pulse"></div>
            <div className="space-y-2 flex-1">
              <div className="h-3 bg-slate-800 rounded w-28 animate-pulse"></div>
              <div className="h-2 bg-emerald-950 rounded w-20 border border-emerald-500/20 animate-pulse"></div>
            </div>
          </div>

          {/* Status Pill Skeleton */}
          <div className="h-7 bg-emerald-950/40 border border-emerald-500/20 rounded-xl animate-pulse flex items-center px-3">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping mr-2"></div>
            <div className="h-2 bg-emerald-800 rounded w-24"></div>
          </div>

          {/* Navigation Items Skeletons */}
          <div className="space-y-3 pt-2">
            <div className="h-2.5 bg-slate-800 rounded w-24 animate-pulse"></div>
            <div className="h-9 bg-emerald-950/30 border border-emerald-500/30 rounded-xl animate-pulse"></div>
            <div className="h-9 bg-slate-900 rounded-xl animate-pulse"></div>
            <div className="h-9 bg-slate-900 rounded-xl animate-pulse"></div>
          </div>
        </div>

        {/* User Footer Skeleton */}
        <div className="p-3 bg-slate-900/90 rounded-xl border border-emerald-500/20 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-800 animate-pulse"></div>
          <div className="space-y-1.5 flex-1">
            <div className="h-3 bg-slate-800 rounded w-24 animate-pulse"></div>
            <div className="h-2 bg-emerald-950 rounded w-16 animate-pulse"></div>
          </div>
        </div>
      </aside>

      {/* Main Content Techky Skeleton */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 space-y-6">
        {/* Top Header Navbar Skeleton */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="space-y-2">
            <div className="h-2.5 bg-emerald-950 border border-emerald-500/30 rounded w-36 animate-pulse"></div>
            <div className="h-6 bg-slate-900 border border-slate-800 rounded w-64 animate-pulse"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 bg-slate-900 border border-slate-800 rounded-xl w-32 animate-pulse"></div>
            <div className="h-9 w-9 bg-slate-900 border border-emerald-500/30 rounded-xl animate-pulse"></div>
          </div>
        </div>

        {/* Developer Banner Skeleton */}
        <div className="h-28 bg-[#090E1A] border border-emerald-500/20 rounded-2xl p-6 flex items-center justify-between animate-pulse shadow-[0_0_30px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-slate-900 border border-emerald-500/40 rounded-2xl shrink-0"></div>
            <div className="space-y-2">
              <div className="h-5 bg-slate-800 rounded w-48"></div>
              <div className="h-3 bg-cyan-950 rounded w-36"></div>
            </div>
          </div>
          <div className="space-y-2 text-right">
            <div className="h-3 bg-slate-800 rounded w-28 ml-auto"></div>
            <div className="h-4 bg-emerald-950 border border-emerald-500/30 rounded w-32 ml-auto"></div>
          </div>
        </div>

        {/* 4 Stats Cards Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 bg-[#090E1A] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between animate-pulse"
            >
              <div className="h-2.5 bg-slate-800 rounded w-24"></div>
              <div className="h-6 bg-emerald-950/60 border border-emerald-500/20 rounded w-16"></div>
            </div>
          ))}
        </div>

        {/* Main Content Workspace Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
          <div className="lg:col-span-2 bg-[#090E1A] border border-slate-800 rounded-2xl p-6 space-y-4 animate-pulse">
            <div className="h-4 bg-slate-800 rounded w-56"></div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="h-16 bg-slate-950 border border-slate-800 rounded-xl"></div>
              <div className="h-16 bg-slate-950 border border-slate-800 rounded-xl"></div>
              <div className="h-16 bg-slate-950 border border-slate-800 rounded-xl"></div>
              <div className="h-16 bg-slate-950 border border-slate-800 rounded-xl"></div>
            </div>
          </div>

          <div className="bg-[#04060C] border border-emerald-500/20 rounded-2xl p-5 space-y-4 animate-pulse">
            <div className="h-4 bg-slate-800 rounded w-36"></div>
            <div className="h-36 bg-slate-950 border border-slate-800 rounded-xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TechkySkeleton;
