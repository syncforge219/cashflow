"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import TeacherSidebar from "@/components/TeacherSidebar";
import BatchDisplay from "@/components/BatchDisplay";
import { useUser } from "@/app/component/context/user-context";

export default function BatchesPage() {
  const { user } = useUser();
  const roleLowerStr = (user?.role || "").toLowerCase().trim();
  const isTeacher =
    roleLowerStr.includes("teacher") ||
    roleLowerStr.includes("faculty") ||
    roleLowerStr.includes("instructor") ||
    roleLowerStr.includes("trainer");

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      {/* Navigation Sidebar */}
      {isTeacher ? <TeacherSidebar /> : <Sidebar />}

      {/* Main Content View */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6">
        <BatchDisplay />
      </div>
    </div>
  );
}
