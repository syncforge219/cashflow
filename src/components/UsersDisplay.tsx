"use client";

import React, { useState, useEffect } from "react";

interface UserAccount {
  _id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  brandScope?: string;
  customAppName?: string;
  createdAt?: string;
}

interface BrandItem {
  _id: string;
  name: string;
  code?: string;
  status?: string;
}

export default function UsersDisplay() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("software developer");
  const [phone, setPhone] = useState("");
  const [brandScope, setBrandScope] = useState("All Brands");
  const [customAppName, setCustomAppName] = useState("Coach");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userRes, brandRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/brands"),
      ]);

      const userData = await userRes.json();
      if (userData.success && Array.isArray(userData.data)) {
        setUsers(userData.data);
      }

      const brandData = await brandRes.json();
      if (brandData.success && Array.isArray(brandData.brands)) {
        setBrands(brandData.brands);
      }
    } catch (err) {
      console.error("Failed to fetch system user and brand data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenAddModal = () => {
    setEditingUserId(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("software developer");
    setPhone("");
    setBrandScope("All Brands");
    setCustomAppName("Coach");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: UserAccount) => {
    setEditingUserId(user._id);
    setName(user.name || "");
    setEmail(user.email || "");
    setPassword("");
    setRole(user.role || "software developer");
    setPhone(user.phone || "");
    setBrandScope(user.brandScope || "All Brands");
    setCustomAppName(user.customAppName || "Coach");
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim() || !email.trim()) {
      setErrorMsg("Name and email are required.");
      return;
    }

    if (!editingUserId && !password) {
      setErrorMsg("Password is required for new user creation.");
      return;
    }

    setSubmitting(true);
    try {
      const isEditing = Boolean(editingUserId);
      const url = "/api/users";
      const method = isEditing ? "PUT" : "POST";
      const payload: any = {
        id: editingUserId,
        name: name.trim(),
        email: email.trim(),
        role,
        phone: phone.trim(),
        brandScope,
        customAppName: customAppName.trim(),
      };

      if (password) {
        payload.password = password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        setErrorMsg(data.error || "Failed to save user account");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete user account "${userName}"?`)) return;

    try {
      const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error || "Failed to delete user account");
      }
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  // Filter users based on search & role filter
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.brandScope?.toLowerCase().includes(q);

    const matchesRole =
      roleFilter === "all" || u.role?.toLowerCase().includes(roleFilter.toLowerCase());

    return matchesSearch && matchesRole;
  });

  // Categorize Users:
  // 1. Super Admins & Directors
  const superAdmins = filteredUsers.filter((u) => {
    const r = (u.role || "").toLowerCase();
    return r.includes("super admin") || r.includes("director");
  });

  // 2. Non-Super-Admin Employees grouped by Brand Scope
  const employeeUsers = filteredUsers.filter((u) => {
    const r = (u.role || "").toLowerCase();
    return !r.includes("super admin") && !r.includes("director");
  });

  // Build Brand Groups Map
  const brandGroupsMap: Record<string, UserAccount[]> = {};

  // Initialize known brands
  brands.forEach((b) => {
    const bName = b.name.toUpperCase().trim();
    brandGroupsMap[bName] = [];
  });

  // Always ensure "ALL BRANDS / GLOBAL" category exists
  if (!brandGroupsMap["ALL BRANDS"]) {
    brandGroupsMap["ALL BRANDS"] = [];
  }

  // Populate users into brand groups
  employeeUsers.forEach((u) => {
    const scope = (u.brandScope || "All Brands").toUpperCase().trim();

    // Check matching brand key
    const matchKey = Object.keys(brandGroupsMap).find(
      (k) => k === scope || scope.includes(k) || k.includes(scope)
    );

    if (matchKey) {
      brandGroupsMap[matchKey].push(u);
    } else {
      if (!brandGroupsMap[scope]) {
        brandGroupsMap[scope] = [];
      }
      brandGroupsMap[scope].push(u);
    }
  });

  // Filter out empty brand groups if searching
  const activeBrandKeys = Object.keys(brandGroupsMap).filter(
    (k) => brandGroupsMap[k].length > 0
  );

  return (
    <div className="space-y-8 flex-1 flex flex-col font-mono text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <span className="p-2 bg-emerald-950/80 border border-emerald-500/30 rounded-xl text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6 0 3.375 3.375 0 0 1 6 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </span>
            // SYSTEM_USERS_AND_BRANDS_HIERARCHY
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl font-medium">
            Super Admin leadership, registered brand accounts, and employee rosters grouped by brand.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-800 rounded-xl bg-slate-950/90 text-white focus:outline-none focus:border-emerald-500/50"
          >
            <option value="all">All Roles ({users.length})</option>
            <option value="super admin">Super Admins</option>
            <option value="developer">Developers</option>
            <option value="manager">Managers & Admin</option>
            <option value="counsellor">Counsellors & Staff</option>
          </select>

          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
            </svg>
            <input
              type="text"
              placeholder="Search user, brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs border border-slate-800 rounded-xl bg-slate-950/90 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-44 sm:w-56 transition-all"
            />
          </div>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 text-xs font-black bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 rounded-xl px-4 py-2 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Provision User
          </button>
        </div>
      </div>

      {/* Cyber Stats Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-emerald-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">SUPER_ADMIN_COUNT</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-cyan-400">{superAdmins.length}</span>
            <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded">Super Admins</span>
          </div>
        </div>

        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-emerald-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">REGISTERED_BRANDS</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400">{brands.length || Object.keys(brandGroupsMap).length}</span>
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">Active Brands</span>
          </div>
        </div>

        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-emerald-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">BRAND_EMPLOYEES</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-400">{employeeUsers.length}</span>
            <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-500/30 px-2 py-0.5 rounded">Team Staff</span>
          </div>
        </div>

        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-emerald-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">TOTAL_ACCOUNTS</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{users.length}</span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">MongoDB Users</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm font-medium text-slate-500 animate-pulse">
          Loading system users and brand hierarchy...
        </div>
      ) : (
        <div className="space-y-8">
          {/* LEVEL 1: SUPER ADMINS & DIRECTORS */}
          <div className="bg-[#090E1A] border border-cyan-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.6)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <span className="text-cyan-400 font-extrabold">&gt;_</span> LEVEL_1: SUPER_ADMINISTRATORS & EXECUTIVE DIRECTORS
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">Root access accounts with master control across all brands</p>
              </div>
              <span className="text-xs font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-500/40 px-3 py-1 rounded-lg">
                {superAdmins.length} Super Admin{superAdmins.length !== 1 ? "s" : ""}
              </span>
            </div>

            {superAdmins.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">No Super Admin accounts match search query</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {superAdmins.map((u) => (
                  <div
                    key={u._id}
                    className="bg-[#050811] border border-cyan-500/40 hover:border-cyan-400 rounded-xl p-4 shadow-xl transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0 shadow-md text-sm">
                          {u.name ? u.name.charAt(0).toUpperCase() : "A"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-black text-white truncate">{u.name}</h3>
                          <p className="text-xs text-cyan-300 font-mono truncate">{u.email}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-black bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
                        SUPER ADMIN
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                      <span>SCOPE: {u.brandScope || "All Brands"}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors cursor-pointer"
                        >
                          [EDIT]
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u._id, u.name)}
                          className="text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer"
                        >
                          [DELETE]
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LEVEL 2: REGISTERED BRANDS & EMPLOYEES BY BRAND */}
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span className="text-emerald-400 font-extrabold">&gt;_</span> LEVEL_2 & 3: REGISTERED BRANDS & BRAND EMPLOYEES
                </h2>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Employees and technical staff grouped under their respective brand scope
                </p>
              </div>
              <span className="text-xs font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-lg">
                {activeBrandKeys.length} Brand Category Groups
              </span>
            </div>

            {activeBrandKeys.length === 0 ? (
              <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-500">
                No brand employee records found matching query
              </div>
            ) : (
              activeBrandKeys.map((brandName) => {
                const brandUsers = brandGroupsMap[brandName] || [];

                return (
                  <div
                    key={brandName}
                    className="bg-[#090E1A] border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-6 shadow-xl space-y-4 transition-all"
                  >
                    {/* Brand Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-950/80 border border-emerald-500/30 rounded-xl text-emerald-400 font-black text-sm">
                          🏷️
                        </div>
                        <div>
                          <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                            BRAND: {brandName}
                          </h3>
                          <p className="text-xs text-slate-400">
                            Registered Employees & Personnel assigned to {brandName}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-bold bg-slate-900 text-emerald-400 border border-slate-800 px-3 py-1 rounded-lg shrink-0">
                        {brandUsers.length} Employee{brandUsers.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Brand Employees Roster Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {brandUsers.map((emp) => {
                        const rLower = (emp.role || "").toLowerCase();
                        const roleBadgeColor =
                          rLower.includes("developer")
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/30"
                            : rLower.includes("admin")
                            ? "bg-cyan-950/80 text-cyan-300 border-cyan-500/30"
                            : rLower.includes("manager")
                            ? "bg-purple-950/80 text-purple-300 border-purple-500/30"
                            : rLower.includes("counsellor")
                            ? "bg-amber-950/80 text-amber-300 border-amber-500/30"
                            : "bg-blue-950/80 text-blue-300 border-blue-500/30";

                        return (
                          <div
                            key={emp._id}
                            className="bg-[#050811] border border-slate-800 hover:border-emerald-500/40 rounded-xl p-4 shadow-xl transition-all flex flex-col justify-between hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] space-y-3"
                          >
                            <div>
                              <div className="flex items-start gap-3">
                                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-slate-950 font-black flex items-center justify-center shrink-0 shadow-md text-xs">
                                  {emp.name ? emp.name.charAt(0).toUpperCase() : "E"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-black text-slate-100 truncate">{emp.name}</h4>
                                  <span className={`text-[9px] font-black border rounded px-2 py-0.5 uppercase tracking-wider inline-block mt-0.5 ${roleBadgeColor}`}>
                                    {emp.role || "Employee"}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-3 space-y-1 text-xs text-slate-400 font-mono">
                                <div className="truncate text-cyan-300">✉ {emp.email}</div>
                                <div>📞 {emp.phone || "No Phone"}</div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                              <span>APP: {emp.customAppName || "Coach"}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenEditModal(emp)}
                                  className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors cursor-pointer"
                                >
                                  [EDIT]
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(emp._id, emp.name)}
                                  className="text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer"
                                >
                                  [DELETE]
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Cyber Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#0B0F19] border border-emerald-500/30 rounded-2xl max-w-md w-full p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)] space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white">
                {editingUserId ? "// EDIT_SYSTEM_USER_ACCOUNT" : "// PROVISION_NEW_SYSTEM_USER"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-300 p-1 rounded-lg">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-950/80 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. alex@company.com"
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Password {editingUserId ? "(Leave blank to keep unchanged)" : "*"}
                </label>
                <input
                  type="password"
                  required={!editingUserId}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUserId ? "••••••••••••" : "Minimum 6 characters"}
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">System Access Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="software developer">Software Developer</option>
                  <option value="super admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager / Centre Head</option>
                  <option value="counsellor">Counsellor</option>
                  <option value="teacher">Teacher</option>
                  <option value="cfo">CFO / Finance</option>
                  <option value="crm">CRM Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Phone Contact</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Brand Scope</label>
                <select
                  value={brandScope}
                  onChange={(e) => setBrandScope(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="All Brands">All Brands</option>
                  {brands.map((b) => (
                    <option key={b._id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 border border-slate-800 rounded-xl hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-black text-slate-950 bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 rounded-xl disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                >
                  {submitting ? "Saving..." : editingUserId ? "Update User" : "Provision User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
