"use client";

import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import QuotationNav from "@/components/QuotationNav";
import CfoSecurityGuard from "@/components/CfoSecurityGuard";
import { compressImageFile } from "@/lib/imageCompressor";

interface CompanyEntity {
  _id: string;
  name: string;
  legalName?: string;
  gst?: string;
  pan?: string;
  bank?: string;
  address?: string;
  brands?: string[];
  qrCodeUrl?: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [companies, setCompanies] = useState<CompanyEntity[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

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
  const [isoTag, setIsoTag] = useState("");

  const [bankName, setBankName] = useState("STATE BANK OF INDIA");
  const [branch, setBranch] = useState("SITAPURA IND. AREA JAIPUR");
  const [accountNumber, setAccountNumber] = useState("61330464677");
  const [ifsc, setIfsc] = useState("SBIN0031792");
  const [rtgsCode, setRtgsCode] = useState("SBIN0031792");

  const [authorizedSignatory, setAuthorizedSignatory] = useState("AUTHORISED SIGNATORY");
  const [signatureImage, setSignatureImage] = useState("");
  const [bankQrImage, setBankQrImage] = useState("");
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
  const qrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchCompanies() {
      try {
        const res = await fetch("/api/companies");
        const data = await res.json();
        if (res.ok && data.success && Array.isArray(data.companies)) {
          setCompanies(data.companies);
        }
      } catch (err) {
        console.error("Error loading companies list:", err);
      }
    }
    fetchCompanies();
  }, []);

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
          setIsoTag(p.isoTag || "");
          setPrefix(p.prefix || "APPL");

          if (p.bankDetails) {
            setBankName(p.bankDetails.bankName || "");
            setBranch(p.bankDetails.branch || "");
            setAccountNumber(p.bankDetails.accountNumber || "");
            setIfsc(p.bankDetails.ifsc || "");
            setRtgsCode(p.bankDetails.rtgsCode || "");
          }

          setAuthorizedSignatory(p.authorizedSignatory || "AUTHORISED SIGNATORY");
          setSignatureImage(p.signatureImage || "");
          setBankQrImage(p.bankQrImage || "");

          if (Array.isArray(p.defaultTerms) && p.defaultTerms.length > 0) {
            setDefaultTerms(p.defaultTerms);
          }
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  const handleSelectCompany = (compId: string) => {
    setSelectedCompanyId(compId);
    if (!compId) return;

    const target = companies.find((c) => c._id === compId);
    if (target) {
      if (target.legalName || target.name) {
        setName(target.legalName || target.name);
      }
      if (target.gst && target.gst !== "Not Provided") {
        setGstin(target.gst.toUpperCase());
      }
      if (target.address && target.address !== "No listed street, No City, No State, PIN") {
        setAddress(target.address);
      }
      if (target.bank) {
        setBankName(target.bank);
      }
      if (Array.isArray(target.brands) && target.brands.length > 0) {
        setDescription(`Manufacturers / Providers for: ${target.brands.join(", ")}`);
      }
      if (target.qrCodeUrl) {
        // Option to sync QR if available
      }
      setMsg(`✓ Loaded details from company entity "${target.name}"`);
      setTimeout(() => setMsg(""), 4000);
    }
  };

  const handleFileUpload = async (ref: React.RefObject<HTMLInputElement | null>, setter: (val: string) => void) => {
    const file = ref.current?.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressImageFile(file, 800, 0.85);
      setter(compressedDataUrl);
    } catch (err) {
      console.error("Image compression error:", err);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setter(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddTerm = () => {
    if (!newTerm.trim()) return;
    setDefaultTerms([...defaultTerms, newTerm.trim().toUpperCase()]);
    setNewTerm("");
  };

  const handleRemoveTerm = (index: number) => {
    setDefaultTerms(defaultTerms.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    const payload = {
      name,
      logo,
      gstin: gstin.toUpperCase(),
      cin: cin.toUpperCase(),
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
      prefix: prefix.toUpperCase(),
      bankDetails: {
        bankName,
        branch,
        accountNumber,
        ifsc,
        rtgsCode,
      },
      authorizedSignatory,
      signatureImage,
      bankQrImage,
      defaultTerms,
    };

    try {
      const res = await fetch("/api/quotations/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { success: false, error: `Server returned HTTP ${res.status}` };
      }

      if (res.ok && data.success) {
        setMsg("✓ Company settings & branding updated successfully!");
        setTimeout(() => setMsg(""), 4000);
      } else {
        alert("Error saving settings: " + (data.error || "Failed"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CfoSecurityGuard>
      <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans transition-colors duration-200 relative">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <QuotationNav />

          <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
            {/* Header */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2 font-sans">
                ⚙️ Company Profile & Quotation Branding
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Configure company name, GSTIN, CIN, bank details, logo, authorized signature stamp, and default terms
              </p>
            </div>

            {msg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl shadow-sm animate-pulse">
                {msg}
              </div>
            )}

            {loading ? (
              <div className="p-8 text-center text-slate-400 font-bold">Loading settings...</div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                {/* Section 1: Company Info */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 font-sans">
                      1. Company & Header Details
                    </h3>

                    {/* Company Dropdown Selection */}
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-extrabold uppercase text-slate-500 whitespace-nowrap">
                        🏢 Select Company:
                      </label>
                      <select
                        value={selectedCompanyId}
                        onChange={(e) => handleSelectCompany(e.target.value)}
                        className="bg-indigo-50/60 border border-indigo-200 text-indigo-900 text-xs font-bold rounded-xl px-3 py-1.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-2xs"
                      >
                        <option value="">-- Auto-Fill from Companies Model --</option>
                        {companies.map((comp) => (
                          <option key={comp._id} value={comp._id}>
                            {comp.name} {comp.legalName && comp.legalName !== comp.name ? `(${comp.legalName})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Company Name *</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">GSTIN *</label>
                      <input
                        type="text"
                        required
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value.toUpperCase())}
                        className="w-full bg-slate-50 border border-slate-200 text-cyan-600 font-mono font-bold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">CIN</label>
                      <input
                        type="text"
                        value={cin}
                        onChange={(e) => setCin(e.target.value.toUpperCase())}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Company Description / Banner</label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Manufacturers of : ISI MARKED HDPE PIPES, SPRINKLER SYSTEM"
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Office Address</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">City / State / Pin</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="City"
                          className="w-1/3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <input
                          type="text"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          placeholder="State"
                          className="w-1/3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <input
                          type="text"
                          value={pincode}
                          onChange={(e) => setPincode(e.target.value)}
                          placeholder="Pincode"
                          className="w-1/3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Phone & Telefax</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Phone"
                          className="w-1/2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <input
                          type="text"
                          value={telefax}
                          onChange={(e) => setTelefax(e.target.value)}
                          placeholder="Telefax"
                          className="w-1/2 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Website</label>
                      <input
                        type="text"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Quotation Prefix</label>
                      <input
                        type="text"
                        value={prefix}
                        onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                        placeholder="APPL"
                        className="w-full bg-slate-50 border border-slate-200 text-indigo-600 font-bold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Regd. Office & Works Address (Footer)</label>
                    <input
                      type="text"
                      value={worksAddress}
                      onChange={(e) => setWorksAddress(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                {/* Section 2: Bank Details */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2 font-sans">
                    2. Bank Details (Footer Table)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Name of Bank</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Branch Address</label>
                      <input
                        type="text"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Account Number</label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-emerald-600 font-mono font-bold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">IFSC / RTGS Code</label>
                      <input
                        type="text"
                        value={rtgsCode}
                        onChange={(e) => {
                          setRtgsCode(e.target.value.toUpperCase());
                          setIfsc(e.target.value.toUpperCase());
                        }}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Authorized Signatory Title</label>
                      <input
                        type="text"
                        value={authorizedSignatory}
                        onChange={(e) => setAuthorizedSignatory(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Logos & Signature Image */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2 font-sans">
                    3. Company Logo, Signature Stamp & Bank Payment QR Code Upload
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-sans">
                    {/* Logo Upload */}
                    <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <span className="font-bold text-slate-700 block">Company Header Logo</span>
                      <input
                        type="file"
                        ref={logoInputRef}
                        accept="image/*"
                        onChange={() => handleFileUpload(logoInputRef, setLogo)}
                        className="hidden"
                      />
                      <div className="flex items-center gap-3">
                        {logo ? (
                          <img src={logo} alt="Company Logo" className="h-12 object-contain border border-slate-200 p-1 rounded-lg bg-white shadow-xs" />
                        ) : (
                          <span className="text-slate-400 font-medium">No logo uploaded</span>
                        )}
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer shadow-sm"
                        >
                          Upload Logo Image
                        </button>
                      </div>
                    </div>

                    {/* Stamp Upload */}
                    <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <span className="font-bold text-slate-700 block">Official Signature & Stamp</span>
                      <input
                        type="file"
                        ref={sigInputRef}
                        accept="image/*"
                        onChange={() => handleFileUpload(sigInputRef, setSignatureImage)}
                        className="hidden"
                      />
                      <div className="flex items-center gap-3">
                        {signatureImage ? (
                          <img src={signatureImage} alt="Stamp" className="h-12 object-contain border border-slate-200 p-1 rounded-lg bg-white shadow-xs" />
                        ) : (
                          <span className="text-slate-400 font-medium">No stamp uploaded</span>
                        )}
                        <button
                          type="button"
                          onClick={() => sigInputRef.current?.click()}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer shadow-sm"
                        >
                          Upload Signature Image
                        </button>
                      </div>
                    </div>

                    {/* Bank QR Code Upload */}
                    <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <span className="font-bold text-slate-700 block">Bank Payment QR Code</span>
                      <input
                        type="file"
                        ref={qrInputRef}
                        accept="image/*"
                        onChange={() => handleFileUpload(qrInputRef, setBankQrImage)}
                        className="hidden"
                      />
                      <div className="flex items-center gap-3">
                        {bankQrImage ? (
                          <img src={bankQrImage} alt="Bank QR" className="h-12 object-contain border border-slate-200 p-1 rounded-lg bg-white shadow-xs" />
                        ) : (
                          <span className="text-slate-400 font-medium">No QR uploaded</span>
                        )}
                        <button
                          type="button"
                          onClick={() => qrInputRef.current?.click()}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl cursor-pointer shadow-sm"
                        >
                          Upload Bank QR
                        </button>
                        {bankQrImage && (
                          <button
                            type="button"
                            onClick={() => setBankQrImage("")}
                            className="px-2 py-1 text-rose-500 hover:text-rose-700 font-bold cursor-pointer text-xs"
                            title="Remove QR Code"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Default Terms & Conditions */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2 font-sans">
                    4. Default Terms & Conditions
                  </h3>

                  <ul className="space-y-2 text-xs font-sans">
                    {defaultTerms.map((t, i) => (
                      <li key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
                        <span className="font-semibold text-slate-800">
                          {i + 1}. {t}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTerm(i)}
                          className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer text-xs"
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
                      className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={handleAddTerm}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm"
                    >
                      + Add Term
                    </button>
                  </div>
                </div>

                <div className="flex justify-end border-t border-slate-200 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-500/20 cursor-pointer transition-all"
                  >
                    {saving ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </CfoSecurityGuard>
  );
}
