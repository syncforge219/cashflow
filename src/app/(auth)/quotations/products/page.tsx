"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import QuotationNav from "@/components/QuotationNav";

interface Product {
  _id: string;
  name: string;
  description?: string;
  sku?: string;
  hsnCode?: string;
  unit: string;
  defaultRate: number;
  gstRate: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [unit, setUnit] = useState("mtr");
  const [defaultRate, setDefaultRate] = useState<number>(0);
  const [gstRate, setGstRate] = useState<number>(18);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/products?q=${encodeURIComponent(search)}`);
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
  }, [search]);

  const openAddModal = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setSku("");
    setHsnCode("");
    setUnit("mtr");
    setDefaultRate(0);
    setGstRate(18);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingId(p._id);
    setName(p.name);
    setDescription(p.description || "");
    setSku(p.sku || "");
    setHsnCode(p.hsnCode || "");
    setUnit(p.unit || "mtr");
    setDefaultRate(p.defaultRate || 0);
    setGstRate(p.gstRate !== undefined ? p.gstRate : 18);
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
      name: name.trim(),
      description: description.trim(),
      sku: sku.trim(),
      hsnCode: hsnCode.trim(),
      unit: unit.trim() || "mtr",
      defaultRate: Number(defaultRate) || 0,
      gstRate: Number(gstRate),
    };

    try {
      const method = editingId ? "PUT" : "POST";
      const res = await fetch("/api/quotations/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsModalOpen(false);
        fetchProducts();
      } else {
        alert("Error: " + (data.error || "Failed"));
      }
    } catch (err: any) {
      alert("Error saving product: " + err.message);
    }
  };

  const handleDelete = async (id: string, prodName: string) => {
    if (!confirm(`Delete product ${prodName}?`)) return;
    try {
      const res = await fetch(`/api/quotations/products?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#050811] text-slate-100 font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <QuotationNav />

        <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                📦 Product Master Management
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage goods, HSN codes, default rates, measurement units, and GST slab rates
              </p>
            </div>

            <button
              onClick={openAddModal}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
            >
              + Add New Product
            </button>
          </div>

          {/* Search Bar */}
          <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-4">
            <input
              type="text"
              placeholder="Search product by name, description, HSN code, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-96 bg-[#050811] border border-slate-800 text-white placeholder-slate-500 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Products Table */}
          <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#050811] text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Product Name</th>
                    <th className="px-4 py-3.5">HSN Code / SKU</th>
                    <th className="px-4 py-3.5 text-center">Unit</th>
                    <th className="px-4 py-3.5 text-right">Default Rate</th>
                    <th className="px-4 py-3.5 text-center">GST Slab</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Loading products...
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No products found. Click <b>+ Add New Product</b> to create one.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <tr key={p._id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-white">
                          {p.name}
                          {p.description && <div className="text-[10px] text-slate-500 font-normal">{p.description}</div>}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-cyan-400">
                          {p.hsnCode || "-"}
                          {p.sku && <span className="text-slate-500 text-[10px] block">SKU: {p.sku}</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center text-slate-300 font-bold uppercase">{p.unit}</td>
                        <td className="px-4 py-3.5 text-right font-black text-emerald-400">
                          ₹{Number(p.defaultRate || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold text-blue-400">{p.gstRate}%</td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(p)}
                              className="px-2.5 py-1 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(p._id, p.name)}
                              className="px-2 py-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 cursor-pointer"
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0B0F19] border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                {editingId ? "Edit Product" : "Add New Product"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="HDPE PIPE 160MM, PE100, PN6"
                  className="w-full bg-[#050811] border border-slate-800 text-white font-bold rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="6 Mtr Length High Density Polyethylene Pipe"
                  className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                    placeholder="39172110"
                    className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">SKU</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="HDP-160-PN6"
                    className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="mtr"
                    className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Default Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={defaultRate}
                    onChange={(e) => setDefaultRate(Number(e.target.value))}
                    placeholder="390"
                    className="w-full bg-[#050811] border border-slate-800 text-white font-bold rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">GST Rate (%)</label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="w-full bg-[#050811] border border-slate-800 text-white font-bold rounded-xl px-3 py-2 focus:outline-none cursor-pointer"
                  >
                    <option value={18}>18%</option>
                    <option value={12}>12%</option>
                    <option value={5}>5%</option>
                    <option value={28}>28%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-400 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl cursor-pointer"
                >
                  {editingId ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
