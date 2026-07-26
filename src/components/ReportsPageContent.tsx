"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { useUser } from "../app/component/context/user-context";
import Sidebar from "@/components/Sidebar";
import ManagerSidebar from "@/components/ManagerSidebar";
import ProfileDisplay from "@/components/ProfileDisplay";
import DailyBiDashboard from "@/components/DailyBiDashboard";

interface ReportsPageContentProps {
  role: "admin" | "manager";
}

// ── CANVAS CHART ENGINE FOR EXCEL REPORTS ───────────────────────
const drawBarChartCanvas = (
  title: string,
  labels: string[],
  values: number[],
  colors = ["#4f46e5", "#059669", "#7c3aed", "#2563eb", "#d97706", "#dc2626", "#06b6d4", "#ec4899", "#f97316"],
  valueFormatter: (v: number) => string = (v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${v.toLocaleString('en-IN')}`,
  width = 720,
  height = 360
): string | null => {
  if (typeof window === "undefined" || !document) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Border & Header
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(2, 2, width - 4, 44);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.fillText(title.toUpperCase(), 20, 28);

  if (labels.length === 0 || values.length === 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText("No data available to generate chart", 20, 100);
    return canvas.toDataURL("image/png");
  }

  const maxVal = Math.max(...values, 1);
  const chartTop = 80;
  const chartBottom = height - 50;
  const chartLeft = 70;
  const chartRight = width - 40;
  const chartH = chartBottom - chartTop;
  const chartW = chartRight - chartLeft;

  // Gridlines
  const steps = 4;
  ctx.strokeStyle = "#f1f5f9";
  ctx.lineWidth = 1;
  for (let i = 0; i <= steps; i++) {
    const y = chartBottom - (chartH / steps) * i;
    const val = (maxVal / steps) * i;
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();

    ctx.fillStyle = "#64748b";
    ctx.font = "10px Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(valueFormatter(val), chartLeft - 8, y + 3);
  }

  // Bars
  const gap = 16;
  const barW = Math.min(65, Math.max(20, (chartW - gap * (labels.length + 1)) / labels.length));

  labels.forEach((lbl, i) => {
    const val = values[i] || 0;
    const bHeight = (val / maxVal) * chartH;
    const x = chartLeft + gap + i * (barW + gap);
    const y = chartBottom - bHeight;
    const color = colors[i % colors.length];

    ctx.fillStyle = color;
    if ((ctx as any).roundRect) {
      ctx.beginPath();
      (ctx as any).roundRect(x, y, barW, bHeight, [6, 6, 0, 0]);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, barW, bHeight);
    }

    // Top Label
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 11px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(valueFormatter(val), x + barW / 2, y - 6);

    // Bottom X-Axis Label
    ctx.fillStyle = "#334155";
    ctx.font = "11px Arial, sans-serif";
    const trunc = lbl.length > 12 ? lbl.substring(0, 10) + ".." : lbl;
    ctx.fillText(trunc, x + barW / 2, chartBottom + 18);
  });

  return canvas.toDataURL("image/png");
};

const drawDonutChartCanvas = (
  title: string,
  labels: string[],
  values: number[],
  colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#f97316"],
  width = 640,
  height = 360
): string | null => {
  if (typeof window === "undefined" || !document) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(2, 2, width - 4, 44);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.fillText(title.toUpperCase(), 20, 28);

  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText("No data available", 20, 100);
    return canvas.toDataURL("image/png");
  }

  const cx = 170;
  const cy = height / 2 + 10;
  const radius = 105;
  let startAngle = -Math.PI / 2;

  values.forEach((val, i) => {
    const sliceAngle = (val / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;
    const color = colors[i % colors.length];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    startAngle = endAngle;
  });

  // Center hole
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(total.toString(), cx, cy + 2);
  ctx.fillStyle = "#64748b";
  ctx.font = "10px Arial, sans-serif";
  ctx.fillText("TOTAL", cx, cy + 16);

  // Legend
  let legendY = 80;
  labels.forEach((lbl, i) => {
    const val = values[i] || 0;
    const pct = ((val / total) * 100).toFixed(1) + "%";
    const color = colors[i % colors.length];

    ctx.fillStyle = color;
    ctx.fillRect(340, legendY, 14, 14);

    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${lbl}: ${val} (${pct})`, 364, legendY + 12);

    legendY += 28;
  });

  return canvas.toDataURL("image/png");
};

const drawHorizontalBarChartCanvas = (
  title: string,
  labels: string[],
  values: number[],
  colors = ["#4f46e5", "#059669", "#7c3aed", "#2563eb", "#d97706", "#dc2626", "#06b6d4"],
  valueFormatter: (v: number) => string = (v) => v.toString(),
  width = 720,
  height = 360
): string | null => {
  if (typeof window === "undefined" || !document) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(2, 2, width - 4, 44);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 15px Arial, sans-serif";
  ctx.fillText(title.toUpperCase(), 20, 28);

  const maxVal = Math.max(...values, 1);
  const startY = 70;
  const barH = 26;
  const gap = 12;

  labels.forEach((lbl, idx) => {
    const y = startY + idx * (barH + gap);
    const val = values[idx] || 0;
    const barW = Math.max((val / maxVal) * 440, 10);
    const color = colors[idx % colors.length];

    ctx.fillStyle = "#334155";
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.textAlign = "left";
    const trunc = lbl.length > 20 ? lbl.substring(0, 18) + ".." : lbl;
    ctx.fillText(trunc, 25, y + 18);

    ctx.fillStyle = color;
    if ((ctx as any).roundRect) {
      ctx.beginPath();
      (ctx as any).roundRect(170, y, barW, barH, 6);
      ctx.fill();
    } else {
      ctx.fillRect(170, y, barW, barH);
    }

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(valueFormatter(val), 180 + barW, y + 18);
  });

  return canvas.toDataURL("image/png");
};

