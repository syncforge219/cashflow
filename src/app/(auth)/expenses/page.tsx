"use client";

import React, { useState, useEffect, useMemo } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import Sidebar from "@/components/Sidebar";
import ProfileDisplay from "@/components/ProfileDisplay";
import { useUser } from "@/app/component/context/user-context";
import CfoSecurityGuard from "@/components/CfoSecurityGuard";
import ExpensePdfReportModal from "@/components/ExpensePdfReportModal";
import { TableSkeleton, CardSkeleton } from "@/components/Skeleton";

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
  recurringFrequency?: string;
  nextRecurringDate?: string;
  remarks?: string;
}

const EXPENSE_CATEGORIES = [
  "Construction",
  "Maintenance/repairs",
  "Nagar Nigam",
  "University Expenses",
  "Salaries",
  "Digital marketing",
  "Ads Recharge",
  "Electricity",
  "Loan",
  "Rent",
  "Misc Expense",
  "Stationary",
  "Mobile",
  "Internet",
  "Gunjan",
  "Tarang",
  "Pending Payment",
  "Advance",
  "GST",
  "Vendor Payment",
  "Income Tax",
  "TDS",
  "Bank Charges",
  "Deposit",
  "Audit Fees",
  "General Expenses",
  "Office Expenses",
  "Over Time",
  "Diesel / Petrol",
  "Course Material",
  "Temple / Pooja",
  "Refund",
  "Incentive",
  "Printing",
  "Furniture",
  "Training",
  "Pantry Expenses",
  "Petty Cash",
  "Marketing",
  "Conveyance",
  "Internal Transfer",
  "Computer Rental",
  "Credit Card",
  "Travel",
  "Maintenance",
  "Pending Salary",
  "Legal",
];

interface TooltipItem {
  name: string;
  value: number;
  pct?: string;
  category?: string;
}

