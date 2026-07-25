"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import TeacherSidebar from "@/components/TeacherSidebar";
import AttendanceDisplay from "@/components/AttendanceDisplay";
import { useUser } from "@/app/component/context/user-context";

export default function AttendancePage() {
  const { user } = useUser();
  const isTeacher = user?.role === "teacher";

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      {/* Sidebar navigation based on role */}
      {isTeacher ? <TeacherSidebar /> : <Sidebar />}

      {/* Main Attendance Management Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6">
        <AttendanceDisplay />
      </div>
    </div>
  );
}
