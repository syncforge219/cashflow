import React from "react";
import { DashboardSkeleton } from "@/components/Skeleton";

export default function AuthLoading() {
  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      <DashboardSkeleton />
    </div>
  );
}
