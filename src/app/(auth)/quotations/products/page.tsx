"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import QuotationNav from "@/components/QuotationNav";
import CfoSecurityGuard from "@/components/CfoSecurityGuard";

interface Product {
  _id: string;
  category?: string;
  billingCycle?: string;
  name: string;
  description?: string;
  sku?: string;
  hsnCode?: string;
  unit: string;
  defaultRate: number;
  gstRate: number;
  defaultTerms?: string[];
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [category, setCategory] = useState("PRODUCT");
  const [billingCycle, setBillingCycle] = useState("ONE_TIME");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [unit, setUnit] = useState("mtr");
  const [defaultRate, setDefaultRate] = useState<number>(0);
  const [gstRate, setGstRate] = useState<number>(18);
  const [defaultTermsText, setDefaultTermsText] = useState("");

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/products?q=${encodeURIComponent(search)}&category=${categoryFilter}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setProducts(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search, categoryFilter]);

  const openAddModal = () => {
    setEditingId(null);
    setCategory("PRODUCT");
    setBillingCycle("ONE_TIME");
    setName("");
    setDescription("");
    setSku("");
    setHsnCode("");
    setUnit("mtr");
    setDefaultRate(0);
    setGstRate(18);
    setDefaultTermsText("");
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingId(p._id);
    setCategory(p.category || "PRODUCT");
    setBillingCycle(p.billingCycle || "ONE_TIME");
    setName(p.name);
    setDescription(p.description || "");
    setSku(p.sku || "");
    setHsnCode(p.hsnCode || "");
    setUnit(p.unit || "mtr");
    setDefaultRate(p.defaultRate || 0);
    setGstRate(p.gstRate || 18);
    setDefaultTermsText(Array.isArray(p.defaultTerms) ? p.defaultTerms.join("\n") : "");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Product Name is required");
      return;
    }

    const payload = {
      ...(editingId && { id: editingId }),
      category,
      billingCycle,
      name: name.trim(),
      description,
      sku,
      hsnCode,
      unit,
      defaultRate,
      gstRate,
      defaultTerms: defaultTermsText.split("\n").map((t) => t.trim()).filter(Boolean),
    };

    try {
      const res = await fetch("/api/quotations/products", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsModalOpen(false);
        fetchProducts();
      } else {
        alert("Error: " + (data.error || "Save failed"));
      }
    } catch (err: any) {
      alert("Save error: " + err.message);
    }
  };

  const handleDelete = async (id: string, productName: string) => {
    if (!confirm(`Delete product ${productName}?`)) return;
    try {
      const res = await fetch(`/api/quotations/products?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchProducts();
      } else {
        alert("Delete failed: " + (data.error || "Error"));
      }
    } catch (err: any) {
      alert("Delete error: " + err.message);
    }
  };

  return (
    <CfoSecurityGuard>
      <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans transition-colors duration-200 relative">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <QuotationNav />

          <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
            {/* Header */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2 font-sans">
                  📦 Products Master Inventory
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Manage goods, HSN codes, default rates, measurement units, and GST slab rates
                </p>
              </div>

              <button
                onClick={openAddModal}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer transition-all"
              >
                + Add New Product
              </button>
            </div>

            {/* Search & Category Filter Bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
              <input
                type="text"
                placeholder="Search product by name, description, HSN code, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full md:w-80 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl px-3.5 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
              />

              <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
                {[
                  { key: "ALL", label: "All Items" },
                  { key: "SOFTWARE", label: "💻 Software" },
                  { key: "DIGITAL_MARKETING", label: "📢 Marketing" },
                  { key: "PRODUCT", label: "📦 Products" },
                  { key: "SERVICE", label: "🛠️ Services" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setCategoryFilter(tab.key)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      categoryFilter === tab.key
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 font-sans">
                  <thead className="bg-slate-50/80 text-slate-500 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5">Item Name & Details</th>
                      <th className="px-4 py-3.5">HSN Code / SKU</th>
                      <th className="px-4 py-3.5 text-center">Unit</th>
                      <th className="px-4 py-3.5 text-right">Default Rate</th>
                      <th className="px-4 py-3.5 text-center">GST Slab</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-medium">
                          Loading items master...
                        </td>
                      </tr>
                    ) : products.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-medium">
                          No items found. Click <b>+ Add New Product</b> to create one.
                        </td>
                      </tr>
                    ) : (
                      products.map((p) => (
                        <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3.5">
                            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {(p.category || "PRODUCT").replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-bold text-slate-900">
                            {p.name}
                            {p.description && <div className="text-[10px] text-slate-400 font-normal">{p.description}</div>}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-cyan-600">
                            {p.hsnCode || "-"}
                            {p.sku && <span className="text-slate-400 text-[10px] font-normal block">SKU: {p.sku}</span>}
                          </td>
                          <td className="px-4 py-3.5 text-center text-slate-700 font-bold uppercase">{p.unit}</td>
                          <td className="px-4 py-3.5 text-right font-black text-emerald-600">
                            ₹{Number(p.defaultRate || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-blue-600">{p.gstRate}%</td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openEditModal(p)}
                                className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(p._id, p.name)}
                                className="px-2 py-1 text-[11px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Add / Edit Product Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-sans">
                  {editingId ? "Edit Item Master" : "Add New Item Master"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3 text-xs font-sans">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                      Category *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-indigo-200 text-indigo-700 font-bold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    >
                      <option value="SOFTWARE">💻 Software / SaaS</option>
                      <option value="DIGITAL_MARKETING">📢 Digital Marketing</option>
                      <option value="PRODUCT">📦 Physical Product</option>
                      <option value="SERVICE">🛠️ Services & AMC</option>
                      <option value="CUSTOM">⚡ Custom Offering</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                      Billing Cycle
                    </label>
                    <select
                      value={billingCycle}
                      onChange={(e) => setBillingCycle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    >
                      <option value="ONE_TIME">One-Time / Sale</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="HALF_YEARLY">Half-Yearly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Enterprise ERP SaaS Subscription"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Specifications / Service scope details"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">HSN Code</label>
                    <input
                      type="text"
                      value={hsnCode}
                      onChange={(e) => setHsnCode(e.target.value)}
                      placeholder="39172110"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">SKU</label>
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="HDP-160-PN6"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Unit</label>
                    <input
                      type="text"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="mtr"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Default Rate (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={defaultRate}
                      onChange={(e) => setDefaultRate(Number(e.target.value))}
                      placeholder="390"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">GST Rate (%)</label>
                    <select
                      value={gstRate}
                      onChange={(e) => setGstRate(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    >
                      <option value={18}>18%</option>
                      <option value={12}>12%</option>
                      <option value={5}>5%</option>
                      <option value={28}>28%</option>
                      <option value={0}>0%</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Product-Specific Terms & Conditions (One per line)
                  </label>
                  <textarea
                    rows={3}
                    value={defaultTermsText}
                    onChange={(e) => setDefaultTermsText(e.target.value)}
                    placeholder="e.g. ALL PIPE 6MTR LENGTH&#10;100% ADVANCE ALONG WITH PO&#10;MATERIAL DELIVERED WITHIN 7 DAYS"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    These terms will automatically be added to Quotation Terms & Conditions when this product is selected.
                  </p>
                </div>

                <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl cursor-pointer font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer shadow-md shadow-indigo-500/20"
                  >
                    {editingId ? "Save Changes" : "Create Product"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </CfoSecurityGuard>
  );
}
