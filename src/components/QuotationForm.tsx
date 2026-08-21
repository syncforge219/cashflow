"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { numberToIndianWords } from "@/lib/numberToWords";

interface ItemRow {
  productId?: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  gstRate: number;
  amount: number;
}

interface CustomerOption {
  _id: string;
  name: string;
  contactPerson?: string;
  address?: string;
  gstin?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

interface ProductOption {
  _id: string;
  name: string;
  description?: string;
  unit: string;
  defaultRate: number;
  gstRate: number;
}

interface QuotationFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export default function QuotationForm({ initialData, isEdit = false }: QuotationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [profile, setProfile] = useState<any>(null);

  // Form State
  const [quotationNumber, setQuotationNumber] = useState(initialData?.quotationNumber || "");
  const [date, setDate] = useState(
    initialData?.date
      ? new Date(initialData.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [validUntil, setValidUntil] = useState(
    initialData?.validUntil ? new Date(initialData.validUntil).toISOString().split("T")[0] : ""
  );
  const [poNumber, setPoNumber] = useState(initialData?.poNumber || "APPL/2026-27");
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialData?.customerId || "");
  const [customerName, setCustomerName] = useState(initialData?.customerName || "");
  const [consigneeInfo, setConsigneeInfo] = useState(initialData?.consigneeInfo || "");
  const [customerAddress, setCustomerAddress] = useState(initialData?.customerAddress || "");
  const [customerGstin, setCustomerGstin] = useState(initialData?.customerGstin || "");
  const [deliveryLocation, setDeliveryLocation] = useState(initialData?.deliveryLocation || "");

  const [items, setItems] = useState<ItemRow[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [
          {
            name: "HDPE PIPE 160MM, PE100, PN6",
            description: "6 Mtr Length",
            quantity: 1100,
            unit: "mtr",
            rate: 390,
            gstRate: 18,
            amount: 429000,
          },
          {
            name: "HDPE PIPE 110MM, PE100, PN6",
            description: "6 Mtr Length",
            quantity: 1300,
            unit: "mtr",
            rate: 230,
            gstRate: 18,
            amount: 299000,
          },
        ]
  );

  const [gstRate, setGstRate] = useState(initialData?.gstRate !== undefined ? initialData.gstRate : 18);
  const [discount, setDiscount] = useState(initialData?.discount || 0);
  const [transportCharges, setTransportCharges] = useState(initialData?.transportCharges || 0);
  const [transportText, setTransportText] = useState(initialData?.transportText || "included");
  const [additionalCharges, setAdditionalCharges] = useState(initialData?.additionalCharges || 0);
  const [terms, setTerms] = useState<string[]>(
    initialData?.termsAndConditions || [
      "GST CHARGE EXTRA",
      "TRANSPORTATION INCLUDED",
      "PAYMENT ADVANCE",
      "ALL PIPE 6MTR LENGTH",
      "MATERIAL DELIVERD WITHIN 7DAYS",
    ]
  );

  const [status, setStatus] = useState(initialData?.status || "DRAFT");
  const [newTermInput, setNewTermInput] = useState("");

  // Load masters (customers, products, profile)
  useEffect(() => {
    async function loadMasters() {
      try {
        const [profRes, custRes, prodRes] = await Promise.all([
          fetch("/api/quotations/profile"),
          fetch("/api/quotations/customers"),
          fetch("/api/quotations/products"),
        ]);

        const profData = await profRes.json();
        const custData = await custRes.json();
        const prodData = await prodRes.json();

        if (profData.success) {
          setProfile(profData.data);
          if (!isEdit && !initialData?.termsAndConditions) {
            setTerms(profData.data.defaultTerms || []);
          }
        }
        if (custData.success) setCustomers(custData.data || []);
        if (prodData.success) setProducts(prodData.data || []);
      } catch (err) {
        console.error("Error loading master data:", err);
      }
    }
    loadMasters();
  }, [isEdit]);

  // Handle Customer Selection
  const handleSelectCustomer = (custDocId: string) => {
    setSelectedCustomerId(custDocId);
    if (!custDocId) return;
    const found = customers.find((c) => c._id === custDocId);
    if (found) {
      setCustomerName(found.name);
      setConsigneeInfo(`${found.name}\n${found.address || ""}\n${found.city || ""}`);
      setCustomerAddress(found.address || "");
      setCustomerGstin(found.gstin || "");
      if (found.city) setDeliveryLocation(found.city);
    }
  };

  // Add Product Row from dropdown
  const handleAddProductRow = (prodDocId: string) => {
    if (!prodDocId) return;
    const found = products.find((p) => p._id === prodDocId);
    if (found) {
      setItems((prev) => [
        ...prev,
        {
          productId: found._id,
          name: found.name,
          description: found.description || "",
          quantity: 1,
          unit: found.unit || "mtr",
          rate: found.defaultRate || 0,
          gstRate: found.gstRate || 18,
          amount: (found.defaultRate || 0) * 1,
        },
      ]);
    }
  };

  // Add Blank Row
  const handleAddBlankRow = () => {
    setItems((prev) => [
      ...prev,
      {
        name: "",
        description: "",
        quantity: 1,
        unit: "mtr",
        rate: 0,
        gstRate: 18,
        amount: 0,
      },
    ]);
  };

  const handleUpdateRow = (index: number, field: keyof ItemRow, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };
      if (field === "quantity" || field === "rate") {
        const qty = Math.max(0, Number(field === "quantity" ? value : row.quantity) || 0);
        const rt = Math.max(0, Number(field === "rate" ? value : row.rate) || 0);
        row.amount = qty * rt;
      }
      next[index] = row;
      return next;
    });
  };

  const handleRemoveRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const calculatedSubtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const taxableBase = Math.max(0, calculatedSubtotal - Number(discount || 0));
  const calculatedGstAmount = (taxableBase * Number(gstRate || 18)) / 100;
  const calculatedGrandTotal = Math.round(
    taxableBase + calculatedGstAmount + Number(transportCharges || 0) + Number(additionalCharges || 0)
  );

  const amountInWords = numberToIndianWords(calculatedGrandTotal);

  // Terms handlers
  const handleAddTerm = () => {
    if (!newTermInput.trim()) return;
    setTerms((prev) => [...prev, newTermInput.trim().toUpperCase()]);
    setNewTermInput("");
  };

  const handleRemoveTerm = (index: number) => {
    setTerms((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert("Please enter Customer Name");
      return;
    }
    if (items.length === 0) {
      alert("Please add at least one product item");
      return;
    }

    setLoading(true);
    setSaveSuccess("");

    const payload = {
      ...(isEdit && { id: initialData._id }),
      quotationNumber: quotationNumber.trim(),
      date,
      validUntil: validUntil || undefined,
      poNumber: poNumber.trim(),
      customerId: selectedCustomerId || undefined,
      customerName: customerName.trim(),
      consigneeInfo: consigneeInfo.trim(),
      customerAddress: customerAddress.trim(),
      customerGstin: customerGstin.trim().toUpperCase(),
      deliveryLocation: deliveryLocation.trim(),
      items,
      subtotal: calculatedSubtotal,
      discount: Number(discount || 0),
      gstRate: Number(gstRate || 18),
      gstAmount: calculatedGstAmount,
      transportCharges: Number(transportCharges || 0),
      transportText: transportText.trim(),
      additionalCharges: Number(additionalCharges || 0),
      grandTotal: calculatedGrandTotal,
      amountInWords,
      termsAndConditions: terms,
      status,
    };

    try {
      const endpoint = "/api/quotations";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccess(`✓ Quotation ${isEdit ? "updated" : "created"} successfully!`);
        setTimeout(() => {
          router.push("/quotations");
        }, 800);
      } else {
        alert("Failed: " + (data.error || "Server error"));
      }
    } catch (err: any) {
      alert("Error saving quotation: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Title Bar */}
        <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              {isEdit ? `✏️ Edit Quotation (${initialData?.quotationNumber})` : "📝 Create New Quotation"}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Fill in customer details, add products, GST rate, transport charges, and preview live PDF layout
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/quotations")}
              className="px-4 py-2 text-xs font-bold text-slate-400 bg-slate-800 hover:text-white rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Quotation"}
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl animate-pulse">
            {saveSuccess}
          </div>
        )}

        {/* Section 1: Basic Information */}
        <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">
            1. Basic Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Quotation # (Auto generated if blank)
              </label>
              <input
                type="text"
                value={quotationNumber}
                onChange={(e) => setQuotationNumber(e.target.value)}
                placeholder="Auto (e.g. APPL/2026-27/0001)"
                className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">P.O. Number</label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="e.g. APPL/2026-27"
                className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50 cursor-pointer font-bold"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="SENT">SENT</option>
                <option value="ACCEPTED">ACCEPTED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Consignee & Customer Details */}
        <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400">
              2. Consignee & Customer Details
            </h3>

            {customers.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold">Select Saved Customer:</span>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                  className="bg-[#050811] border border-indigo-500/30 text-indigo-300 rounded-xl px-3 py-1 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.city || "No City"})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Customer Name / Consignee *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="M/S ARVA ASSOCIATES"
                className="w-full bg-[#050811] border border-slate-800 text-white font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer GSTIN</label>
              <input
                type="text"
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                placeholder="09AFIPA8247C1ZM"
                className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50 uppercase"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Delivery At (Location)</label>
              <input
                type="text"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="CHITRAKOOT"
                className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Customer Address</label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="BUNGALOW NO 55 CANTT, SADAR BAZAR, JHANSI"
                className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Product Items Table */}
        <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400">
              3. Items Table
            </h3>

            <div className="flex items-center gap-2 text-xs">
              {products.length > 0 && (
                <select
                  onChange={(e) => {
                    handleAddProductRow(e.target.value);
                    e.target.value = "";
                  }}
                  className="bg-[#050811] border border-emerald-500/30 text-emerald-300 rounded-xl px-3 py-1 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="">+ Select Product Master</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} (Rate: ₹{p.defaultRate}/{p.unit})
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={handleAddBlankRow}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                + Add Custom Row
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#050811] text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-3 py-3 w-12 text-center">S.No</th>
                  <th className="px-3 py-3">Description of Goods</th>
                  <th className="px-3 py-3 w-28 text-center">Qty</th>
                  <th className="px-3 py-3 w-20 text-center">Unit</th>
                  <th className="px-3 py-3 w-28 text-center">Rate per unit</th>
                  <th className="px-3 py-3 w-32 text-right">Amount</th>
                  <th className="px-3 py-3 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {items.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/50">
                    <td className="px-3 py-2 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2 space-y-1">
                      <input
                        type="text"
                        required
                        value={row.name}
                        onChange={(e) => handleUpdateRow(idx, "name", e.target.value)}
                        placeholder="Product Name"
                        className="w-full bg-[#050811] border border-slate-800 text-white font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500/50"
                      />
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => handleUpdateRow(idx, "description", e.target.value)}
                        placeholder="Sub description (e.g. 6 Mtr Length)"
                        className="w-full bg-[#050811] border border-slate-850 text-slate-400 text-[11px] rounded-lg px-2.5 py-1 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={row.quantity}
                        onChange={(e) => handleUpdateRow(idx, "quantity", e.target.value)}
                        className="w-full bg-[#050811] border border-slate-800 text-white font-bold text-center rounded-lg px-2 py-1.5 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => handleUpdateRow(idx, "unit", e.target.value)}
                        placeholder="mtr"
                        className="w-full bg-[#050811] border border-slate-800 text-white text-center rounded-lg px-1.5 py-1.5 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={row.rate}
                        onChange={(e) => handleUpdateRow(idx, "rate", e.target.value)}
                        className="w-full bg-[#050811] border border-slate-800 text-white font-bold text-center rounded-lg px-2 py-1.5 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-extrabold text-white text-sm">
                      ₹{row.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="text-rose-400 hover:text-rose-300 font-bold p-1 cursor-pointer"
                        title="Remove Item"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: Totals, GST & Transport Calculations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Terms & Conditions */}
          <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">
              4. Terms & Conditions
            </h3>

            <ul className="space-y-2 text-xs">
              {terms.map((t, i) => (
                <li key={i} className="flex items-center justify-between bg-[#050811] border border-slate-800 rounded-xl px-3 py-2">
                  <span className="font-semibold text-slate-200">
                    {i + 1}. {t}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTerm(i)}
                    className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer text-xs"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTermInput}
                onChange={(e) => setNewTermInput(e.target.value)}
                placeholder="Add custom term (e.g. PAYMENT ADVANCE)"
                className="flex-1 bg-[#050811] border border-slate-800 text-white text-xs rounded-xl px-3 py-2 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddTerm}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Right Column: Financial Totals Summary */}
          <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">
              5. Financial Summary
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span className="font-bold">Items Subtotal:</span>
                <span className="font-extrabold text-white text-sm">₹{calculatedSubtotal.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between items-center text-slate-400">
                <span className="font-bold">Discount (₹):</span>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-32 bg-[#050811] border border-slate-800 text-white font-bold text-right rounded-lg px-2.5 py-1 focus:outline-none"
                />
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="font-bold">GST Rate (%):</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="w-16 bg-[#050811] border border-slate-800 text-white font-bold text-center rounded-lg px-2 py-1 focus:outline-none"
                  />
                </div>
                <span className="font-extrabold text-blue-400">₹{calculatedGstAmount.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="font-bold">Transport (Text/Amt):</span>
                  <input
                    type="text"
                    value={transportText}
                    onChange={(e) => setTransportText(e.target.value)}
                    placeholder="included"
                    className="w-28 bg-[#050811] border border-slate-800 text-white text-xs rounded-lg px-2 py-1 focus:outline-none"
                  />
                </div>
                <input
                  type="number"
                  min="0"
                  value={transportCharges}
                  onChange={(e) => setTransportCharges(Number(e.target.value))}
                  placeholder="Charge (₹)"
                  className="w-28 bg-[#050811] border border-slate-800 text-white font-bold text-right rounded-lg px-2.5 py-1 focus:outline-none"
                />
              </div>

              <div className="border-t border-slate-800 pt-3 flex justify-between items-center">
                <span className="font-black text-white text-base">Grand Total:</span>
                <span className="font-black text-emerald-400 text-xl">₹{calculatedGrandTotal.toLocaleString("en-IN")}</span>
              </div>

              {/* Amount in Words Display */}
              <div className="bg-[#050811] border border-slate-800/80 rounded-xl p-3 text-[11px] text-slate-300 font-bold">
                <span className="text-slate-500 uppercase block text-[9px] mb-0.5">Amount in words:</span>
                {amountInWords}
              </div>
            </div>
          </div>
        </div>

        {/* Action Bottom Bar */}
        <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-4 flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.push("/quotations")}
            className="px-6 py-2.5 text-xs font-bold text-slate-400 bg-slate-800 hover:text-white rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Quotation"}
          </button>
        </div>
      </form>
    </div>
  );
}
