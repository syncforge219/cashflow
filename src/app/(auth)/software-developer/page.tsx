"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import ProfileDisplay from "@/components/ProfileDisplay";
import { useUser } from "@/app/component/context/user-context";
import Link from "next/link";

export default function SoftwareDeveloperPage() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  if (!user) return null;

  const roleLower = (user.role || "").toLowerCase().trim();

  // Role validation: check if logged-in user is a Software Developer or Super Admin
  const allowedDevRoles = [
    "super admin",
    "admin",
    "director",
    "software developer",
    "software_developer",
    "developer",
    "software engineer",
    "tech lead",
  ];

  const isSoftwareDeveloper = allowedDevRoles.includes(roleLower);

  const initialLetter = user.name ? user.name.charAt(0).toUpperCase() : "D";

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 space-y-6">
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/80 pb-4 shrink-0">
          <div>
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 select-none">
              <span>CoachFlow</span>
              <span>/</span>
              <span className="text-slate-600 font-bold">Developer Portal</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mt-1 flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600 text-sm">
                💻
              </span>
              Software Developer Workspace
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <ProfileDisplay
              isOpen={isProfileOpen}
              onClose={() => setIsProfileOpen(false)}
              user={user}
              logout={logout}
            />

            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-700">{user.name}</div>
                <div className="text-[9px] font-bold text-indigo-600 uppercase tracking-wide">
                  {user.role}
                </div>
              </div>
              <button
                onClick={() => setIsProfileOpen(true)}
                className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-md hover:opacity-90 transition-all cursor-pointer"
              >
                {initialLetter}
              </button>
            </div>
          </div>
        </header>

        {/* RESTRICTED ACCESS SCREEN FOR NON-DEVELOPERS */}
        {!isSoftwareDeveloper ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="bg-white border border-rose-200/80 rounded-2xl p-8 max-w-lg w-full text-center shadow-xl space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center mx-auto text-3xl shadow-sm">
                🔒
              </div>
              <div className="space-y-2">
                <span className="inline-block px-3 py-1 bg-rose-100/80 text-rose-700 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                  Access Restricted
                </span>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Super Admin & Software Developer Access Only
                </h2>
                <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-md mx-auto">
                  This page contains restricted developer configurations and personal profile details reserved strictly for team members with the{" "}
                  <strong className="text-slate-700 font-bold">Super Admin</strong> or <strong className="text-slate-700 font-bold">Software Developer</strong> role.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl text-left text-xs space-y-2 font-medium">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Your Current User:</span>
                  <span className="font-bold text-slate-800">{user.name} ({user.email})</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Your Current Role:</span>
                  <span className="font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded uppercase text-[10px]">
                    {user.role || "Standard User"}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <Link
                  href="/"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all"
                >
                  Return to Dashboard
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* SOFTWARE DEVELOPER ACCESS GRANTED CONTENT */
          <div className="space-y-6 flex-1">
            {/* Developer Banner Card */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
              
              <div className="flex items-center gap-5 z-10">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-black text-2xl flex items-center justify-center shadow-lg shrink-0 border border-white/20">
                  {initialLetter}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-white tracking-tight">{user.name}</h2>
                    <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold rounded-full uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Verified Developer
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200/80 font-medium">{user.email}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-300 pt-1">
                    <span className="bg-white/10 px-2.5 py-0.5 rounded-md border border-white/10">
                      Role: <strong className="text-white font-bold">{user.role}</strong>
                    </span>
                    <span className="bg-white/10 px-2.5 py-0.5 rounded-md border border-white/10">
                      Scope: <strong className="text-indigo-300 font-bold">{user.brandScope || "All Brands"}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="z-10 flex flex-wrap md:flex-col items-start md:items-end justify-between gap-2 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6">
                <div className="text-left md:text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Environment App</span>
                  <span className="text-sm font-extrabold text-white">{user.customAppName || "Coach ERP"}</span>
                </div>
                <div className="text-left md:text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Security Status</span>
                  <span className="text-xs font-bold text-emerald-400">Authenticated & Encrypted</span>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile & Personal Details Card */}
              <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-indigo-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                      Logged-in Software Developer Profile Details
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">Personal account information and developer identity credentials</p>
                  </div>
                  <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
                    Active Session
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</span>
                    <span className="text-sm font-extrabold text-slate-800">{user.name}</span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</span>
                    <span className="text-sm font-extrabold text-slate-800">{user.email}</span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned System Role</span>
                    <span className="text-sm font-extrabold text-indigo-600">{user.role}</span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone Contact</span>
                    <span className="text-sm font-extrabold text-slate-800">{user.phone || "Not Specified"}</span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Brand Access Scope</span>
                    <span className="text-sm font-extrabold text-slate-800">{user.brandScope || "All Brands"}</span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200/70 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Custom App Title</span>
                    <span className="text-sm font-extrabold text-slate-800">{user.customAppName || "Coach"}</span>
                  </div>
                </div>

                {/* Developer System Privileges Table */}
                <div className="pt-2">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3">
                    System Operations & Access Permissions
                  </h4>
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-4">Permission Module</th>
                          <th className="py-2.5 px-4">Access Level</th>
                          <th className="py-2.5 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        <tr>
                          <td className="py-3 px-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            REST API & Route Handlers
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">Full Execution & Audit</td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded text-[10px]">
                              ENABLED
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            MongoDB & Schema Models
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">Read / Write Access</td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded text-[10px]">
                              ENABLED
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            System Cron Services & Engine
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">Trigger & Monitor</td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold rounded text-[10px]">
                              ACTIVE
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Developer Roster Management
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">Provision & Register</td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded text-[10px]">
                              GRANTED
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Stack & Quick Tools Panel */}
              <div className="space-y-6">
                {/* Tech Stack Summary Card */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-indigo-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                    </svg>
                    Platform Tech Stack
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <span className="font-extrabold text-slate-700">Frontend & Routing</span>
                      <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">Next.js (App Router)</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <span className="font-extrabold text-slate-700">Language</span>
                      <span className="font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[11px]">TypeScript</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <span className="font-extrabold text-slate-700">Database & ODM</span>
                      <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">MongoDB (Mongoose)</span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                      <span className="font-extrabold text-slate-700">Styling Framework</span>
                      <span className="font-black text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded text-[11px]">Tailwind CSS</span>
                    </div>
                  </div>
                </div>

                {/* Developer Quick Navigation Links */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-800 border-b border-slate-100 pb-3">
                    Developer Quick Links
                  </h3>

                  <div className="space-y-2.5 text-xs">
                    <Link
                      href="/software-developers"
                      className="flex items-center justify-between p-3 bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-200/80 rounded-xl font-bold text-indigo-900 transition-all group"
                    >
                      <span className="flex items-center gap-2">
                        <span>👥</span> Developer Roster & Provisioning
                      </span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </Link>

                    <Link
                      href="/admin-dashboard"
                      className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl font-bold text-slate-700 transition-all group"
                    >
                      <span className="flex items-center gap-2">
                        <span>⚡</span> Admin Command Center
                      </span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
