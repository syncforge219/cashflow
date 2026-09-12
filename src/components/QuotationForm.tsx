"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { numberToIndianWords } from "@/lib/numberToWords";
import { useUser } from "@/app/component/context/user-context";
import { compressImageFile } from "@/lib/imageCompressor";

interface ItemRow {
  productId?: string;
  name: string;
  description: string;
  quantity: number | string;
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
  defaultTerms?: string[];
}

interface CompanyOption {
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

interface QuotationFormProps {
  initialData?: any;
  isEdit?: boolean;
  isPo?: boolean;
}

export default function QuotationForm({ initialData, isEdit = false, isPo = false }: QuotationFormProps) {
  const router = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState("");

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [companiesList, setCompaniesList] = useState<CompanyOption[]>([]);
  const [selectedCompanyEntityId, setSelectedCompanyEntityId] = useState("");

  const [issuingCompanyInfo, setIssuingCompanyInfo] = useState<{
    name: string;
    gstin: string;
    cin: string;
    address: string;
    description: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    branch: string;
    prefix: string;
    logo: string;
    stampImage: string;
    signatureImage: string;
    bankQrImage: string;
    authorizedSignatory: string;
    phone: string;
    email: string;
    website: string;
  }>({
    name: initialData?.companyName || "SICCES PRIVATE LIMITED",
    gstin: initialData?.companyGstin || "09AASCS4608K1ZP",
    cin: initialData?.companyCin || "",
    address: initialData?.companyAddress || "101, Vinayak Complex, Station Road, Jaipur",
    description: initialData?.companyDescription || "Providers of Software, Digital Marketing & Educational Services",
    bankName: initialData?.bankDetails?.bankName || "STATE BANK OF INDIA",
    accountNumber: initialData?.bankDetails?.accountNumber || "61330464677",
    ifsc: initialData?.bankDetails?.ifsc || initialData?.bankDetails?.rtgsCode || "SBIN0031792",
    branch: initialData?.bankDetails?.branch || "SITAPURA IND. AREA JAIPUR",
    prefix: "SICCES",
    logo: initialData?.companyLogo !== undefined ? initialData.companyLogo : "/sicces-logo.png",
    stampImage: initialData?.stampImage || "",
    signatureImage: initialData?.signatureImage || "",
    bankQrImage: initialData?.bankQrImage || "",
    authorizedSignatory: initialData?.authorizedSignatory || "AUTHORISED SIGNATORY",
    phone: initialData?.companyPhone || "0141-4059826",
    email: initialData?.companyEmail || "info@sicces.com",
    website: initialData?.companyWebsite || "www.sicces.com",
  });

  // File input refs for Company Assets (Logo, Stamp, Sign, Bank QR)
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const stampFileInputRef = useRef<HTMLInputElement | null>(null);
  const signatureFileInputRef = useRef<HTMLInputElement | null>(null);
  const bankQrFileInputRef = useRef<HTMLInputElement | null>(null);

  // URL input toggles for each asset
  const [assetUrlInputs, setAssetUrlInputs] = useState<{
    logo: boolean;
    stampImage: boolean;
    signatureImage: boolean;
    bankQrImage: boolean;
  }>({
    logo: false,
    stampImage: false,
    signatureImage: false,
    bankQrImage: false,
  });

  // Expandable verification assets section for non-OTHER presets
  const [showAssetsSection, setShowAssetsSection] = useState(false);

  const handleAssetUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logo" | "stampImage" | "signatureImage" | "bankQrImage",
    maxDim = 600
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, maxDim, 0.85);
      setIssuingCompanyInfo((prev) => ({ ...prev, [field]: compressed }));
    } catch (err) {
      console.error(`Error compressing ${field}:`, err);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setIssuingCompanyInfo((prev) => ({ ...prev, [field]: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    } finally {
      e.target.value = "";
    }
  };

  // Form State
  const [category, setCategory] = useState<string>(initialData?.category || "PRODUCT");
  const [customCategoryName, setCustomCategoryName] = useState<string>(
    initialData?.customCategoryName || (initialData?.category === "CUSTOM" ? "CUSTOM" : initialData?.category || "CUSTOM")
  );
  const [billingCycle, setBillingCycle] = useState<string>(initialData?.billingCycle || "ONE_TIME");
  const [contractPeriod, setContractPeriod] = useState<string>(initialData?.contractPeriod || "");
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
  const [supplierName, setSupplierName] = useState(initialData?.supplierName || "");

  const categoryPresets: Record<string, { label: string; icon: string; defaultUnit: string; descHeader: string }> = {
    SOFTWARE: { label: "Software / SaaS", icon: "💻", defaultUnit: "seat/mo", descHeader: "Description of Software / SaaS Modules" },
    DIGITAL_MARKETING: { label: "Digital Marketing", icon: "📢", defaultUnit: "month", descHeader: "Description of Marketing Deliverables" },
    PRODUCT: { label: "Physical Goods", icon: "📦", defaultUnit: "mtr", descHeader: "Description of Goods" },
    SERVICE: { label: "Services & Maintenance", icon: "🛠️", defaultUnit: "hour", descHeader: "Description of Services" },
    CUSTOM: { label: "Custom Offering", icon: "⚡", defaultUnit: "unit", descHeader: "Description of Items" },
  };

  const categoryTermsPresets: Record<string, string[]> = {
    SOFTWARE: [
      "BILLING IN ADVANCE EVERY MONTH / CYCLE",
      "12 MONTHS MINIMUM CONTRACT PERIOD",
      "99.9% UPTIME SLA GUARANTEED",
      "INCLUDES 24/7 EMAIL & PHONE SUPPORT",
      "GST 18% APPLICABLE EXTRA AS PER GOVT NORMS",
    ],
    DIGITAL_MARKETING: [
      "PAYMENT 100% IN ADVANCE AT THE START OF EACH BILLING CYCLE",
      "AD SPEND BUDGET TO BE PAID DIRECTLY BY CLIENT TO GOOGLE/META",
      "MONTHLY STRATEGY & ROI REPORTING CALL INCLUDED",
      "MINIMUM 3 MONTHS ENGAGEMENT PERIOD",
    ],
    PRODUCT: [
      "GST CHARGE EXTRA",
      "TRANSPORTATION INCLUDED",
      "PAYMENT ADVANCE",
      "ALL PIPE 6MTR LENGTH",
      "MATERIAL DELIVERED WITHIN 7DAYS",
    ],
    SERVICE: [
      "50% ADVANCE UPON SIGNING, 50% ON COMPLETION",
      "INCLUDES PREVENTIVE MAINTENANCE VISITS",
      "PARTS & HARDWARE BILLED SEPARATELY AT ACTUALS",
    ],
    CUSTOM: [
      "PAYMENT AS PER AGREED MILESTONES",
      "TAXES APPLICABLE AS PER GOVERNMENT LAWS",
    ],
  };

  const unitPresetsPerCategory: Record<string, string[]> = {
    SOFTWARE: ["seat/mo", "user", "license", "month", "year", "project", "hour"],
    DIGITAL_MARKETING: ["month", "quarter", "campaign", "package", "post", "lead", "hour"],
    PRODUCT: ["mtr", "pc", "kg", "box", "set", "sq.ft", "ton"],
    SERVICE: ["hour", "day", "month", "year", "project", "visit"],
    CUSTOM: ["unit", "month", "project", "pc"],
  };

  const [items, setItems] = useState<ItemRow[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [
        {
          name: "Enterprise ERP SaaS Subscription",
          description: "25 Active User Seats with Cloud Backups & Premium Support",
          quantity: 25,
          unit: "seat/mo",
          rate: 1500,
          gstRate: 18,
          amount: 37500,
        },
      ]
  );

  const [gstRate, setGstRate] = useState(initialData?.gstRate !== undefined ? initialData.gstRate : 18);
  const [discount, setDiscount] = useState(initialData?.discount || 0);
  const [transportCharges, setTransportCharges] = useState(initialData?.transportCharges || 0);
  const [transportText, setTransportText] = useState(initialData?.transportText || "");
  const [additionalCharges, setAdditionalCharges] = useState(initialData?.additionalCharges || 0);
  const [terms, setTerms] = useState<string[]>(
    Array.isArray(initialData?.termsAndConditions)
      ? initialData.termsAndConditions
      : (categoryTermsPresets[category] || [
        "GST CHARGE EXTRA",
        "PAYMENT ADVANCE",
      ])
  );

  const [status, setStatus] = useState(initialData?.status || "DRAFT");
  const [newTermInput, setNewTermInput] = useState("");

  // Load masters (customers, products, profile, companies)
  useEffect(() => {
    async function loadMasters() {
      try {
        const [profRes, custRes, prodRes, compRes] = await Promise.all([
          fetch("/api/quotations/profile"),
          fetch("/api/quotations/customers"),
          fetch("/api/quotations/products"),
          fetch("/api/companies"),
        ]);

        const profData = await profRes.json();
        const custData = await custRes.json();
        const prodData = await prodRes.json();
        const compData = await compRes.json();

        if (profData.success && profData.data) {
          const p = profData.data;
          setProfile(p);
          if (!isEdit) {
            setIssuingCompanyInfo({
              name: p.name && p.name !== "AARAM PLASTICS PVT. LTD." ? p.name : "SICCES PRIVATE LIMITED",
              gstin: p.gstin || "09AASCS4608K1ZP",
              cin: p.cin || "",
              address: p.address || "101, Vinayak Complex, Station Road",
              description: p.description || "",
              bankName: p.bankDetails?.bankName || "STATE BANK OF INDIA",
              accountNumber: p.bankDetails?.accountNumber || "",
              ifsc: p.bankDetails?.ifsc || "",
              branch: p.bankDetails?.branch || "",
              prefix: p.prefix && p.prefix !== "APPL" ? p.prefix : "SICCES",
              logo: p.logo || "/sicces-logo.png",
              stampImage: p.stampImage || "",
              signatureImage: p.signatureImage || "",
              bankQrImage: p.bankQrImage || "",
              authorizedSignatory: p.authorizedSignatory || "AUTHORISED SIGNATORY",
              phone: p.phone || "",
              email: p.email || "",
              website: p.website || "",
            });
            if (!initialData?.poNumber && p.prefix) {
              setPoNumber(`${p.prefix && p.prefix !== "APPL" ? p.prefix : "SICCES"}/2026-27`);
            }
          }
          if (!isEdit && !initialData) {
            setTerms(p.defaultTerms || []);
          }
        }
        if (custData.success) setCustomers(custData.data || []);
        if (prodData.success) setProducts(prodData.data || []);
        if (compData.success && Array.isArray(compData.companies)) {
          const comps: CompanyOption[] = compData.companies;
          setCompaniesList(comps);

          if (!isEdit) {
            const siccesComp = comps.find(
              (c) =>
                c.name?.toUpperCase().includes("SICCES") ||
                c.legalName?.toUpperCase().includes("SICCES")
            );

            if (siccesComp) {
              setSelectedCompanyEntityId(siccesComp._id);
              setIssuingCompanyInfo({
                name: siccesComp.legalName || siccesComp.name || "SICCES PRIVATE LIMITED",
                gstin: (siccesComp.gst && siccesComp.gst !== "Not Provided") ? siccesComp.gst : (profData?.data?.gstin || "09AASCS4608K1ZP"),
                cin: profData?.data?.cin || "",
                address: (siccesComp.address && siccesComp.address !== "No listed street, No City, No State, PIN") ? siccesComp.address : (profData?.data?.address || "101, Vinayak Complex, Station Road"),
                description: Array.isArray(siccesComp.brands) && siccesComp.brands.length > 0 ? `Providers for: ${siccesComp.brands.join(", ")}` : (profData?.data?.description || "Providers of Software, Digital Marketing & Educational Services"),
                bankName: siccesComp.bank || profData?.data?.bankDetails?.bankName || "STATE BANK OF INDIA",
                accountNumber: profData?.data?.bankDetails?.accountNumber || "61330464677",
                ifsc: profData?.data?.bankDetails?.ifsc || "SBIN0031792",
                branch: profData?.data?.bankDetails?.branch || "SITAPURA IND. AREA JAIPUR",
                prefix: "SICCES",
                logo: profData?.data?.logo || "/sicces-logo.png",
                stampImage: profData?.data?.stampImage || "",
                signatureImage: profData?.data?.signatureImage || "",
                bankQrImage: profData?.data?.bankQrImage || "",
                authorizedSignatory: profData?.data?.authorizedSignatory || "AUTHORISED SIGNATORY",
                phone: profData?.data?.phone || "0141-4059826",
                email: profData?.data?.email || "info@sicces.com",
                website: profData?.data?.website || "www.sicces.com",
              });
              if (!initialData?.poNumber) {
                setPoNumber("SICCES/2026-27");
              }
            } else if (profData.success && profData.data) {
              const p = profData.data;
              setIssuingCompanyInfo({
                name: p.name && p.name !== "AARAM PLASTICS PVT. LTD." ? p.name : "SICCES PRIVATE LIMITED",
                gstin: p.gstin || "09AASCS4608K1ZP",
                cin: p.cin || "",
                address: p.address || "101, Vinayak Complex, Station Road",
                description: p.description || "",
                bankName: p.bankDetails?.bankName || "STATE BANK OF INDIA",
                accountNumber: p.bankDetails?.accountNumber || "",
                ifsc: p.bankDetails?.ifsc || "",
                branch: p.bankDetails?.branch || "",
                prefix: p.prefix && p.prefix !== "APPL" ? p.prefix : "SICCES",
                logo: p.logo || "/sicces-logo.png",
                stampImage: p.stampImage || "",
                signatureImage: p.signatureImage || "",
                bankQrImage: p.bankQrImage || "",
                authorizedSignatory: p.authorizedSignatory || "AUTHORISED SIGNATORY",
                phone: p.phone || "",
                email: p.email || "",
                website: p.website || "",
              });
              if (!initialData?.poNumber && p.prefix) {
                setPoNumber(`${p.prefix && p.prefix !== "APPL" ? p.prefix : "SICCES"}/2026-27`);
              }
            }
          } else {
            // Edit Mode: detect whether current company matches a preset or is custom
            if (initialData?.companyName) {
              const matched = comps.find(
                (c) =>
                  c.name?.toLowerCase() === initialData.companyName?.toLowerCase() ||
                  c.legalName?.toLowerCase() === initialData.companyName?.toLowerCase()
              );
              if (matched) {
                setSelectedCompanyEntityId(matched._id);
              } else {
                setSelectedCompanyEntityId("OTHER");
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading master data:", err);
      }
    }
    loadMasters();
  }, [isEdit]);

  const handleSelectCompanyEntity = (compId: string) => {
    setSelectedCompanyEntityId(compId);
    if (!compId) {
      if (profile) {
        setIssuingCompanyInfo({
          name: profile.name && profile.name !== "AARAM PLASTICS PVT. LTD." ? profile.name : "SICCES PRIVATE LIMITED",
          gstin: profile.gstin || "09AASCS4608K1ZP",
          cin: profile.cin || "",
          address: profile.address || "101, Vinayak Complex, Station Road",
          description: profile.description || "Providers of Software, Digital Marketing & Educational Services",
          bankName: profile.bankDetails?.bankName || "STATE BANK OF INDIA",
          accountNumber: profile.bankDetails?.accountNumber || "61330464677",
          ifsc: profile.bankDetails?.ifsc || "SBIN0031792",
          branch: profile.bankDetails?.branch || "SITAPURA IND. AREA JAIPUR",
          prefix: profile.prefix && profile.prefix !== "APPL" ? profile.prefix : "SICCES",
          logo: profile.logo || "/sicces-logo.png",
          stampImage: profile.stampImage || "",
          signatureImage: profile.signatureImage || "",
          bankQrImage: profile.bankQrImage || "",
          authorizedSignatory: profile.authorizedSignatory || "AUTHORISED SIGNATORY",
          phone: profile.phone || "0141-4059826",
          email: profile.email || "info@sicces.com",
          website: profile.website || "www.sicces.com",
        });
      }
      return;
    }

    if (compId === "OTHER") {
      setIssuingCompanyInfo({
        name: "",
        gstin: "",
        cin: "",
        address: "",
        description: "",
        bankName: "",
        accountNumber: "",
        ifsc: "",
        branch: "",
        prefix: "CUSTOM",
        logo: "",
        stampImage: "",
        signatureImage: "",
        bankQrImage: "",
        authorizedSignatory: "AUTHORISED SIGNATORY",
        phone: "",
        email: "",
        website: "",
      });
      return;
    }

    const found = companiesList.find((c) => c._id === compId);
    if (found) {
      const generatedPrefix = found.name.toUpperCase().includes("SICCES")
        ? "SICCES"
        : found.name.replace(/[^A-Za-z0-9]/g, "").substring(0, 4).toUpperCase();
      setIssuingCompanyInfo({
        name: found.legalName || found.name || "",
        gstin: (found.gst && found.gst !== "Not Provided") ? found.gst : (profile?.gstin || ""),
        cin: profile?.cin || "",
        address: (found.address && found.address !== "No listed street, No City, No State, PIN") ? found.address : (profile?.address || ""),
        description: Array.isArray(found.brands) && found.brands.length > 0 ? `Providers for: ${found.brands.join(", ")}` : (profile?.description || ""),
        bankName: found.bank || profile?.bankDetails?.bankName || "STATE BANK OF INDIA",
        accountNumber: profile?.bankDetails?.accountNumber || "",
        ifsc: profile?.bankDetails?.ifsc || "",
        branch: profile?.bankDetails?.branch || "",
        prefix: generatedPrefix,
        logo: found.name?.toUpperCase().includes("SICCES") ? "/sicces-logo.png" : (profile?.logo || ""),
        stampImage: profile?.stampImage || "",
        signatureImage: profile?.signatureImage || "",
        bankQrImage: profile?.bankQrImage || "",
        authorizedSignatory: profile?.authorizedSignatory || "AUTHORISED SIGNATORY",
        phone: profile?.phone || "",
        email: profile?.email || "",
        website: profile?.website || "",
      });
      if (found.name) {
        setPoNumber(`${generatedPrefix}/2026-27`);
      }
    }
  };

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
          unit: found.unit || "",
          rate: found.defaultRate || 0,
          gstRate: found.gstRate || 18,
          amount: (found.defaultRate || 0) * 1,
        },
      ]);
      if (Array.isArray(found.defaultTerms) && found.defaultTerms.length > 0) {
        setTerms((prevTerms) => {
          const updated = [...prevTerms];
          found.defaultTerms?.forEach((t: string) => {
            const trimmed = t.trim();
            if (trimmed && !updated.includes(trimmed)) {
              updated.push(trimmed);
            }
          });
          return updated;
        });
      }
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
        unit: "",
        rate: 0,
        gstRate: 18,
        amount: 0,
      },
    ]);
  };

  const parseQtyNum = (val: any): number => {
    if (typeof val === "number") return val;
    if (!val) return 0;
    const str = String(val).trim().toLowerCase();
    const match = str.match(/[\d.]+/);
    if (match) return parseFloat(match[0]);
    const wordsMap: Record<string, number> = {
      one: 1, a: 1, single: 1,
      two: 2, double: 2,
      three: 3, triple: 3,
      four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    };
    for (const [w, n] of Object.entries(wordsMap)) {
      if (str.includes(w)) return n;
    }
    return 0;
  };

  const handleUpdateRow = (index: number, field: keyof ItemRow, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };
      if (field === "quantity" || field === "rate") {
        const qtyVal = field === "quantity" ? value : row.quantity;
        const qty = parseQtyNum(qtyVal);
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

  // Helper to format/convert list lines
  const formatDescriptionList = (idx: number, type: "alpha" | "num" | "bullet") => {
    const current = items[idx]?.description || "";
    const lines = current
      .split("\n")
      .map((l) => l.replace(/^([A-Za-z0-9]+[.)]|[-•*])\s*/, "").trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      if (type === "alpha") handleUpdateRow(idx, "description", "A) ");
      else if (type === "num") handleUpdateRow(idx, "description", "1. ");
      else handleUpdateRow(idx, "description", "• ");
      return;
    }

    const formatted = lines
      .map((line, i) => {
        if (type === "alpha") {
          const letter = String.fromCharCode(65 + (i % 26));
          return `${letter}) ${line}`;
        } else if (type === "num") {
          return `${i + 1}. ${line}`;
        } else {
          return `• ${line}`;
        }
      })
      .join("\n");

    handleUpdateRow(idx, "description", formatted);
  };

  // Smart dynamic line numbering on Shift+Enter / Enter
  const handleDescriptionKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    idx: number
  ) => {
    if (e.key === "Enter") {
      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd, value } = textarea;

      // Extract current line context around the cursor
      const textBefore = value.substring(0, selectionStart);
      const textAfter = value.substring(selectionEnd);
      const lineStart = textBefore.lastIndexOf("\n") + 1;
      const currentLineBefore = textBefore.substring(lineStart);
      const lineEndOffset = textAfter.indexOf("\n");
      const currentLineAfter = lineEndOffset === -1 ? textAfter : textAfter.substring(0, lineEndOffset);
      const fullCurrentLine = currentLineBefore + currentLineAfter;

      // 1. Capital letter prefix: "A) " or "A. "
      const capParen = fullCurrentLine.match(/^([A-Z])\)\s*(.*)$/);
      if (capParen) {
        e.preventDefault();
        const letter = capParen[1];
        const content = capParen[2].trim();
        if (!content && fullCurrentLine.trim() === `${letter})`) {
          // Empty item -> exit list
          const newBefore = textBefore.substring(0, lineStart);
          const newAfter = textAfter.substring(currentLineAfter.length);
          const newVal = newBefore + newAfter;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newBefore.length;
          }, 0);
        } else {
          const nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1);
          const insertion = `\n${nextLetter}) `;
          const newVal = textBefore + insertion + textAfter;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + insertion.length;
          }, 0);
        }
        return;
      }

      const capDot = fullCurrentLine.match(/^([A-Z])\.\s*(.*)$/);
      if (capDot) {
        e.preventDefault();
        const letter = capDot[1];
        const content = capDot[2].trim();
        if (!content && fullCurrentLine.trim() === `${letter}.`) {
          const newBefore = textBefore.substring(0, lineStart);
          const newAfter = textAfter.substring(currentLineAfter.length);
          const newVal = newBefore + newAfter;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newBefore.length;
          }, 0);
        } else {
          const nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1);
          const insertion = `\n${nextLetter}. `;
          const newVal = textBefore + insertion + textAfter;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + insertion.length;
          }, 0);
        }
        return;
      }

      // 2. Numbers prefix: "1. " or "1) "
      const numDot = fullCurrentLine.match(/^(\d+)\.\s*(.*)$/);
      if (numDot) {
        e.preventDefault();
        const num = parseInt(numDot[1], 10);
        const content = numDot[2].trim();
        if (!content && fullCurrentLine.trim() === `${num}.`) {
          const newBefore = textBefore.substring(0, lineStart);
          const newAfter = textAfter.substring(currentLineAfter.length);
          const newVal = newBefore + newAfter;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newBefore.length;
          }, 0);
        } else {
          const insertion = `\n${num + 1}. `;
          const newVal = textBefore + insertion + textAfter;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + insertion.length;
          }, 0);
        }
        return;
      }

      const numParen = fullCurrentLine.match(/^(\d+)\)\s*(.*)$/);
      if (numParen) {
        e.preventDefault();
        const num = parseInt(numParen[1], 10);
        const content = numParen[2].trim();
        if (!content && fullCurrentLine.trim() === `${num})`) {
          const newBefore = textBefore.substring(0, lineStart);
          const newAfter = textAfter.substring(currentLineAfter.length);
          const newVal = newBefore + newAfter;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newBefore.length;
          }, 0);
        } else {
          const insertion = `\n${num + 1}) `;
          const newVal = textBefore + insertion + textAfter;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + insertion.length;
          }, 0);
        }
        return;
      }

      // 3. Lowercase letter prefix: "a) " or "a. "
      const lowParen = fullCurrentLine.match(/^([a-z])\)\s*(.*)$/);
      if (lowParen) {
        e.preventDefault();
        const letter = lowParen[1];
        const content = lowParen[2].trim();
        if (!content && fullCurrentLine.trim() === `${letter})`) {
          const newBefore = textBefore.substring(0, lineStart);
          const newAfter = textAfter.substring(currentLineAfter.length);
          const newVal = newBefore + newAfter;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newBefore.length;
          }, 0);
        } else {
          const nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1);
          const insertion = `\n${nextLetter}) `;
          const newVal = textBefore + insertion + textAfter;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + insertion.length;
          }, 0);
        }
        return;
      }

      // 4. Bullet prefix: "- " or "• " or "* "
      const bullet = fullCurrentLine.match(/^([-•*])\s*(.*)$/);
      if (bullet) {
        e.preventDefault();
        const bChar = bullet[1];
        const content = bullet[2].trim();
        if (!content && fullCurrentLine.trim() === bChar) {
          const newBefore = textBefore.substring(0, lineStart);
          const newAfter = textAfter.substring(currentLineAfter.length);
          const newVal = newBefore + newAfter;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newBefore.length;
          }, 0);
        } else {
          const insertion = `\n${bChar} `;
          const newVal = textBefore + insertion + textAfter;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + insertion.length;
          }, 0);
        }
        return;
      }

      // 5. If user pressed Shift+Enter on an un-prefixed line with text
      if (e.shiftKey && fullCurrentLine.trim().length > 0) {
        e.preventDefault();
        if (textBefore.lastIndexOf("\n") === -1 && !value.includes("\n")) {
          // First line: prefix with A) and create line 2 B)
          const updatedLine1 = `A) ${fullCurrentLine.trim()}`;
          const insertion = `\nB) `;
          const newVal = updatedLine1 + insertion;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newVal.length;
          }, 0);
        } else {
          const allLines = value.split("\n").filter((l) => l.trim().length > 0);
          const nextLetter = String.fromCharCode(65 + Math.min(25, allLines.length));
          const insertion = `\n${nextLetter}) `;
          const newVal = textBefore + insertion + textAfter;
          handleUpdateRow(idx, "description", newVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + insertion.length;
          }, 0);
        }
      }
    }
  };

  // Calculations
  const isPhysicalGoods = category === "PRODUCT";
  const calculatedSubtotal = items.reduce((sum, item) => {
    const qty = parseQtyNum(item.quantity);
    const rt = Number(item.rate) || 0;
    const amt = typeof item.amount === "number" ? item.amount : qty * rt;
    return sum + (amt || 0);
  }, 0);
  const taxableBase = Math.max(0, calculatedSubtotal - Number(discount || 0));
  const safeGstRate = gstRate !== "" && gstRate !== undefined && gstRate !== null ? Number(gstRate) : 0;
  const calculatedGstAmount = (taxableBase * safeGstRate) / 100;
  const effectiveTransportCharges = isPhysicalGoods ? Number(transportCharges || 0) : 0;
  const calculatedGrandTotal = Math.round(
    taxableBase + calculatedGstAmount + effectiveTransportCharges + Number(additionalCharges || 0)
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
      ...(isPo && { supplierName: supplierName.trim() }),
      createdBy: isEdit ? (initialData?.createdBy || user?.name || "Admin") : (user?.name || "Admin"),
      category,
      customCategoryName: customCategoryName.trim().toUpperCase(),
      billingCycle,
      contractPeriod: contractPeriod.trim(),
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
      gstRate: safeGstRate,
      gstAmount: calculatedGstAmount,
      transportCharges: isPhysicalGoods ? Number(transportCharges || 0) : 0,
      transportText: isPhysicalGoods ? transportText.trim() : "",
      additionalCharges: Number(additionalCharges || 0),
      grandTotal: calculatedGrandTotal,
      amountInWords,
      termsAndConditions: terms,
      status,
      companyName: issuingCompanyInfo.name,
      companyGstin: issuingCompanyInfo.gstin,
      companyCin: issuingCompanyInfo.cin,
      companyAddress: issuingCompanyInfo.address,
      companyDescription: issuingCompanyInfo.description,
      companyLogo: issuingCompanyInfo.logo,
      stampImage: issuingCompanyInfo.stampImage,
      signatureImage: issuingCompanyInfo.signatureImage,
      bankQrImage: issuingCompanyInfo.bankQrImage,
      authorizedSignatory: issuingCompanyInfo.authorizedSignatory,
      companyPhone: issuingCompanyInfo.phone || "",
      companyEmail: issuingCompanyInfo.email || "",
      companyWebsite: issuingCompanyInfo.website || "",
      bankDetails: {
        bankName: issuingCompanyInfo.bankName || "",
        accountNumber: issuingCompanyInfo.accountNumber || "",
        ifsc: issuingCompanyInfo.ifsc || "",
        branch: issuingCompanyInfo.branch || "",
        rtgsCode: issuingCompanyInfo.ifsc || "",
      },
    };

    try {
      const endpoint = isPo ? "/api/purchase-orders" : "/api/quotations";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccess(`✓ ${isPo ? "Purchase Order" : "Quotation"} ${isEdit ? "updated" : "created"} successfully!`);
        setTimeout(() => {
          router.push(isPo ? "/purchase-orders" : "/quotations");
        }, 800);
      } else {
        alert("Failed: " + (data.error || "Server error"));
      }
    } catch (err: any) {
      alert(`Error saving ${isPo ? "purchase order" : "quotation"}: ` + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Title Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2 font-sans">
              {isPo
                ? isEdit
                  ? `✏️ Edit Purchase Order (${initialData?.poNumber})`
                  : "📦 Create New Purchase Order"
                : isEdit
                  ? `✏️ Edit Quotation (${initialData?.quotationNumber})`
                  : "📝 Create New Quotation"}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Customizable for Software, Digital Marketing, Physical Goods & Services across Monthly, Quarterly, and Annual billing
            </p>
          </div>
        </div>

        {saveSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl animate-pulse shadow-sm">
            {saveSuccess}
          </div>
        )}

        {/* Section 0: Quotation Category Selector */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm font-sans">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 font-sans">
              1. Offering Category & Industry Type
            </h3>
            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              Selected: {categoryPresets[category]?.label}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            {Object.entries(categoryPresets).map(([catKey, info]) => {
              const isActive = category === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => {
                    setCategory(catKey);
                    setCustomCategoryName(info.label);
                    const profileTerms = profile?.categoryDefaultTerms?.[catKey];
                    if (Array.isArray(profileTerms) && profileTerms.length > 0) {
                      setTerms([...profileTerms]);
                    } else if (categoryTermsPresets[catKey]) {
                      setTerms([...categoryTermsPresets[catKey]]);
                    }
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${isActive
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20 ring-2 ring-indigo-600/30"
                      : "bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-800"
                    }`}
                >
                  <div className="text-2xl">{info.icon}</div>
                  <div>
                    <div className="font-extrabold text-xs">{info.label}</div>
                    <div className={`text-[10px] mt-0.5 font-medium ${isActive ? "text-indigo-100" : "text-slate-500"}`}>
                      Preset units & terms
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Editable Category Name field */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider whitespace-nowrap">
              Category Name / Heading on Quotation PDF:
            </label>
            <input
              type="text"
              value={customCategoryName}
              onChange={(e) => setCustomCategoryName(e.target.value)}
              placeholder="e.g. CUSTOM, TRAINING, HARDWARE, CONSULTING..."
              className="w-full sm:w-80 bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Section 2: Issuing Company (Seller Profile) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm font-sans">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-base">🏢</div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 font-sans">
                  2. Issuing Company (Seller / Brand Profile)
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  This quotation will be created and branded under the seller company entity below
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-600 font-bold">Company:</span>
              <select
                value={selectedCompanyEntityId}
                onChange={(e) => handleSelectCompanyEntity(e.target.value)}
                className="bg-indigo-50/80 border border-indigo-200 text-indigo-950 font-extrabold rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-2xs min-w-[200px]"
              >
                <option value="">-- Default Company Profile --</option>
                {companiesList.map((comp) => (
                  <option key={comp._id} value={comp._id}>
                    {comp.name} {comp.legalName && comp.legalName !== comp.name ? `(${comp.legalName})` : ""}
                  </option>
                ))}
                <option value="OTHER">✨ Other (Enter Custom Details)</option>
              </select>
            </div>
          </div>

          {/* Mode Indicator Banner */}
          <div className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${selectedCompanyEntityId === "OTHER"
              ? "bg-amber-50/80 border-amber-200 text-amber-900"
              : "bg-indigo-50/50 border-indigo-100 text-indigo-900"
            }`}>
            <div className="flex items-center gap-2">
              <span className="text-base">{selectedCompanyEntityId === "OTHER" ? "✍️" : "🏢"}</span>
              <div>
                <span className="font-extrabold">
                  {selectedCompanyEntityId === "OTHER"
                    ? "Custom Company Mode Active:"
                    : `Active Profile: ${issuingCompanyInfo.name || "Default Company"}`}
                </span>
                <span className="text-[11px] opacity-80 block sm:inline sm:ml-2">
                  {selectedCompanyEntityId === "OTHER"
                    ? "Fill in all company details below. They will be saved with this quotation and printed on PDFs."
                    : "You can modify any of the company information fields below specifically for this document."}
                </span>
              </div>
            </div>
            {selectedCompanyEntityId === "OTHER" && (
              <span className="px-2.5 py-0.5 rounded-md bg-amber-200/70 text-amber-900 text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                Other / Custom
              </span>
            )}
          </div>

          {/* Editable Company Fields Grid */}
          <div className="space-y-4">
            {/* Primary Details Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Company / Seller Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={issuingCompanyInfo.name}
                  onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, name: e.target.value })}
                  placeholder="e.g. SICCES PRIVATE LIMITED"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-bold rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Seller GSTIN
                </label>
                <input
                  type="text"
                  value={issuingCompanyInfo.gstin}
                  onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, gstin: e.target.value.toUpperCase() })}
                  placeholder="e.g. 09AASCS4608K1ZP"
                  className="w-full bg-slate-50 border border-slate-200 text-cyan-800 font-mono font-bold rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  CIN / Registration No.
                </label>
                <input
                  type="text"
                  value={issuingCompanyInfo.cin}
                  onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, cin: e.target.value.toUpperCase() })}
                  placeholder="e.g. U25209RJ1996PTC011513"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Doc Prefix (PO/Quotation)
                </label>
                <input
                  type="text"
                  value={issuingCompanyInfo.prefix}
                  onChange={(e) => {
                    const p = e.target.value.toUpperCase();
                    setIssuingCompanyInfo({ ...issuingCompanyInfo, prefix: p });
                    if (!poNumber || poNumber.includes("/2026-27")) {
                      setPoNumber(`${p}/2026-27`);
                    }
                  }}
                  placeholder="e.g. SICCES"
                  className="w-full bg-slate-50 border border-slate-200 text-indigo-700 font-mono font-black text-xs rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Description & Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Line of Business / Services Description
                </label>
                <input
                  type="text"
                  value={issuingCompanyInfo.description}
                  onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, description: e.target.value })}
                  placeholder="e.g. Providers of Software, Digital Marketing & Educational Services"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Registered Office Address
                </label>
                <input
                  type="text"
                  value={issuingCompanyInfo.address}
                  onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, address: e.target.value })}
                  placeholder="e.g. 101, Vinayak Complex, Station Road, Jaipur"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            {/* Contact & Branding */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Company Phone
                </label>
                <input
                  type="text"
                  value={issuingCompanyInfo.phone || ""}
                  onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, phone: e.target.value })}
                  placeholder="e.g. 0141-4059826"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Company Email
                </label>
                <input
                  type="email"
                  value={issuingCompanyInfo.email || ""}
                  onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, email: e.target.value })}
                  placeholder="e.g. info@company.com"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Company Website
                </label>
                <input
                  type="text"
                  value={issuingCompanyInfo.website || ""}
                  onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, website: e.target.value })}
                  placeholder="e.g. www.company.com"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    Company Logo
                  </label>
                  {issuingCompanyInfo.logo && (
                    <button
                      type="button"
                      onClick={() => setIssuingCompanyInfo((prev) => ({ ...prev, logo: "" }))}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                      title="Leave logo blank"
                    >
                      ✕ Blank
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {issuingCompanyInfo.logo ? (
                    <img
                      src={issuingCompanyInfo.logo}
                      alt="Logo"
                      className="h-9 w-9 object-contain rounded-xl border border-slate-200 bg-white p-1 shrink-0 shadow-2xs"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 text-xs shrink-0">
                      🏢
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    className="flex-1 px-3 py-2 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 font-bold rounded-xl border border-indigo-200 text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <span>📤</span>
                    <span>{issuingCompanyInfo.logo ? "Change" : "Upload"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bank Settlement Details */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[10px] font-black uppercase text-indigo-600 block tracking-wider mb-2">
                Settlement Bank Account Details
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={issuingCompanyInfo.bankName || ""}
                    onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, bankName: e.target.value })}
                    placeholder="e.g. STATE BANK OF INDIA"
                    className="w-full bg-slate-50 border border-slate-200 text-emerald-800 font-bold rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={issuingCompanyInfo.accountNumber || ""}
                    onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, accountNumber: e.target.value })}
                    placeholder="e.g. 61330464677"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono font-bold rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    IFSC / RTGS Code
                  </label>
                  <input
                    type="text"
                    value={issuingCompanyInfo.ifsc || ""}
                    onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, ifsc: e.target.value.toUpperCase() })}
                    placeholder="e.g. SBIN0031792"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-mono font-bold rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                    Branch Name / Location
                  </label>
                  <input
                    type="text"
                    value={issuingCompanyInfo.branch || ""}
                    onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, branch: e.target.value })}
                    placeholder="e.g. SITAPURA IND. AREA JAIPUR"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Hidden File Inputs for 4 Verification & Branding Assets */}
            <input
              type="file"
              ref={logoFileInputRef}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => handleAssetUpload(e, "logo", 600)}
              className="hidden"
            />
            <input
              type="file"
              ref={stampFileInputRef}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => handleAssetUpload(e, "stampImage", 500)}
              className="hidden"
            />
            <input
              type="file"
              ref={signatureFileInputRef}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => handleAssetUpload(e, "signatureImage", 500)}
              className="hidden"
            />
            <input
              type="file"
              ref={bankQrFileInputRef}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => handleAssetUpload(e, "bankQrImage", 450)}
              className="hidden"
            />

            {/* Custom Company Verification & Branding Assets Section */}
            <div className={`pt-4 border-t ${selectedCompanyEntityId === "OTHER" ? "border-amber-300" : "border-slate-100"}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{selectedCompanyEntityId === "OTHER" ? "🛡️" : "🎨"}</span>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Company Verification & Branding Assets
                    </span>
                    {selectedCompanyEntityId === "OTHER" && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[10px] border border-amber-300 animate-pulse">
                        Upload Required or Leave Blank
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {selectedCompanyEntityId === "OTHER"
                      ? "Upload the 4 verification assets for this custom company. Any asset left blank will be omitted cleanly from the document and PDF."
                      : "Header logo, official seal stamp, digital signature, and payment QR code for this quotation."}
                  </p>
                </div>

                {selectedCompanyEntityId !== "OTHER" && (
                  <button
                    type="button"
                    onClick={() => setShowAssetsSection((prev) => !prev)}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                  >
                    <span>{showAssetsSection ? "Hide Details" : "View / Customize All 4 Assets"}</span>
                    <span>{showAssetsSection ? "▲" : "▼"}</span>
                  </button>
                )}
              </div>

              {(selectedCompanyEntityId === "OTHER" || showAssetsSection) && (
                <div className="space-y-3">
                  {/* Notice Banner */}
                  <div className="p-3 bg-gradient-to-r from-amber-50/80 via-indigo-50/50 to-slate-50 border border-amber-200 rounded-xl text-xs flex items-start gap-2.5">
                    <span className="text-amber-700 text-base shrink-0 mt-0.5">⚠️</span>
                    <div className="space-y-1">
                      <span className="font-extrabold text-slate-900 block">
                        Custom Company Asset Upload Guide:
                      </span>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Please upload your official files for each of the 4 sections below. If no file is uploaded or you click <span className="font-bold text-rose-600">✕ Leave Blank</span>, that section will be left completely blank on the generated quotation and PDF without any fallback watermark.
                      </p>
                    </div>
                  </div>

                  {/* 4 Assets Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* 1. Company Header Logo */}
                    <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
                            <span>🏢</span>
                            <span>1. Header Logo</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAssetUrlInputs((prev) => ({ ...prev, logo: !prev.logo }))}
                              className="text-[9px] text-indigo-600 hover:underline cursor-pointer font-bold"
                            >
                              {assetUrlInputs.logo ? "Upload" : "URL"}
                            </button>
                            {issuingCompanyInfo.logo && (
                              <button
                                type="button"
                                onClick={() => setIssuingCompanyInfo((prev) => ({ ...prev, logo: "" }))}
                                className="text-[9px] text-rose-600 hover:underline cursor-pointer font-bold"
                                title="Leave logo space completely blank"
                              >
                                ✕ Blank
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Top-left header of quotation
                        </p>
                      </div>

                      {/* Preview Box */}
                      <div className="h-24 w-full rounded-lg border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center p-2 overflow-hidden">
                        {issuingCompanyInfo.logo ? (
                          <img
                            src={issuingCompanyInfo.logo}
                            alt="Header Logo"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <div className="text-center text-slate-400">
                            <span className="block text-xl opacity-40">🏢</span>
                            <span className="text-[10px] italic">Blank / No Logo</span>
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      {assetUrlInputs.logo ? (
                        <input
                          type="text"
                          value={issuingCompanyInfo.logo || ""}
                          onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, logo: e.target.value })}
                          placeholder="Paste Logo URL..."
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:bg-white focus:outline-none"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => logoFileInputRef.current?.click()}
                            className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 text-[11px] cursor-pointer flex items-center justify-center gap-1 transition-colors"
                          >
                            <span>📤</span>
                            <span>{issuingCompanyInfo.logo ? "Change Logo" : "Upload Logo"}</span>
                          </button>
                          {issuingCompanyInfo.logo && (
                            <button
                              type="button"
                              onClick={() => setIssuingCompanyInfo((prev) => ({ ...prev, logo: "" }))}
                              className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg border border-rose-200 text-[11px] cursor-pointer"
                              title="Leave blank"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}

                      {/* Status */}
                      <div className="text-[10px] flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Header Left</span>
                        {issuingCompanyInfo.logo ? (
                          <span className="text-emerald-600 font-bold">✓ Attached</span>
                        ) : (
                          <span className="text-amber-600 font-medium italic">Leave Blank</span>
                        )}
                      </div>
                    </div>

                    {/* 2. Official Seal / Stamp */}
                    <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
                            <span>🔴</span>
                            <span>2. Seal / Stamp</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAssetUrlInputs((prev) => ({ ...prev, stampImage: !prev.stampImage }))}
                              className="text-[9px] text-indigo-600 hover:underline cursor-pointer font-bold"
                            >
                              {assetUrlInputs.stampImage ? "Upload" : "URL"}
                            </button>
                            {issuingCompanyInfo.stampImage && (
                              <button
                                type="button"
                                onClick={() => setIssuingCompanyInfo((prev) => ({ ...prev, stampImage: "" }))}
                                className="text-[9px] text-rose-600 hover:underline cursor-pointer font-bold"
                                title="Leave stamp space completely blank"
                              >
                                ✕ Blank
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Company round/oval stamp
                        </p>
                      </div>

                      {/* Preview Box */}
                      <div className="h-24 w-full rounded-lg border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center p-2 overflow-hidden">
                        {issuingCompanyInfo.stampImage ? (
                          <img
                            src={issuingCompanyInfo.stampImage}
                            alt="Official Stamp"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <div className="text-center text-slate-400">
                            <span className="block text-xl opacity-40">🔴</span>
                            <span className="text-[10px] italic">Blank / No Stamp</span>
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      {assetUrlInputs.stampImage ? (
                        <input
                          type="text"
                          value={issuingCompanyInfo.stampImage || ""}
                          onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, stampImage: e.target.value })}
                          placeholder="Paste Stamp URL..."
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:bg-white focus:outline-none"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => stampFileInputRef.current?.click()}
                            className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 text-[11px] cursor-pointer flex items-center justify-center gap-1 transition-colors"
                          >
                            <span>📤</span>
                            <span>{issuingCompanyInfo.stampImage ? "Change Stamp" : "Upload Stamp"}</span>
                          </button>
                          {issuingCompanyInfo.stampImage && (
                            <button
                              type="button"
                              onClick={() => setIssuingCompanyInfo((prev) => ({ ...prev, stampImage: "" }))}
                              className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg border border-rose-200 text-[11px] cursor-pointer"
                              title="Leave blank"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}

                      {/* Status */}
                      <div className="text-[10px] flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Signature Box</span>
                        {issuingCompanyInfo.stampImage ? (
                          <span className="text-emerald-600 font-bold">✓ Attached</span>
                        ) : (
                          <span className="text-amber-600 font-medium italic">Leave Blank</span>
                        )}
                      </div>
                    </div>

                    {/* 3. Digital Signature (Sign) */}
                    <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
                            <span>✍️</span>
                            <span>3. Digital Signature</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAssetUrlInputs((prev) => ({ ...prev, signatureImage: !prev.signatureImage }))}
                              className="text-[9px] text-indigo-600 hover:underline cursor-pointer font-bold"
                            >
                              {assetUrlInputs.signatureImage ? "Upload" : "URL"}
                            </button>
                            {issuingCompanyInfo.signatureImage && (
                              <button
                                type="button"
                                onClick={() => setIssuingCompanyInfo((prev) => ({ ...prev, signatureImage: "" }))}
                                className="text-[9px] text-rose-600 hover:underline cursor-pointer font-bold"
                                title="Leave signature space completely blank"
                              >
                                ✕ Blank
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          Sign over company stamp
                        </p>
                      </div>

                      {/* Preview Box */}
                      <div className="h-24 w-full rounded-lg border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center p-2 overflow-hidden">
                        {issuingCompanyInfo.signatureImage ? (
                          <img
                            src={issuingCompanyInfo.signatureImage}
                            alt="Digital Signature"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <div className="text-center text-slate-400">
                            <span className="block text-xl opacity-40">✍️</span>
                            <span className="text-[10px] italic">Blank / No Sign</span>
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      {assetUrlInputs.signatureImage ? (
                        <input
                          type="text"
                          value={issuingCompanyInfo.signatureImage || ""}
                          onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, signatureImage: e.target.value })}
                          placeholder="Paste Signature URL..."
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:bg-white focus:outline-none"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => signatureFileInputRef.current?.click()}
                            className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 text-[11px] cursor-pointer flex items-center justify-center gap-1 transition-colors"
                          >
                            <span>📤</span>
                            <span>{issuingCompanyInfo.signatureImage ? "Change Sign" : "Upload Sign"}</span>
                          </button>
                          {issuingCompanyInfo.signatureImage && (
                            <button
                              type="button"
                              onClick={() => setIssuingCompanyInfo((prev) => ({ ...prev, signatureImage: "" }))}
                              className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg border border-rose-200 text-[11px] cursor-pointer"
                              title="Leave blank"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}

                      {/* Status */}
                      <div className="text-[10px] flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Signatory Line</span>
                        {issuingCompanyInfo.signatureImage ? (
                          <span className="text-emerald-600 font-bold">✓ Attached</span>
                        ) : (
                          <span className="text-amber-600 font-medium italic">Leave Blank</span>
                        )}
                      </div>
                    </div>

                    {/* 4. Bank Payment QR Code */}
                    <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
                            <span>📱</span>
                            <span>4. Bank Payment QR</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAssetUrlInputs((prev) => ({ ...prev, bankQrImage: !prev.bankQrImage }))}
                              className="text-[9px] text-indigo-600 hover:underline cursor-pointer font-bold"
                            >
                              {assetUrlInputs.bankQrImage ? "Upload" : "URL"}
                            </button>
                            {issuingCompanyInfo.bankQrImage && (
                              <button
                                type="button"
                                onClick={() => setIssuingCompanyInfo((prev) => ({ ...prev, bankQrImage: "" }))}
                                className="text-[9px] text-rose-600 hover:underline cursor-pointer font-bold"
                                title="Leave Bank QR Code completely blank"
                              >
                                ✕ Blank
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          UPI / Payment QR in bank footer
                        </p>
                      </div>

                      {/* Preview Box */}
                      <div className="h-24 w-full rounded-lg border border-dashed border-slate-200 bg-slate-50/50 flex items-center justify-center p-2 overflow-hidden">
                        {issuingCompanyInfo.bankQrImage ? (
                          <img
                            src={issuingCompanyInfo.bankQrImage}
                            alt="Payment QR Code"
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <div className="text-center text-slate-400">
                            <span className="block text-xl opacity-40">📱</span>
                            <span className="text-[10px] italic">Blank / No QR</span>
                          </div>
                        )}
                      </div>

                      {/* Controls */}
                      {assetUrlInputs.bankQrImage ? (
                        <input
                          type="text"
                          value={issuingCompanyInfo.bankQrImage || ""}
                          onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, bankQrImage: e.target.value })}
                          placeholder="Paste QR URL..."
                          className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:bg-white focus:outline-none"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => bankQrFileInputRef.current?.click()}
                            className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 text-[11px] cursor-pointer flex items-center justify-center gap-1 transition-colors"
                          >
                            <span>📤</span>
                            <span>{issuingCompanyInfo.bankQrImage ? "Change QR" : "Upload QR"}</span>
                          </button>
                          {issuingCompanyInfo.bankQrImage && (
                            <button
                              type="button"
                              onClick={() => setIssuingCompanyInfo((prev) => ({ ...prev, bankQrImage: "" }))}
                              className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-lg border border-rose-200 text-[11px] cursor-pointer"
                              title="Leave blank"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      )}

                      {/* Status */}
                      <div className="text-[10px] flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-slate-400">Bank Footer</span>
                        {issuingCompanyInfo.bankQrImage ? (
                          <span className="text-emerald-600 font-bold">✓ Attached</span>
                        ) : (
                          <span className="text-amber-600 font-medium italic">Leave Blank</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Signatory Title Input */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="w-full sm:w-1/2">
                      <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                        Authorised Signatory Designation / Title
                      </label>
                      <input
                        type="text"
                        value={issuingCompanyInfo.authorizedSignatory}
                        onChange={(e) => setIssuingCompanyInfo({ ...issuingCompanyInfo, authorizedSignatory: e.target.value.toUpperCase() })}
                        placeholder="e.g. AUTHORISED SIGNATORY or MANAGING DIRECTOR"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Basic Information & Billing Cycle */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm font-sans">
          <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2 font-sans">
            3. Basic Information & Billing Schedule
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                {isPo ? "PO #" : "Quotation #"}
              </label>
              <input
                type="text"
                value={quotationNumber}
                onChange={(e) => setQuotationNumber(e.target.value)}
                placeholder="Auto generated"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-xs"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Leave blank for auto-generation</p>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Billing Frequency</label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                className="w-full bg-slate-50 border border-indigo-200 text-indigo-700 font-extrabold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="ONE_TIME">One-Time / Fixed Price</option>
                <option value="MONTHLY">Monthly Recurring</option>
                <option value="QUARTERLY">Quarterly Billing</option>
                <option value="HALF_YEARLY">Half-Yearly (6 Months)</option>
                <option value="YEARLY">Yearly / Annual Contract</option>
                <option value="CUSTOM">Custom Schedule</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Contract / Commitment</label>
              <input
                type="text"
                value={contractPeriod}
                onChange={(e) => setContractPeriod(e.target.value)}
                placeholder="e.g. 12 Months Contract"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Date *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">P.O. / Ref Number</label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="e.g. SW-2026-01"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer font-bold"
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

        {/* Section 4: Consignee & Customer Details */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm font-sans">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 font-sans">
              4. Consignee & Customer Details
            </h3>

            {customers.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-bold">Select Saved Customer:</span>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                  className="bg-slate-50 border border-indigo-200 text-indigo-700 font-bold rounded-xl px-3 py-1 text-xs focus:outline-none cursor-pointer"
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
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                Customer Name / Consignee *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="M/S ARVA ASSOCIATES"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Customer GSTIN</label>
              <input
                type="text"
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value.toUpperCase())}
                placeholder="09AFIPA8247C1ZM"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 uppercase"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Delivery At (Location)</label>
              <input
                type="text"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="CHITRAKOOT"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Full Customer Address</label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="BUNGALOW NO 55 CANTT, SADAR BAZAR, JHANSI"
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        </div>

        {/* Section: Supplier Details (for Purchase Orders) */}
        {isPo && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm font-sans">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 font-sans">
                5. Supplier Details
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Enter Supplier Name..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Product Items Table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm font-sans">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 font-sans">
              5. Items Table
            </h3>

            <div className="flex items-center gap-2 text-xs">
              {products.length > 0 && (
                <select
                  onChange={(e) => {
                    handleAddProductRow(e.target.value);
                    e.target.value = "";
                  }}
                  className="bg-slate-50 border border-emerald-200 text-emerald-700 font-bold rounded-xl px-3 py-1 text-xs focus:outline-none cursor-pointer"
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
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl cursor-pointer"
              >
                + Add Custom Row
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 font-sans">
              <thead className="bg-slate-50/80 text-slate-500 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 w-12 text-center">S.No</th>
                  <th className="px-3 py-3">{categoryPresets[category]?.descHeader || "Description of Items"}</th>
                  <th className="px-3 py-3 w-28 text-center">Qty / Duration</th>
                  <th className="px-3 py-3 w-36 text-center">Unit</th>
                  <th className="px-3 py-3 w-32 text-center">
                    {(() => {
                      const firstUnit = items.find((i) => i.unit && i.unit.trim())?.unit?.trim();
                      if (!firstUnit) return "Rate per unit";
                      if (firstUnit.toLowerCase().startsWith("per ")) {
                        return `Rate ${firstUnit}`;
                      }
                      return `Rate per ${firstUnit}`;
                    })()}
                  </th>
                  <th className="px-3 py-3 w-32 text-right">Amount</th>
                  <th className="px-3 py-3 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2 space-y-1.5 align-top">
                      <input
                        type="text"
                        required
                        value={row.name}
                        onChange={(e) => handleUpdateRow(idx, "name", e.target.value)}
                        placeholder="Item / Module Name"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-bold rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs"
                      />
                      <div className="space-y-1">
                        <textarea
                          rows={Math.max(2, (row.description || "").split("\n").length)}
                          value={row.description}
                          onChange={(e) => handleUpdateRow(idx, "description", e.target.value)}
                          onKeyDown={(e) => handleDescriptionKeyDown(e, idx)}
                          placeholder="Sub description / Specifications (Press Shift+Enter or Enter for next numbered line)"
                          className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-medium rounded-lg px-2.5 py-1.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y leading-relaxed font-sans"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-medium">Format:</span>
                            <button
                              type="button"
                              onClick={() => formatDescriptionList(idx, "alpha")}
                              title="Format all lines as A), B), C)..."
                              className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-bold transition-colors cursor-pointer"
                            >
                              A) B) C)
                            </button>
                            <button
                              type="button"
                              onClick={() => formatDescriptionList(idx, "num")}
                              title="Format all lines as 1., 2., 3...."
                              className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-bold transition-colors cursor-pointer"
                            >
                              1. 2. 3.
                            </button>
                            <button
                              type="button"
                              onClick={() => formatDescriptionList(idx, "bullet")}
                              title="Format all lines with bullet points"
                              className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded font-bold transition-colors cursor-pointer"
                            >
                              • Bullet
                            </button>
                          </div>
                          <span className="text-slate-400 italic text-[9px]">
                            Shift+Enter for next line
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="text"
                        value={row.quantity}
                        onChange={(e) => handleUpdateRow(idx, "quantity", e.target.value)}
                        placeholder="e.g. 2 days or 5"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-bold text-center rounded-lg px-2 py-1.5 focus:bg-white focus:outline-none text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-center space-y-1">
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => handleUpdateRow(idx, "unit", e.target.value)}
                        placeholder="e.g. seat/mo"
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-center rounded-lg px-1.5 py-1.5 focus:bg-white focus:outline-none text-xs font-bold"
                      />
                      <div className="flex flex-wrap gap-1 justify-center">
                        {(unitPresetsPerCategory[category] || unitPresetsPerCategory.PRODUCT).slice(0, 4).map((uPreset) => (
                          <button
                            key={uPreset}
                            type="button"
                            onClick={() => handleUpdateRow(idx, "unit", uPreset)}
                            className="px-1.5 py-0.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-[9px] font-bold rounded-md cursor-pointer transition-colors"
                          >
                            {uPreset}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={row.rate}
                        onChange={(e) => handleUpdateRow(idx, "rate", e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-bold text-center rounded-lg px-2 py-1.5 focus:bg-white focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-black text-emerald-600 text-sm">
                      ₹{row.amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="text-rose-500 hover:text-rose-700 font-bold p-1 cursor-pointer"
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-sans">
          {/* Left Column: Terms & Conditions */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600">
                6. Terms & Conditions
              </h3>
              {categoryTermsPresets[category] && (
                <button
                  type="button"
                  onClick={() => setTerms(categoryTermsPresets[category])}
                  className="px-2.5 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg cursor-pointer transition-colors"
                >
                  ⚡ Reset to {categoryPresets[category]?.label} Terms
                </button>
              )}
            </div>

            <ul className="space-y-2 text-xs">
              {terms.map((t, i) => (
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
                value={newTermInput}
                onChange={(e) => setNewTermInput(e.target.value)}
                placeholder="Add custom term (e.g. PAYMENT ADVANCE)"
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="button"
                onClick={handleAddTerm}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Right Column: Financial Totals Summary */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 border-b border-slate-100 pb-2">
              7. Financial Summary
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-700">
                <span className="font-bold">Items Subtotal:</span>
                <span className="font-extrabold text-slate-900 text-sm">₹{calculatedSubtotal.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span className="font-bold">Discount (₹):</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-32 bg-slate-50 border border-slate-200 text-slate-800 font-bold text-right rounded-lg px-2.5 py-1 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-between items-center text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="font-bold">GST Rate (%):</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={gstRate}
                    onChange={(e) => setGstRate(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-16 bg-slate-50 border border-slate-200 text-slate-800 font-bold text-center rounded-lg px-2 py-1 focus:bg-white focus:outline-none"
                  />
                </div>
                <span className="font-extrabold text-blue-600">₹{calculatedGstAmount.toLocaleString("en-IN")}</span>
              </div>



              <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                <span className="font-black text-slate-900 text-base">Grand Total:</span>
                <span className="font-black text-emerald-600 text-xl">₹{calculatedGrandTotal.toLocaleString("en-IN")}</span>
              </div>

              {/* Amount in Words Display */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-800 font-bold">
                <span className="text-slate-400 uppercase block text-[9px] mb-0.5 font-bold">Amount in words:</span>
                {amountInWords}
              </div>
            </div>
          </div>
        </div>

        {/* Action Bottom Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex justify-end gap-4 shadow-sm">
          <button
            type="button"
            onClick={() => router.push(isPo ? "/purchase-orders" : "/quotations")}
            className="px-6 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
          >
            {loading ? "Saving..." : isEdit ? "Save Changes" : isPo ? "Create Purchase Order" : "Create Quotation"}
          </button>
        </div>
      </form>
    </div>
  );
}
