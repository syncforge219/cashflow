"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "../../component/context/user-context";
import Sidebar from "@/components/Sidebar";
import { useRouter } from "next/navigation";
import ProfileDisplay from "@/components/ProfileDisplay";
import CommandPalette from "@/components/CommandPalette";
import DashboardFilter from "@/components/DashboardFilter";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import StudentSearchCenter from "@/components/StudentSearchCenter";
import AddBatchModal from "@/components/AddBatchModal";
import AdmissionBreakdownModal from "@/components/AdmissionBreakdownModal";

export default function AdminDashboard() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isAdmissionBreakdownOpen, setIsAdmissionBreakdownOpen] = useState(false);

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const defaultStart = new Date(currentYear, currentMonth, 1).toISOString().split("T")[0];
  const defaultEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString().split("T")[0];
  const defaultLabel = `${MONTHS[currentMonth]} ${currentYear}`;

  const [startDate, setStartDate] = useState<string | null>(defaultStart);
  const [endDate, setEndDate] = useState<string | null>(defaultEnd);
  const [filterLabel, setFilterLabel] = useState<string>(defaultLabel);

  const [trendMode, setTrendMode] = useState<"daily" | "cumulative">("daily");
  const [hoveredTrendDay, setHoveredTrendDay] = useState<any>(null);
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [enquiryToDelete, setEnquiryToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingWeeklyReport, setIsSendingWeeklyReport] = useState(false);

  const handleSendWeeklyReport = async () => {
    setIsSendingWeeklyReport(true);
    try {
      const res = await fetch("/api/email/send-weekly-report", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Success: ${data.message}`);
      } else {
        alert(`❌ Email Error: ${data.error}`);
      }
    } catch (err: any) {
      alert("Error triggering report email: " + err.message);
    } finally {
      setIsSendingWeeklyReport(false);
    }
  };

  const handleCheckOverdueEmis = async () => {
    try {
      const res = await fetch("/api/email/check-overdue-emis", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Overdue Scan Complete: Sent ${data.emailsSentCount} overdue EMI email reminders.`);
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err: any) {
      alert("Error scanning overdue EMIs: " + err.message);
    }
  };

  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications?status=Pending");
      const data = await res.json();
      if (res.ok && data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error("Failed fetching notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleApproveRejectDiscount = async (notificationId: string, action: "Approved" | "Rejected") => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId, action })
      });
      const data = await res.json();
      if (data.success) {
        fetchNotifications();
      }
    } catch (err) {
      console.error("Failed updating discount approval:", err);
    }
  };

  useEffect(() => {
    if (user?.role === "counsellor") {
      router.replace("/counsellor-dashboard");
    } else if (user?.role === "brand manager") {
      router.replace("/manager-dashboard");
    } else if (user?.role === "teacher") {
      router.replace("/teacher-dashboard");
    } else if (user?.role === "crm" || user?.role === "crm executive" || user?.role === "crm advisor") {
      router.replace("/crm-dashboard");
    }
  }, [user, router]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (user?.role !== "counsellor") {
      setIsLoading(true);
      let url = "/api/admin-dashboard/stats";
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      }
      fetch(url)
        .then(res => res.json())
        .then(resData => {
          if (resData.success) {
            setData(resData.data);
          }
          setIsLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch dashboard data:", err);
          setIsLoading(false);
        });
    }
  }, [user, startDate, endDate]);

  if (!user || user.role === "counsellor" || user.role === "brand manager" || user.role === "teacher") return null;

  const initialLetter = user.name ? user.name.charAt(0).toUpperCase() : "A";

  // Data for Metric Cards with Hover Color Gradients
  const metrics = [
    {
      name: "Total Leads",
      value: data?.kpis?.totalLeads || 0,
      trend: filterLabel === "Overall" ? "Overall" : `Filtered: ${filterLabel}`,
      isGreen: true,
      borderAccent: "border-l-4 border-blue-500",
      hoverGradient: "hover:bg-gradient-to-br hover:from-blue-50/90 hover:via-indigo-50/50 hover:to-white hover:border-blue-300",
      pillClass: "text-blue-700 bg-blue-50 border-blue-200/60"
    },
    {
      name: "Today's Admissions",
      value: data?.kpis?.admissionsToday || 0,
      trend: "Today",
      isGreen: true,
      borderAccent: "border-l-4 border-teal-500",
      hoverGradient: "hover:bg-gradient-to-br hover:from-teal-50/90 hover:via-emerald-50/50 hover:to-white hover:border-teal-300",
      pillClass: "text-teal-700 bg-teal-50 border-teal-200/60"
    },
    {
      name: "Today's Collection",
      value: data?.kpis?.todayCollection || "₹0",
      trend: "Today",
      isGreen: true,
      borderAccent: "border-l-4 border-emerald-500",
      hoverGradient: "hover:bg-gradient-to-br hover:from-emerald-50/90 hover:via-green-50/50 hover:to-white hover:border-emerald-300",
      pillClass: "text-emerald-700 bg-emerald-50 border-emerald-200/60"
    },
    {
      name: "Monthly Collection",
      value: data?.kpis?.monthlyCollection || "₹0 L",
      trend: "Current Month",
      isGreen: true,
      borderAccent: "border-l-4 border-purple-500",
      hoverGradient: "hover:bg-gradient-to-br hover:from-purple-50/90 hover:via-indigo-50/50 hover:to-white hover:border-purple-300",
      pillClass: "text-purple-700 bg-purple-50 border-purple-200/60"
    },
    {
      name: "Total Revenue",
      value: data?.kpis?.revenue || "₹0 L",
      trend: "Total Collections",
      isGreen: true,
      borderAccent: "border-l-4 border-indigo-500",
      hoverGradient: "hover:bg-gradient-to-br hover:from-indigo-50/90 hover:via-blue-50/50 hover:to-white hover:border-indigo-300",
      pillClass: "text-indigo-700 bg-indigo-50 border-indigo-200/60"
    },
    {
      name: "Total Payroll",
      value: data?.kpis?.totalPayroll || "₹0 L",
      trend: "Paid Staff Salaries",
      isGreen: false,
      borderAccent: "border-l-4 border-rose-500",
      hoverGradient: "hover:bg-gradient-to-br hover:from-rose-50/90 hover:via-pink-50/50 hover:to-white hover:border-rose-300",
      pillClass: "text-rose-700 bg-rose-50 border-rose-200/60"
    },
    {
      name: "Total Expenses",
      value: data?.kpis?.totalExpenses || "₹0 L",
      trend: "Operational Overhead",
      isGreen: false,
      borderAccent: "border-l-4 border-amber-500",
      hoverGradient: "hover:bg-gradient-to-br hover:from-amber-50/90 hover:via-orange-50/50 hover:to-white hover:border-amber-300",
      pillClass: "text-amber-800 bg-amber-50 border-amber-200/60"
    },
    {
      name: "Net Profit",
      value: data?.kpis?.netProfit || "₹0 L",
      trend: `Margin: ${data?.kpis?.profitMargin || "0%"}`,
      isGreen: data?.kpis?.isProfitable ?? true,
      borderAccent: data?.kpis?.isProfitable ?? true ? "border-l-4 border-emerald-500" : "border-l-4 border-rose-500",
      hoverGradient: data?.kpis?.isProfitable ?? true ? "hover:bg-gradient-to-br hover:from-emerald-50/90 hover:via-teal-50/50 hover:to-white hover:border-emerald-300" : "hover:bg-gradient-to-br hover:from-rose-50/90 hover:via-red-50/50 hover:to-white hover:border-rose-300",
      pillClass: data?.kpis?.isProfitable ?? true ? "text-emerald-700 bg-emerald-50 border-emerald-200/60" : "text-rose-700 bg-rose-50 border-rose-200/60"
    },
    {
      name: "Conversion Rate",
      value: data?.kpis?.conversionRate || "0%",
      trend: filterLabel === "Overall" ? "Overall" : filterLabel,
      isGreen: true,
      borderAccent: "border-l-4 border-cyan-500",
      hoverGradient: "hover:bg-gradient-to-br hover:from-cyan-50/90 hover:via-blue-50/50 hover:to-white hover:border-cyan-300",
      pillClass: "text-cyan-700 bg-cyan-50 border-cyan-200/60"
    },
    {
      name: "Pending Approvals",
      value: data?.kpis?.pendingApprovals || 0,
      trend: "Needs Action",
      isGreen: false,
      borderAccent: "border-l-4 border-orange-500",
      hoverGradient: "hover:bg-gradient-to-br hover:from-orange-50/90 hover:via-amber-50/50 hover:to-white hover:border-orange-300",
      pillClass: "text-orange-800 bg-orange-50 border-orange-200/60"
    },
    {
      name: "EMI Overdue Summary",
      value: data?.kpis?.emiOverdueAmount || "₹0 L",
      trend: `${data?.kpis?.emiOverdueCount || 0} Overdue Students`,
      isGreen: false,
      borderAccent: "border-l-4 border-red-500",
      hoverGradient: "hover:bg-gradient-to-br hover:from-red-50/90 hover:via-rose-50/50 hover:to-white hover:border-red-300",
      pillClass: "text-red-700 bg-red-50 border-red-200/60"
    },
    {
      name: "Hot Negotiation Leads",
      value: data?.kpis?.hotLeads || 0,
      trend: "High Priority",
      isGreen: true,
      borderAccent: "border-l-4 border-rose-500",
      hoverGradient: "hover:bg-gradient-to-br hover:from-rose-50/90 hover:via-orange-50/50 hover:to-white hover:border-rose-300",
      pillClass: "text-rose-700 bg-rose-50 border-rose-200/60",
      simpleText: true
    }
  ];

  const processedTrendDays = React.useMemo(() => {
    if (!data?.trendDays) return [];
    if (trendMode === "daily") return data.trendDays;

    let runningLeads = 0;
    let runningAdmissions = 0;
    let runningLost = 0;
    let runningFollowups = 0;

    return data.trendDays.map((d: any) => {
      runningLeads += d.newLeads || 0;
      runningAdmissions += d.admissions || 0;
      runningLost += d.lostLeads || 0;
      runningFollowups += d.followUps || 0;

      return {
        ...d,
        newLeads: runningLeads,
        admissions: runningAdmissions,
        lostLeads: runningLost,
        followUps: runningFollowups,
      };
    });
  }, [data?.trendDays, trendMode]);

  // Trend line chart generation
  const maxVal = Math.max(
    ...(processedTrendDays.map((d: any) => Math.max(d.newLeads, d.admissions, d.lostLeads, d.followUps)) || [0]),
    10
  );

  const generatePath = (key: string) => {
    if (!processedTrendDays || processedTrendDays.length === 0) return "";
    const totalPoints = processedTrendDays.length;
    const step = 600 / Math.max(1, totalPoints - 1);
    return processedTrendDays.map((d: any, i: number) => {
      const x = i * step;
      const y = 160 - ((d[key] || 0) / maxVal) * 140;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ");
  };

  // Donut chart generation
  let currentOffset = 0;
  const donutCircles = (data?.enquiriesBySource || []).map((source: any, i: number) => {
    const strokeDasharray = `${source.pctNum} ${100 - source.pctNum}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += source.pctNum;
    return (
      <circle key={i} cx="18" cy="18" r="15.915" fill="transparent" stroke={source.hex} strokeWidth="3" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} />
    );
  });

  const handleMarkLost = async () => {
    if (!enquiryToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/enquiries/${enquiryToDelete.dbId}?lostLead=true`, {
        method: "DELETE"
      });
      const result = await res.json();
      if (result.success) {
        let url = "/api/admin-dashboard/stats";
        if (startDate && endDate) {
          url += `?startDate=${startDate}&endDate=${endDate}`;
        }
        const refetchRes = await fetch(url);
        const refetchData = await refetchRes.json();
        if (refetchData.success) {
          setData(refetchData.data);
        }
        setIsDeleteModalOpen(false);
        setEnquiryToDelete(null);
      } else {
        alert("Failed to mark as lost: " + result.error);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while marking as lost");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8faff] text-slate-800 overflow-hidden font-sans transition-colors duration-200">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 space-y-6">

        {/* ELEGANT HEADER */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/80 pb-4 shrink-0">
          <div>
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 select-none">
              <span>CoachFlow</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800 font-bold tracking-tight">Executive Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="relative w-full sm:w-64 flex items-center justify-between pl-3.5 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-blue-50/50 hover:border-indigo-300 transition-all text-slate-400 group shadow-xs"
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 mr-2 group-hover:text-indigo-600 transition-colors">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                </svg>
                Search financials & leads...
              </div>
              <span className="flex items-center pointer-events-none text-[9px] font-bold text-slate-400/80 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded">
                CTRL+K
              </span>
            </button>
            <ProfileDisplay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} logout={logout} />

            <div className="flex items-center gap-2.5 border-l border-slate-200 pl-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-900">{user.name}</div>
                <div className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">{user.role}</div>
              </div>
              <button
                onClick={() => setIsProfileOpen(true)}
                className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white font-bold text-xs flex items-center justify-center border border-indigo-500 shadow-xs hover:from-indigo-700 hover:to-indigo-800 transition-all cursor-pointer overflow-hidden shrink-0"
                title="View Profile Details"
              >
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt={user.name} className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : null}
                <span className={user.photoUrl ? "hidden" : "block"}>{initialLetter}</span>
              </button>
            </div>
          </div>
        </header>

        {/* ADMIN PENDING DISCOUNT APPROVAL NOTIFICATIONS BANNER */}
        {notifications.length > 0 && (
          <div className="space-y-3 shrink-0">
            {notifications.map((notif: any) => (
              <div
                key={notif._id}
                className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 text-amber-900 rounded-xl text-lg shrink-0">
                    🚨
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{notif.title}</h4>
                      <span className="text-[9px] font-bold bg-amber-200/80 text-amber-900 px-2.5 py-0.5 rounded-full uppercase border border-amber-300">
                        Requires Approval
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-1">{notif.message}</p>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 mt-1">
                      <span>Requested Discount: <strong className="text-rose-600">₹{Number(notif.requestedDiscount || 0).toLocaleString('en-IN')}</strong></span>
                      <span>•</span>
                      <span>Course Cap: <strong className="text-slate-800">₹{Number(notif.maxAllowedDiscount || 5000).toLocaleString('en-IN')}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleApproveRejectDiscount(notif._id, "Approved")}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    Approve Discount
                  </button>
                  <button
                    onClick={() => handleApproveRejectDiscount(notif._id, "Rejected")}
                    className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ELEGANT QUICK ACTIONS BAR WITH GRADIENT HOVER BUTTONS */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs flex items-center gap-3 overflow-hidden shrink-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 select-none shrink-0 border-r border-slate-200 pr-3">
            Quick Actions:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5 w-full">
            <button
              onClick={() => router.push("/payroll")}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all duration-300 hover:bg-gradient-to-r hover:from-emerald-500 hover:to-teal-600 hover:text-white hover:border-emerald-500 cursor-pointer shrink-0 shadow-xs"
            >
              Payroll
            </button>
            <button
              onClick={() => router.push("/expenses")}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all duration-300 hover:bg-gradient-to-r hover:from-rose-500 hover:to-pink-600 hover:text-white hover:border-rose-500 cursor-pointer shrink-0 shadow-xs"
            >
              Expenses
            </button>
            <button
              onClick={() => router.push("/admin-dashboard/brands")}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-500 hover:to-indigo-600 hover:text-white hover:border-blue-500 cursor-pointer shrink-0 shadow-xs"
            >
              Brands
            </button>
            <button
              onClick={() => router.push("/companies")}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all duration-300 hover:bg-gradient-to-r hover:from-purple-500 hover:to-indigo-600 hover:text-white hover:border-purple-500 cursor-pointer shrink-0 shadow-xs"
            >
              Companies
            </button>
            <button
              onClick={() => router.push("/counsellors")}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all duration-300 hover:bg-gradient-to-r hover:from-teal-500 hover:to-cyan-600 hover:text-white hover:border-teal-500 cursor-pointer shrink-0 shadow-xs"
            >
              Users
            </button>
            <button
              onClick={() => router.push("/admin-dashboard/reports")}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all duration-300 hover:bg-gradient-to-r hover:from-amber-500 hover:to-orange-600 hover:text-white hover:border-amber-500 cursor-pointer shrink-0 shadow-xs"
            >
              Reports
            </button>
            <button
              onClick={() => setIsBatchModalOpen(true)}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all duration-300 hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-600 hover:text-white hover:border-indigo-500 cursor-pointer shrink-0 shadow-xs"
            >
              Create Batch
            </button>
            <button
              onClick={handleSendWeeklyReport}
              disabled={isSendingWeeklyReport}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all duration-300 hover:bg-gradient-to-r hover:from-purple-500 hover:to-pink-600 hover:text-white hover:border-purple-500 cursor-pointer shrink-0 shadow-xs disabled:opacity-50"
            >
              {isSendingWeeklyReport ? "Sending..." : "Weekly Report"}
            </button>
            <button
              onClick={handleCheckOverdueEmis}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all duration-300 hover:bg-gradient-to-r hover:from-rose-500 hover:to-red-600 hover:text-white hover:border-rose-500 cursor-pointer shrink-0 shadow-xs"
            >
              Overdue EMIs
            </button>
            <button
              onClick={() => {
                if (!data?.enquiriesList) return;
                const csvContent = "data:text/csv;charset=utf-8," + ["ID,Student,Course,Counsellor,Stage"].concat(data.enquiriesList.map((e: any) => `${e.id},${e.student},${e.course},${e.counsellor},${e.stage}`)).join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `CoachFlow_Export_${new Date().toISOString().split("T")[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs ml-auto"
            >
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />

        <div className="space-y-6">
          {/* Student Search & Action Center */}
          <StudentSearchCenter />

          <DashboardFilter
            currentLabel={filterLabel}
            onFilterChange={(start, end, label) => {
              setStartDate(start);
              setEndDate(end);
              setFilterLabel(label);
            }}
          />

          {/* 12 ELEGANT KPI METRIC CARDS WITH COLORFUL HOVER GRADIENTS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-6 gap-3.5">
            {isLoading && !data ? (
              Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between h-28 animate-pulse">
                  <div className="h-3 w-20 bg-slate-200 rounded-md"></div>
                  <div className="h-7 w-16 bg-slate-200 rounded-lg my-2"></div>
                  <div className="h-4 w-16 bg-slate-100 rounded-md"></div>
                </div>
              ))
            ) : (
              metrics.map((card, i) => {
                const isAdmCard = card.name.toLowerCase().includes("admission");
                return (
                  <div
                    key={i}
                    onClick={() => {
                      if (isAdmCard) {
                        setIsAdmissionBreakdownOpen(true);
                      }
                    }}
                    className={`bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group ${card.borderAccent || ""} ${card.hoverGradient || ""} ${
                      isAdmCard
                        ? "cursor-pointer ring-2 ring-indigo-500/10 hover:border-indigo-400"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider select-none leading-snug group-hover:text-slate-700 transition-colors">
                        {card.name}
                      </span>
                      {isAdmCard && (
                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">
                          Click for Details
                        </span>
                      )}
                    </div>

                    <div className="my-2 flex items-baseline gap-1">
                      <span className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
                        {card.value}
                      </span>
                    </div>

                    <span
                      className={`text-[9.5px] font-bold rounded-md px-2 py-0.5 w-fit border ${
                        card.pillClass
                          ? card.pillClass
                          : card.simpleText
                          ? "text-slate-600 bg-slate-100 border-slate-200"
                          : card.isGreen
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200/60"
                          : "text-rose-700 bg-rose-50 border-rose-200/60"
                      }`}
                    >
                      {card.trend}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <AdmissionBreakdownModal
            isOpen={isAdmissionBreakdownOpen}
            onClose={() => setIsAdmissionBreakdownOpen(false)}
            filterLabel={filterLabel}
            startDate={startDate}
            endDate={endDate}
          />

          {/* FINANCIAL PROFIT & LOSS COMMAND CENTER WITH GRADIENT HOVER CARDS */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">Financial Profit & Loss Command Center</h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      (data?.financialSummary?.netProfit || 0) >= 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    Margin: {data?.financialSummary?.profitMargin || "0%"}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                  Calculated from Total Billed Fee Revenue vs Staff Payroll and Operational Expenses
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push("/payroll")}
                  className="px-3.5 py-1.5 bg-slate-50 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 text-slate-700 hover:text-indigo-700 text-xs font-semibold rounded-xl border border-slate-200 hover:border-indigo-200 transition-all cursor-pointer"
                >
                  Manage Payroll
                </button>
                <button
                  onClick={() => router.push("/expenses")}
                  className="px-3.5 py-1.5 bg-slate-50 hover:bg-gradient-to-r hover:from-rose-50 hover:to-pink-50 text-slate-700 hover:text-rose-700 text-xs font-semibold rounded-xl border border-slate-200 hover:border-rose-200 transition-all cursor-pointer"
                >
                  Track Expenses
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border-l-4 border-indigo-500 border border-slate-200/80 rounded-xl p-4 space-y-1 shadow-xs transition-all duration-300 hover:bg-gradient-to-br hover:from-indigo-50/80 hover:to-blue-50/40 hover:border-indigo-300 hover:shadow-md">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue (Billed)</span>
                <div className="text-2xl font-bold text-slate-900">
                  {(data?.financialSummary?.revenue || 0) >= 100000
                    ? `₹${(data.financialSummary.revenue / 100000).toFixed(2)} L`
                    : `₹${(data?.financialSummary?.revenue || 0).toLocaleString("en-IN")}`}
                </div>
                <span className="text-[10px] text-indigo-600 font-semibold block pt-1 border-t border-slate-100">
                  Collections: ₹{(data?.financialSummary?.collections || data?.financialSummary?.revenue || 0).toLocaleString("en-IN")}
                </span>
              </div>

              <div className="bg-white border-l-4 border-purple-500 border border-slate-200/80 rounded-xl p-4 space-y-1 shadow-xs transition-all duration-300 hover:bg-gradient-to-br hover:from-purple-50/80 hover:to-indigo-50/40 hover:border-purple-300 hover:shadow-md">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Staff Payroll</span>
                <div className="text-2xl font-bold text-slate-900">
                  {(data?.financialSummary?.payroll || 0) >= 100000
                    ? `₹${(data.financialSummary.payroll / 100000).toFixed(2)} L`
                    : `₹${(data?.financialSummary?.payroll || 0).toLocaleString("en-IN")}`}
                </div>
                <span className="text-[10px] text-purple-600 font-semibold block pt-1 border-t border-slate-100">
                  ₹{(data?.financialSummary?.payroll || 0).toLocaleString("en-IN")} paid
                </span>
              </div>

              <div className="bg-white border-l-4 border-amber-500 border border-slate-200/80 rounded-xl p-4 space-y-1 shadow-xs transition-all duration-300 hover:bg-gradient-to-br hover:from-amber-50/80 hover:to-orange-50/40 hover:border-amber-300 hover:shadow-md">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Operational Expenses</span>
                <div className="text-2xl font-bold text-slate-900">
                  {(data?.financialSummary?.expenses || 0) >= 100000
                    ? `₹${(data.financialSummary.expenses / 100000).toFixed(2)} L`
                    : `₹${(data?.financialSummary?.expenses || 0).toLocaleString("en-IN")}`}
                </div>
                <span className="text-[10px] text-amber-700 font-semibold block pt-1 border-t border-slate-100">
                  ₹{(data?.financialSummary?.expenses || 0).toLocaleString("en-IN")} spent
                </span>
              </div>

              <div className={`bg-white ${ (data?.financialSummary?.netProfit || 0) >= 0 ? "border-l-4 border-emerald-500 hover:bg-gradient-to-br hover:from-emerald-50/80 hover:to-teal-50/40 hover:border-emerald-300" : "border-l-4 border-rose-500 hover:bg-gradient-to-br hover:from-rose-50/80 hover:to-red-50/40 hover:border-rose-300" } border border-slate-200/80 rounded-xl p-4 space-y-1 shadow-xs transition-all duration-300 hover:shadow-md`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Net Profit (Bottom Line)
                </span>
                <div className={`text-2xl font-bold ${ (data?.financialSummary?.netProfit || 0) >= 0 ? "text-emerald-600" : "text-rose-600" }`}>
                  {Math.abs(data?.financialSummary?.netProfit || 0) >= 100000
                    ? `₹${((data?.financialSummary?.netProfit || 0) / 100000).toFixed(2)} L`
                    : `₹${(data?.financialSummary?.netProfit || 0).toLocaleString("en-IN")}`}
                </div>
                <span className={`text-[10px] font-semibold block pt-1 border-t border-slate-100 ${ (data?.financialSummary?.netProfit || 0) >= 0 ? "text-emerald-600" : "text-rose-600" }`}>
                  ₹{(data?.financialSummary?.netProfit || 0).toLocaleString("en-IN")} net
                </span>
              </div>
            </div>

            {/* Segmented Progress Bar */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between text-xs font-bold text-slate-700 select-none">
                <span>Revenue vs Outflow Allocation</span>
                <span className="text-slate-400 font-medium text-[11px]">
                  Total Outflow: ₹{(data?.financialSummary?.outflow || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-slate-200/70">
                <div
                  style={{
                    width: `${
                      (data?.financialSummary?.revenue || 0) > 0
                        ? Math.min(
                            100,
                            ((data?.financialSummary?.payroll || 0) / (data?.financialSummary?.revenue || 1)) * 100
                          )
                        : 0
                    }%`,
                  }}
                  className="bg-purple-500 h-full rounded-l-full transition-all"
                  title="Payroll Payouts"
                ></div>
                <div
                  style={{
                    width: `${
                      (data?.financialSummary?.revenue || 0) > 0
                        ? Math.min(
                            100,
                            ((data?.financialSummary?.expenses || 0) / (data?.financialSummary?.revenue || 1)) * 100
                          )
                        : 0
                    }%`,
                  }}
                  className="bg-amber-500 h-full transition-all"
                  title="Operational Expenses"
                ></div>
                <div
                  style={{
                    width: `${
                      (data?.financialSummary?.revenue || 0) > 0 && (data?.financialSummary?.netProfit || 0) > 0
                        ? Math.min(
                            100,
                            ((data?.financialSummary?.netProfit || 0) / (data?.financialSummary?.revenue || 1)) * 100
                          )
                        : 0
                    }%`,
                  }}
                  className="bg-emerald-500 h-full rounded-r-full transition-all"
                  title="Net Profit"
                ></div>
              </div>

              <div className="flex items-center gap-5 text-[10.5px] font-semibold text-slate-500 pt-1 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-500"></span> Payroll (
                  {data?.financialSummary?.revenue > 0
                    ? ((data.financialSummary.payroll / data.financialSummary.revenue) * 100).toFixed(1)
                    : 0}
                  %)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span> Operational Expenses (
                  {data?.financialSummary?.revenue > 0
                    ? ((data.financialSummary.expenses / data.financialSummary.revenue) * 100).toFixed(1)
                    : 0}
                  %)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> Net Profit (
                  {data?.financialSummary?.profitMargin || "0%"})
                </span>
              </div>
            </div>
          </div>

          {/* TREND CHART & MARKETING SOURCE DONUT GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider select-none">
                    Lead Trend ({filterLabel === "Overall" ? "Last 30 Days" : filterLabel})
                  </h2>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setTrendMode("daily")}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${trendMode === "daily" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      Daily
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendMode("cumulative")}
                      className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${trendMode === "cumulative" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      Cumulative
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 select-none">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span> Total Leads
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 select-none">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Admissions
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 select-none">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span> Lost Leads
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5 select-none">
                    <span className="h-2 w-2 rounded-full bg-amber-500"></span> Follow-ups
                  </span>
                </div>
              </div>

              <div className="relative w-full h-48 group">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 600 180" preserveAspectRatio="none">
                  <line x1="0" y1="30" x2="600" y2="30" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1="70" x2="600" y2="70" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1="110" x2="600" y2="110" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1="150" x2="600" y2="150" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />

                  <path d={generatePath('newLeads')} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={generatePath('admissions')} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={generatePath('lostLeads')} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={generatePath('followUps')} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Vertical Guide Line on Hover */}
                  {hoveredTrendIndex !== null && processedTrendDays && (
                    <line
                      x1={hoveredTrendIndex * (600 / Math.max(1, processedTrendDays.length - 1))}
                      y1="10"
                      x2={hoveredTrendIndex * (600 / Math.max(1, processedTrendDays.length - 1))}
                      y2="160"
                      stroke="#64748b"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* Invisible Hover Rectangles */}
                  {processedTrendDays?.map((d: any, i: number) => {
                    const step = 600 / Math.max(1, processedTrendDays.length - 1);
                    const cx = i * step;
                    return (
                      <rect
                        key={i}
                        x={cx - step / 2}
                        y="0"
                        width={step}
                        height="180"
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => {
                          setHoveredTrendDay(d);
                          setHoveredTrendIndex(i);
                        }}
                        onMouseLeave={() => {
                          setHoveredTrendDay(null);
                          setHoveredTrendIndex(null);
                        }}
                      />
                    );
                  })}
                </svg>

                {/* Interactive Tooltip Popover */}
                {hoveredTrendDay && hoveredTrendIndex !== null && processedTrendDays && (
                  <div
                    className="absolute top-2 pointer-events-none bg-slate-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl shadow-xl z-30 border border-slate-700 transition-all"
                    style={{
                      left: `${Math.min(82, Math.max(8, (hoveredTrendIndex / Math.max(1, processedTrendDays.length - 1)) * 100))}%`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    <div className="font-bold text-[11px] text-slate-300 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between gap-4">
                      <span>{hoveredTrendDay.dateLabel}</span>
                      <span className="text-[9px] text-indigo-400 font-bold uppercase">{trendMode === "daily" ? "Daily Count" : "Cumulative Total"}</span>
                    </div>
                    <div className="space-y-1 text-[10px] font-semibold">
                      <div className="flex justify-between items-center gap-3">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500"></span> {trendMode === "daily" ? "New Leads Today" : "Total Leads to Date"}:</span>
                        <span className="font-bold text-white">{hoveredTrendDay.newLeads}</span>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> Admissions:</span>
                        <span className="font-bold text-emerald-400">{hoveredTrendDay.admissions}</span>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500"></span> Follow-ups:</span>
                        <span className="font-bold text-amber-400">{hoveredTrendDay.followUps}</span>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500"></span> Lost Leads:</span>
                        <span className="font-bold text-rose-400">{hoveredTrendDay.lostLeads}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-2 px-2 select-none">
                {processedTrendDays?.filter((_: any, i: number) => i % Math.max(1, Math.floor((processedTrendDays.length || 30) / 6)) === 0).map((d: any, idx: number) => (
                  <span key={idx}>{d.dateLabel}</span>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider select-none">Lead Source Channels</h2>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 select-none">
                    Live Mix
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5 select-none">Marketing acquisition distribution</p>
              </div>

              <div className="my-auto py-3 flex flex-col items-center justify-center">
                <div className="h-32 w-32 relative flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90 drop-shadow-xs" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="3" />
                    {donutCircles}
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-2xl font-bold text-slate-900 tracking-tight">
                      {data?.kpis?.totalLeads ?? 0}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider select-none">
                      Total Leads
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-slate-100">
                {data?.enquiriesBySource?.map((src: any, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${src.color || "bg-indigo-500"}`}></span>
                        <span className="font-semibold text-slate-700">{src.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{src.pct}</span>
                        <span className="text-[10px] font-semibold text-slate-400">({src.count || 0})</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${src.color || "bg-indigo-500"}`}
                        style={{ width: src.pct || "0%" }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COUNSELLOR, BRAND, AND COMPANY PERFORMANCE TABLES GRID */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider select-none">Counsellor Performance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                      <th className="py-2.5 px-2 whitespace-nowrap select-none">Counsellor</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Assigned</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Follow-ups</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Admissions</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Conv %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 font-semibold text-slate-700">
                    {data?.counsellorPerformance?.map((c: any, i: number) => (
                      <tr key={i} className="hover:bg-gradient-to-r hover:from-teal-50/40 hover:to-slate-50 transition-colors">
                        <td className="py-2.5 px-2 text-slate-900 font-bold capitalize whitespace-nowrap">{c.name}</td>
                        <td className="py-2.5 px-2 text-right font-medium">{c.assigned}</td>
                        <td className="py-2.5 px-2 text-right font-medium">{c.followups}</td>
                        <td className="py-2.5 px-2 text-right font-bold text-emerald-600">{c.admissions}</td>
                        <td className="py-2.5 px-2 text-right font-bold text-slate-800">{c.conversion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider select-none">Brand Performance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                      <th className="py-2.5 px-2 whitespace-nowrap select-none">Brand</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Leads</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Admissions</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Revenue</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Conv %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 font-semibold text-slate-700">
                    {data?.brandPerformance?.map((b: any, i: number) => (
                      <tr key={i} className="hover:bg-gradient-to-r hover:from-indigo-50/40 hover:to-slate-50 transition-colors">
                        <td className="py-2.5 px-2 text-slate-900 font-bold whitespace-nowrap">{b.name}</td>
                        <td className="py-2.5 px-2 text-right font-medium">{b.leads}</td>
                        <td className="py-2.5 px-2 text-right font-medium">{b.admissions}</td>
                        <td className="py-2.5 px-2 text-right font-bold text-indigo-600">{b.revenue}</td>
                        <td className="py-2.5 px-2 text-right font-bold text-emerald-600">{b.achievePct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider select-none">Company Limit & Utilization</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                      <th className="py-2.5 px-2 whitespace-nowrap select-none">Company</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Collection</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Used %</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 font-semibold text-slate-700">
                    {data?.companyUtilization?.map((c: any, i: number) => (
                      <tr key={i} className="hover:bg-gradient-to-r hover:from-purple-50/40 hover:to-slate-50 transition-colors">
                        <td className="py-2.5 px-2 text-slate-900 font-bold whitespace-nowrap">{c.name}</td>
                        <td className="py-2.5 px-2 text-right font-medium">{c.collection}</td>
                        <td className="py-2.5 px-2 text-right font-bold text-emerald-600">{c.usedPct}</td>
                        <td className="py-2.5 px-2 text-right font-medium">{c.remaining}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider select-none mb-4 flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span>System Work Queue</span>
              </h2>
              <div className="space-y-3 font-semibold text-xs">
                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-xl transition-all hover:bg-gradient-to-r hover:from-indigo-50/80 hover:to-blue-50/40 hover:border-indigo-200"><span className="text-slate-600">Follow-ups Due Today</span><span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">{data?.workQueue?.followUpsDue || 0}</span></div>
                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-xl transition-all hover:bg-gradient-to-r hover:from-rose-50/80 hover:to-pink-50/40 hover:border-rose-200"><span className="text-slate-600">Missed / Overdue</span><span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-md">{data?.workQueue?.missedCalls || 0}</span></div>
                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-xl transition-all hover:bg-gradient-to-r hover:from-amber-50/80 hover:to-orange-50/40 hover:border-amber-200"><span className="text-slate-600">Counselling Scheduled</span><span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md">{data?.workQueue?.counsellingScheduled || 0}</span></div>
                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-xl transition-all hover:bg-gradient-to-r hover:from-teal-50/80 hover:to-emerald-50/40 hover:border-teal-200"><span className="text-slate-600">Negotiation Phase</span><span className="text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-md">{data?.workQueue?.admissionsWaiting || 0}</span></div>
                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-xl transition-all hover:bg-gradient-to-r hover:from-purple-50/80 hover:to-indigo-50/40 hover:border-purple-200"><span className="text-slate-600">Students w/ Fee Pending</span><span className="text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-md">{data?.workQueue?.feePending || 0}</span></div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider select-none mb-4 flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span>Recent Activity</span>
              </h2>
              <div className="space-y-4 relative pl-4 border-l border-slate-100">
                {data?.recentActivity?.map((act: any, i: number) => (
                  <div key={i} className="relative">
                    <span className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${act.color}`}></span>
                    <span className="text-[10px] text-slate-400 font-bold">{act.time}</span>
                    <p className="text-xs text-slate-600 font-semibold mt-0.5 leading-snug">{act.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider select-none">Recent Enquiries List</h2>
                <span className="text-[10px] font-semibold text-slate-400">{data?.enquiriesList?.length || 0} Records</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/70 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                      <th className="py-2.5 px-2.5 w-10 text-center select-none">Lost</th>
                      <th className="py-2.5 px-3 whitespace-nowrap select-none">Enquiry No</th>
                      <th className="py-2.5 px-3 whitespace-nowrap select-none">Student</th>
                      <th className="py-2.5 px-3 select-none">Course</th>
                      <th className="py-2.5 px-3 whitespace-nowrap select-none">Counsellor</th>
                      <th className="py-2.5 px-3 whitespace-nowrap select-none">Stage</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-right select-none">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 font-semibold text-slate-600 bg-white">
                    {data?.enquiriesList?.map((e: any, i: number) => {
                      const isAdmittedStudent =
                        (e.stage || "").toUpperCase().includes("ADMIT") ||
                        (e.status || "").toUpperCase().includes("ADMIT") ||
                        e.isAdmitted === true;

                      return (
                        <tr key={i} className="hover:bg-gradient-to-r hover:from-indigo-50/40 hover:to-slate-50 transition-colors">
                          <td className="py-3 px-2.5 text-center">
                            {isAdmittedStudent ? (
                              <span
                                className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 select-none cursor-not-allowed inline-block whitespace-nowrap"
                                title="Enrolled/Admitted student cannot be marked as Lost Lead"
                              >
                                ✓ Enrolled
                              </span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={false}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-rose-500 focus:ring-rose-500 cursor-pointer"
                                onChange={(ev) => {
                                  if (ev.target.checked) {
                                    if (!e.dbId || e.dbId === "undefined") {
                                      alert("Please refresh the page to sync the latest data before performing this action.");
                                      return;
                                    }
                                    setEnquiryToDelete(e);
                                    setIsDeleteModalOpen(true);
                                  }
                                }}
                                title="Mark as Lost Lead (Deletes Enquiry)"
                              />
                            )}
                          </td>
                        <td className="py-3 px-3 text-indigo-600 font-bold whitespace-nowrap">{e.id}</td>
                        <td className="py-3 px-3 text-slate-800 font-bold whitespace-nowrap">{e.student}</td>
                        <td className="py-3 px-3 text-slate-600 min-w-[180px] max-w-[240px] truncate">{e.course}</td>
                        <td className="py-3 px-3 text-slate-700 whitespace-nowrap">{e.counsellor}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-[9px] bg-slate-100 border border-slate-200/80 text-slate-700 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wide inline-block whitespace-nowrap">
                            {e.stage}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className="text-[9px] bg-amber-50 border border-amber-200/60 text-amber-700 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wide inline-block whitespace-nowrap">
                            {e.priority}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      </div>

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setEnquiryToDelete(null);
        }}
        onConfirm={handleMarkLost}
        title="Mark Enquiry as Lost"
        itemName={enquiryToDelete?.student ? `enquiry for ${enquiryToDelete.student}` : "this enquiry"}
        description="Are you sure you want to mark this enquiry as lost? It will be permanently deleted and the lost lead count will increment."
        isLoading={isDeleting}
      />

      <AddBatchModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onSuccess={() => {
          setIsBatchModalOpen(false);
          window.location.reload();
        }}
      />
    </div>
  );
}
