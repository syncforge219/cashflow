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

export default function UsersDisplay() {
  const [users, setUsers] = useState<UserAccount[]>([]);
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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setUsers(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
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
    setPassword(""); // Leave blank unless updating
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
        fetchUsers();
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
        fetchUsers();
      } else {
        alert(data.error || "Failed to delete user account");
      }
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.phone?.includes(q);

    const matchesRole =
      roleFilter === "all" || u.role?.toLowerCase().includes(roleFilter.toLowerCase());

    return matchesSearch && matchesRole;
  });

  // Calculate statistics
  const devCount = users.filter((u) => u.role?.toLowerCase().includes("developer")).length;
  const adminCount = users.filter(
    (u) => u.role?.toLowerCase().includes("admin") || u.role?.toLowerCase().includes("manager")
  ).length;
  const counsellorCount = users.filter(
    (u) => u.role?.toLowerCase().includes("counsellor") || u.role?.toLowerCase().includes("teacher")
  ).length;

  return (
    <div className="space-y-6 flex-1 flex flex-col font-mono text-slate-100">
      {/* Top Tech Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <span className="p-2 bg-emerald-950/80 border border-emerald-500/30 rounded-xl text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6 0 3.375 3.375 0 0 1 6 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </span>
            // SYSTEM_USERS_DIRECTORY
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl font-medium">
            Provision, manage, and assign system access permissions for all application users and roles.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Role Select Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-800 rounded-xl bg-slate-950/90 text-white focus:outline-none focus:border-emerald-500/50"
          >
            <option value="all">All Roles ({users.length})</option>
            <option value="developer">Developers ({devCount})</option>
            <option value="admin">Admins & Managers ({adminCount})</option>
            <option value="counsellor">Counsellors & Staff ({counsellorCount})</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
            </svg>
            <input
              type="text"
              placeholder="Search user, email..."
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

      {/* Cyber Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-emerald-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">TOTAL_SYSTEM_USERS</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">{users.length}</span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">All Accounts</span>
          </div>
        </div>

        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-emerald-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">SOFTWARE_DEVELOPERS</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-400">{devCount}</span>
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded">Engineering</span>
          </div>
        </div>

        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-cyan-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">ADMINS_AND_MANAGERS</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-cyan-400">{adminCount}</span>
            <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded">Supervisors</span>
          </div>
        </div>

        <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-4 shadow-xl hover:border-emerald-500/30 transition-all">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">COUNSELLORS_AND_STAFF</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-400">{counsellorCount}</span>
            <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-500/30 px-2 py-0.5 rounded">Operations</span>
          </div>
        </div>
      </div>

      {/* Users Roster Grid */}
      <div className="bg-[#090E1A] border border-slate-800 rounded-2xl p-5 shadow-xl flex-1">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div>
            <h2 className="text-base font-black text-white">// REGISTERED_SYSTEM_USERS_ROSTER</h2>
            <p className="text-xs text-slate-400 font-medium">All authenticated application accounts registered in MongoDB database</p>
          </div>
          <span className="text-xs font-bold bg-slate-900 text-emerald-400 border border-slate-800 px-3 py-1 rounded-lg">
            {filteredUsers.length} Account{filteredUsers.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm font-medium text-slate-500 animate-pulse">Loading system users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6 0 3.375 3.375 0 0 1 6 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-300">No user accounts found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Click "Provision User" to create new system user accounts and roles.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((u) => {
              const rLower = (u.role || "").toLowerCase();
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
                  key={u._id}
                  className="bg-[#050811] border border-slate-800 hover:border-emerald-500/40 rounded-xl p-4 shadow-xl transition-all flex flex-col justify-between hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] space-y-4"
                >
                  <div>
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-slate-950 font-black flex items-center justify-center shrink-0 shadow-md text-sm">
                        {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black text-slate-100 truncate">{u.name}</h3>
                        <span className={`text-[9px] font-black border rounded px-2 py-0.5 uppercase tracking-wider inline-block mt-0.5 ${roleBadgeColor}`}>
                          {u.role || "User"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-emerald-400 shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                        </svg>
                        <span className="truncate text-cyan-300">{u.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-slate-500 shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.596-5.48-4.18-7.076-7.076l1.293-.97c.362-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25z" />
                        </svg>
                        <span className="text-slate-300">{u.phone || "N/A"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                    <span>SCOPE: {u.brandScope || "All Brands"}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleOpenEditModal(u)}
                        className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        [EDIT_USER]
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u._id, u.name)}
                        className="text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer"
                      >
                        [DELETE_USER]
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
                <input
                  type="text"
                  value={brandScope}
                  onChange={(e) => setBrandScope(e.target.value)}
                  placeholder="e.g. All Brands or Coach Academy"
                  className="w-full text-xs px-3 py-2 border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:border-emerald-500/50"
                />
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
