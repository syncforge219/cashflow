"use client";

import React, { useState, useEffect } from "react";
import TeacherSidebar from "@/components/TeacherSidebar";
import Sidebar from "@/components/Sidebar";
import { useUser } from "@/app/component/context/user-context";

export default function NotificationsPage() {
  const { user } = useUser();
  const isTeacher = user?.role === "teacher";

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("All");

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/notifications?role=${user?.role || "teacher"}`);
      const json = await res.json();
      if (res.ok && (json.notifications || json.data)) {
        setNotifications(json.notifications || json.data || []);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const filteredNotifs = notifications.filter((n) => {
    if (filterType === "Unread") return !n.read;
    if (filterType === "Demos") return n.type === "demo_scheduled";
    if (filterType === "Attendance") return n.type === "attendance_reminder";
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      {isTeacher ? <TeacherSidebar /> : <Sidebar />}

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto w-full space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-slate-400 flex items-center gap-1 mb-1">
                <span>CoachFlow</span>
                <span>/</span>
                <span className="text-indigo-600 font-extrabold">Notifications Hub</span>
              </div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Faculty Notifications & Alerts
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Stay updated with scheduled demos, daily attendance reminders, and student updates
              </p>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all shrink-0 cursor-pointer"
              >
                ✓ Mark All As Read
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              {["All", "Unread", "Demos", "Attendance"].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shrink-0 ${
                    filterType === t
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="text-xs font-semibold text-slate-400">
              Total Notifications: <strong className="text-slate-700">{filteredNotifs.length}</strong>
            </div>
          </div>

          {/* Notifications Feed */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-6 space-y-3">
            {isLoading ? (
              <div className="py-16 text-center text-slate-400 font-semibold text-xs">
                Loading notifications...
              </div>
            ) : filteredNotifs.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-semibold text-xs">
                No notifications match your current filter.
              </div>
            ) : (
              filteredNotifs.map((notif) => (
                <div
                  key={notif._id}
                  className={`p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                    !notif.read
                      ? "bg-indigo-50/40 border-indigo-200 shadow-xs"
                      : "bg-white border-slate-100"
                  }`}
                >
                  <div className="p-3 rounded-2xl bg-white border border-slate-200 text-xl shrink-0 shadow-2xs">
                    {notif.type === "demo_scheduled"
                      ? "🗓️"
                      : notif.type === "attendance_reminder"
                      ? "📋"
                      : notif.type === "student_enrolled"
                      ? "🎓"
                      : "🔔"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-slate-800 tracking-tight">
                        {notif.title}
                      </h3>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {notif.createdAt
                          ? new Date(notif.createdAt).toLocaleDateString()
                          : "Today"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 font-medium leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
