"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import TeacherDisplay from "@/components/TeacherDisplay";

export default function TeachersPage() {
  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6">
        <TeacherDisplay />
      </div>
    </div>
  );
}
