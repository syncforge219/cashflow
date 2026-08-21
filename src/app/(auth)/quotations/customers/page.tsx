"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import QuotationNav from "@/components/QuotationNav";

interface Customer {
  _id: string;
  name: string;
  contactPerson?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  phone?: string;
  email?: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/customers?q=${encodeURIComponent(search)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomers(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const openAddModal = () => {
    setEditingId(null);
    setName("");
    setContactPerson("");
    setAddress("");
    setCity("");
    setState("");
    setPincode("");
    setGstin("");
    setPhone("");
    setEmail("");
    setIsModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingId(c._id);
    setName(c.name);
    setContactPerson(c.contactPerson || "");
    setAddress(c.address || "");
    setCity(c.city || "");
    setState(c.state || "");
    setPincode(c.pincode || "");
    setGstin(c.gstin || "");
    setPhone(c.phone || "");
    setEmail(c.email || "");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Customer Name is required");
      return;
    }

    const payload = {
      ...(editingId && { id: editingId }),
      name: name.trim(),
      contactPerson,
      address,
      city,
      state,
      pincode,
      gstin: gstin.toUpperCase(),
      phone,
      email,
    };

    try {
      const method = editingId ? "PUT" : "POST";
      const res = await fetch("/api/quotations/customers", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsModalOpen(false);
        fetchCustomers();
      } else {
        alert("Error: " + (data.error || "Failed"));
      }
    } catch (err: any) {
      alert("Error saving: " + err.message);
    }
  };

  const handleDelete = async (id: string, customerName: string) => {
    if (!confirm(`Delete customer ${customerName}?`)) return;
    try {
      const res = await fetch(`/api/quotations/customers?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchCustomers();
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
                🏢 Customer Master Management
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage client companies, contact persons, shipping/consignee addresses and GSTIN numbers
              </p>
            </div>

            <button
              onClick={openAddModal}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-pointer"
            >
              + Add New Customer
            </button>
          </div>

          {/* Search bar */}
          <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-4">
            <input
              type="text"
              placeholder="Search customer by name, contact person, GSTIN, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-96 bg-[#050811] border border-slate-800 text-white placeholder-slate-500 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Customers Table */}
          <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#050811] text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Customer Name</th>
                    <th className="px-4 py-3.5">Contact Person</th>
                    <th className="px-4 py-3.5">GSTIN</th>
                    <th className="px-4 py-3.5">Location / City</th>
                    <th className="px-4 py-3.5">Phone / Email</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Loading customers...
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No customers found. Click <b>+ Add New Customer</b> to create one.
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => (
                      <tr key={c._id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-white">
                          {c.name}
                          {c.address && <div className="text-[10px] text-slate-500 font-normal truncate max-w-xs">{c.address}</div>}
                        </td>
                        <td className="px-4 py-3.5 text-slate-300 font-semibold">{c.contactPerson || "-"}</td>
                        <td className="px-4 py-3.5 font-mono text-cyan-400">{c.gstin || "NOT PROVIDED"}</td>
                        <td className="px-4 py-3.5 text-slate-300">
                          {c.city ? `${c.city}${c.state ? `, ${c.state}` : ""}` : "-"}
                        </td>
                        <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                          {c.phone && <div>{c.phone}</div>}
                          {c.email && <div className="text-slate-500">{c.email}</div>}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(c)}
                              className="px-2.5 py-1 text-[11px] font-bold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(c._id, c.name)}
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

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-[#0B0F19] border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                {editingId ? "Edit Customer" : "Add New Customer"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Customer / Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="M/S ARVA ASSOCIATES"
                  className="w-full bg-[#050811] border border-slate-800 text-white font-bold rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Rajesh Sharma"
                    className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="09AFIPA8247C1ZM"
                    className="w-full bg-[#050811] border border-slate-800 text-white uppercase rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="BUNGALOW NO 55 CANTT, SADAR BAZAR"
                  className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="JHANSI"
                    className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Uttar Pradesh"
                    className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pincode</label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="284001"
                    className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@gmail.com"
                    className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                  />
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
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl cursor-pointer"
                >
                  {editingId ? "Save Changes" : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
