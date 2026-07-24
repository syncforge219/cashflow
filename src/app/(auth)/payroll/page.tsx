"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ProfileDisplay from "@/components/ProfileDisplay";
import { useUser } from "@/app/component/context/user-context";

interface PayrollRecord {
  _id: string;
  employeeName: string;
  employeeRole: string;
  month: string;
  baseSalary: number;
  bonus: number;
  deductions: number;
  netSalary: number;
  paymentStatus: "Pending" | "Paid";
  paymentDate: string;
  paymentMode: string;
  isRecurring?: boolean;
  recurringFrequency?: string;
  nextRecurringDate?: string;
  remarks?: string;
}

export default function PayrollPage() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    employeeName: "",
    employeeRole: "Counsellor",
    month: new Date().toISOString().slice(0, 7), // "YYYY-MM"
    baseSalary: "",
    bonus: "0",
    deductions: "0",
    paymentStatus: "Paid",
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMode: "Bank Transfer",
    isRecurring: false,
    recurringFrequency: "Monthly",
    remarks: "",
  });

  const fetchPayroll = async () => {
    setIsLoading(true);
    try {
      let url = "/api/payroll";
      const params = new URLSearchParams();
      if (selectedMonth) params.append("month", selectedMonth);
      if (searchQuery) params.append("search", searchQuery);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPayrolls(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch payroll:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [selectedMonth]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayroll();
  };

  const handleCreatePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeName || !formData.baseSalary) {
      alert("Please fill in required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setFormData({
          employeeName: "",
          employeeRole: "Counsellor",
          month: new Date().toISOString().slice(0, 7),
          baseSalary: "",
          bonus: "0",
          deductions: "0",
          paymentStatus: "Paid",
          paymentDate: new Date().toISOString().slice(0, 10),
          paymentMode: "Bank Transfer",
          isRecurring: false,
          recurringFrequency: "Monthly",
          remarks: "",
        });
        fetchPayroll();
      } else {
        alert(data.message || "Failed to create payroll record.");
      }
    } catch (err) {
      console.error("Error creating payroll:", err);
      alert("Failed to submit payroll.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayroll = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payroll entry?")) return;

    try {
      const res = await fetch(`/api/payroll?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchPayroll();
      } else {
        alert(data.message || "Failed to delete record.");
      }
    } catch (err) {
      console.error("Error deleting payroll:", err);
    }
  };

  // Summary Metrics
  const totalPaid = payrolls
    .filter((p) => p.paymentStatus === "Paid")
    .reduce((acc, cur) => acc + cur.netSalary, 0);

  const totalPending = payrolls
    .filter((p) => p.paymentStatus === "Pending")
    .reduce((acc, cur) => acc + cur.netSalary, 0);

  const totalRecurringCount = payrolls.filter((p) => p.isRecurring).length;

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/80 pb-4 mb-6 shrink-0">
          <div>
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 select-none">
              <span>CoachFlow</span>
              <span>/</span>
              <span className="text-slate-600 font-bold">Payroll & Salaries</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mt-1">Staff Payroll Management</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Record Salary Payout</span>
            </button>
            <ProfileDisplay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} logout={logout} />
          </div>
        </header>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Paid Payroll</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">₹{totalPaid.toLocaleString("en-IN")}</div>
            <span className="text-[10px] font-semibold text-slate-400">{payrolls.filter(p => p.paymentStatus === "Paid").length} Employee Payouts</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Pending Salaries</span>
            <div className="text-2xl font-black text-amber-600 mt-1">₹{totalPending.toLocaleString("en-IN")}</div>
            <span className="text-[10px] font-semibold text-slate-400">{payrolls.filter(p => p.paymentStatus === "Pending").length} Payouts Pending</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Recurring Payouts</span>
            <div className="text-2xl font-black text-purple-600 mt-1">{totalRecurringCount} Active</div>
            <span className="text-[10px] font-semibold text-slate-400">Auto-recurring Schedules</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 mb-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by employee name or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-colors"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500">Filter Month:</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-medium"
            />
            {selectedMonth && (
              <button
                onClick={() => setSelectedMonth("")}
                className="text-xs text-rose-500 font-bold hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Payroll Table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3">Employee</th>
                  <th className="pb-3">Role</th>
                  <th className="pb-3">Month</th>
                  <th className="pb-3 text-right">Base Salary</th>
                  <th className="pb-3 text-right">Bonus</th>
                  <th className="pb-3 text-right">Net Payout</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 text-center">Recurring</th>
                  <th className="pb-3">Payment Date</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 font-semibold text-slate-600">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      Loading payroll records...
                    </td>
                  </tr>
                ) : payrolls.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No payroll records found. Click &quot;Record Salary Payout&quot; to add one.
                    </td>
                  </tr>
                ) : (
                  payrolls.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 font-bold text-slate-900">{p.employeeName}</td>
                      <td>
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">
                          {p.employeeRole}
                        </span>
                      </td>
                      <td className="font-bold text-slate-700">{p.month}</td>
                      <td className="text-right">₹{p.baseSalary.toLocaleString("en-IN")}</td>
                      <td className="text-right text-emerald-600">+₹{p.bonus.toLocaleString("en-IN")}</td>
                      <td className="text-right font-black text-slate-900">₹{p.netSalary.toLocaleString("en-IN")}</td>
                      <td className="text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                            p.paymentStatus === "Paid"
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                              : "bg-amber-50 text-amber-600 border border-amber-200"
                          }`}
                        >
                          {p.paymentStatus}
                        </span>
                      </td>
                      <td className="text-center">
                        {p.isRecurring ? (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                            🔁 {p.recurringFrequency || "Monthly"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300 font-normal">One-time</span>
                        )}
                      </td>
                      <td className="text-slate-500 text-[11px]">
                        {new Date(p.paymentDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleDeletePayroll(p._id)}
                          className="text-xs text-rose-500 hover:text-rose-700 font-bold transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Add Salary Payout */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">Record Employee Salary Payout</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">
                  ×
                </button>
              </div>

              <form onSubmit={handleCreatePayroll} className="space-y-4 mt-4 text-xs font-semibold">
                <div>
                  <label className="block text-slate-600 mb-1">Employee Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={formData.employeeName}
                    onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Role *</label>
                    <select
                      value={formData.employeeRole}
                      onChange={(e) => setFormData({ ...formData, employeeRole: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="Counsellor">Counsellor</option>
                      <option value="Teacher">Teacher</option>
                      <option value="Brand Manager">Brand Manager</option>
                      <option value="Admin">Admin</option>
                      <option value="Staff">Staff</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Month (YYYY-MM) *</label>
                    <input
                      type="month"
                      required
                      value={formData.month}
                      onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Base Salary (₹) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="35000"
                      value={formData.baseSalary}
                      onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Bonus (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="5000"
                      value={formData.bonus}
                      onChange={(e) => setFormData({ ...formData, bonus: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Deductions (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="1000"
                      value={formData.deductions}
                      onChange={(e) => setFormData({ ...formData, deductions: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                {/* Recurring Payment Option */}
                <div className="bg-purple-50/70 border border-purple-100 p-3 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isRecurring}
                      onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-purple-900 select-none">🔁 Mark as Recurring Salary Payout</span>
                  </label>

                  {formData.isRecurring && (
                    <div className="mt-2.5">
                      <label className="block text-[11px] font-bold text-purple-800 mb-1">Recurring Frequency</label>
                      <select
                        value={formData.recurringFrequency}
                        onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs border border-purple-200 rounded-xl bg-white text-purple-900 font-bold focus:outline-none"
                      >
                        <option value="Monthly">Monthly (Auto-renews every month)</option>
                        <option value="Weekly">Weekly (Auto-renews every week)</option>
                        <option value="Quarterly">Quarterly (Auto-renews every 3 months)</option>
                        <option value="Yearly">Yearly (Auto-renews annually)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="bg-indigo-50/50 p-2.5 rounded-xl flex justify-between items-center border border-indigo-100">
                  <span className="text-slate-600 font-bold">Estimated Net Payout:</span>
                  <span className="text-indigo-700 font-black text-sm">
                    ₹
                    {(
                      (Number(formData.baseSalary) || 0) +
                      (Number(formData.bonus) || 0) -
                      (Number(formData.deductions) || 0)
                    ).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Status</label>
                    <select
                      value={formData.paymentStatus}
                      onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="Paid">Paid</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Payment Mode</label>
                    <select
                      value={formData.paymentMode}
                      onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Remarks / Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Monthly salary + Q3 bonus"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md"
                  >
                    {isSubmitting ? "Saving..." : "Save Payout"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