export default function ReportsPageContent({ role }: ReportsPageContentProps) {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Filter States
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeReportTab, setActiveReportTab] = useState<"super" | "leads" | "counsellors" | "brandManagers" | "expenses">("super");

  // Status & Loaders
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // WhatsApp States
  const [adminPhone, setAdminPhone] = useState("919335913286");
  const [isSendingWhatsAppReport, setIsSendingWhatsAppReport] = useState(false);
  const [waReportStatus, setWaReportStatus] = useState({ text: "", type: "" });
  const [isSendingMonthlyReport, setIsSendingMonthlyReport] = useState(false);
  const [monthlyReportStatus, setMonthlyReportStatus] = useState({ text: "", type: "" });

  useEffect(() => {
    const rawUserPhone = (user as any)?.phone || (user as any)?.mobile || (user as any)?.phoneNumber || (user as any)?.mobileNumber;
    if (rawUserPhone) {
      let digits = rawUserPhone.toString().replace(/\D/g, "");
      if (digits.length === 10) digits = `91${digits}`;
      if (digits) setAdminPhone(digits);
    }
  }, [user]);

  // ── WhatsApp Daily & Monthly Triggers ───────────────────
  const handleSendDailyWhatsAppReport = async () => {
    setIsSendingWhatsAppReport(true);
    setWaReportStatus({ text: "Gathering metrics & generating PDF report...", type: "info" });
    try {
      const res = await fetch("/api/reports/daily/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminMobileNumber: adminPhone }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWaReportStatus({
          text: `Daily Report PDF successfully sent to ${adminPhone}! (Leads: ${data.stats?.totalLeads}, Today Coll: ₹${Number(data.stats?.todaysCollection || 0).toLocaleString('en-IN')})`,
          type: "success",
        });
      } else {
        setWaReportStatus({
          text: data.message || "Failed to send WhatsApp daily report.",
          type: "error",
        });
      }
    } catch (err: any) {
      console.error(err);
      setWaReportStatus({ text: err.message || "Failed to trigger report.", type: "error" });
    } finally {
      setIsSendingWhatsAppReport(false);
    }
  };

  const handleSendMonthlyWhatsAppReport = async () => {
    setIsSendingMonthlyReport(true);
    setMonthlyReportStatus({ text: "Gathering Month-To-Date (Day 1 to Today) metrics & generating PDF...", type: "info" });
    try {
      const res = await fetch("/api/reports/monthly/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminMobileNumber: adminPhone }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMonthlyReportStatus({
          text: `Monthly MTD Report PDF successfully sent to ${adminPhone}! (MTD Leads: ${data.stats?.totalLeads}, Monthly Coll: ₹${Number(data.stats?.monthlyCollection || 0).toLocaleString('en-IN')})`,
          type: "success",
        });
      } else {
        setMonthlyReportStatus({
          text: data.message || "Failed to send Monthly WhatsApp report.",
          type: "error",
        });
      }
    } catch (err: any) {
      console.error(err);
      setMonthlyReportStatus({ text: err.message || "Failed to trigger report.", type: "error" });
    } finally {
      setIsSendingMonthlyReport(false);
    }
  };

  // ── Fetch Master Data & Trigger Selected Excel Report ───
  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setMessage({ text: "Fetching comprehensive master dataset...", type: "info" });

    try {
      const query = new URLSearchParams();
      if (startDate) query.append("startDate", startDate);
      if (endDate) query.append("endDate", endDate);

      const res = await fetch(`/api/reports/master?${query.toString()}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to fetch master report data");
      }

      const master = data.data;

      if (activeReportTab === "super") {
        setMessage({ text: "Building Super Master Multi-Sheet Excel Workbook...", type: "info" });
        await generateSuperMasterExcel(master);
      } else if (activeReportTab === "leads") {
        setMessage({ text: "Building Leads & Enquiries Register Excel...", type: "info" });
        await generateLeadsExcel(master);
      } else if (activeReportTab === "counsellors") {
        setMessage({ text: "Building Counsellor Performance Scorecard Excel...", type: "info" });
        await generateCounsellorExcel(master);
      } else if (activeReportTab === "brandManagers") {
        setMessage({ text: "Building Brand Manager Performance Excel...", type: "info" });
        await generateBrandManagerExcel(master);
      } else if (activeReportTab === "expenses") {
        setMessage({ text: "Building Operational Expense Report Excel...", type: "info" });
        await generateExpenseExcel(master);
      }

      setMessage({ text: "Report downloaded successfully!", type: "success" });
    } catch (error: any) {
      console.error(error);
      setMessage({ text: error.message || "An error occurred while generating the report.", type: "error" });
    } finally {
      setIsGenerating(false);
    }
  };

  // ══════════════════════════════════════════════════════════
  // 1. SUPER MASTER MULTI-SHEET REPORT GENERATOR
  // ══════════════════════════════════════════════════════════
  const generateSuperMasterExcel = async (master: any) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SyncForge CRM";
    workbook.created = new Date();

    const { enquiries = [], payments = [], brands = [], companies = [], counsellors = [] } = master;

    // ── SHEET 1: MASTER SUMMARY (ALL BRANDS & ALL COMPANIES) ──
    const summarySheet = workbook.addWorksheet("Master Executive Summary");

    // Title Block
    summarySheet.addRow(["ACADEMIC & CORPORATE MASTER EXECUTIVE SUMMARY REPORT"]);
    summarySheet.addRow([`Generated On: ${new Date().toLocaleString('en-IN')}`, `Date Scope: ${startDate || 'Beginning'} to ${endDate || 'Today'}`]);
    summarySheet.addRow([]);

    // 1A. ALL BRANDS SUMMARY TABLE
    summarySheet.addRow(["1. ALL BRANDS PERFORMANCE SUMMARY"]);
    const brandHeaders = ["Brand Name", "Brand ID", "Total Enquiries", "Demos Conducted", "Admissions", "Conversion Rate", "Total Revenue Billed (INR)"];
    const brandHeaderRow = summarySheet.addRow(brandHeaders);
    brandHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    brandHeaderRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } }; // Indigo
    });

    let globalTotalEnquiries = 0;
    let globalTotalAdmissions = 0;
    let globalTotalRevenue = 0;

    brands.forEach((b: any) => {
      const bNameLower = (b.name || "").toLowerCase().trim();
      const bEnquiries = enquiries.filter((e: any) =>
        (e.targetBrand || "").toLowerCase().trim() === bNameLower ||
        (e.brand || "").toLowerCase().trim() === bNameLower
      );
      const bDemos = bEnquiries.filter((e: any) => e.isDemoScheduled || (e.demos && e.demos.length > 0) || (e.status || "").toLowerCase().includes("demo")).length;
      const bAdmissions = bEnquiries.filter((e: any) => (e.status || "").toLowerCase() === "admitted").length;

      const bRev = payments.reduce((sum: number, p: any) => {
        const admission = p.admissionId || {};
        const pBrand = (admission.brand || p.brand || "").toLowerCase().trim();
        return pBrand === bNameLower ? sum + Number(p.amountReceived || 0) : sum;
      }, 0);

      const convPct = bEnquiries.length > 0 ? ((bAdmissions / bEnquiries.length) * 100).toFixed(1) + "%" : "0.0%";

      globalTotalEnquiries += bEnquiries.length;
      globalTotalAdmissions += bAdmissions;
      globalTotalRevenue += bRev;

      summarySheet.addRow([b.name, b.brandId || "N/A", bEnquiries.length, bDemos, bAdmissions, convPct, bRev]);
    });

    // Total Brand Row
    const brandTotalRow = summarySheet.addRow([
      "TOTAL ALL BRANDS", "-", globalTotalEnquiries, "-", globalTotalAdmissions,
      globalTotalEnquiries > 0 ? ((globalTotalAdmissions / globalTotalEnquiries) * 100).toFixed(1) + "%" : "0.0%",
      globalTotalRevenue
    ]);
    brandTotalRow.font = { bold: true };

    summarySheet.addRow([]); // Blank Row
    summarySheet.addRow([]); // Blank Row

    // 1B. ALL COMPANIES SUMMARY TABLE
    summarySheet.addRow(["2. ALL LEGAL COMPANIES FINANCIAL SUMMARY"]);
    const companyHeaders = ["Company Name", "GST Number", "Receipts Issued", "Total Billed Collections (INR)"];
    const companyHeaderRow = summarySheet.addRow(companyHeaders);
    companyHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    companyHeaderRow.eachCell(cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } }; // Emerald
    });

    let globalCompanyTotalRevenue = 0;
    let globalReceiptsCount = 0;

    companies.forEach((comp: any) => {
      const cNameLower = (comp.name || "").toLowerCase().trim();
      const compPayments = payments.filter((p: any) => {
        const admission = p.admissionId || {};
        const pComp = (admission.companyAssigned || p.company || "").toLowerCase().trim();
        return pComp.includes(cNameLower) || cNameLower.includes(pComp);
      });

      const compRev = compPayments.reduce((sum: number, p: any) => sum + Number(p.amountReceived || 0), 0);
      globalCompanyTotalRevenue += compRev;
      globalReceiptsCount += compPayments.length;

      summarySheet.addRow([comp.name, comp.gst || "Registered", compPayments.length, compRev]);
    });

    const compTotalRow = summarySheet.addRow(["TOTAL ALL COMPANIES", "-", globalReceiptsCount, globalCompanyTotalRevenue]);
    compTotalRow.font = { bold: true };

    // Format Sheet 1 Columns
    summarySheet.columns.forEach(col => col.width = 24);

    // Embed Visual Chart Graphics into Sheet 1
    try {
      const brandNames = brands.map((b: any) => b.name);
      const brandRevenues = brands.map((b: any) => {
        const bNameLower = (b.name || "").toLowerCase().trim();
        return payments.reduce((sum: number, p: any) => {
          const admission = p.admissionId || {};
          const pBrand = (admission.brand || p.brand || "").toLowerCase().trim();
          return pBrand === bNameLower ? sum + Number(p.amountReceived || 0) : sum;
        }, 0);
      });

      const compNames = companies.map((c: any) => c.name);
      const compRevenues = companies.map((comp: any) => {
        const cNameLower = (comp.name || "").toLowerCase().trim();
        const compPayments = payments.filter((p: any) => {
          const admission = p.admissionId || {};
          const pComp = (admission.companyAssigned || p.company || "").toLowerCase().trim();
          return pComp.includes(cNameLower) || cNameLower.includes(pComp);
        });
        return compPayments.reduce((sum: number, p: any) => sum + Number(p.amountReceived || 0), 0);
      });

      const courseCounts: Record<string, number> = {};
      enquiries.forEach((e: any) => {
        const crs = e.targetCourse || "General";
        courseCounts[crs] = (courseCounts[crs] || 0) + 1;
      });
      const sortedCourses = Object.entries(courseCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

      const brandChartBase64 = drawBarChartCanvas("BRAND BILLED REVENUE (INR)", brandNames, brandRevenues, ["#4f46e5", "#059669", "#7c3aed", "#2563eb", "#d97706"]);
      if (brandChartBase64) {
        const img1 = workbook.addImage({ base64: brandChartBase64, extension: "png" });
        summarySheet.addImage(img1, {
          tl: { col: 8, row: 3 },
          ext: { width: 560, height: 280 }
        });
      }

      const compChartBase64 = drawDonutChartCanvas("COMPANY COLLECTIONS SHARE", compNames, compRevenues, ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444"]);
      if (compChartBase64) {
        const img2 = workbook.addImage({ base64: compChartBase64, extension: "png" });
        summarySheet.addImage(img2, {
          tl: { col: 8, row: 18 },
          ext: { width: 560, height: 280 }
        });
      }

      const courseChartBase64 = drawHorizontalBarChartCanvas("TOP DEMANDED COURSES", sortedCourses.map(c => c[0]), sortedCourses.map(c => c[1]), ["#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1"], (v) => v.toString() + " Leads");
      if (courseChartBase64) {
        const img3 = workbook.addImage({ base64: courseChartBase64, extension: "png" });
        summarySheet.addImage(img3, {
          tl: { col: 8, row: 33 },
          ext: { width: 560, height: 280 }
        });
      }
    } catch (chartErr) {
      console.error("Failed adding charts to Super Master report:", chartErr);
    }

    // ── SHEETS FOR EACH BRAND ────────────────────────────────
    brands.forEach((b: any) => {
      const bNameLower = (b.name || "").toLowerCase().trim();
      const bEnquiries = enquiries.filter((e: any) =>
        (e.targetBrand || "").toLowerCase().trim() === bNameLower ||
        (e.brand || "").toLowerCase().trim() === bNameLower
      );

      const safeSheetName = `Brand - ${b.name}`.replace(/[?*/\\[\]]/g, '').substring(0, 31);
      const sheet = workbook.addWorksheet(safeSheetName);

      sheet.addRow([`BRAND REGISTER: ${b.name.toUpperCase()} (${b.brandId || ''})`]);
      sheet.addRow([]);

      const headerRow = sheet.addRow([
        "Enquiry ID", "Student Name", "Mobile", "Email", "Target Course",
        "Assigned Counsellor", "Lead Source", "Priority", "Status", "Fees Collected (INR)"
      ]);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
      });

      bEnquiries.forEach((e: any, idx: number) => {
        const row = sheet.addRow([
          e.enquiryId || "N/A",
          e.studentFullName || "Student",
          e.primaryPhoneMobile || e.phone || "N/A",
          e.emailAddress || e.email || "N/A",
          e.targetCourse || "General",
          e.assignedCrmAdvisor || "Unassigned",
          e.leadSource || "Direct",
          e.priorityLevel || e.priority || "Medium",
          e.status || "New",
          parseFloat(String(e.feesCollected || "0").replace(/[^0-9.]/g, "")) || 0
        ]);
        if (idx % 2 === 1) {
          row.eachCell(cell => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          });
        }
      });

      sheet.columns.forEach(col => col.width = 20);
    });

    // ── SHEETS FOR EACH COMPANY ──────────────────────────────
    companies.forEach((comp: any) => {
      const cNameLower = (comp.name || "").toLowerCase().trim();
      const compPayments = payments.filter((p: any) => {
        const admission = p.admissionId || {};
        const pComp = (admission.companyAssigned || p.company || "").toLowerCase().trim();
        return pComp.includes(cNameLower) || cNameLower.includes(pComp);
      });

      let safeSheetName = `Comp - ${comp.name}`.replace(/[?*/\\[\]]/g, '').substring(0, 31);
      if (workbook.getWorksheet(safeSheetName)) {
        safeSheetName = `Company - ${comp.name}`.replace(/[?*/\\[\]]/g, '').substring(0, 31);
      }

      const sheet = workbook.addWorksheet(safeSheetName);
      sheet.addRow([`CORPORATE FINANCIAL REGISTER: ${comp.name.toUpperCase()} (GST: ${comp.gst || 'N/A'})`]);
      sheet.addRow([]);

      const headerRow = sheet.addRow([
        "Receipt No", "Student Name", "Mobile", "Course Billed", "Brand",
        "Payment Date", "Payment Mode", "Reference No", "Amount Received (INR)"
      ]);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
      });

      compPayments.forEach((p: any, idx: number) => {
        const admission = p.admissionId || {};
        const row = sheet.addRow([
          p.receiptNo || "N/A",
          admission.fullName || p.studentName || "N/A",
          admission.mobileNumber || "N/A",
          admission.course || "N/A",
          admission.brand || p.brand || "N/A",
          p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-IN") : "N/A",
          p.paymentMode || "Cash",
          p.referenceNo || "-",
          Number(p.amountReceived || 0)
        ]);
        if (idx % 2 === 1) {
          row.eachCell(cell => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDF4" } };
          });
        }
      });

      sheet.columns.forEach(col => col.width = 20);
    });

    // Download Workbook
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `Super_Master_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ══════════════════════════════════════════════════════════
  // 2. LEADS & ENQUIRIES REGISTER REPORT GENERATOR
  // ══════════════════════════════════════════════════════════
  const generateLeadsExcel = async (master: any) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Leads Register");

    sheet.addRow(["ACADEMIC LEADS & ENQUIRIES FULL REGISTER"]);
    sheet.addRow([`Export Date: ${new Date().toLocaleString('en-IN')}`]);
    sheet.addRow([]);

    sheet.addRow([
      "Enquiry ID", "Student Name", "Mobile", "Email", "Target Brand",
      "Target Course", "Counsellor", "Lead Source", "Priority", "Status",
      "Demo Scheduled", "Date Created"
    ]);
    sheet.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(4).eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } });

    (master.enquiries || []).forEach((e: any, idx: number) => {
      const row = sheet.addRow([
        e.enquiryId || "N/A",
        e.studentFullName || "Student",
        e.primaryPhoneMobile || e.phone || "N/A",
        e.emailAddress || e.email || "N/A",
        e.targetBrand || "N/A",
        e.targetCourse || "N/A",
        e.assignedCrmAdvisor || "Unassigned",
        e.leadSource || "Direct",
        e.priorityLevel || e.priority || "Medium",
        e.status || "New",
        e.isDemoScheduled ? "Yes" : "No",
        e.createdAt ? new Date(e.createdAt).toLocaleDateString("en-IN") : "N/A"
      ]);
      if (idx % 2 === 1) {
        row.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } });
      }
    });

    sheet.columns.forEach(col => col.width = 20);

    // Embed Visual Chart Graphics into Leads Register
    try {
      const enquiries = master.enquiries || [];
      const statusMap: Record<string, number> = {};
      const sourceMap: Record<string, number> = {};
      const priorityMap: Record<string, number> = {};
      const courseMap: Record<string, number> = {};

      enquiries.forEach((e: any) => {
        const st = e.status || "New";
        const src = e.leadSource || "Direct";
        const pri = e.priorityLevel || e.priority || "Medium";
        const crs = e.targetCourse || "General";
        statusMap[st] = (statusMap[st] || 0) + 1;
        sourceMap[src] = (sourceMap[src] || 0) + 1;
        priorityMap[pri] = (priorityMap[pri] || 0) + 1;
        courseMap[crs] = (courseMap[crs] || 0) + 1;
      });

      const sortedCourses = Object.entries(courseMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

      const statusChart = drawDonutChartCanvas("ENQUIRY STATUS BREAKDOWN", Object.keys(statusMap), Object.values(statusMap), ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444"]);
      if (statusChart) {
        const img1 = workbook.addImage({ base64: statusChart, extension: "png" });
        sheet.addImage(img1, {
          tl: { col: 13, row: 3 },
          ext: { width: 520, height: 260 }
        });
      }

      const sourceChart = drawBarChartCanvas("LEAD ACQUISITION CHANNELS", Object.keys(sourceMap), Object.values(sourceMap), ["#3b82f6", "#10b981", "#7c3aed", "#d97706", "#ec4899"], (v) => v.toString());
      if (sourceChart) {
        const img2 = workbook.addImage({ base64: sourceChart, extension: "png" });
        sheet.addImage(img2, {
          tl: { col: 13, row: 18 },
          ext: { width: 560, height: 280 }
        });
      }

      const priorityChart = drawDonutChartCanvas("PRIORITY LEVEL BREAKDOWN", Object.keys(priorityMap), Object.values(priorityMap), ["#ef4444", "#f59e0b", "#3b82f6"]);
      if (priorityChart) {
        const img3 = workbook.addImage({ base64: priorityChart, extension: "png" });
        sheet.addImage(img3, {
          tl: { col: 13, row: 33 },
          ext: { width: 520, height: 260 }
        });
      }

      const courseChart = drawHorizontalBarChartCanvas("TOP DEMANDED COURSES", sortedCourses.map(c => c[0]), sortedCourses.map(c => c[1]), ["#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1"], (v) => v.toString() + " Leads");
      if (courseChart) {
        const img4 = workbook.addImage({ base64: courseChart, extension: "png" });
        sheet.addImage(img4, {
          tl: { col: 13, row: 48 },
          ext: { width: 560, height: 280 }
        });
      }
    } catch (chartErr) {
      console.error("Failed adding charts to Leads Register report:", chartErr);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Leads_Register_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ══════════════════════════════════════════════════════════
  // 3. COUNSELLOR PERFORMANCE REPORT GENERATOR
  // ══════════════════════════════════════════════════════════
  const generateCounsellorExcel = async (master: any) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales Executive Performance");

    sheet.addRow(["SALES EXECUTIVE PERFORMANCE & CONVERSION SCORECARD"]);
    sheet.addRow([`Export Date: ${new Date().toLocaleString('en-IN')}`]);
    sheet.addRow([]);

    sheet.addRow([
      "Sales Executive Name", "Email", "Brand Scope", "Assigned Leads",
      "Demos Conducted", "Admissions Closed", "Conversion Rate %", "Total Revenue Collected (INR)"
    ]);
    sheet.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(4).eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } }); // Purple

    const statsMap: Record<string, any> = {};

    (master.enquiries || []).forEach((e: any) => {
      const cName = (e.assignedCrmAdvisor || "Unassigned").trim();
      const key = cName.toLowerCase();
      if (!statsMap[key]) {
        statsMap[key] = { name: cName, leads: 0, demos: 0, admissions: 0, revenue: 0 };
      }
      statsMap[key].leads++;
      if (e.isDemoScheduled || (e.demos && e.demos.length > 0) || (e.status || "").toLowerCase().includes("demo")) {
        statsMap[key].demos++;
      }
      if ((e.status || "").toLowerCase() === "admitted") {
        statsMap[key].admissions++;
        const fee = parseFloat(String(e.feesCollected || "0").replace(/[^0-9.]/g, ""));
        statsMap[key].revenue += isNaN(fee) ? 0 : fee;
      }
    });

    Object.values(statsMap).forEach((c: any, idx: number) => {
      const conv = c.leads > 0 ? ((c.admissions / c.leads) * 100).toFixed(1) + "%" : "0.0%";
      const row = sheet.addRow([c.name, "-", "-", c.leads, c.demos, c.admissions, conv, c.revenue]);
      if (idx % 2 === 1) {
        row.eachCell(cell => cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF5FF" } });
      }
    });

    sheet.columns.forEach(col => col.width = 22);

    // Embed Visual Chart Graphics into Counsellor Performance
    try {
      const cList = Object.values(statsMap);
      const names = cList.map((c: any) => c.name);
      const admissions = cList.map((c: any) => c.admissions);
      const revenues = cList.map((c: any) => c.revenue);
      const convPcts = cList.map((c: any) => c.leads > 0 ? parseFloat(((c.admissions / c.leads) * 100).toFixed(1)) : 0);

      const admChart = drawBarChartCanvas("SALES EXECUTIVE ADMISSIONS SCORECARD", names, admissions, ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"], (v) => v.toString());
      if (admChart) {
        const img1 = workbook.addImage({ base64: admChart, extension: "png" });
        sheet.addImage(img1, {
          tl: { col: 9, row: 3 },
          ext: { width: 560, height: 280 }
        });
      }

      const revChart = drawBarChartCanvas("SALES EXECUTIVE REVENUE COLLECTED (INR)", names, revenues, ["#4f46e5", "#059669", "#7c3aed", "#d97706"]);
      if (revChart) {
        const img2 = workbook.addImage({ base64: revChart, extension: "png" });
        sheet.addImage(img2, {
          tl: { col: 9, row: 18 },
          ext: { width: 560, height: 280 }
        });
      }

      const convChart = drawHorizontalBarChartCanvas("CONVERSION RATE SCORECARD %", names, convPcts, ["#06b6d4", "#ec4899", "#14b8a6", "#f97316"], (v) => v.toString() + "%");
      if (convChart) {
        const img3 = workbook.addImage({ base64: convChart, extension: "png" });
        sheet.addImage(img3, {
          tl: { col: 9, row: 33 },
          ext: { width: 560, height: 280 }
        });
      }
    } catch (chartErr) {
      console.error("Failed adding charts to Counsellor report:", chartErr);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Counsellor_Performance_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ══════════════════════════════════════════════════════════
  // 4. BRAND MANAGER PERFORMANCE REPORT GENERATOR
  // ══════════════════════════════════════════════════════════
  const generateBrandManagerExcel = async (master: any) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Centre Head Scorecard");

    sheet.addRow(["CENTRE HEAD & BRAND SCOPE PERFORMANCE SCORECARD"]);
    sheet.addRow([`Export Date: ${new Date().toLocaleString('en-IN')}`]);
    sheet.addRow([]);

    sheet.addRow([
      "Brand Name", "Brand ID", "Linked Companies", "Active Staff",
      "Total Enquiries", "Demos Conducted", "Admissions Closed", "Conversion %", "Total Revenue (INR)"
    ]);
    sheet.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(4).eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } }); // Blue

    (master.brands || []).forEach((b: any, idx: number) => {
      const bNameLower = (b.name || "").toLowerCase().trim();
      const bEnquiries = (master.enquiries || []).filter((e: any) =>
        (e.targetBrand || "").toLowerCase().trim() === bNameLower ||
        (e.brand || "").toLowerCase().trim() === bNameLower
      );

      const bDemos = bEnquiries.filter((e: any) => e.isDemoScheduled || (e.demos && e.demos.length > 0) || (e.status || "").toLowerCase().includes("demo")).length;
      const bAdmitted = bEnquiries.filter((e: any) => (e.status || "").toLowerCase() === "admitted").length;

      const bRev = (master.payments || []).reduce((sum: number, p: any) => {
        const admission = p.admissionId || {};
        const pBrand = (admission.brand || p.brand || "").toLowerCase().trim();
        return pBrand === bNameLower ? sum + Number(p.amountReceived || 0) : sum;
      }, 0);

      const conv = bEnquiries.length > 0 ? ((bAdmitted / bEnquiries.length) * 100).toFixed(1) + "%" : "0.0%";

      const row = sheet.addRow([
        b.name,
        b.brandId || "N/A",
        (b.companies || []).length,
        b.stats?.counsellorsCount || 1,
        bEnquiries.length,
        bDemos,
        bAdmitted,
        conv,
        bRev
      ]);

      if (idx % 2 === 1) {
        row.eachCell(cell => cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } });
      }
    });

    sheet.columns.forEach(col => col.width = 22);

    // Embed Visual Chart Graphics into Brand Performance
    try {
      const bNames: string[] = [];
      const bRevenues: number[] = [];
      const bAdmissions: number[] = [];

      (master.brands || []).forEach((b: any) => {
        const bNameLower = (b.name || "").toLowerCase().trim();
        const bEnquiries = (master.enquiries || []).filter((e: any) =>
          (e.targetBrand || "").toLowerCase().trim() === bNameLower ||
          (e.brand || "").toLowerCase().trim() === bNameLower
        );
        const bAdmitted = bEnquiries.filter((e: any) => (e.status || "").toLowerCase() === "admitted").length;
        const bRev = (master.payments || []).reduce((sum: number, p: any) => {
          const admission = p.admissionId || {};
          const pBrand = (admission.brand || p.brand || "").toLowerCase().trim();
          return pBrand === bNameLower ? sum + Number(p.amountReceived || 0) : sum;
        }, 0);

        bNames.push(b.name);
        bRevenues.push(bRev);
        bAdmissions.push(bAdmitted);
      });

      const brandChart = drawBarChartCanvas("BRAND REVENUE PERFORMANCE (INR)", bNames, bRevenues, ["#2563eb", "#10b981", "#7c3aed", "#f59e0b"]);
      if (brandChart) {
        const img1 = workbook.addImage({ base64: brandChart, extension: "png" });
        sheet.addImage(img1, {
          tl: { col: 10, row: 3 },
          ext: { width: 560, height: 280 }
        });
      }

      const admChart = drawBarChartCanvas("BRAND ADMISSIONS CLOSED", bNames, bAdmissions, ["#10b981", "#3b82f6", "#8b5cf6"], (v) => v.toString());
      if (admChart) {
        const img2 = workbook.addImage({ base64: admChart, extension: "png" });
        sheet.addImage(img2, {
          tl: { col: 10, row: 18 },
          ext: { width: 560, height: 280 }
        });
      }

      const compDonut = drawDonutChartCanvas("BRAND REVENUE SHARE DISTRIBUTION", bNames, bRevenues, ["#2563eb", "#10b981", "#7c3aed", "#f59e0b"]);
      if (compDonut) {
        const img3 = workbook.addImage({ base64: compDonut, extension: "png" });
        sheet.addImage(img3, {
          tl: { col: 10, row: 33 },
          ext: { width: 520, height: 260 }
        });
      }
    } catch (chartErr) {
      console.error("Failed adding charts to Brand Manager report:", chartErr);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `BrandManager_Performance_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ══════════════════════════════════════════════════════════
  // 5. OPERATIONAL EXPENSE REPORT GENERATOR WITH VISUAL GRAPHS
  // ══════════════════════════════════════════════════════════
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

  const generateExpenseExcel = async (master: any) => {
    const expenseList = master.expenses || [];
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CoachFlow ERP";
    workbook.created = new Date();

    // ── SHEET 1: VISUAL ANALYTICS & EXECUTIVE SUMMARY ──────────────────────────
    const summarySheet = workbook.addWorksheet("📊 Executive Summary & Graphs");

    summarySheet.addRow(["COACHFLOW ERP - OPERATIONAL EXPENSE VISUAL ANALYTICS REPORT"]);
    summarySheet.addRow([`Report Generated On: ${new Date().toLocaleString("en-IN")}`, `Total Records: ${expenseList.length}`]);
    summarySheet.addRow([]);

    summarySheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FF4F46E5" } };
    summarySheet.getRow(2).font = { size: 10, color: { argb: "FF64748B" } };

    const totalAmount = expenseList.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const variableAmount = expenseList
      .filter((e: any) => (e.expenseType || "variable").toLowerCase() === "variable")
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const fixedAmount = expenseList
      .filter((e: any) => (e.expenseType || "").toLowerCase() === "fixed")
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

    const cashAmount = expenseList
      .filter((e: any) => (e.paymentMode || "").toLowerCase() === "cash")
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
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

    summarySheet.addRow(["Total Operational Expenses", totalAmount, "100.0%", expenseList.length]);
    summarySheet.addRow([
      "Variable Expenses",
      variableAmount,
      totalAmount > 0 ? `${((variableAmount / totalAmount) * 100).toFixed(1)}%` : "0%",
      expenseList.filter((e: any) => (e.expenseType || "variable").toLowerCase() === "variable").length,
    ]);
    summarySheet.addRow([
      "Fixed Expenses",
      fixedAmount,
      totalAmount > 0 ? `${((fixedAmount / totalAmount) * 100).toFixed(1)}%` : "0%",
      expenseList.filter((e: any) => (e.expenseType || "").toLowerCase() === "fixed").length,
    ]);
    summarySheet.addRow([
      "Cash Payments",
      cashAmount,
      totalAmount > 0 ? `${((cashAmount / totalAmount) * 100).toFixed(1)}%` : "0%",
      expenseList.filter((e: any) => (e.paymentMode || "").toLowerCase() === "cash").length,
    ]);
    summarySheet.addRow([
      "Digital / Bank Transfers",
      bankAmount,
      totalAmount > 0 ? `${((bankAmount / totalAmount) * 100).toFixed(1)}%` : "0%",
      expenseList.filter((e: any) => (e.paymentMode || "").toLowerCase() !== "cash").length,
    ]);

    summarySheet.addRow([]);

    // Category Breakdown Table
    summarySheet.addRow(["2. EXPENSE CATEGORY BREAKDOWN SUMMARY"]);
    summarySheet.getRow(12).font = { bold: true, size: 11, color: { argb: "FF1E293B" } };

    const catHeader = summarySheet.addRow(["Category Name", "Total Billed (INR)", "% Share", "Transactions"]);
    catHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    catHeader.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } }));

    const categoryMap: Record<string, { total: number; count: number }> = {};
    expenseList.forEach((e: any) => {
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
      const { categoryPng, paymentPng, naturePng } = generateExpenseChartImages(expenseList);

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

    // Header Row (Row 1) matching user screenshot styling (#b4d7a8 green fill)
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

    expenseList.forEach((exp: any, idx: number) => {
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
        Number(exp.amount) || 0,
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
    saveAs(new Blob([buffer]), `Operational_Expense_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 font-sans overflow-hidden">
      {role === "admin" ? <Sidebar /> : <ManagerSidebar />}

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
        {/* Header Area */}
        <header className="h-20 px-8 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-10 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Executive Reports Center</h2>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={() => setIsProfileOpen(true)} className="flex items-center gap-3 hover:bg-slate-50 p-2 rounded-2xl transition-all border border-transparent hover:border-slate-200 cursor-pointer">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-extrabold text-slate-700 leading-tight">{user?.name}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user?.role}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center border-2 border-white shadow-md">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
            </button>
          </div>
        </header>

        <div className="p-8 space-y-8 max-w-6xl mx-auto w-full">
          {/* Executive Daily Business Intelligence Dashboard */}
          <DailyBiDashboard />

          <div className="pt-6 border-t border-slate-200">
            <h2 className="text-2xl font-black text-[#1e293b] tracking-tight">Excel Workbooks & WhatsApp Dispatch Center</h2>
            <p className="text-slate-500 font-medium mt-1">Export multi-sheet Excel workbooks or trigger instant WhatsApp PDF reports.</p>
          </div>

          {/* Daily & Monthly WhatsApp Report Trigger Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily WhatsApp Trigger */}
            <div className="bg-white border border-emerald-200/80 rounded-3xl p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Daily Executive PDF Report
                </h3>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-extrabold uppercase">
                  Daily WhatsApp
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Triggers 24-hour midnight dispatch & instant PDF summary on WhatsApp.</p>
              <button
                onClick={handleSendDailyWhatsAppReport}
                disabled={isSendingWhatsAppReport}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSendingWhatsAppReport ? "Sending PDF Report..." : "📲 Trigger Daily WhatsApp Report"}
              </button>
              {waReportStatus.text && <p className="text-[11px] font-bold text-emerald-700">{waReportStatus.text}</p>}
            </div>

            {/* Monthly MTD WhatsApp Trigger */}
            <div className="bg-white border border-indigo-200/80 rounded-3xl p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                  Monthly MTD PDF Report
                </h3>
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-[9px] font-extrabold uppercase">
                  Monthly MTD
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Aggregates Day 1 to Today MTD metrics into a formal executive PDF on WhatsApp.</p>
              <button
                onClick={handleSendMonthlyWhatsAppReport}
                disabled={isSendingMonthlyReport}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSendingMonthlyReport ? "Generating MTD PDF..." : "📊 Trigger Monthly MTD Report"}
              </button>
              {monthlyReportStatus.text && <p className="text-[11px] font-bold text-indigo-700">{monthlyReportStatus.text}</p>}
            </div>
          </div>

          {/* MAIN EXCEL REPORT EXPORT CENTER */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-slate-200/80 rounded-3xl shadow-xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                1. Select Report Type & Data Scope
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">Choose between Super Master Multi-Sheet workbooks, leads register, or performance scorecards.</p>
            </div>

            <div className="p-6 space-y-6">
              
              {/* REPORT TYPE SELECTOR TABS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[
                  { id: "super", label: "🌟 Super Master Report", desc: "Sheet 1: All Brands & Companies Summary + Separate sheets for each Brand & Company" },
                  { id: "leads", label: "📥 Leads & Enquiries", desc: "Full enquiry database register with contact, status & demo details" },
                  { id: "counsellors", label: "🏆 Sales Executive Performance", desc: "Per-sales executive leads, demos, admissions & fee collection scorecard" },
                  { id: "brandManagers", label: "🏢 Centre Head Analytics", desc: "Centre head performance, active staff & revenue per brand" },
                  { id: "expenses", label: "📊 Operational Expenses", desc: "Category, description, debit amount, payment mode, company, brand, bank & nature" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveReportTab(tab.id as any)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      activeReportTab === tab.id
                        ? "bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <span className={`text-xs font-extrabold block ${activeReportTab === tab.id ? "text-indigo-700" : "text-slate-800"}`}>
                        {tab.label}
                      </span>
                      <p className="text-[10px] font-semibold text-slate-500 mt-1 leading-snug">
                        {tab.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* DATE RANGE FILTER */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">2. Optional Date Range Filter</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Start Date</label>
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">End Date</label>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* DOWNLOAD TRIGGER ACTION */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  {message.text && (
                    <p className={`text-xs font-bold ${
                      message.type === 'error' ? 'text-rose-500' : 
                      message.type === 'success' ? 'text-emerald-600' : 'text-indigo-600'
                    }`}>
                      {message.text}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-6 py-3.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 min-w-[240px]"
                >
                  {isGenerating ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating Excel Workbook...
                    </>
                  ) : (
                    <>
                      <span>📥</span>
                      <span>Download {activeReportTab === "super" ? "Super Master Excel" : "Excel Report"}</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          </motion.div>

        </div>
      </div>
      
      {user && (
        <ProfileDisplay
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          user={user}
          logout={logout}
        />
      )}
    </div>
  );
}
