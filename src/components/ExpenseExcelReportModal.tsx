"use client";

import React, { useState, useEffect, useMemo } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface ExpenseRecord {
  _id: string;
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  paymentMode: string;
  brand?: string;
  company?: string;
  bank?: string;
  expenseType?: "variable" | "fixed";
  recordedBy?: string;
  isRecurring?: boolean;
  remarks?: string;
}

interface ExpenseExcelReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: ExpenseRecord[];
  categories: string[];
  brands: string[];
  companies: string[];
  filters: {
    category: string;
    brand: string;
    company: string;
    datePreset: string;
    startDate: string;
    endDate: string;
    searchQuery: string;
  };
}

// Canvas chart graphics generator for Excel workbook
const generateExpenseChartImages = (expenseList: ExpenseRecord[]) => {
  if (typeof window === "undefined" || !document)
    return { categoryPng: null, paymentPng: null, naturePng: null };

  // 1. CATEGORY SPEND DISTRIBUTION (Horizontal Bar Chart)
  const categoryTotals: Record<string, number> = {};
  expenseList.forEach((e) => {
    const cat = e.category || "Misc";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(e.amount) || 0);
  });

  const sortedCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const canvas1 = document.createElement("canvas");
  canvas1.width = 750;
  canvas1.height = 380;
  const ctx1 = canvas1.getContext("2d");

  if (ctx1) {
    ctx1.fillStyle = "#ffffff";
    ctx1.fillRect(0, 0, canvas1.width, canvas1.height);

    ctx1.fillStyle = "#1e293b";
    ctx1.font = "bold 16px Arial";
    ctx1.fillText("TOP OPERATIONAL EXPENSE CATEGORIES (INR)", 25, 35);

    const maxVal = Math.max(...sortedCategories.map((c) => c[1]), 1);
    const startY = 70;
    const barHeight = 26;
    const gap = 12;

    sortedCategories.forEach(([cat, val], idx) => {
      const y = startY + idx * (barHeight + gap);
      const barWidth = Math.max((val / maxVal) * 450, 10);

      ctx1.fillStyle = "#334155";
      ctx1.font = "bold 12px Arial";
      ctx1.textAlign = "left";
      ctx1.fillText(cat.length > 20 ? cat.substring(0, 18) + "..." : cat, 25, y + 18);

      const grad = ctx1.createLinearGradient(170, y, 170 + barWidth, y);
      grad.addColorStop(0, "#059669");
      grad.addColorStop(1, "#34d399");
      ctx1.fillStyle = grad;

      ctx1.beginPath();
      if ((ctx1 as any).roundRect) {
        (ctx1 as any).roundRect(170, y, barWidth, barHeight, 6);
      } else {
        ctx1.rect(170, y, barWidth, barHeight);
      }
      ctx1.fill();

      ctx1.fillStyle = "#1e293b";
      ctx1.font = "bold 12px Arial";
      ctx1.textAlign = "left";
      ctx1.fillText(`₹${val.toLocaleString("en-IN")}`, 180 + barWidth, y + 18);
    });
  }

  // 2. PAYMENT MODE DONUT CHART
  const paymentTotals: Record<string, number> = {};
  let grandTotal = 0;
  expenseList.forEach((e) => {
    const mode = e.paymentMode || "Cash";
    const amt = Number(e.amount) || 0;
    paymentTotals[mode] = (paymentTotals[mode] || 0) + amt;
    grandTotal += amt;
  });

  const canvas2 = document.createElement("canvas");
  canvas2.width = 600;
  canvas2.height = 350;
  const ctx2 = canvas2.getContext("2d");

  if (ctx2) {
    ctx2.fillStyle = "#ffffff";
    ctx2.fillRect(0, 0, canvas2.width, canvas2.height);

    ctx2.fillStyle = "#1e293b";
    ctx2.font = "bold 16px Arial";
    ctx2.fillText("PAYMENT MODE DISTRIBUTION SHARE", 25, 35);

    const colors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];
    const entries = Object.entries(paymentTotals);
    const centerX = 160;
    const centerY = 190;
    const radius = 100;

    let startAngle = 0;
    entries.forEach(([mode, val], i) => {
      const sliceAngle = grandTotal > 0 ? (val / grandTotal) * 2 * Math.PI : 0;
      const endAngle = startAngle + sliceAngle;
      const color = colors[i % colors.length];

      ctx2.beginPath();
      ctx2.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx2.arc(centerX, centerY, radius * 0.55, endAngle, startAngle, true);
      ctx2.closePath();
      ctx2.fillStyle = color;
      ctx2.fill();

      startAngle = endAngle;

      const legendY = 80 + i * 32;
      ctx2.fillStyle = color;
      ctx2.fillRect(320, legendY, 16, 16);

      const pct = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) : "0.0";
      ctx2.fillStyle = "#334155";
      ctx2.font = "bold 12px Arial";
      ctx2.textAlign = "left";
      ctx2.fillText(`${mode}: ₹${val.toLocaleString("en-IN")} (${pct}%)`, 345, legendY + 13);
    });

    ctx2.fillStyle = "#0f172a";
    ctx2.font = "bold 12px Arial";
    ctx2.textAlign = "center";
    ctx2.fillText("Total Spend", centerX, centerY - 6);
    ctx2.fillStyle = "#10b981";
    ctx2.font = "bold 13px Arial";
    ctx2.fillText(`₹${grandTotal.toLocaleString("en-IN")}`, centerX, centerY + 14);
  }

  // 3. VARIABLE VS FIXED COMPARISON CHART
  let variableTotal = 0;
  let fixedTotal = 0;
  expenseList.forEach((e) => {
    const type = (e.expenseType || "variable").toLowerCase();
    const amt = Number(e.amount) || 0;
    if (type === "fixed") fixedTotal += amt;
    else variableTotal += amt;
  });

  const canvas3 = document.createElement("canvas");
  canvas3.width = 500;
  canvas3.height = 350;
  const ctx3 = canvas3.getContext("2d");

  if (ctx3) {
    ctx3.fillStyle = "#ffffff";
    ctx3.fillRect(0, 0, canvas3.width, canvas3.height);

    ctx3.fillStyle = "#1e293b";
    ctx3.font = "bold 16px Arial";
    ctx3.fillText("VARIABLE VS FIXED EXPENSES", 25, 35);

    const maxNature = Math.max(variableTotal, fixedTotal, 1);
    const chartHeight = 200;
    const baseLine = 280;

    const varH = (variableTotal / maxNature) * chartHeight;
    ctx3.fillStyle = "#ec4899";
    ctx3.beginPath();
    if ((ctx3 as any).roundRect) {
      (ctx3 as any).roundRect(110, baseLine - varH, 90, varH, 8);
    } else {
      ctx3.rect(110, baseLine - varH, 90, varH);
    }
    ctx3.fill();

    ctx3.fillStyle = "#1e293b";
    ctx3.font = "bold 12px Arial";
    ctx3.textAlign = "center";
    ctx3.fillText("Variable", 155, baseLine + 22);
    ctx3.fillText(`₹${variableTotal.toLocaleString("en-IN")}`, 155, baseLine - varH - 10);

    const fixedH = (fixedTotal / maxNature) * chartHeight;
    ctx3.fillStyle = "#6366f1";
    ctx3.beginPath();
    if ((ctx3 as any).roundRect) {
      (ctx3 as any).roundRect(290, baseLine - fixedH, 90, fixedH, 8);
    } else {
      ctx3.rect(290, baseLine - fixedH, 90, fixedH);
    }
    ctx3.fill();

    ctx3.fillStyle = "#1e293b";
    ctx3.font = "bold 12px Arial";
    ctx3.textAlign = "center";
    ctx3.fillText("Fixed", 335, baseLine + 22);
    ctx3.fillText(`₹${fixedTotal.toLocaleString("en-IN")}`, 335, baseLine - fixedH - 10);
  }

  return {
    categoryPng: canvas1 ? canvas1.toDataURL("image/png") : null,
    paymentPng: canvas2 ? canvas2.toDataURL("image/png") : null,
    naturePng: canvas3 ? canvas3.toDataURL("image/png") : null,
  };
};