function SvgDonutChart({
  data,
  size = 210,
  innerRadiusRatio = 0.65,
  onHover,
  onLeave,
}: {
  data: { name: string; value: number; color: string }[];
  size?: number;
  innerRadiusRatio?: number;
  onHover: (item: TooltipItem, e: React.MouseEvent) => void;
  onLeave: () => void;
}) {
  const total = data.reduce((sum, d) => sum + Math.max(0, d.value), 0) || 1;
  let accumulatedAngle = 0;

  const radius = size / 2 - 10;
  const innerRadius = radius * innerRadiusRatio;
  const center = size / 2;

  const slices = data.map((d) => {
    const angle = (Math.max(0, d.value) / total) * 360;
    const startAngle = accumulatedAngle;
    const endAngle = accumulatedAngle + angle;
    accumulatedAngle += angle;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1Out = center + radius * Math.cos(startRad);
    const y1Out = center + radius * Math.sin(startRad);
    const x2Out = center + radius * Math.cos(endRad);
    const y2Out = center + radius * Math.sin(endRad);

    const x1In = center + innerRadius * Math.cos(endRad);
    const y1In = center + innerRadius * Math.sin(endRad);
    const x2In = center + innerRadius * Math.cos(startRad);
    const y2In = center + innerRadius * Math.sin(startRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData =
      angle >= 359.9
        ? `M ${center - radius}, ${center} A ${radius},${radius} 0 1,0 ${center + radius},${center} A ${radius},${radius} 0 1,0 ${center - radius},${center}`
        : `M ${x1Out},${y1Out} A ${radius},${radius} 0 ${largeArcFlag},1 ${x2Out},${y2Out} L ${x1In},${y1In} A ${innerRadius},${innerRadius} 0 ${largeArcFlag},0 ${x2In},${y2In} Z`;

    return { ...d, pathData, pct: ((d.value / total) * 100).toFixed(1) };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-md">
          {slices.map((slice, idx) => (
            <path
              key={idx}
              d={slice.pathData}
              fill={slice.color}
              className="transition-all duration-200 hover:opacity-80 hover:scale-105 transform origin-center cursor-pointer"
              onMouseEnter={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "ALLOCATION" }, e)}
              onMouseMove={(e) => onHover({ name: slice.name, value: slice.value, pct: slice.pct, category: "ALLOCATION" }, e)}
              onMouseLeave={onLeave}
            />
          ))}
        </svg>
        <div className="absolute flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL</span>
          <span className="text-sm font-black text-indigo-600">₹{(total / 100000).toFixed(1)}L</span>
        </div>
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isCfo =
    user?.role?.toLowerCase() === "cfo" ||
    user?.role?.toLowerCase() === "finance manager" ||
    user?.role?.toLowerCase() === "finance executive";

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedBrand, setSelectedBrand] = useState("All Brands");
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("All Companies");
  const [companies, setCompanies] = useState<string[]>([]);
  const [rawBrands, setRawBrands] = useState<any[]>([]);
  const [rawCompanies, setRawCompanies] = useState<any[]>([]);
  const getInitialThisMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return {
      preset: "this_month",
      start: `${year}-${month}-01`,
      end: `${year}-${month}-${day}`,
    };
  };

  const initMonth = getInitialThisMonth();
  const [datePreset, setDatePreset] = useState(initMonth.preset);
  const [startDateFilter, setStartDateFilter] = useState(initMonth.start);
  const [endDateFilter, setEndDateFilter] = useState(initMonth.end);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

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
      setStartDateFilter("");
      setEndDateFilter("");
    } else if (preset === "today") {
      const todayStr = formatDate(now);
      setStartDateFilter(todayStr);
      setEndDateFilter(todayStr);
    } else if (preset === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yestStr = formatDate(yesterday);
      setStartDateFilter(yestStr);
      setEndDateFilter(yestStr);
    } else if (preset === "this_week") {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      setStartDateFilter(formatDate(monday));
      setEndDateFilter(formatDate(now));
    } else if (preset === "this_month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDateFilter(formatDate(firstDay));
      setEndDateFilter(formatDate(now));
    } else if (preset === "last_month") {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDateFilter(formatDate(firstDayLastMonth));
      setEndDateFilter(formatDate(lastDayLastMonth));
    } else if (preset === "custom") {
      // keep user selected custom values
    }
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "Construction",
    amount: "",
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMode: "UPI",
    brand: "All Brands",
    company: "All Companies",
    bank: "",
    expenseType: "variable",
    isRecurring: false,
    recurringFrequency: "Monthly",
    remarks: "",
  });

  const handleOpenCreateModal = () => {
    setEditingExpenseId(null);
    setFormData({
      title: "",
      category: "Construction",
      amount: "",
      expenseDate: new Date().toISOString().slice(0, 10),
      paymentMode: "UPI",
      brand: "All Brands",
      company: "All Companies",
      bank: "",
      expenseType: "variable",
      isRecurring: false,
      recurringFrequency: "Monthly",
      remarks: "",
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (expense: ExpenseRecord) => {
    setEditingExpenseId(expense._id);
    setFormData({
      title: expense.title || "",
      category: expense.category || "Misc Expense",
      amount: expense.amount ? String(expense.amount) : "",
      expenseDate: expense.expenseDate ? new Date(expense.expenseDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      paymentMode: expense.paymentMode || "UPI",
      brand: expense.brand || "All Brands",
      company: expense.company || "All Companies",
      bank: expense.bank || "",
      expenseType: expense.expenseType || "variable",
      isRecurring: Boolean(expense.isRecurring),
      recurringFrequency: expense.recurringFrequency || "Monthly",
      remarks: expense.remarks || "",
    });
    setIsModalOpen(true);
  };

  // Canvas chart graphics generator for Excel workbook
  const generateExpenseChartImages = (expenseList: any[]) => {
    if (typeof window === "undefined" || !document) return { categoryPng: null, paymentPng: null, naturePng: null };

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
        grad.addColorStop(0, "#4f46e5");
        grad.addColorStop(1, "#818cf8");
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

  // Excel Report Generator with Visual Analytics & Graphs
  const handleExportExcel = async () => {
    if (!expenses || expenses.length === 0) {
      alert("No expense records available to export.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CoachFlow ERP";
    workbook.created = new Date();

    // ── SHEET 1: VISUAL ANALYTICS & EXECUTIVE SUMMARY ──────────────────────────
    const summarySheet = workbook.addWorksheet("📊 Executive Summary & Graphs");

    summarySheet.addRow(["COACHFLOW ERP - OPERATIONAL EXPENSE VISUAL ANALYTICS REPORT"]);
    summarySheet.addRow([`Report Generated On: ${new Date().toLocaleString("en-IN")}`, `Total Records: ${expenses.length}`]);
    summarySheet.addRow([]);

    summarySheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FF4F46E5" } };
    summarySheet.getRow(2).font = { size: 10, color: { argb: "FF64748B" } };

    const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const variableAmount = expenses
      .filter((e) => (e.expenseType || "variable").toLowerCase() === "variable")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const fixedAmount = expenses
      .filter((e) => (e.expenseType || "").toLowerCase() === "fixed")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const cashAmount = expenses
      .filter((e) => (e.paymentMode || "").toLowerCase() === "cash")
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const bankAmount = totalAmount - cashAmount;

    // KPI Highlights Grid
    summarySheet.addRow(["1. KEY PERFORMANCE INDICATORS"]);
    summarySheet.getRow(4).font = { bold: true, size: 11, color: { argb: "FF1E293B" } };

    const kpiHeader = summarySheet.addRow([
      "Metric Name",
      "Total Value (INR)",
      "% Share of Total Spend",
      "Transaction Count",
    ]);
    kpiHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    kpiHeader.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } }));

    summarySheet.addRow(["Total Operational Expenses", totalAmount, "100.0%", expenses.length]);
    summarySheet.addRow([
      "Variable Expenses",
      variableAmount,
      totalAmount > 0 ? `${((variableAmount / totalAmount) * 100).toFixed(1)}%` : "0%",
      expenses.filter((e) => (e.expenseType || "variable").toLowerCase() === "variable").length,
    ]);
    summarySheet.addRow([
      "Fixed Expenses",
      fixedAmount,
      totalAmount > 0 ? `${((fixedAmount / totalAmount) * 100).toFixed(1)}%` : "0%",
      expenses.filter((e) => (e.expenseType || "").toLowerCase() === "fixed").length,
    ]);
    summarySheet.addRow([
      "Cash Payments",
      cashAmount,
      totalAmount > 0 ? `${((cashAmount / totalAmount) * 100).toFixed(1)}%` : "0%",
      expenses.filter((e) => (e.paymentMode || "").toLowerCase() === "cash").length,
    ]);
    summarySheet.addRow([
      "Digital / Bank Transfers",
      bankAmount,
      totalAmount > 0 ? `${((bankAmount / totalAmount) * 100).toFixed(1)}%` : "0%",
      expenses.filter((e) => (e.paymentMode || "").toLowerCase() !== "cash").length,
    ]);

    summarySheet.addRow([]);

    // Category Breakdown Table
    summarySheet.addRow(["2. EXPENSE CATEGORY BREAKDOWN SUMMARY"]);
    summarySheet.getRow(12).font = { bold: true, size: 11, color: { argb: "FF1E293B" } };

    const catHeader = summarySheet.addRow(["Category Name", "Total Billed (INR)", "% Share", "Transactions"]);
    catHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    catHeader.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } }));

    const categoryMap: Record<string, { total: number; count: number }> = {};
    expenses.forEach((e) => {
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
      const { categoryPng, paymentPng, naturePng } = generateExpenseChartImages(expenses);

      if (categoryPng) {
        const img1 = workbook.addImage({ base64: categoryPng, extension: "png" });
        summarySheet.addImage(img1, {
          tl: { col: 5, row: 3 },
          ext: { width: 550, height: 280 },
        });
      }

      if (paymentPng) {
        const img2 = workbook.addImage({ base64: paymentPng, extension: "png" });
        summarySheet.addImage(img2, {
          tl: { col: 5, row: 18 },
          ext: { width: 450, height: 260 },
        });
      }

      if (naturePng) {
        const img3 = workbook.addImage({ base64: naturePng, extension: "png" });
        summarySheet.addImage(img3, {
          tl: { col: 10, row: 18 },
          ext: { width: 380, height: 260 },
        });
      }
    } catch (err) {
      console.error("Failed to render canvas chart graphics in Excel export:", err);
    }

    // ── SHEET 2: EXPENSE DETAILED REGISTER (EXACT USER SCREENSHOT FORMAT) ──────
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
    ]);

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFB4D7A8" }, // Light green matching screenshot
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

    expenses.forEach((exp, idx) => {
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
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `Expense_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  useEffect(() => {
    fetch("/api/brands")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.brands)) {
          setRawBrands(data.brands);
          const names = data.brands.map((b: any) => b.name).filter(Boolean);
          setBrands(names);
        }
      })
      .catch((err) => console.error("Failed to fetch brands:", err));

    fetch("/api/companies")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.companies)) {
          setRawCompanies(data.companies);
          const names = data.companies.map((c: any) => c.name).filter(Boolean);
          setCompanies(names);
        }
      })
      .catch((err) => console.error("Failed to fetch companies:", err));
  }, []);

  const deduplicateCompanies = (list: string[]) => {
    const map = new Map<string, string>();
    list.forEach((orig) => {
      if (!orig || !orig.trim()) return;
      const name = orig.trim().toUpperCase();
      const key = name
        .replace(/[^A-Z0-9]/g, "")
        .replace(/PRIVATELIMITED/g, "PVTLTD")
        .replace(/PVTLIMITED/g, "PVTLTD")
        .replace(/LIMITED/g, "LTD")
        .replace(/SERVICES/g, "")
        .replace(/GATEEWAY/g, "GATEWAY")
        .replace(/LLP/g, "");

      if (!key) return;

      if (!map.has(key)) {
        map.set(key, name);
      } else {
        const existing = map.get(key)!;
        if (name.length > existing.length) {
          map.set(key, name);
        }
      }
    });
    return Array.from(map.values()).sort();
  };

  const getLinkedCompaniesForBrand = (targetBrand: string) => {
    const allUniqueCompanies = new Set<string>();

    // Add companies from rawCompanies
    rawCompanies.forEach((c: any) => {
      if (c.name) allUniqueCompanies.add(c.name.trim());
      if (c.legalName) allUniqueCompanies.add(c.legalName.trim());
    });

    // Add companies from companies state
    companies.forEach((cn) => {
      if (cn) allUniqueCompanies.add(cn.trim());
    });

    // Add companies from rawBrands
    rawBrands.forEach((b: any) => {
      if (Array.isArray(b.companies)) {
        b.companies.forEach((cn: string) => {
          if (cn) allUniqueCompanies.add(cn.trim());
        });
      }
      if (Array.isArray(b.legalEntities)) {
        b.legalEntities.forEach((le: any) => {
          const leName = typeof le === "string" ? le : le?.name;
          if (leName) allUniqueCompanies.add(leName.trim());
        });
      }
    });

    const allCompaniesList = deduplicateCompanies(Array.from(allUniqueCompanies));

    if (!targetBrand || targetBrand === "All Brands" || targetBrand === "ALL BRANDS" || targetBrand === "All") {
      return allCompaniesList;
    }

    const linkedNames = new Set<string>();

    rawCompanies.forEach((c: any) => {
      const cName = c.name;
      const cBrand = c.brand;
      const cBrands = Array.isArray(c.brands) ? c.brands : [];

      if (
        cBrand?.trim().toLowerCase() === targetBrand.trim().toLowerCase() ||
        cBrands.some((b: string) => b.trim().toLowerCase() === targetBrand.trim().toLowerCase())
      ) {
        if (cName) linkedNames.add(cName.trim());
      }
    });

    const brandObj = rawBrands.find(
      (b) => b.name?.trim().toLowerCase() === targetBrand.trim().toLowerCase()
    );

    if (brandObj) {
      if (Array.isArray(brandObj.companies)) {
        brandObj.companies.forEach((cn: string) => {
          if (cn) linkedNames.add(cn.trim());
        });
      }
      if (Array.isArray(brandObj.legalEntities)) {
        brandObj.legalEntities.forEach((le: any) => {
          const leName = typeof le === "string" ? le : le?.name;
          if (leName) linkedNames.add(leName.trim());
        });
      }
    }

    const deduplicatedLinked = deduplicateCompanies(Array.from(linkedNames));
    return deduplicatedLinked.length > 0 ? deduplicatedLinked : allCompaniesList;
  };

  const availableFilterCompanies = getLinkedCompaniesForBrand(selectedBrand);
  const availableFormCompanies = getLinkedCompaniesForBrand(formData.brand);

  const getBankForCompany = (compName: string) => {
    if (!compName || compName === "All Companies" || compName === "All") return "";
    const found = rawCompanies.find(
      (c) => c.name?.trim().toLowerCase() === compName.trim().toLowerCase()
    );
    return found?.bank || found?.bankName || "";
  };

  const availableCompanyBanks = Array.from<string>(
    rawCompanies
      .map((c) => c.bank || c.bankName)
      .filter((b) => Boolean(b) && b !== "Not Provided")
      .reduce((map, b) => {
        const key = b.trim().toLowerCase();
        if (!map.has(key)) map.set(key, b.trim());
        return map;
      }, new Map<string, string>()).values()
  );

  const handlePaymentModeChangeInForm = (newMode: string) => {
    if (newMode === "Cash") {
      setFormData((prev) => ({
        ...prev,
        paymentMode: newMode,
        company: "All Companies",
        bank: "",
      }));
    } else {
      setFormData((prev) => {
        const compBank = getBankForCompany(prev.company);
        return {
          ...prev,
          paymentMode: newMode,
          bank: compBank || prev.bank,
        };
      });
    }
  };

  const handleCompanyChangeInForm = (newCompany: string) => {
    if (formData.paymentMode === "Cash") {
      setFormData((prev) => ({
        ...prev,
        company: "All Companies",
        bank: "",
      }));
      return;
    }
    const compBank = getBankForCompany(newCompany);
    setFormData((prev) => ({
      ...prev,
      company: newCompany,
      bank: compBank || (newCompany === "All Companies" ? "" : prev.bank),
    }));
  };

  const handleBrandChangeInForm = (newBrand: string) => {
    const linked = getLinkedCompaniesForBrand(newBrand);
    let newCompany = "All Companies";
    if (linked.length === 1) {
      newCompany = linked[0];
    } else if (linked.length > 1) {
      newCompany = linked.includes(formData.company) ? formData.company : linked[0];
    }

    if (formData.paymentMode === "Cash") {
      setFormData((prev) => ({
        ...prev,
        brand: newBrand,
        company: "All Companies",
        bank: "",
      }));
      return;
    }

    const compBank = getBankForCompany(newCompany);
    setFormData((prev) => ({
      ...prev,
      brand: newBrand,
      company: newCompany,
      bank: compBank || (newCompany === "All Companies" ? "" : prev.bank),
    }));
  };

  useEffect(() => {
    if (formData.paymentMode === "Cash") {
      if (formData.company !== "All Companies" || formData.bank !== "") {
        setFormData((prev) => ({ ...prev, company: "All Companies", bank: "" }));
      }
    } else if (formData.company && formData.company !== "All Companies" && rawCompanies.length > 0) {
      const compBank = getBankForCompany(formData.company);
      if (compBank && formData.bank !== compBank) {
        setFormData((prev) => ({ ...prev, bank: compBank }));
      }
    }
  }, [formData.paymentMode, formData.company, rawCompanies]);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      let url = "/api/expenses";
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "All") params.append("category", selectedCategory);
      if (selectedBrand && selectedBrand !== "All Brands" && selectedBrand !== "All") params.append("brand", selectedBrand);
      if (selectedCompany && selectedCompany !== "All Companies" && selectedCompany !== "All") params.append("company", selectedCompany);
      if (startDateFilter) params.append("startDate", startDateFilter);
      if (endDateFilter) params.append("endDate", endDateFilter);
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
  }, [selectedCategory, selectedBrand, selectedCompany, startDateFilter, endDateFilter, searchQuery]);

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
      const url = editingExpenseId ? `/api/expenses?id=${editingExpenseId}` : "/api/expenses";
      const method = editingExpenseId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          _id: editingExpenseId,
          recordedBy: user?.name || "Admin",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setEditingExpenseId(null);
        setFormData({
          title: "",
          category: "Construction",
          amount: "",
          expenseDate: new Date().toISOString().slice(0, 10),
          paymentMode: "UPI",
          brand: "All Brands",
          company: "All Companies",
          bank: "",
          expenseType: "variable",
          isRecurring: false,
          recurringFrequency: "Monthly",
          remarks: "",
        });
        fetchExpenses();
      } else {
        alert(data.message || "Failed to save expense entry.");
      }
    } catch (err) {
      console.error("Error saving expense:", err);
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

  // Filter expenses locally for real-time live search & filtering
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // 1. Search Query Filter (checks title, category, brand, company, paymentMode, bank, remarks, amount)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (e.title || "").toLowerCase().includes(q);
        const matchCategory = (e.category || "").toLowerCase().includes(q);
        const matchBrand = (e.brand || "").toLowerCase().includes(q);
        const matchCompany = (e.company || "").toLowerCase().includes(q);
        const matchPayment = (e.paymentMode || "").toLowerCase().includes(q);
        const matchBank = (e.bank || "").toLowerCase().includes(q);
        const matchRemarks = (e.remarks || "").toLowerCase().includes(q);
        const matchAmount = String(e.amount || "").includes(q);

        if (!matchTitle && !matchCategory && !matchBrand && !matchCompany && !matchPayment && !matchBank && !matchRemarks && !matchAmount) {
          return false;
        }
      }

      // 2. Category Filter
      if (selectedCategory && selectedCategory !== "All") {
        if ((e.category || "").toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
      }

      // 3. Brand Filter
      if (selectedBrand && selectedBrand !== "All Brands" && selectedBrand !== "All") {
        if ((e.brand || "").toLowerCase() !== selectedBrand.toLowerCase()) {
          return false;
        }
      }

      // 4. Company Filter
      if (selectedCompany && selectedCompany !== "All Companies" && selectedCompany !== "All") {
        if ((e.company || "").toLowerCase() !== selectedCompany.toLowerCase()) {
          return false;
        }
      }

      // 5. Date Range Filter
      if (startDateFilter) {
        const expenseTime = new Date(e.expenseDate).setHours(0, 0, 0, 0);
        const startTime = new Date(startDateFilter).setHours(0, 0, 0, 0);
        if (expenseTime < startTime) return false;
      }
      if (endDateFilter) {
        const expenseTime = new Date(e.expenseDate).setHours(23, 59, 59, 999);
        const endTime = new Date(endDateFilter).setHours(23, 59, 59, 999);
        if (expenseTime > endTime) return false;
      }

      return true;
    });
  }, [expenses, searchQuery, selectedCategory, selectedBrand, selectedCompany, startDateFilter, endDateFilter]);

  // Summary Metrics
  const totalExpenseSum = filteredExpenses.reduce((acc, cur) => acc + cur.amount, 0);

  const maintenanceExpenseSum = filteredExpenses
    .filter((e) => {
      const cat = (e.category || "").toLowerCase();
      return cat.includes("maintenance") || cat.includes("repair");
    })
    .reduce((acc, cur) => acc + cur.amount, 0);

  const totalRecurringExpenses = filteredExpenses.filter((e) => e.isRecurring).length;

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");

  // Reset to page 1 on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedBrand, selectedCompany, startDateFilter, endDateFilter, itemsPerPage, dateSort]);

  // Sort expenses date-wise according to dateSort
  const sortedExpenses = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => {
      const timeA = new Date(a.expenseDate).getTime();
      const timeB = new Date(b.expenseDate).getTime();
      return dateSort === "desc" ? timeB - timeA : timeA - timeB;
    });
  }, [filteredExpenses, dateSort]);

  const totalPages = Math.max(1, Math.ceil(sortedExpenses.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedExpenses = sortedExpenses.slice(startIndex, startIndex + itemsPerPage);

  // Floating Hover Tooltip State
  const [hoveredTooltip, setHoveredTooltip] = useState<TooltipItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleHover = (item: TooltipItem, e: React.MouseEvent) => {
    setHoveredTooltip(item);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleLeave = () => {
    setHoveredTooltip(null);
  };

  const COLORS = ["#4f46e5", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#3b82f6", "#f97316", "#14b8a6"];

  const categoryMap: Record<string, number> = {};
  expenses.forEach((e) => {
    const cat = e.category || "Misc";
    categoryMap[cat] = (categoryMap[cat] || 0) + (Number(e.amount) || 0);
  });

  const categoryBreakdown = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const categoryDonutData = categoryBreakdown.map((c, idx) => ({
    name: c.name,
    value: c.value,
    color: COLORS[idx % COLORS.length],
  }));

  return (
    <CfoSecurityGuard>
      <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans relative">
      <Sidebar />

      {/* FLOATING HOVER TOOLTIP */}
      {hoveredTooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-slate-900/95 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-2xl border border-slate-700 backdrop-blur-md transform -translate-x-1/2 -translate-y-full transition-all duration-100"
          style={{ left: tooltipPos.x, top: tooltipPos.y - 12 }}
        >
          <div className="text-[10px] text-indigo-300 font-extrabold uppercase mb-0.5">{hoveredTooltip.category || "DETAILS"}</div>
          <div className="text-sm font-black text-white">{hoveredTooltip.name}</div>
          <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-slate-800 text-[11px]">
            <span className="text-emerald-400 font-extrabold">Amount: ₹{Number(hoveredTooltip.value).toLocaleString("en-IN")}</span>
            {hoveredTooltip.pct !== undefined && (
              <span className="text-slate-300 font-bold bg-slate-800 px-1.5 py-0.5 rounded">
                Share: {hoveredTooltip.pct}%
              </span>
            )}
          </div>
        </div>
      )}

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
              onClick={handleOpenCreateModal}
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
            <span className="text-[10px] font-bold text-slate-400 uppercase">Maintenance & Repairs</span>
            <div className="text-2xl font-black text-blue-600 mt-1">₹{maintenanceExpenseSum.toLocaleString("en-IN")}</div>
            <span className="text-[10px] font-semibold text-slate-400">Facility, Assets & Maintenance</span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Recurring Expenses</span>
            <div className="text-2xl font-black text-purple-600 mt-1">{totalRecurringExpenses} Active</div>
            <span className="text-[10px] font-semibold text-slate-400">Software, Rent & Subscriptions</span>
          </div>
        </div>

        {/* WHERE EXPENSES GO (CATEGORIES) DONUT & NUMBERS TABLE */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm mb-6 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-extrabold text-slate-800">🍩 Where Expenses Go (Categories)</h3>
            <p className="text-xs text-slate-400 font-medium">Category breakdown of operational expenditures</p>
          </div>

          {categoryDonutData.length === 0 ? (
            <div className="py-12 text-xs font-semibold text-slate-400 text-center">No expense records found</div>
          ) : (
            <SvgDonutChart data={categoryDonutData} size={210} onHover={handleHover} onLeave={handleLeave} />
          )}        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 mb-6 shadow-xs flex flex-col xl:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full xl:w-72 shrink-0">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search expenses by description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-slate-700 font-medium"
              />
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
              </svg>
            </div>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition-colors shrink-0 cursor-pointer"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full xl:w-auto overflow-x-auto">
            <div className="flex items-center gap-2 shrink-0 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-slate-500 shrink-0">Brand:</span>
              <select
                value={selectedBrand}
                onChange={(e) => {
                  const nb = e.target.value;
                  setSelectedBrand(nb);
                  const linked = getLinkedCompaniesForBrand(nb);
                  if (selectedCompany !== "All Companies" && !linked.includes(selectedCompany)) {
                    setSelectedCompany("All Companies");
                  }
                }}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[130px] truncate"
              >
                <option value="All Brands">All Brands</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-slate-500 shrink-0">Company:</span>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[140px] truncate"
              >
                <option value="All Companies">All Companies</option>
                {availableFilterCompanies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-slate-500 shrink-0">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[140px] truncate"
              >
                <option value="All">All Categories</option>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-slate-500 shrink-0">Date Order:</span>
              <select
                value={dateSort}
                onChange={(e) => setDateSort(e.target.value as "desc" | "asc")}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-slate-500 shrink-0">Date Range:</span>
              <select
                value={datePreset}
                onChange={(e) => handleDatePresetChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {(datePreset === "custom" || startDateFilter || endDateFilter) && (
              <div className="flex items-center gap-2 shrink-0 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
                <span className="text-xs font-bold text-slate-500">From:</span>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => {
                    setDatePreset("custom");
                    setStartDateFilter(e.target.value);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-500">To:</span>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => {
                    setDatePreset("custom");
                    setEndDateFilter(e.target.value);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                />
                {(startDateFilter || endDateFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset("all");
                      setStartDateFilter("");
                      setEndDateFilter("");
                    }}
                    className="text-xs font-bold text-rose-500 hover:text-rose-700 ml-1 cursor-pointer"
                    title="Clear Date Filter"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex-1 flex flex-col justify-between">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 pr-4 min-w-[130px]">Title / Description</th>
                  <th className="pb-3 pr-4 min-w-[140px]">Category</th>
                  <th className="pb-3 pr-3 min-w-[90px]">Brand Tag</th>
                  <th className="pb-3 pr-3 min-w-[130px]">Company Tag</th>
                  <th className="pb-3 pr-3 min-w-[90px]">Bank</th>
                  <th className="pb-3 pr-3 min-w-[72px]">Nature</th>
                  <th className="pb-3 px-3 min-w-[90px] text-right">Amount</th>
                  <th className="pb-3 px-3 min-w-[110px] whitespace-nowrap">Payment Mode</th>
                  <th className="pb-3 px-3 min-w-[100px] whitespace-nowrap">Date</th>
                  <th className="pb-3 text-right min-w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 font-semibold text-slate-600">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td colSpan={10} className="py-3 px-2">
                        <div className="h-4 bg-slate-200/80 rounded-lg w-full"></div>
                      </td>
                    </tr>
                  ))
                ) : sortedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No expense records found. Click &quot;Record Expense&quot; to add one.
                    </td>
                  </tr>
                ) : (
                  paginatedExpenses.map((e) => (
                    <tr key={e._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 pr-4 font-bold text-slate-900">{e.title}</td>
                      <td className="pr-4">
                        <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border border-rose-100 whitespace-nowrap">
                          {e.category}
                        </span>
                      </td>
                      <td className="pr-3 text-slate-600">{e.brand || "-"}</td>
                      <td className="pr-3 text-slate-600">{e.company || "-"}</td>
                      <td className="pr-3 text-slate-600 font-bold">{e.bank || "-"}</td>
                      <td className="pr-3">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold whitespace-nowrap ${e.expenseType === "fixed" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-slate-100 text-slate-600"}`}>
                          {e.expenseType || "variable"}
                        </span>
                      </td>
                      <td className="px-3 text-right font-black text-rose-600 whitespace-nowrap">₹{e.amount.toLocaleString("en-IN")}</td>
                      <td className="px-3 text-slate-500 whitespace-nowrap">{e.paymentMode}</td>
                      <td className="px-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(e.expenseDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEditModal(e)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors mr-3 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(e._id)}
                          className="text-xs text-rose-500 hover:text-rose-700 font-bold transition-colors cursor-pointer"
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

          {/* Date-Wise Pagination Bar */}
          {sortedExpenses.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 mt-4 border-t border-slate-100 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-2">
                <span>Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
                <span>entries (Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedExpenses.length)} of {sortedExpenses.length} date-wise expenses)</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                >
                  ← Previous Date
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                    .map((page, idx, arr) => {
                      const showDots = idx > 0 && page - arr[idx - 1] > 1;
                      return (
                        <React.Fragment key={page}>
                          {showDots && <span className="px-1.5 text-slate-400 font-bold">...</span>}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              currentPage === page
                                ? "bg-rose-600 text-white shadow-sm"
                                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            }`}
                          >
                            {page}
                          </button>
                        </React.Fragment>
                      );
                    })}
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
                >
                  Next Date →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal: Add or Edit Expense */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 flex flex-col max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              
              {/* Header (Sticky top) */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm">
                    💸
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug">
                      {editingExpenseId ? "Edit Operational Expense" : "Record Operational Expense"}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">Enter transaction details below</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold text-lg transition-colors cursor-pointer"
                >
                  ×
                </button>
              </div>

              {/* Form Content (Scrollable) */}
              <form id="expense-form" onSubmit={handleCreateExpense} className="flex flex-col flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs font-semibold">
                  
                  {/* Expense Description */}
                  <div>
                    <label className="block text-slate-700 font-bold text-xs mb-1.5">
                      Expense Description / Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Meta Ads Campaign July 2026"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder-slate-400"
                    />
                  </div>

                  {/* Category & Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1.5">
                        Category <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all cursor-pointer"
                      >
                        {EXPENSE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1.5">
                        Amount (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        min="0"
                        placeholder="15000"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder-slate-400"
                      />
                    </div>
                  </div>

                  {/* Recurring Expense Box */}
                  <div className="bg-rose-50/60 border border-rose-100 p-3.5 rounded-xl">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isRecurring}
                        onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                        className="w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-rose-900 select-none">🔁 Mark as Recurring Operational Expense</span>
                    </label>

                    {formData.isRecurring && (
                      <div className="mt-3 pt-2.5 border-t border-rose-100">
                        <label className="block text-[11px] font-bold text-rose-800 mb-1.5">Recurring Frequency</label>
                        <select
                          value={formData.recurringFrequency}
                          onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value })}
                          className="w-full px-3 py-2 text-xs border border-rose-200 rounded-xl bg-white text-rose-900 font-bold focus:outline-none focus:ring-2 focus:ring-rose-400/20 cursor-pointer"
                        >
                          <option value="Monthly">Monthly (Auto-renews every month)</option>
                          <option value="Weekly">Weekly (Auto-renews every week)</option>
                          <option value="Quarterly">Quarterly (Auto-renews every 3 months)</option>
                          <option value="Yearly">Yearly (Auto-renews annually)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Date & Payment Mode */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1.5">Expense Date</label>
                      <input
                        type="date"
                        value={formData.expenseDate}
                        onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1.5">Payment Mode</label>
                      <select
                        value={formData.paymentMode}
                        onChange={(e) => handlePaymentModeChangeInForm(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all cursor-pointer"
                      >
                        <option value="UPI">UPI</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="NEFT">NEFT</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                  </div>

                  {/* Brand Tag */}
                  <div>
                    <label className="block text-slate-700 font-bold text-xs mb-1.5">Brand Tag</label>
                    <select
                      value={formData.brand}
                      onChange={(e) => handleBrandChangeInForm(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all cursor-pointer"
                    >
                      <option value="All Brands">All Brands</option>
                      {brands.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Company Allocation */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-slate-700 font-bold text-xs">
                        Company Allocation
                      </label>
                      {formData.paymentMode === "Cash" && (
                        <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                          N/A for Cash Payment
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={availableFormCompanies.includes(formData.company) ? formData.company : "CUSTOM"}
                          disabled={formData.paymentMode === "Cash"}
                          onChange={(e) => {
                            if (e.target.value !== "CUSTOM") {
                              handleCompanyChangeInForm(e.target.value);
                            }
                          }}
                          className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:opacity-50 uppercase cursor-pointer"
                        >
                          <option value="All Companies">All Companies (Unallocated)</option>
                          {availableFormCompanies.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                          {!availableFormCompanies.includes(formData.company) && formData.company && formData.company !== "All Companies" && (
                            <option value="CUSTOM">{formData.company}</option>
                          )}
                        </select>
                      </div>

                      <input
                        type="text"
                        value={formData.company}
                        disabled={formData.paymentMode === "Cash"}
                        onChange={(e) => handleCompanyChangeInForm(e.target.value.toUpperCase())}
                        placeholder="Or type custom company name..."
                        className="w-full px-3 py-1.5 bg-slate-50/30 border border-slate-200/80 rounded-xl text-slate-700 text-[11px] font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder-slate-400 disabled:opacity-50 uppercase"
                      />

                      {/* Company Suggestions Quick Pills */}
                      {formData.paymentMode !== "Cash" && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 w-full block">All Companies Suggestions ({availableFormCompanies.length}):</span>
                          {availableFormCompanies.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleCompanyChangeInForm(c)}
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer border ${
                                formData.company === c
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bank Name & Expense Nature */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-slate-700 font-bold text-xs">Bank Name</label>
                        {formData.paymentMode === "Cash" ? (
                          <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            N/A for Cash
                          </span>
                        ) : formData.company && formData.company !== "All Companies" && getBankForCompany(formData.company) ? (
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            ✓ Auto-selected
                          </span>
                        ) : null}
                      </div>
                      <select
                        value={formData.bank}
                        disabled={formData.paymentMode === "Cash"}
                        onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all cursor-pointer disabled:opacity-50 disabled:bg-slate-100"
                      >
                        <option value="">-- No Bank (Cash / N/A) --</option>
                        {availableCompanyBanks.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                        {!availableCompanyBanks.includes("BOI") && <option value="BOI">BOI</option>}
                        {!availableCompanyBanks.includes("Bank Of India") && <option value="Bank Of India">Bank Of India</option>}
                        {!availableCompanyBanks.includes("ICICI") && <option value="ICICI">ICICI</option>}
                        {!availableCompanyBanks.includes("HDFC") && <option value="HDFC">HDFC</option>}
                        {!availableCompanyBanks.includes("SBI") && <option value="SBI">SBI</option>}
                        {!availableCompanyBanks.includes("AXIS") && <option value="AXIS">AXIS</option>}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold text-xs mb-1.5">Expense Nature</label>
                      <select
                        value={formData.expenseType}
                        onChange={(e) => setFormData({ ...formData, expenseType: e.target.value as "variable" | "fixed" })}
                        className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all cursor-pointer"
                      >
                        <option value="variable">variable</option>
                        <option value="fixed">fixed</option>
                      </select>
                    </div>
                  </div>

                  {/* Remarks / Details */}
                  <div>
                    <label className="block text-slate-700 font-bold text-xs mb-1.5">Remarks / Details</label>
                    <input
                      type="text"
                      placeholder="e.g. Paid to vendor via Google Pay"
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder-slate-400"
                    />
                  </div>

                </div>

                {/* Footer Buttons (Sticky Bottom) */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 shrink-0 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-2xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? "Saving..." : editingExpenseId ? "Update Expense" : "Save Expense"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ExpensePdfReportModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          expenses={filteredExpenses}
          filters={{
            category: selectedCategory,
            brand: selectedBrand,
            company: selectedCompany,
            datePreset,
            startDate: startDateFilter,
            endDate: endDateFilter,
            searchQuery,
          }}
        />
      </div>
    </div>
    </CfoSecurityGuard>
  );
}
