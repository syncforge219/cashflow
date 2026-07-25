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

export default function ReportsPageContent({ role }: ReportsPageContentProps) {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Filter States
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeReportTab, setActiveReportTab] = useState<"super" | "leads" | "counsellors" | "brandManagers">("super");

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

      sheet.addRow([
        "Enquiry ID", "Student Name", "Mobile", "Email", "Target Course",
        "Assigned Counsellor", "Lead Source", "Priority", "Status", "Fees Collected (INR)"
      ]);
      sheet.getRow(3).font = { bold: true };

      bEnquiries.forEach((e: any) => {
        sheet.addRow([
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

      sheet.addRow([
        "Receipt No", "Student Name", "Mobile", "Course Billed", "Brand",
        "Payment Date", "Payment Mode", "Reference No", "Amount Received (INR)"
      ]);
      sheet.getRow(3).font = { bold: true };

      compPayments.forEach((p: any) => {
        const admission = p.admissionId || {};
        sheet.addRow([
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

    (master.enquiries || []).forEach((e: any) => {
      sheet.addRow([
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
    });

    sheet.columns.forEach(col => col.width = 20);

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

    Object.values(statsMap).forEach((c: any) => {
      const conv = c.leads > 0 ? ((c.admissions / c.leads) * 100).toFixed(1) + "%" : "0.0%";
      sheet.addRow([c.name, "-", "-", c.leads, c.demos, c.admissions, conv, c.revenue]);
    });

    sheet.columns.forEach(col => col.width = 22);

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

    (master.brands || []).forEach((b: any) => {
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

      sheet.addRow([
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
    });

    sheet.columns.forEach(col => col.width = 22);

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `BrandManager_Performance_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { id: "super", label: "🌟 Super Master Report", desc: "Sheet 1: All Brands & Companies Summary + Separate sheets for each Brand & Company" },
                  { id: "leads", label: "📥 Leads & Enquiries", desc: "Full enquiry database register with contact, status & demo details" },
                  { id: "counsellors", label: "🏆 Sales Executive Performance", desc: "Per-sales executive leads, demos, admissions & fee collection scorecard" },
                  { id: "brandManagers", label: "🏢 Centre Head Analytics", desc: "Centre head performance, active staff & revenue per brand" }
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
