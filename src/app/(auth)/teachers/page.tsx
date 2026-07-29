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
      <div className="flex-1 h-screen overflow-y-auto min-w-0 px-6 py-6 pb-32">
        <TeacherDisplay />
      </div>
    </div>
  );
}