export default function ExpenseExcelReportModal({
  isOpen,
  onClose,
  expenses,
  categories,
  brands,
  companies,
  filters,
}: ExpenseExcelReportModalProps) {
  // ── Custom Filter Controls ──
  const [selectedCategory, setSelectedCategory] = useState<string>(filters.category || "All");
  const [selectedBrand, setSelectedBrand] = useState<string>(filters.brand || "All Brands");
  const [selectedCompany, setSelectedCompany] = useState<string>(filters.company || "All Companies");
  const [datePreset, setDatePreset] = useState<string>(filters.datePreset || "all");
  const [startDate, setStartDate] = useState<string>(filters.startDate || "");
  const [endDate, setEndDate] = useState<string>(filters.endDate || "");

  // Voucher Row Index Range Controls
  const [startRow, setStartRow] = useState<number>(1);
  const [endRow, setEndRow] = useState<number>(expenses.length || 1);
  const [presetRowRange, setPresetRowRange] = useState<string>("all");

  const [modalExpenses, setModalExpenses] = useState<ExpenseRecord[]>(expenses);
  const [isFetchingModalData, setIsFetchingModalData] = useState<boolean>(false);

  useEffect(() => {
    setSelectedCategory(filters.category || "All");
    setSelectedBrand(filters.brand || "All Brands");
    setSelectedCompany(filters.company || "All Companies");
    setDatePreset(filters.datePreset || "all");
    setStartDate(filters.startDate || "");
    setEndDate(filters.endDate || "");
    setStartRow(1);
    setPresetRowRange("all");
  }, [isOpen, filters]);

  // Fetch expense records dynamically from API backend when modal date range or filters change
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchModalData = async () => {
      setIsFetchingModalData(true);
      try {
        const params = new URLSearchParams();
        if (selectedCategory && selectedCategory !== "All") params.append("category", selectedCategory);
        if (selectedBrand && selectedBrand !== "All Brands" && selectedBrand !== "All") params.append("brand", selectedBrand);
        if (selectedCompany && selectedCompany !== "All Companies" && selectedCompany !== "All") params.append("company", selectedCompany);
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        if (filters.searchQuery) params.append("search", filters.searchQuery);

        const res = await fetch(`/api/expenses?${params.toString()}`);
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.data)) {
          setModalExpenses(data.data);
          setEndRow(data.data.length || 1);
        }
      } catch (err) {
        console.error("Error fetching modal expense records:", err);
      } finally {
        if (isMounted) setIsFetchingModalData(false);
      }
    };

    fetchModalData();

    return () => {
      isMounted = false;
    };
  }, [
    isOpen,
    selectedCategory,
    selectedBrand,
    selectedCompany,
    startDate,
    endDate,
    filters.searchQuery,
  ]);

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      const todayStr = formatDate(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yestStr = formatDate(yesterday);
      setStartDate(yestStr);
      setEndDate(yestStr);
    } else if (preset === "this_week") {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      setStartDate(formatDate(monday));
      setEndDate(formatDate(now));
    } else if (preset === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(now));
    } else if (preset === "last_month") {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(formatDate(firstDayLastMonth));
      setEndDate(formatDate(lastDayLastMonth));
    }
  };

  const handleApplyRowPreset = (preset: string) => {
    setPresetRowRange(preset);
    if (preset === "all") {
      setStartRow(1);
      setEndRow(modalExpenses.length || 1);
    } else if (preset === "1_50") {
      setStartRow(1);
      setEndRow(Math.min(50, modalExpenses.length || 1));
    } else if (preset === "51_100") {
      setStartRow(51);
      setEndRow(Math.min(100, modalExpenses.length || 1));
    } else if (preset === "101_200") {
      setStartRow(101);
      setEndRow(Math.min(200, modalExpenses.length || 1));
    }
  };

  // Calculate Scoped Expenses based on backend API response & row slicing
  const scopedExpenses = useMemo(() => {
    let list = modalExpenses;
    const sIdx = Math.max(1, startRow) - 1;
    const eIdx = Math.min(list.length, endRow || list.length);
    return list.slice(sIdx, eIdx);
  }, [
    modalExpenses,
    startRow,
    endRow,
  ]);

  if (!isOpen) return null;

  const totalAmount = scopedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const variableAmount = scopedExpenses
    .filter((e) => (e.expenseType || "variable").toLowerCase() === "variable")
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const fixedAmount = scopedExpenses
    .filter((e) => (e.expenseType || "").toLowerCase() === "fixed")
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Generate and Download Excel File
  const handleGenerateExcel = async () => {
    if (!scopedExpenses || scopedExpenses.length === 0) {
      alert("No expense records match the selected date range and filters.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CoachFlow ERP";
    workbook.created = new Date();

    // ── SHEET 1: VISUAL ANALYTICS & EXECUTIVE SUMMARY ──────────────────────────
    const summarySheet = workbook.addWorksheet("📊 Executive Summary & Graphs");

    summarySheet.addRow(["COACHFLOW ERP - OPERATIONAL EXPENSE VISUAL ANALYTICS REPORT"]);

    const dateRangeLabel =
      startDate || endDate
        ? `${startDate || "Start"} to ${endDate || "Present"}`
        : datePreset === "all"
        ? "All Time"
        : datePreset.replace("_", " ").toUpperCase();

    summarySheet.addRow([`Report Generated On: ${new Date().toLocaleString("en-IN")}`]);
    summarySheet.addRow([
      `Selected Category: ${selectedCategory || "All Categories"}`,
      `Chosen Date Range: ${dateRangeLabel}`,
    ]);
    summarySheet.addRow([
      `Brand Tag: ${selectedBrand || "All Brands"}`,
      `Company Tag: ${selectedCompany || "All Companies"}`,
    ]);
    summarySheet.addRow([
      `Exported Vouchers Count: ${scopedExpenses.length} of ${expenses.length}`,
    ]);
    summarySheet.addRow([]);

    summarySheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FF059669" } };
    summarySheet.getRow(2).font = { size: 10, color: { argb: "FF64748B" } };
    summarySheet.getRow(3).font = { size: 10, color: { argb: "FF334155" } };
    summarySheet.getRow(4).font = { size: 10, color: { argb: "FF334155" } };
    summarySheet.getRow(5).font = { bold: true, size: 10, color: { argb: "FF047857" } };

    const cashAmount = scopedExpenses
      .filter((e) => (e.paymentMode || "").toLowerCase() === "cash")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const bankAmount = totalAmount - cashAmount;

    // KPI Highlights Grid
    summarySheet.addRow(["1. KEY PERFORMANCE INDICATORS"]);
    summarySheet.getRow(7).font = { bold: true, size: 11, color: { argb: "FF1E293B" } };

    const kpiHeader = summarySheet.addRow([
      "Metric Name",
      "Total Value (INR)",
      "% Share of Total Spend",
      "Transaction Count",
    ]);
    kpiHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    kpiHeader.eachCell(
      (c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } })
    );

    summarySheet.addRow(["Total Operational Expenses", totalAmount, "100.0%", scopedExpenses.length]);
    summarySheet.addRow([
      "Variable Expenses",
      variableAmount,
      totalAmount > 0 ? `${((variableAmount / totalAmount) * 100).toFixed(1)}%` : "0%",
      scopedExpenses.filter((e) => (e.expenseType || "variable").toLowerCase() === "variable").length,
    ]);
    summarySheet.addRow([
      "Fixed Expenses",
      fixedAmount,
      totalAmount > 0 ? `${((fixedAmount / totalAmount) * 100).toFixed(1)}%` : "0%",
      scopedExpenses.filter((e) => (e.expenseType || "").toLowerCase() === "fixed").length,
    ]);
    summarySheet.addRow([
      "Cash Payments",
      cashAmount,
      totalAmount > 0 ? `${((cashAmount / totalAmount) * 100).toFixed(1)}%` : "0%",
      scopedExpenses.filter((e) => (e.paymentMode || "").toLowerCase() === "cash").length,
    ]);
    summarySheet.addRow([
      "Digital / Bank Transfers",
      bankAmount,
      totalAmount > 0 ? `${((bankAmount / totalAmount) * 100).toFixed(1)}%` : "0%",
      scopedExpenses.filter((e) => (e.paymentMode || "").toLowerCase() !== "cash").length,
    ]);

    summarySheet.addRow([]);

    // Category Breakdown Table
    summarySheet.addRow(["2. EXPENSE CATEGORY BREAKDOWN SUMMARY"]);
    summarySheet.getRow(15).font = { bold: true, size: 11, color: { argb: "FF1E293B" } };

    const catHeader = summarySheet.addRow(["Category Name", "Total Billed (INR)", "% Share", "Transactions"]);
    catHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    catHeader.eachCell(
      (c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } })
    );

    const categoryMap: Record<string, { total: number; count: number }> = {};
    scopedExpenses.forEach((e) => {
      const cat = e.category || "Misc";
      if (!categoryMap[cat]) categoryMap[cat] = { total: 0, count: 0 };
      categoryMap[cat].total += Number(e.amount) || 0;
      categoryMap[cat].count += 1;
    });

    Object.entries(categoryMap)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([cat, data]) => {
        const share = totalAmount > 0 ? ((data.total / totalAmount) * 100).toFixed(1) + "%" : "0%";
        summarySheet.addRow([cat, data.total, share, data.count]);
      });

    summarySheet.columns = [
      { width: 32 },
      { width: 22 },
      { width: 22 },
      { width: 18 },
    ];

    // Embed Visual Chart Graphics into Sheet 1
    try {
      const { categoryPng, paymentPng, naturePng } = generateExpenseChartImages(scopedExpenses);

      if (categoryPng) {
        const img1 = workbook.addImage({ base64: categoryPng, extension: "png" });
        summarySheet.addImage(img1, {
          tl: { col: 5, row: 6 },
          ext: { width: 550, height: 280 },
        });
      }

      if (paymentPng) {
        const img2 = workbook.addImage({ base64: paymentPng, extension: "png" });
        summarySheet.addImage(img2, {
          tl: { col: 5, row: 21 },
          ext: { width: 450, height: 260 },
        });
      }

      if (naturePng) {
        const img3 = workbook.addImage({ base64: naturePng, extension: "png" });
        summarySheet.addImage(img3, {
          tl: { col: 10, row: 21 },
          ext: { width: 380, height: 260 },
        });
      }
    } catch (err) {
      console.error("Failed to render canvas chart graphics in Excel export:", err);
    }

    // ── SHEET 2: EXPENSE DETAILED REGISTER (RECORDS SHEET) ──────
    const sheet = workbook.addWorksheet("📋 Expense Detailed Register");

    const headerRow = sheet.addRow([
      "s.no",
      "Date",
      "Category",
      "Description",
      "DEBIT AMOUNT",
      "PAYMENT",
      "Company",
      "Brand",
      "BANK",
      "VARIABLE / FIXED",
      "Remarks",
    ]);

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFB4D7A8" }, // Light green matching standard screenshot
      };
      cell.font = {
        bold: true,
        color: { argb: "FF000000" },
        name: "Arial",
        size: 10,
      };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    });

    scopedExpenses.forEach((exp, idx) => {
      const formattedDate = exp.expenseDate
        ? new Date(exp.expenseDate).toLocaleDateString("en-US", {
            month: "numeric",
            day: "numeric",
            year: "numeric",
          })
        : "";

      const isCash = (exp.paymentMode || "").trim().toLowerCase() === "cash";
      const companyVal = (!isCash && exp.company && exp.company !== "All Companies") ? exp.company : "";
      const brandVal = (exp.brand && exp.brand !== "All Brands") ? exp.brand : "";
      const bankVal = !isCash ? (exp.bank || "") : "";

      const row = sheet.addRow([
        idx + 1,
        formattedDate,
        exp.category || "Misc",
        exp.title || "",
        exp.amount || 0,
        exp.paymentMode || "Cash",
        companyVal,
        brandVal,
        bankVal,
        exp.expenseType || "variable",
        exp.remarks || "",
      ]);

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Arial", size: 10 };
        cell.border = {
          top: { style: "thin", color: { argb: "FF000000" } },
          left: { style: "thin", color: { argb: "FF000000" } },
          bottom: { style: "thin", color: { argb: "FF000000" } },
          right: { style: "thin", color: { argb: "FF000000" } },
        };

        if (colNumber === 5) {
          cell.numFmt = "#,##0";
          cell.alignment = { horizontal: "right" };
        }
      });
    });

    // Add Grand Total Row at bottom of Sheet 2
    const totalRowIndex = scopedExpenses.length + 2;
    const totalRow = sheet.addRow([
      "",
      "",
      "",
      "GRAND TOTAL",
      { formula: `SUM(E2:E${totalRowIndex - 1})` },
      "",
      "",
      "",
      "",
      "",
      "",
    ]);

    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2EFDA" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "double", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
      if (colNumber === 5) {
        cell.numFmt = "₹#,##0";
        cell.alignment = { horizontal: "right" };
      }
    });

    sheet.columns = [
      { width: 8 },  // s.no
      { width: 14 }, // Date
      { width: 24 }, // Category
      { width: 36 }, // Description
      { width: 18 }, // DEBIT AMOUNT
      { width: 14 }, // PAYMENT
      { width: 18 }, // Company
      { width: 16 }, // Brand
      { width: 12 }, // BANK
      { width: 18 }, // VARIABLE / FIXED
      { width: 28 }, // Remarks
    ];

    const safeCatStr = selectedCategory && selectedCategory !== "All" ? `_${selectedCategory.replace(/[^a-zA-Z0-9]/g, "")}` : "";
    const safeDateStr = new Date().toISOString().split("T")[0];
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `Expense_Executive_Report${safeCatStr}_${safeDateStr}.xlsx`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header */}
        <div className="bg-emerald-950 text-white px-6 py-4 flex items-center justify-between shrink-0 border-b border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-black text-base shadow-md">
              📊
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">Excel Custom Date Range Export</h2>
              <p className="text-xs text-emerald-300 font-medium">Choose exact date range, category & filters before generating .xlsx workbook</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center bg-emerald-900 hover:bg-emerald-800 text-emerald-200 hover:text-white rounded-xl transition-colors cursor-pointer text-sm font-bold"
            title="Close Modal"
          >
            ✕
          </button>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="p-6 bg-slate-50 border-b border-slate-200/80 space-y-4">
          {/* Row 1: Date Presets & Custom Dates */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              1. Choose Date Range & Period Preset
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "all", label: "All Dates" },
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "this_week", label: "This Week" },
                { id: "this_month", label: "This Month" },
                { id: "last_month", label: "Last Month" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleDatePresetChange(p.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${
                    datePreset === p.id
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 shrink-0">Start Date:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setDatePreset("custom");
                    setStartDate(e.target.value);
                  }}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer w-full text-right"
                />
              </div>

              <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 shrink-0">End Date:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setDatePreset("custom");
                    setEndDate(e.target.value);
                  }}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer w-full text-right"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Category, Brand, Company Selectors */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
              2. Filter by Category, Brand & Company
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block mb-1">Expense Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-500 block mb-1">Brand Tag:</span>
                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  <option value="All Brands">All Brands</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-500 block mb-1">Company Allocation:</span>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  <option value="All Companies">All Companies</option>
                  {companies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Row 3: Voucher Row Range Selection */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                3. Voucher Row Index Range (Optional Slicing)
              </label>
              <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                {scopedExpenses.length} Vouchers Selected
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                {["all", "1_50", "51_100", "101_200"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleApplyRowPreset(r)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      presetRowRange === r ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {r === "all" ? `All (${expenses.length})` : r.replace("_", "-")}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500">Row:</span>
                <input
                  type="number"
                  min={1}
                  max={expenses.length}
                  value={startRow}
                  onChange={(e) => {
                    setPresetRowRange("custom");
                    setStartRow(Number(e.target.value));
                  }}
                  className="w-12 px-1 py-0.5 text-center font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:outline-none text-xs"
                />
                <span className="text-slate-400 font-bold text-xs">to</span>
                <input
                  type="number"
                  min={1}
                  max={expenses.length}
                  value={endRow}
                  onChange={(e) => {
                    setPresetRowRange("custom");
                    setEndRow(Number(e.target.value));
                  }}
                  className="w-14 px-1 py-0.5 text-center font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:outline-none text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Financial Highlights Preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4">
              <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Scoped Total Spend</span>
              <div className="text-xl font-black text-emerald-700 mt-1">₹{totalAmount.toLocaleString("en-IN")}</div>
              <div className="text-[10px] font-bold text-emerald-600 mt-0.5">{scopedExpenses.length} Vouchers Included</div>
            </div>

            <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4">
              <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider">Variable Expenses</span>
              <div className="text-xl font-black text-purple-700 mt-1">₹{variableAmount.toLocaleString("en-IN")}</div>
              <div className="text-[10px] font-bold text-purple-600 mt-0.5">
                {totalAmount > 0 ? ((variableAmount / totalAmount) * 100).toFixed(1) : 0}% Share
              </div>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4">
              <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wider">Fixed Overhead</span>
              <div className="text-xl font-black text-indigo-700 mt-1">₹{fixedAmount.toLocaleString("en-IN")}</div>
              <div className="text-[10px] font-bold text-indigo-600 mt-0.5">
                {totalAmount > 0 ? ((fixedAmount / totalAmount) * 100).toFixed(1) : 0}% Share
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Workbook Export Structure Summary:</span>
              <span className="text-emerald-600 font-black">2 Sheets Multi-Tab Workbook</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <span>📊 Sheet 1:</span> Executive Summary & Graphs
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Metadata header with selected date range, KPI table, category breakdown table, and 3 embedded visual canvas charts.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <span>📋 Sheet 2:</span> Expense Detailed Register
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Complete voucher transaction register formatted with light green headers (`#B4D7A8`) and a bold `=SUM()` grand total row.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400 font-medium">
            Ready to export <span className="text-emerald-400 font-bold">{scopedExpenses.length} vouchers</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleGenerateExcel}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>Download Excel Workbook (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
