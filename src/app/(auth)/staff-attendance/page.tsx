"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import TeacherSidebar from "@/components/TeacherSidebar";
import CounsellorSidebar from "@/components/CounsellorSidebar";
import ManagerSidebar from "@/components/ManagerSidebar";
import CrmSidebar from "@/components/CrmSidebar";
import StaffAttendanceDisplay from "@/components/StaffAttendanceDisplay";
import { useUser } from "@/app/component/context/user-context";

export default function StaffAttendancePage() {
  const { user } = useUser();
  const roleLower = (user?.role || "").toLowerCase().trim();

  // Render appropriate sidebar based on staff role
  const renderSidebar = () => {
    if (roleLower.includes("teacher")) {
      return <TeacherSidebar />;
    } else if (roleLower.includes("counsellor") || roleLower.includes("counselor")) {
      return <CounsellorSidebar />;
    } else if (
      roleLower.includes("centre") ||
      roleLower.includes("center") ||
      roleLower.includes("manager") ||
      roleLower.includes("branch")
    ) {
      return <ManagerSidebar />;
    } else if (roleLower.includes("crm")) {
      return <CrmSidebar />;
    }
    return <Sidebar />;
  };

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      {renderSidebar()}

      {/* Main Content Area */}
      <div className="flex-1 h-screen overflow-y-auto min-w-0 px-6 py-6 pb-32">
        <StaffAttendanceDisplay />
      </div>
    </div>
  );
}
