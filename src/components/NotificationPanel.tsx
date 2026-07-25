"use client";

import React, { useState, useEffect } from "react";

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"All" | "Unread">("All");

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/notifications?role=teacher");
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
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const markSingleRead = async (id: string) => {
    try {
      if (!id.startsWith("live-")) {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: id, action: "Read" }),
        });
      }
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  if (!isOpen) return null;

  const filteredNotifs = notifications.filter((n) => {
    if (activeTab === "Unread") return !n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs font-sans">
      <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-slate-200 flex flex-col animate-slide-left">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Faculty Notifications</h2>
              <p className="text-[11px] text-slate-300">Live alerts, batch reminders & demo updates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action Controls */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab("All")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeTab === "All" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab("Unread")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeTab === "Unread" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              ✓ Mark All Read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {isLoading ? (
            <div className="py-16 text-center text-xs font-semibold text-slate-400">
              Loading alerts...
            </div>
          ) : filteredNotifs.length === 0 ? (
            <div className="py-16 text-center text-xs font-semibold text-slate-400">
              No notifications found.
            </div>
          ) : (
            filteredNotifs.map((notif) => (
              <div
                key={notif._id}
                onClick={() => markSingleRead(notif._id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                  !notif.read
                    ? "border-indigo-200 bg-indigo-50/40 shadow-xs"
                    : "border-slate-100 bg-white hover:border-slate-200"
                }`}
              >
                {!notif.read && (
                  <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>
                )}

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-white border border-slate-200 text-base shrink-0 shadow-2xs">
                    {notif.type === "demo_scheduled"
                      ? "🗓️"
                      : notif.type === "attendance_reminder"
                      ? "📋"
                      : notif.type === "student_enrolled"
                      ? "🎓"
                      : "🔔"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-extrabold text-slate-800 tracking-tight">
                      {notif.title}
                    </h4>
                    <p className="text-xs text-slate-600 mt-1 leading-snug font-medium">
                      {notif.message}
                    </p>

                    <div className="mt-2.5 flex items-center justify-between text-[10px] font-semibold text-slate-400">
                      <span>
                        {notif.createdAt
                          ? new Date(notif.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "Just now"}
                      </span>
                      <span className="text-indigo-600 font-bold hover:underline">
                        View Details →
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
