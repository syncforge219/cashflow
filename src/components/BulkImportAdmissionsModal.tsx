"use client";

import React, { useState, useRef, useCallback } from "react";
import ExcelJS from "exceljs";

// ── Column mapping: Excel header → DB field ──────────────────────────────────
const COLUMN_MAP: { header: string; field: string; required: boolean; hint: string }[] = [
  { header: "Full Name",          field: "fullName",           required: false, hint: "Student full name (optional, defaults to Student)" },
  { header: "Mobile Number",      field: "mobileNumber",       required: false, hint: "10-digit mobile (optional)" },
  { header: "Email",              field: "email",              required: false, hint: "Email address" },
  { header: "Address",            field: "address",            required: false, hint: "Full address" },
  { header: "City",               field: "city",               required: false, hint: "City" },
  { header: "State",              field: "state",              required: false, hint: "State" },
  { header: "Pincode",            field: "pincode",            required: false, hint: "6-digit pincode" },
  { header: "Date of Birth",      field: "dob",                required: false, hint: "DD/MM/YYYY" },
  { header: "Gender",             field: "gender",             required: false, hint: "Male / Female / Other" },
  { header: "Counsellor",         field: "counsellor",         required: false, hint: "Counsellor name" },
  { header: "Brand",              field: "brand",              required: false, hint: "Brand name" },
  { header: "Course",             field: "course",             required: false, hint: "Course name" },
  { header: "Batch",              field: "batch",              required: false, hint: "Batch code/name" },
  { header: "Duration",           field: "duration",           required: false, hint: "e.g. 6 Months" },
  { header: "Start Date",         field: "startDate",          required: false, hint: "YYYY-MM-DD" },
  { header: "Academic Year",      field: "academicYear",       required: false, hint: "e.g. 2024-25" },
  { header: "Admission Date",     field: "admissionDate",      required: false, hint: "YYYY-MM-DD" },
  { header: "Company Assigned",   field: "companyAssigned",    required: false, hint: "Company or Cash" },
  { header: "Course Fee",         field: "courseFee",          required: false, hint: "Original fee" },
  { header: "Scholarship Amount", field: "scholarshipAmount",  required: false, hint: "Number" },
  { header: "Discount Amount",    field: "discountAmount",     required: false, hint: "Number" },
  { header: "Additional Discount",field: "additionalDiscount", required: false, hint: "Number" },
  { header: "Total Discount",     field: "totalDiscount",      required: false, hint: "Sum of all discounts" },
  { header: "Final Fee",          field: "finalFee",           required: false, hint: "Fee after discount" },
  { header: "Payment Mode",       field: "paymentMode",        required: false, hint: "UPI / Cash / NEFT etc." },
  { header: "Transaction No",     field: "transactionNo",      required: false, hint: "Txn ID or CASH" },
  { header: "Amount Received",    field: "amountReceivedToday",required: false, hint: "Amount paid at admission" },
  { header: "Payment Date",       field: "paymentDate",        required: false, hint: "YYYY-MM-DD" },
  { header: "Remaining Balance",  field: "remainingBalance",   required: false, hint: "Outstanding amount" },
  { header: "Has EMI",            field: "hasEmi",             required: false, hint: "TRUE / FALSE" },
  { header: "Num Installments",   field: "numInstallments",    required: false, hint: "Number of EMIs" },
  { header: "Installment Amount", field: "installmentAmount",  required: false, hint: "Per EMI amount" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ImportRow = Record<string, any> & { __rowIndex: number };
type RowResult = { index: number; status: "ok" | "error"; admissionId?: string; error?: string };

export default function BulkImportAdmissionsModal({ isOpen, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<RowResult[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Download template ─────────────────────────────────────────────────────
  const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Students Import Template");

    // Header row
    const headers = COLUMN_MAP.map((c) => c.header);
    const headerRow = ws.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });

    // Hint row
    const hintRow = ws.addRow(COLUMN_MAP.map((c) => c.hint));
    hintRow.eachCell((cell) => {
      cell.font = { italic: true, size: 9, color: { argb: "FF888888" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFF" } };
    });

    // Sample data row
    ws.addRow([
      "Rahul Sharma", "+919876543210", "rahul@example.com", "123 Main St", "Nagpur", "Maharashtra", "440001",
      "15/06/1998", "Male", "Priya Counsellor", "Cadd Mantra", "AutoCAD 3D", "BATCH-2024-A", "6 Months",
      "2024-01-15", "2024-25", "2024-01-15", "CT Enterprises", "25000", "0", "2000", "0", "2000",
      "23000", "UPI", "TXN123456", "10000", "2024-01-15", "13000", "TRUE", "3", "4334"
    ]);

    // Column widths
    ws.columns.forEach((col, i) => {
      col.width = Math.max(headers[i].length + 4, 18);
    });

    // Required marker on header row
    COLUMN_MAP.forEach((c, i) => {
      if (c.required) {
        const cell = headerRow.getCell(i + 1);
        cell.value = `${c.header} *`;
      }
    });

    // Download
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "admissions_import_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Parse Excel ───────────────────────────────────────────────────────────
  const parseFile = useCallback(async (file: File) => {
    setParseError(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("No worksheets found in the file.");

      const headers: string[] = [];
      ws.getRow(1).eachCell((cell) => {
        // Strip * from required markers
        headers.push(String(cell.value || "").replace(" *", "").trim());
      });

      // Skip hint row (row 2 looks like a hint if it matches COLUMN_MAP hints)
      const parsedRows: ImportRow[] = [];

      ws.eachRow((row, rowNum) => {
        if (rowNum <= 2) return; // skip header + hint
        const values = row.values as any[];
        // ExcelJS row.values is 1-indexed
        const obj: ImportRow = { __rowIndex: rowNum - 2 };
        let hasData = false;
        headers.forEach((h, colIdx) => {
          const mapping = COLUMN_MAP.find(
            (c) => c.header.toLowerCase().replace(" *", "").trim() === h.toLowerCase().trim()
          );
          const rawVal = values[colIdx + 1];
          const val = rawVal !== null && rawVal !== undefined
            ? (rawVal instanceof Date ? rawVal.toISOString().slice(0, 10) : String(rawVal).trim())
            : "";
          if (val !== "") hasData = true;
          if (mapping) obj[mapping.field] = val;
        });
        if (hasData) parsedRows.push(obj);
      });

      if (parsedRows.length === 0) throw new Error("No data rows found after the header. Please check the template.");
      setRows(parsedRows);
      setStep("preview");
    } catch (err: any) {
      setParseError(err.message || "Failed to parse file.");
    }
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  // ── Run import ─────────────────────────────────────────────────────────────
  const runImport = async () => {
    setIsImporting(true);
    setStep("importing");
    try {
      const payload = rows.map(({ __rowIndex, ...rest }) => rest);
      const res = await fetch("/api/admissions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });
      const json = await res.json();
      setResults(json.results || []);
      setSuccessCount(json.successCount || 0);
      setErrorCount(json.errorCount || 0);
      setStep("done");
      if (json.successCount > 0) onSuccess();
    } catch (err: any) {
      setParseError(err.message);
      setStep("preview");
    } finally {
      setIsImporting(false);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = () => {
    setStep("upload");
    setRows([]);
    setParseError(null);
    setResults([]);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!isOpen) return null;

  // ── Validate rows for preview ──────────────────────────────────────────────
  const requiredFields = COLUMN_MAP.filter((c) => c.required).map((c) => c.field);
  const rowsWithErrors = rows.map((row) => {
    const missing = requiredFields.filter((f) => !row[f] || String(row[f]).trim() === "");
    return { ...row, __errors: missing };
  });
  const validCount = rowsWithErrors.filter((r) => r.__errors.length === 0).length;
  const invalidCount = rowsWithErrors.filter((r) => r.__errors.length > 0).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-indigo-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-800">Import Historical Student Admissions</h2>
              <p className="text-[11px] text-slate-500 font-medium">Upload an Excel file to bulk-import legacy student records into the admissions database.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          {[
            { key: "upload",    label: "1. Upload File" },
            { key: "preview",   label: "2. Preview & Validate" },
            { key: "importing", label: "3. Importing..." },
            { key: "done",      label: "4. Done" },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center">
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full transition-colors ${
                step === s.key ? "bg-indigo-600 text-white" :
                (["upload", "preview", "importing", "done"].indexOf(step) > i) ? "bg-emerald-100 text-emerald-700" :
                "text-slate-400"
              }`}>{s.label}</span>
              {i < 3 && <span className="w-6 text-center text-slate-300 text-xs">›</span>}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── STEP: UPLOAD ─────────────────────────────────────────── */}
          {step === "upload" && (
            <div className="space-y-5">
              {/* Download template */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-indigo-800">📥 Step 1: Download the Import Template</p>
                  <p className="text-xs text-indigo-600 mt-0.5">Fill in your historical student data following the column format and hints in row 2.</p>
                </div>
                <button onClick={downloadTemplate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm ml-4 whitespace-nowrap">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 3v13.5m0 0l-4.5-4.5M12 16.5l4.5-4.5" />
                  </svg>
                  Download Template
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                  isDragging ? "border-indigo-500 bg-indigo-50 scale-[1.01]" : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50"
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 text-emerald-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Drag & drop your Excel file here</p>
                    <p className="text-xs text-slate-400 mt-1">or click to browse  ·  Supports .xlsx and .xls</p>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
              </div>

              {parseError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 flex-shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {parseError}
                </div>
              )}

              {/* Column reference */}
              <details className="border border-slate-200 rounded-xl overflow-hidden">
                <summary className="px-4 py-3 text-xs font-bold text-slate-600 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                  📋 View Required & Optional Columns ({COLUMN_MAP.filter(c => c.required).length} required, {COLUMN_MAP.filter(c => !c.required).length} optional)
                </summary>
                <div className="p-4 grid grid-cols-2 gap-1.5">
                  {COLUMN_MAP.map((c) => (
                    <div key={c.field} className="flex items-center gap-2 text-[11px]">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${c.required ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
                        {c.required ? "REQ" : "OPT"}
                      </span>
                      <span className="font-semibold text-slate-700">{c.header}</span>
                      <span className="text-slate-400 italic">— {c.hint}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {/* ── STEP: PREVIEW ────────────────────────────────────────── */}
          {step === "preview" && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="text-xs font-bold text-slate-600">{fileName}</span>
                </div>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-2 rounded-xl">✓ {validCount} valid rows</span>
                {invalidCount > 0 && (
                  <span className="bg-rose-100 text-rose-700 text-xs font-bold px-3 py-2 rounded-xl">✗ {invalidCount} rows have errors</span>
                )}
                <button onClick={reset} className="ml-auto text-xs text-slate-400 hover:text-slate-600 font-bold underline underline-offset-2">
                  Upload different file
                </button>
              </div>

              {parseError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs font-semibold text-rose-700">{parseError}</div>
              )}

              {/* Preview table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-indigo-600 text-white">
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">#</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Status</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Full Name</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Mobile</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Course</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Batch</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Final Fee</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Paid</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Balance</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Counsellor</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Admission Date</th>
                        <th className="px-3 py-2 text-left font-bold whitespace-nowrap">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsWithErrors.map((row, i) => {
                        const r = row as any;
                        const hasErr = row.__errors.length > 0;
                        return (
                          <tr key={i} className={`border-t border-slate-100 ${hasErr ? "bg-rose-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                            <td className="px-3 py-2 text-slate-400 font-bold">{row.__rowIndex}</td>
                            <td className="px-3 py-2">
                              {hasErr
                                ? <span className="bg-rose-100 text-rose-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded">ERROR</span>
                                : <span className="bg-emerald-100 text-emerald-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded">VALID</span>
                              }
                            </td>
                            <td className="px-3 py-2 font-bold text-slate-800 whitespace-nowrap">{r.fullName || "—"}</td>
                            <td className="px-3 py-2 text-slate-600">{r.mobileNumber || "—"}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.course || "—"}</td>
                            <td className="px-3 py-2 text-slate-600">{r.batch || "—"}</td>
                            <td className="px-3 py-2 font-bold text-slate-800">₹{Number(r.finalFee || 0).toLocaleString("en-IN")}</td>
                            <td className="px-3 py-2 text-emerald-700 font-bold">₹{Number(r.amountReceivedToday || 0).toLocaleString("en-IN")}</td>
                            <td className="px-3 py-2 text-rose-600 font-bold">₹{Number(r.remainingBalance || 0).toLocaleString("en-IN")}</td>
                            <td className="px-3 py-2 text-slate-600">{r.counsellor || "—"}</td>
                            <td className="px-3 py-2 text-slate-500">{r.admissionDate || "—"}</td>
                            <td className="px-3 py-2 text-rose-600 text-[10px]">
                              {hasErr ? row.__errors.join(", ") : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {invalidCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs font-semibold text-amber-800">
                  ⚠️ <strong>{invalidCount} rows have missing required fields</strong> and will be skipped. The remaining {validCount} valid rows will be imported.
                </div>
              )}
            </div>
          )}

          {/* ── STEP: IMPORTING ──────────────────────────────────────── */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-5">
              <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-base font-bold text-slate-700">Importing {rows.length} student records...</p>
              <p className="text-sm text-slate-400">Please don't close this window.</p>
            </div>
          )}

          {/* ── STEP: DONE ───────────────────────────────────────────── */}
          {step === "done" && (
            <div className="space-y-5">
              {/* Result summary */}
              <div className={`rounded-2xl p-6 border ${successCount > 0 ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${successCount > 0 ? "bg-emerald-200" : "bg-rose-200"}`}>
                    {successCount > 0 ? "✅" : "❌"}
                  </div>
                  <div>
                    <p className={`text-base font-extrabold ${successCount > 0 ? "text-emerald-800" : "text-rose-800"}`}>
                      Import {successCount > 0 ? "Completed" : "Failed"}
                    </p>
                    <p className={`text-sm font-semibold ${successCount > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {successCount} records imported successfully · {errorCount} failed
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="bg-white rounded-xl px-5 py-3 text-center shadow-sm border border-emerald-100">
                    <p className="text-2xl font-extrabold text-emerald-600">{successCount}</p>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">Imported</p>
                  </div>
                  <div className="bg-white rounded-xl px-5 py-3 text-center shadow-sm border border-rose-100">
                    <p className="text-2xl font-extrabold text-rose-500">{errorCount}</p>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">Failed</p>
                  </div>
                </div>
              </div>

              {/* Error details */}
              {errorCount > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-rose-50 px-4 py-2 border-b border-slate-200">
                    <p className="text-xs font-bold text-rose-700">Failed Row Details</p>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {results.filter((r) => r.status === "error").map((r) => (
                      <div key={r.index} className="px-4 py-2 border-b border-slate-100 last:border-0 flex items-start gap-3">
                        <span className="bg-rose-100 text-rose-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded mt-0.5">Row {r.index + 1}</span>
                        <span className="text-xs text-slate-600">{r.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          <button onClick={onClose} className="text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors px-4 py-2">
            {step === "done" ? "Close" : "Cancel"}
          </button>

          <div className="flex gap-3">
            {step === "preview" && (
              <>
                <button onClick={reset} className="text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-4 py-2 rounded-xl transition-colors">
                  ← Back
                </button>
                <button
                  onClick={runImport}
                  disabled={validCount === 0}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-6 py-2 rounded-xl transition-colors shadow-sm shadow-indigo-500/20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Import {validCount} Records
                </button>
              </>
            )}
            {step === "done" && successCount > 0 && (
              <button onClick={reset} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-5 py-2 rounded-xl transition-colors">
                Import Another File
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
