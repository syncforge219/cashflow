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

export default function AdminDashboard() {
  const { user, logout } = useUser();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

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

  // Data for Colorful Metric Cards
  const metrics = [
    {
      name: "Total Leads",
      value: data?.kpis?.totalLeads || 0,
      trend: filterLabel === "Overall" ? "Overall" : `Filtered: ${filterLabel}`,
      isGreen: true,
      accentGradient: "from-blue-500 to-indigo-600",
      bgLight: "bg-blue-50/60 border-blue-100",
      textDark: "text-blue-900",
      badgeClass: "text-blue-700 bg-blue-100/80 border-blue-200",
      icon: "🎯"
    },
    {
      name: "Today's Admissions",
      value: data?.kpis?.admissionsToday || 0,
      trend: "Today",
      isGreen: true,
      accentGradient: "from-teal-500 to-emerald-600",
      bgLight: "bg-teal-50/60 border-teal-100",
      textDark: "text-teal-900",
      badgeClass: "text-teal-700 bg-teal-100/80 border-teal-200",
      icon: "🎓"
    },
    {
      name: "Today's Collection",
      value: data?.kpis?.todayCollection || "₹0",
      trend: "Today",
      isGreen: true,
      accentGradient: "from-emerald-500 to-green-600",
      bgLight: "bg-emerald-50/60 border-emerald-100",
      textDark: "text-emerald-900",
      badgeClass: "text-emerald-700 bg-emerald-100/80 border-emerald-200",
      icon: "💵"
    },
    {
      name: "Monthly Collection",
      value: data?.kpis?.monthlyCollection || "₹0 L",
      trend: "Current Month",
      isGreen: true,
      accentGradient: "from-purple-500 to-indigo-600",
      bgLight: "bg-purple-50/60 border-purple-100",
      textDark: "text-purple-900",
      badgeClass: "text-purple-700 bg-purple-100/80 border-purple-200",
      icon: "📈"
    },
    {
      name: "Total Revenue",
      value: data?.kpis?.revenue || "₹0 L",
      trend: "Total Collections",
      isGreen: true,
      accentGradient: "from-indigo-500 to-blue-600",
      bgLight: "bg-indigo-50/60 border-indigo-100",
      textDark: "text-indigo-900",
      badgeClass: "text-indigo-700 bg-indigo-100/80 border-indigo-200",
      icon: "🏛️"
    },
    {
      name: "Total Payroll",
      value: data?.kpis?.totalPayroll || "₹0 L",
      trend: "Paid Staff Salaries",
      isGreen: false,
      accentGradient: "from-rose-500 to-pink-600",
      bgLight: "bg-rose-50/60 border-rose-100",
      textDark: "text-rose-900",
      badgeClass: "text-rose-700 bg-rose-100/80 border-rose-200",
      icon: "💳"
    },
    {
      name: "Total Expenses",
      value: data?.kpis?.totalExpenses || "₹0 L",
      trend: "Operational Overhead",
      isGreen: false,
      accentGradient: "from-amber-500 to-orange-600",
      bgLight: "bg-amber-50/60 border-amber-100",
      textDark: "text-amber-900",
      badgeClass: "text-amber-800 bg-amber-100/80 border-amber-200",
      icon: "💸"
    },
    {
      name: "Net Profit",
      value: data?.kpis?.netProfit || "₹0 L",
      trend: `Margin: ${data?.kpis?.profitMargin || "0%"}`,
      isGreen: data?.kpis?.isProfitable ?? true,
      accentGradient: data?.kpis?.isProfitable ?? true ? "from-emerald-500 to-teal-600" : "from-rose-600 to-red-600",
      bgLight: data?.kpis?.isProfitable ?? true ? "bg-emerald-50/60 border-emerald-100" : "bg-rose-50/60 border-rose-100",
      textDark: data?.kpis?.isProfitable ?? true ? "text-emerald-900" : "text-rose-900",
      badgeClass: data?.kpis?.isProfitable ?? true ? "text-emerald-700 bg-emerald-100/80 border-emerald-200" : "text-rose-700 bg-rose-100/80 border-rose-200",
      icon: "💰"
    },
    {
      name: "Conversion Rate",
      value: data?.kpis?.conversionRate || "0%",
      trend: filterLabel === "Overall" ? "Overall" : filterLabel,
      isGreen: true,
      accentGradient: "from-cyan-500 to-blue-500",
      bgLight: "bg-cyan-50/60 border-cyan-100",
      textDark: "text-cyan-900",
      badgeClass: "text-cyan-700 bg-cyan-100/80 border-cyan-200",
      icon: "⚡"
    },
    {
      name: "Pending Approvals",
      value: data?.kpis?.pendingApprovals || 0,
      trend: "Needs Action",
      isGreen: false,
      accentGradient: "from-amber-600 to-yellow-500",
      bgLight: "bg-amber-50/60 border-amber-100",
      textDark: "text-amber-900",
      badgeClass: "text-amber-800 bg-amber-100/80 border-amber-200",
      icon: "⏳"
    },
    {
      name: "EMI Overdue Summary",
      value: data?.kpis?.emiOverdueAmount || "₹0 L",
      trend: `${data?.kpis?.emiOverdueCount || 0} Overdue Students`,
      isGreen: false,
      accentGradient: "from-red-600 to-rose-600",
      bgLight: "bg-red-50/60 border-red-100",
      textDark: "text-red-900",
      badgeClass: "text-red-700 bg-red-100/80 border-red-200",
      icon: "⏰"
    },
    {
      name: "Hot Negotiation Leads",
      value: data?.kpis?.hotLeads || 0,
      trend: "High Priority",
      isGreen: true,
      accentGradient: "from-rose-600 to-orange-500",
      bgLight: "bg-rose-50/60 border-rose-100",
      textDark: "text-rose-900",
      badgeClass: "text-rose-700 bg-rose-100/80 border-rose-200",
      icon: "🔥",
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
    <div className="flex h-screen bg-[#f4f7fc] text-slate-800 overflow-hidden font-sans transition-colors duration-200">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 space-y-6">

        {/* HEADER WITH RICH BRANDING */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/80 pb-4 shrink-0 transition-colors duration-200">
          <div>
            <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 select-none">
              <span>CoachFlow</span>
              <span>/</span>
              <span className="text-indigo-600 font-extrabold uppercase tracking-wide">Executive Command Center</span>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="relative w-full sm:w-64 flex items-center justify-between pl-3 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-slate-400 group shadow-xs"
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 mr-2 group-hover:text-indigo-500 transition-colors">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
                </svg>
                Search financials & leads...
              </div>
              <span className="flex items-center pointer-events-none text-[9px] font-bold text-slate-400/80 uppercase">
                CTRL+K
              </span>
            </button>
            <ProfileDisplay isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} logout={logout} />

            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-black text-slate-800">{user.name}</div>
                <div className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wide">{user.role}</div>
              </div>
              <button
                onClick={() => setIsProfileOpen(true)}
                className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-xs flex items-center justify-center border border-indigo-500 shadow-md hover:opacity-95 transition-all cursor-pointer overflow-hidden shrink-0"
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
                className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-500 text-white rounded-xl text-lg shrink-0 shadow-xs">
                    🚨
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">{notif.title}</h4>
                      <span className="text-[9px] font-extrabold bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full uppercase border border-amber-300">
                        Requires Admin Approval
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-semibold mt-1">{notif.message}</p>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-600 mt-1">
                      <span>Requested Discount: <strong className="text-rose-600 font-black">₹{Number(notif.requestedDiscount || 0).toLocaleString('en-IN')}</strong></span>
                      <span>•</span>
                      <span>Course Cap: <strong className="text-slate-800 font-black">₹{Number(notif.maxAllowedDiscount || 5000).toLocaleString('en-IN')}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleApproveRejectDiscount(notif._id, "Approved")}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1"
                  >
                    <span>✓ Approve Discount</span>
                  </button>
                  <button
                    onClick={() => handleApproveRejectDiscount(notif._id, "Rejected")}
                    className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1"
                  >
                    <span>✕ Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Super Admin Colorful Quick Actions Bar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-sm flex items-center gap-3 overflow-hidden shrink-0">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider px-2 select-none shrink-0 border-r border-slate-200 pr-3 flex items-center gap-1.5">
            <span className="text-indigo-600">⚡</span> Quick Actions:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5 w-full">
            <button
              onClick={() => router.push("/payroll")}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs hover:opacity-90 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>💳 Manage Payroll</span>
            </button>
            <button
              onClick={() => router.push("/expenses")}
              className="px-3.5 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs hover:opacity-90 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>💸 Track Expenses</span>
            </button>
            <button
              onClick={() => router.push("/admin-dashboard/brands")}
              className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs hover:opacity-90 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>🏢 Add Brand</span>
            </button>
            <button
              onClick={() => router.push("/companies")}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs hover:opacity-90 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>🏛️ Add Company</span>
            </button>
            <button
              onClick={() => router.push("/counsellors")}
              className="px-3.5 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs hover:opacity-90 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>👤 Add User</span>
            </button>
            <button
              onClick={() => router.push("/admin-dashboard/reports")}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs hover:opacity-90 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>📊 View Reports</span>
            </button>
            <button
              onClick={() => setIsBatchModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>📚 Create Faculty Batch</span>
            </button>
            <button
              onClick={handleSendWeeklyReport}
              disabled={isSendingWeeklyReport}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <span>📧 {isSendingWeeklyReport ? "Sending..." : "Weekly Excel Report"}</span>
            </button>
            <button
              onClick={handleCheckOverdueEmis}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>⏰ Overdue EMIs</span>
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
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs ml-auto"
            >
              <span>📥 Export CSV</span>
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

          {/* 12 VIBRANT COLORFUL KPI METRIC CARDS GRID */}
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
              metrics.map((card, i) => (
                <div
                  key={i}
                  className={`bg-white border rounded-2xl p-3.5 shadow-xs flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer group ${card.bgLight}`}
                >
                  {/* Top Colorful Accent Bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${card.accentGradient}`} />

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider select-none leading-snug">
                      {card.name}
                    </span>
                    <span className="text-sm opacity-80 group-hover:scale-110 transition-transform">
                      {card.icon}
                    </span>
                  </div>

                  <div className="my-2 flex items-baseline gap-1">
                    <span className={`text-xl lg:text-2xl font-black tracking-tight ${card.textDark}`}>
                      {card.value}
                    </span>
                  </div>

                  <span className={`text-[10px] font-extrabold rounded-lg px-2 py-0.5 w-fit border ${card.badgeClass}`}>
                    {card.trend}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* FINANCIAL PROFIT & LOSS COMMAND CENTER (COLORFUL GRADIENT THEME) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">💼</span>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">Financial Profit & Loss Command Center</h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      (data?.financialSummary?.netProfit || 0) >= 0
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-rose-100 text-rose-800 border border-rose-200"
                    }`}
                  >
                    Margin: {data?.financialSummary?.profitMargin || "0%"}
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  Calculated from Total Billed Fee Revenue vs Staff Payroll and Operational Expenses
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push("/payroll")}
                  className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors cursor-pointer"
                >
                  💳 Manage Payroll
                </button>
                <button
                  onClick={() => router.push("/expenses")}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer"
                >
                  💸 Track Expenses
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50/40 border border-indigo-100 rounded-2xl p-4 space-y-1 shadow-xs">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Total Revenue (Billed)</span>
                <div className="text-2xl font-black text-indigo-950">
                  {(data?.financialSummary?.revenue || 0) >= 100000
                    ? `₹${(data.financialSummary.revenue / 100000).toFixed(2)} L`
                    : `₹${(data?.financialSummary?.revenue || 0).toLocaleString("en-IN")}`}
                </div>
                <span className="text-[10px] text-indigo-700 font-bold block pt-1 border-t border-indigo-100/60">
                  Collections: ₹{(data?.financialSummary?.collections || data?.financialSummary?.revenue || 0).toLocaleString("en-IN")}
                </span>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-indigo-50/40 border border-purple-100 rounded-2xl p-4 space-y-1 shadow-xs">
                <span className="text-[10px] font-black text-purple-600 uppercase tracking-wider">Total Staff Payroll</span>
                <div className="text-2xl font-black text-purple-950">
                  {(data?.financialSummary?.payroll || 0) >= 100000
                    ? `₹${(data.financialSummary.payroll / 100000).toFixed(2)} L`
                    : `₹${(data?.financialSummary?.payroll || 0).toLocaleString("en-IN")}`}
                </div>
                <span className="text-[10px] text-purple-700 font-bold block pt-1 border-t border-purple-100/60">
                  ₹{(data?.financialSummary?.payroll || 0).toLocaleString("en-IN")} paid
                </span>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-100 rounded-2xl p-4 space-y-1 shadow-xs">
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Operational Expenses</span>
                <div className="text-2xl font-black text-amber-950">
                  {(data?.financialSummary?.expenses || 0) >= 100000
                    ? `₹${(data.financialSummary.expenses / 100000).toFixed(2)} L`
                    : `₹${(data?.financialSummary?.expenses || 0).toLocaleString("en-IN")}`}
                </div>
                <span className="text-[10px] text-amber-800 font-bold block pt-1 border-t border-amber-100/60">
                  ₹{(data?.financialSummary?.expenses || 0).toLocaleString("en-IN")} spent
                </span>
              </div>

              <div
                className={`border rounded-2xl p-4 space-y-1 shadow-xs ${
                  (data?.financialSummary?.netProfit || 0) >= 0
                    ? "bg-gradient-to-br from-emerald-50 to-teal-50/40 border-emerald-200"
                    : "bg-gradient-to-br from-rose-50 to-red-50/40 border-rose-200"
                }`}
              >
                <span
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    (data?.financialSummary?.netProfit || 0) >= 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  Net Profit (Bottom Line)
                </span>
                <div
                  className={`text-2xl font-black ${
                    (data?.financialSummary?.netProfit || 0) >= 0 ? "text-emerald-950" : "text-rose-950"
                  }`}
                >
                  {Math.abs(data?.financialSummary?.netProfit || 0) >= 100000
                    ? `₹${((data?.financialSummary?.netProfit || 0) / 100000).toFixed(2)} L`
                    : `₹${(data?.financialSummary?.netProfit || 0).toLocaleString("en-IN")}`}
                </div>
                <span
                  className={`text-[10px] font-extrabold block pt-1 border-t ${
                    (data?.financialSummary?.netProfit || 0) >= 0 ? "text-emerald-800 border-emerald-200/60" : "text-rose-800 border-rose-200/60"
                  }`}
                >
                  ₹{(data?.financialSummary?.netProfit || 0).toLocaleString("en-IN")} net
                </span>
              </div>
            </div>

            {/* Segmented Colorful Progress Bar */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between text-xs font-extrabold text-slate-800 select-none">
                <span>Revenue vs Outflow Segment Distribution</span>
                <span className="text-slate-500 font-bold text-[11px]">
                  Total Outflow: ₹{(data?.financialSummary?.outflow || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-slate-200">
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
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-l-full transition-all"
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
                  className="bg-gradient-to-r from-amber-400 to-orange-500 h-full transition-all"
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
                  className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full rounded-r-full transition-all"
                  title="Net Profit"
                ></div>
              </div>

              <div className="flex items-center gap-5 text-[10.5px] font-black text-slate-600 pt-1 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md bg-purple-500 shadow-xs"></span> Payroll (
                  {data?.financialSummary?.revenue > 0
                    ? ((data.financialSummary.payroll / data.financialSummary.revenue) * 100).toFixed(1)
                    : 0}
                  %)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md bg-amber-500 shadow-xs"></span> Operational Expenses (
                  {data?.financialSummary?.revenue > 0
                    ? ((data.financialSummary.expenses / data.financialSummary.revenue) * 100).toFixed(1)
                    : 0}
                  %)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-md bg-emerald-500 shadow-xs"></span> Net Profit (
                  {data?.financialSummary?.profitMargin || "0%"})
                </span>
              </div>
            </div>
          </div>

          {/* TREND CHART & MARKETING SOURCE DONUT GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider select-none">
                    📈 Lead Trend ({filterLabel === "Overall" ? "Last 30 Days" : filterLabel})
                  </h2>
                  <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[10px] font-black">
                    <button
                      type="button"
                      onClick={() => setTrendMode("daily")}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${trendMode === "daily" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      Daily
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrendMode("cumulative")}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${trendMode === "cumulative" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                    >
                      Cumulative
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className="text-[10px] text-slate-600 font-extrabold flex items-center gap-1.5 select-none">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span> Total Leads
                  </span>
                  <span className="text-[10px] text-slate-600 font-extrabold flex items-center gap-1.5 select-none">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> Admissions
                  </span>
                  <span className="text-[10px] text-slate-600 font-extrabold flex items-center gap-1.5 select-none">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span> Lost Leads
                  </span>
                  <span className="text-[10px] text-slate-600 font-extrabold flex items-center gap-1.5 select-none">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span> Follow-ups
                  </span>
                </div>
              </div>

              <div className="relative w-full h-48 group">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 600 180" preserveAspectRatio="none">
                  <line x1="0" y1="30" x2="600" y2="30" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1="70" x2="600" y2="70" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1="110" x2="600" y2="110" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="0" y1="150" x2="600" y2="150" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />

                  <path d={generatePath('newLeads')} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={generatePath('admissions')} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={generatePath('lostLeads')} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={generatePath('followUps')} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

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
                    className="absolute top-2 pointer-events-none bg-slate-900/95 backdrop-blur-md text-white text-xs p-3.5 rounded-2xl shadow-2xl z-30 border border-slate-700 transition-all"
                    style={{
                      left: `${Math.min(82, Math.max(8, (hoveredTrendIndex / Math.max(1, processedTrendDays.length - 1)) * 100))}%`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    <div className="font-extrabold text-[11px] text-slate-300 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between gap-4">
                      <span>{hoveredTrendDay.dateLabel}</span>
                      <span className="text-[9px] text-indigo-400 font-extrabold uppercase">{trendMode === "daily" ? "Daily Count" : "Cumulative Total"}</span>
                    </div>
                    <div className="space-y-1 text-[10px] font-extrabold">
                      <div className="flex justify-between items-center gap-3">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500"></span> {trendMode === "daily" ? "New Leads Today" : "Total Leads to Date"}:</span>
                        <span className="font-black text-white">{hoveredTrendDay.newLeads}</span>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> Admissions:</span>
                        <span className="font-black text-emerald-400">{hoveredTrendDay.admissions}</span>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500"></span> Follow-ups:</span>
                        <span className="font-black text-amber-400">{hoveredTrendDay.followUps}</span>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500"></span> Lost Leads:</span>
                        <span className="font-black text-rose-400">{hoveredTrendDay.lostLeads}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-between text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mt-2 px-2 select-none">
                {processedTrendDays?.filter((_: any, i: number) => i % Math.max(1, Math.floor((processedTrendDays.length || 30) / 6)) === 0).map((d: any, idx: number) => (
                  <span key={idx}>{d.dateLabel}</span>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider select-none">🎯 Lead Source Channels</h2>
                  <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 select-none">
                    Live Mix
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 mt-0.5 select-none">Marketing acquisition distribution</p>
              </div>

              <div className="my-auto py-3 flex flex-col items-center justify-center">
                <div className="h-32 w-32 relative flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90 drop-shadow-sm" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="3.5" />
                    {donutCircles}
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-2xl font-black text-indigo-950 tracking-tight">
                      {data?.kpis?.totalLeads ?? 0}
                    </span>
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider select-none">
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
                        <span className="font-extrabold text-slate-800">{src.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-indigo-600">{src.pct}</span>
                        <span className="text-[10px] font-bold text-slate-400">({src.count || 0})</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
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

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider select-none">👤 Counsellor Performance</h2>
                <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">Team</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[10px] text-slate-500 font-extrabold uppercase tracking-wider bg-slate-50/70">
                      <th className="py-2.5 px-2 whitespace-nowrap select-none">Counsellor</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Assigned</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Follow-ups</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Admissions</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Conv %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 font-bold text-slate-700">
                    {data?.counsellorPerformance?.map((c: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-2 text-slate-900 font-extrabold capitalize whitespace-nowrap">{c.name}</td>
                        <td className="py-2.5 px-2 text-right font-semibold">{c.assigned}</td>
                        <td className="py-2.5 px-2 text-right font-semibold">{c.followups}</td>
                        <td className="py-2.5 px-2 text-right font-black text-emerald-600">{c.admissions}</td>
                        <td className="py-2.5 px-2 text-right font-extrabold text-indigo-600">{c.conversion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider select-none">🏢 Brand Performance</h2>
                <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">Brands</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[10px] text-slate-500 font-extrabold uppercase tracking-wider bg-slate-50/70">
                      <th className="py-2.5 px-2 whitespace-nowrap select-none">Brand</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Leads</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Admissions</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Revenue</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Conv %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 font-bold text-slate-700">
                    {data?.brandPerformance?.map((b: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-2 text-slate-900 font-extrabold whitespace-nowrap">{b.name}</td>
                        <td className="py-2.5 px-2 text-right font-semibold">{b.leads}</td>
                        <td className="py-2.5 px-2 text-right font-semibold">{b.admissions}</td>
                        <td className="py-2.5 px-2 text-right font-black text-indigo-600">{b.revenue}</td>
                        <td className="py-2.5 px-2 text-right font-black text-emerald-600">{b.achievePct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider select-none">🏛️ Company Limit & Utilization</h2>
                <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">Ledger</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-[10px] text-slate-500 font-extrabold uppercase tracking-wider bg-slate-50/70">
                      <th className="py-2.5 px-2 whitespace-nowrap select-none">Company</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Collection</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Used %</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap select-none">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/80 font-bold text-slate-700">
                    {data?.companyUtilization?.map((c: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-2 text-slate-900 font-extrabold whitespace-nowrap">{c.name}</td>
                        <td className="py-2.5 px-2 text-right font-semibold">{c.collection}</td>
                        <td className="py-2.5 px-2 text-right font-black text-emerald-600">{c.usedPct}</td>
                        <td className="py-2.5 px-2 text-right font-semibold">{c.remaining}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider select-none mb-4 flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span>📋 System Work Queue</span>
                <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Active</span>
              </h2>
              <div className="space-y-3 font-bold text-xs">
                <div className="flex justify-between items-center bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-xl"><span className="text-slate-700">Follow-ups Due Today</span><span className="text-indigo-700 font-black bg-indigo-100 px-2.5 py-0.5 rounded-lg">{data?.workQueue?.followUpsDue || 0}</span></div>
                <div className="flex justify-between items-center bg-rose-50/50 border border-rose-100 p-2.5 rounded-xl"><span className="text-slate-700">Missed / Overdue</span><span className="text-rose-700 font-black bg-rose-100 px-2.5 py-0.5 rounded-lg">{data?.workQueue?.missedCalls || 0}</span></div>
                <div className="flex justify-between items-center bg-amber-50/50 border border-amber-100 p-2.5 rounded-xl"><span className="text-slate-700">Counselling Scheduled</span><span className="text-amber-800 font-black bg-amber-100 px-2.5 py-0.5 rounded-lg">{data?.workQueue?.counsellingScheduled || 0}</span></div>
                <div className="flex justify-between items-center bg-teal-50/50 border border-teal-100 p-2.5 rounded-xl"><span className="text-slate-700">Negotiation Phase</span><span className="text-teal-800 font-black bg-teal-100 px-2.5 py-0.5 rounded-lg">{data?.workQueue?.admissionsWaiting || 0}</span></div>
                <div className="flex justify-between items-center bg-purple-50/50 border border-purple-100 p-2.5 rounded-xl"><span className="text-slate-700">Students w/ Fee Pending</span><span className="text-purple-800 font-black bg-purple-100 px-2.5 py-0.5 rounded-lg">{data?.workQueue?.feePending || 0}</span></div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider select-none mb-4 flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span>⏱️ Recent Activity</span>
                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Live Feed</span>
              </h2>
              <div className="space-y-4 relative pl-4 border-l border-slate-200">
                {data?.recentActivity?.map((act: any, i: number) => (
                  <div key={i} className="relative">
                    <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${act.color}`}></span>
                    <span className="text-[10px] text-slate-400 font-black">{act.time}</span>
                    <p className="text-xs text-slate-700 font-bold mt-0.5 leading-snug">{act.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider select-none">📋 Recent Enquiries List</h2>
                <span className="text-[10px] font-extrabold text-slate-400">{data?.enquiriesList?.length || 0} Records</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/70 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] text-slate-500 font-black uppercase tracking-wider bg-slate-100/80">
                      <th className="py-2.5 px-2.5 w-10 text-center select-none">Lost</th>
                      <th className="py-2.5 px-3 whitespace-nowrap select-none">Enquiry No</th>
                      <th className="py-2.5 px-3 whitespace-nowrap select-none">Student</th>
                      <th className="py-2.5 px-3 select-none">Course</th>
                      <th className="py-2.5 px-3 whitespace-nowrap select-none">Counsellor</th>
                      <th className="py-2.5 px-3 whitespace-nowrap select-none">Stage</th>
                      <th className="py-2.5 px-3 whitespace-nowrap text-right select-none">Priority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-700 bg-white">
                    {data?.enquiriesList?.map((e: any, i: number) => {
                      const isAdmittedStudent =
                        (e.stage || "").toUpperCase().includes("ADMIT") ||
                        (e.status || "").toUpperCase().includes("ADMIT") ||
                        e.isAdmitted === true;

                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-2.5 text-center">
                            {isAdmittedStudent ? (
                              <span
                                className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 select-none cursor-not-allowed inline-block whitespace-nowrap"
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
                        <td className="py-3 px-3 text-indigo-600 font-black whitespace-nowrap">{e.id}</td>
                        <td className="py-3 px-3 text-slate-900 font-black whitespace-nowrap">{e.student}</td>
                        <td className="py-3 px-3 text-slate-600 min-w-[180px] max-w-[240px] truncate">{e.course}</td>
                        <td className="py-3 px-3 text-slate-700 whitespace-nowrap font-bold">{e.counsellor}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-[9.5px] bg-slate-100 border border-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-black uppercase tracking-wide inline-block whitespace-nowrap">
                            {e.stage}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <span className="text-[9.5px] bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded-md font-black uppercase tracking-wide inline-block whitespace-nowrap">
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
