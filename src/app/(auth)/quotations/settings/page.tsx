"use client";

import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import QuotationNav from "@/components/QuotationNav";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [name, setName] = useState("AARAM PLASTICS PVT. LTD.");
  const [logo, setLogo] = useState("");
  const [gstin, setGstin] = useState("08AABCA5691D1ZS");
  const [cin, setCin] = useState("U25209RJ1996PTC011513");
  const [description, setDescription] = useState("Manufacturers of : ISI MARKED 'GANGOTRI' HDPE PIPES, SPRINKLER SYSTEM AND PLB TELECOM DUCTS");
  const [address, setAddress] = useState("101, Vinayak Complex, Station Road");
  const [city, setCity] = useState("JAIPUR");
  const [state, setState] = useState("Rajasthan");
  const [pincode, setPincode] = useState("302 001");
  const [phone, setPhone] = useState("0141-4059826");
  const [telefax, setTelefax] = useState("0141-2370336");
  const [email, setEmail] = useState("appl_jaipur@rediffmail.com");
  const [website, setWebsite] = useState("www.aaramplastics.com");
  const [worksAddress, setWorksAddress] = useState("G-232, Sitapura Ind. Area, Tonk Road, JAIPUR - 302 022 (Raj.) Tel. : 0141-2771862");
  const [isoTag, setIsoTag] = useState("ISO 9001");

  const [bankName, setBankName] = useState("STATE BANK OF INDIA");
  const [branch, setBranch] = useState("SITAPURA IND. AREA JAIPUR");
  const [accountNumber, setAccountNumber] = useState("61330464677");
  const [ifsc, setIfsc] = useState("SBIN0031792");
  const [rtgsCode, setRtgsCode] = useState("SBIN0031792");

  const [authorizedSignatory, setAuthorizedSignatory] = useState("AUTHORISED SIGNATORY");
  const [signatureImage, setSignatureImage] = useState("");
  const [prefix, setPrefix] = useState("APPL");
  const [defaultTerms, setDefaultTerms] = useState<string[]>([
    "GST CHARGE EXTRA",
    "TRANSPORTATION INCLUDED",
    "PAYMENT ADVANCE",
    "ALL PIPE 6MTR LENGTH",
    "MATERIAL DELIVERD WITHIN 7DAYS",
  ]);

  const [newTerm, setNewTerm] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/quotations/profile");
        const data = await res.json();
        if (res.ok && data.success && data.data) {
          const p = data.data;
          setName(p.name || "");
          setLogo(p.logo || "");
          setGstin(p.gstin || "");
          setCin(p.cin || "");
          setDescription(p.description || "");
          setAddress(p.address || "");
          setCity(p.city || "");
          setState(p.state || "");
          setPincode(p.pincode || "");
          setPhone(p.phone || "");
          setTelefax(p.telefax || "");
          setEmail(p.email || "");
          setWebsite(p.website || "");
          setWorksAddress(p.worksAddress || "");
          setIsoTag(p.isoTag || "ISO 9001");
          setPrefix(p.prefix || "APPL");

          if (p.bankDetails) {
            setBankName(p.bankDetails.bankName || "");
            setBranch(p.bankDetails.branch || "");
            setAccountNumber(p.bankDetails.accountNumber || "");
            setIfsc(p.bankDetails.ifsc || "");
            setRtgsCode(p.bankDetails.rtgsCode || p.bankDetails.ifsc || "");
          }

          setAuthorizedSignatory(p.authorizedSignatory || "AUTHORISED SIGNATORY");
          setSignatureImage(p.signatureImage || "");
          if (p.defaultTerms) setDefaultTerms(p.defaultTerms);
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleFileUpload = (ref: React.RefObject<HTMLInputElement | null>, setter: (val: string) => void) => {
    const file = ref.current?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const res = e.target?.result as string;
      if (res) setter(res);
    };
    reader.readAsDataURL(file);
  };

  const handleAddTerm = () => {
    if (!newTerm.trim()) return;
    setDefaultTerms((prev) => [...prev, newTerm.trim().toUpperCase()]);
    setNewTerm("");
  };

  const handleRemoveTerm = (index: number) => {
    setDefaultTerms((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    const payload = {
      name,
      logo,
      gstin,
      cin,
      description,
      address,
      city,
      state,
      pincode,
      phone,
      telefax,
      email,
      website,
      worksAddress,
      isoTag,
      prefix,
      bankDetails: {
        bankName,
        branch,
        accountNumber,
        ifsc,
        rtgsCode,
      },
      authorizedSignatory,
      signatureImage,
      defaultTerms,
    };

    try {
      const res = await fetch("/api/quotations/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMsg("✓ Company Quotation settings saved successfully!");
      } else {
        alert("Failed to save: " + (data.error || "Error"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#050811] text-slate-100 font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <QuotationNav />

        <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              ⚙️ Company Profile & PDF Quotation Branding Settings
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure company name, GSTIN, CIN, bank details, logo, authorized signature stamp, and default terms
            </p>
          </div>

          {msg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl animate-pulse">
              {msg}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-slate-400 font-bold">Loading settings...</div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {/* Section 1: Company Info */}
              <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">
                  1. Company & Header Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 text-white font-bold rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">GSTIN *</label>
                    <input
                      type="text"
                      required
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      className="w-full bg-[#050811] border border-slate-800 text-cyan-400 font-mono font-bold rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CIN</label>
                    <input
                      type="text"
                      value={cin}
                      onChange={(e) => setCin(e.target.value.toUpperCase())}
                      className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Company Description / Banner</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Manufacturers of : ISI MARKED HDPE PIPES, SPRINKLER SYSTEM"
                    className="w-full bg-[#050811] border border-slate-800 text-white text-xs rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Office Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">City / State / Pin</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City"
                        className="w-1/3 bg-[#050811] border border-slate-800 text-white rounded-xl px-2 py-2 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="State"
                        className="w-1/3 bg-[#050811] border border-slate-800 text-white rounded-xl px-2 py-2 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        placeholder="Pincode"
                        className="w-1/3 bg-[#050811] border border-slate-800 text-white rounded-xl px-2 py-2 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone & Telefax</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone"
                        className="w-1/2 bg-[#050811] border border-slate-800 text-white rounded-xl px-2 py-2 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={telefax}
                        onChange={(e) => setTelefax(e.target.value)}
                        placeholder="Telefax"
                        className="w-1/2 bg-[#050811] border border-slate-800 text-white rounded-xl px-2 py-2 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Website</label>
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quotation Prefix</label>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                      placeholder="APPL"
                      className="w-full bg-[#050811] border border-slate-800 text-indigo-400 font-bold rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Regd. Office & Works Address (Footer)</label>
                  <input
                    type="text"
                    value={worksAddress}
                    onChange={(e) => setWorksAddress(e.target.value)}
                    className="w-full bg-[#050811] border border-slate-800 text-white text-xs rounded-xl px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>

              {/* Section 2: Bank Details */}
              <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">
                  2. Bank Details (Footer Table)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name of Bank</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 text-white font-bold rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Branch Address</label>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 text-white rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 text-emerald-400 font-mono font-bold rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">IFSC / RTGS Code</label>
                    <input
                      type="text"
                      value={rtgsCode}
                      onChange={(e) => {
                        setRtgsCode(e.target.value.toUpperCase());
                        setIfsc(e.target.value.toUpperCase());
                      }}
                      className="w-full bg-[#050811] border border-slate-800 text-white font-mono rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Authorized Signatory Title</label>
                    <input
                      type="text"
                      value={authorizedSignatory}
                      onChange={(e) => setAuthorizedSignatory(e.target.value)}
                      className="w-full bg-[#050811] border border-slate-800 text-white font-bold rounded-xl px-3 py-2 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Logos & Signature Image */}
              <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">
                  3. Company Logo & Signature Stamp Upload
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  {/* Logo Upload */}
                  <div className="space-y-2 bg-[#050811] border border-slate-800 rounded-2xl p-4">
                    <span className="font-bold text-slate-300 block">Company Header Logo</span>
                    <input
                      type="file"
                      ref={logoInputRef}
                      accept="image/*"
                      onChange={() => handleFileUpload(logoInputRef, setLogo)}
                      className="hidden"
                    />
                    <div className="flex items-center gap-3">
                      {logo ? (
                        <img src={logo} alt="Company Logo" className="h-12 object-contain border border-slate-700 p-1 rounded-lg bg-white" />
                      ) : (
                        <span className="text-slate-500 font-bold">No logo uploaded</span>
                      )}
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl cursor-pointer"
                      >
                        Upload Logo Image
                      </button>
                    </div>
                  </div>

                  {/* Stamp Upload */}
                  <div className="space-y-2 bg-[#050811] border border-slate-800 rounded-2xl p-4">
                    <span className="font-bold text-slate-300 block">Official Signature & Stamp</span>
                    <input
                      type="file"
                      ref={sigInputRef}
                      accept="image/*"
                      onChange={() => handleFileUpload(sigInputRef, setSignatureImage)}
                      className="hidden"
                    />
                    <div className="flex items-center gap-3">
                      {signatureImage ? (
                        <img src={signatureImage} alt="Stamp" className="h-12 object-contain border border-slate-700 p-1 rounded-lg bg-white" />
                      ) : (
                        <span className="text-slate-500 font-bold">No stamp uploaded</span>
                      )}
                      <button
                        type="button"
                        onClick={() => sigInputRef.current?.click()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl cursor-pointer"
                      >
                        Upload Signature Image
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Default Terms & Conditions */}
              <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">
                  4. Default Terms & Conditions
                </h3>

                <ul className="space-y-2 text-xs">
                  {defaultTerms.map((t, i) => (
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
                    value={newTerm}
                    onChange={(e) => setNewTerm(e.target.value)}
                    placeholder="Add default term (e.g. MATERIAL DELIVERD WITHIN 7DAYS)"
                    className="flex-1 bg-[#050811] border border-slate-800 text-white text-xs rounded-xl px-3 py-2 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddTerm}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    + Add Term
                  </button>
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-800 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
