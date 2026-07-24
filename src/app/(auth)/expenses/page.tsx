"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ProfileDisplay from "@/components/ProfileDisplay";
import { useUser } from "@/app/component/context/user-context";

interface ExpenseRecord {
  _id: string;
  title: string;
  category: "Rent" | "Marketing / Ads" | "Utilities" | "Software / Tools" | "Office Supplies" | "Travel" | "Misc";
  amount: number;
  expenseDate: string;
  paymentMode: string;
  brand?: string;
  recordedBy?: string;
  isRecurring?: boolean;
  recurringFrequency?: string;
  nextRecurringDate?: string;
  remarks?: string;
}

export default function ExpensesPage() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "Marketing / Ads",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMode: "UPI",
    brand: "All Brands",
    isRecurring: false,
    recurringFrequency: "Monthly",
    remarks: "",
  });

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      let url = "/api/expenses";
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "All") params.append("category", selectedCategory);
      if (searchQuery) params.append("search", searchQuery);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setExpenses(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchExpenses();
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) {
      alert("Please fill in expense description and amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, recordedBy: user?.name || "Admin" }),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setFormData({
          title: "",
          category: "Marketing / Ads",
          amount: "",
          expenseDate: new Date().toISOString().slice(0, 10),
          paymentMode: "UPI",
          brand: "All Brands",
          isRecurring: false,
          recurringFrequency: "Monthly",
          remarks: "",
        });
        fetchExpenses();
      } else {
        alert(data.message || "Failed to create expense entry.");
      }
    } catch (err) {
      console.error("Error creating expense:", err);
      alert("Failed to submit expense.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense record?")) return;

    try {
      const res = await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchExpenses();
      } else {
        alert(data.message || "Failed to delete record.");
      }
    } catch (err) {
      console.error("Error deleting expense:", err);
    }
  };

  // Summary Metrics
  const totalExpenseSum = expenses.reduce((acc, cur) => acc + cur.amount, 0);

  const marketingExpenseSum = expenses
    .filter((e) => e.category === "Marketing / Ads")
    .reduce((acc, cur) => acc + cur.amount, 0);

  const totalRecurringExpenses = expenses.filter((e) => e.isRecurring).length;

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
              <span className="text-slate-600 font-bold">Operational Expenses</span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mt-1">Company Expense Management</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Record Expense</span>
            </button>
            <ProfileDisplay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} logout={logout} />
          </div>
        </header>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Total Operational Expenses</span>
            <div className="text-2xl font-black text-rose-600 mt-1">₹{totalExpenseSum.toLocaleString("en-IN")}</div>
            <span className="text-[10px] font-semibold text-slate-400">{expenses.length} Expense Transactions</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Marketing & Ad Spend</span>
            <div className="text-2xl font-black text-blue-600 mt-1">₹{marketingExpenseSum.toLocaleString("en-IN")}</div>
            <span className="text-[10px] font-semibold text-slate-400">Meta, Google & Campaigns</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Recurring Expenses</span>
            <div className="text-2xl font-black text-purple-600 mt-1">{totalRecurringExpenses} Active</div>
            <span className="text-[10px] font-semibold text-slate-400">Software, Rent & Subscriptions</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 mb-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-80">
            <input
              type="text"
              placeholder="Search expenses by description or remarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-slate-700"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-colors"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            {["All", "Marketing / Ads", "Rent", "Utilities", "Software / Tools", "Office Supplies", "Travel", "Misc"].map(
              (cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    selectedCategory === cat
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3">Title / Description</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Brand Tag</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 text-center">Recurring</th>
                  <th className="pb-3">Payment Mode</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 font-semibold text-slate-600">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Loading expenses...
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No expense records found. Click &quot;Record Expense&quot; to add one.
                    </td>
                  </tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 font-bold text-slate-900">{e.title}</td>
                      <td>
                        <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border border-rose-100">
                          {e.category}
                        </span>
                      </td>
                      <td className="text-slate-600">{e.brand || "All Brands"}</td>
                      <td className="text-right font-black text-rose-600">₹{e.amount.toLocaleString("en-IN")}</td>
                      <td className="text-center">
                        {e.isRecurring ? (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                            🔁 {e.recurringFrequency || "Monthly"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300 font-normal">One-time</span>
                        )}
                      </td>
                      <td className="text-slate-500">{e.paymentMode}</td>
                      <td className="text-slate-500 text-[11px]">
                        {new Date(e.expenseDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleDeleteExpense(e._id)}
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

        {/* Modal: Add Expense */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">Record Operational Expense</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="space-y-4 mt-4 text-xs font-semibold">
                <div>
                  <label className="block text-slate-600 mb-1">Expense Description / Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Meta Ads Campaign July 2026"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    >
                      <option value="Marketing / Ads">Marketing / Ads</option>
                      <option value="Rent">Rent</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Software / Tools">Software / Tools</option>
                      <option value="Office Supplies">Office Supplies</option>
                      <option value="Travel">Travel</option>
                      <option value="Misc">Misc</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="15000"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                </div>

                {/* Recurring Expense Option */}
                <div className="bg-rose-50/70 border border-rose-100 p-3 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isRecurring}
                      onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                      className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-rose-900 select-none">🔁 Mark as Recurring Operational Expense</span>
                  </label>

                  {formData.isRecurring && (
                    <div className="mt-2.5">
                      <label className="block text-[11px] font-bold text-rose-800 mb-1">Recurring Frequency</label>
                      <select
                        value={formData.recurringFrequency}
                        onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs border border-rose-200 rounded-xl bg-white text-rose-900 font-bold focus:outline-none"
                      >
                        <option value="Monthly">Monthly (Auto-renews every month)</option>
                        <option value="Weekly">Weekly (Auto-renews every week)</option>
                        <option value="Quarterly">Quarterly (Auto-renews every 3 months)</option>
                        <option value="Yearly">Yearly (Auto-renews annually)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Expense Date</label>
                    <input
                      type="date"
                      value={formData.expenseDate}
                      onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Payment Mode</label>
                    <select
                      value={formData.paymentMode}
                      onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    >
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Brand Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. TechPro, DataCamp, or All Brands"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Remarks / Details</label>
                  <input
                    type="text"
                    placeholder="e.g. Paid to vendor via Google Pay"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20"
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
                    className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md"
                  >
                    {isSubmitting ? "Saving..." : "Save Expense"}
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
