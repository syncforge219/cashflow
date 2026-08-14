"use client";

import React, { useState, useEffect } from "react";
import { DailyBiReportData } from "@/lib/dailyBiService";

export default function DailyBiDashboard() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [report, setReport] = useState<DailyBiReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (dateStr?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const query = dateStr ? `?date=${dateStr}` : "";
      const res = await fetch(`/api/reports/daily-bi${query}`);
      const json = await res.json();

      if (json.success && json.data) {
        setReport(json.data);
      } else {
        setError(json.message || "Failed to load report data.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching the report.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(selectedDate);
  }, [selectedDate]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/90 shadow-sm text-center">
        <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-extrabold text-slate-900 font-heading">Generating Executive Business Intelligence Report...</p>
        <p className="text-xs text-slate-500 font-medium mt-1">Aggregating revenue, lead conversion funnel, brand analytics & AI insights.</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="bg-rose-50/90 border border-rose-200 rounded-3xl p-8 text-center text-rose-800 backdrop-blur-md">
        <p className="text-sm font-extrabold font-heading">Failed to load report</p>
        <p className="text-xs mt-1 font-medium">{error || "No report data available."}</p>
        <button
          onClick={() => fetchReport(selectedDate)}
          className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-rose-700 transition-colors cursor-pointer"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  const { executiveSummary, revenueTrend, revenueComparison, conversionFunnel, businessLossAnalysis, brandPerformance, counsellorPerformance, leadSourceAnalysis, collectionSummaryByMode, pendingFeeSummary, operationalAlerts, tomorrowTargets, aiInsights } = report;

  const formatCurrency = (amount: number) => `₹${Math.round(amount).toLocaleString("en-IN")}`;

  return (
    <div className="space-y-8 font-sans print:space-y-6 print:p-0">
      
      {/* HEADER & FILTER BAR */}
      <div className="glass-panel rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-200/90 print:shadow-none print:border-none">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              Executive Dashboard
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1 font-heading">
            Lead2Ledger – Daily Business Intelligence Report
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Report Date: <strong className="text-slate-800">{report.dateStr}</strong> • Generated at {report.generatedAtStr}
          </p>
        </div>

        {/* Date Filter & Actions */}
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <div className="flex items-center gap-2 bg-slate-50/90 border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs">
            <span className="text-xs font-bold text-slate-500">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => fetchReport(selectedDate)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
            title="Refresh Report Data"
          >
            🔄 Refresh
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
          >
            🖨️ Print / Save PDF
          </button>
        </div>
      </div>

      {/* 1. EXECUTIVE SUMMARY KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "TOTAL REVENUE", val: formatCurrency(executiveSummary.totalRevenue.value), change: executiveSummary.totalRevenue.changePct, color: "text-indigo-600", bg: "bg-indigo-50/40" },
          { label: "TOTAL COLLECTIONS", val: formatCurrency(executiveSummary.totalCollections.value), change: executiveSummary.totalCollections.changePct, color: "text-emerald-600", bg: "bg-emerald-50/40" },
          { label: "TOTAL LEADS", val: executiveSummary.totalLeads.value, change: executiveSummary.totalLeads.changePct, color: "text-blue-600", bg: "bg-blue-50/40" },
          { label: "ADMISSIONS", val: executiveSummary.admissions.value, change: executiveSummary.admissions.changePct, color: "text-purple-600", bg: "bg-purple-50/40" },
          { label: "CONVERSION RATE", val: `${executiveSummary.conversionRate.value}%`, change: executiveSummary.conversionRate.changePct, color: "text-amber-600", bg: "bg-amber-50/40" },
          { label: "OUTSTANDING FEES", val: formatCurrency(executiveSummary.outstandingFees.value), change: executiveSummary.outstandingFees.changePct, color: "text-slate-800", bg: "bg-slate-50/60" },
          { label: "ESTIMATED LOSS", val: formatCurrency(executiveSummary.businessLoss.value), change: executiveSummary.businessLoss.changePct, color: "text-rose-600", bg: "bg-rose-50/40" },
          { label: "UNCONVERTED LEADS", val: businessLossAnalysis.unconvertedLeads, change: 0, color: "text-violet-600", bg: "bg-violet-50/40" },
        ].map((kpi, idx) => (
          <div key={idx} className={`border border-slate-200/80 rounded-2xl p-4 bg-white/90 backdrop-blur-md shadow-xs ${kpi.bg} transition-all hover:shadow-md hover:-translate-y-0.5`}>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-heading">{kpi.label}</p>
            <p className={`text-2xl font-extrabold mt-1 font-heading ${kpi.color}`}>{kpi.val}</p>
            <div className="flex items-center gap-1 mt-1 text-[11px] font-bold">
              {kpi.change >= 0 ? (
                <span className="text-emerald-600 flex items-center gap-0.5">↑ +{kpi.change}% <span className="text-[10px] text-slate-400 font-medium">vs yesterday</span></span>
              ) : (
                <span className="text-rose-500 flex items-center gap-0.5">↓ {kpi.change}% <span className="text-[10px] text-slate-400 font-medium">vs yesterday</span></span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 2 & 3. DAILY REVENUE TREND & REVENUE COMPARISON */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 14-Day Revenue Trend Line Graph Bar */}
        <div className="lg:col-span-8 glass-panel rounded-3xl p-6 shadow-xs border border-slate-200/90">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 font-heading">Daily Revenue & Collection Trend (14 Days)</h2>
              <p className="text-xs text-slate-500 font-medium">Historical performance to identify growth & decline patterns</p>
            </div>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
              14-Day Timeline
            </span>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-48 flex items-end gap-2 pt-6 border-b border-slate-100 pb-2">
            {revenueTrend.map((item, idx) => {
              const maxVal = Math.max(...revenueTrend.map(r => Math.max(r.revenue, r.collections)), 100000);
              const revHeight = Math.max(8, (item.revenue / maxVal) * 100);
              const collHeight = Math.max(8, (item.collections / maxVal) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip Hover */}
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-12 bg-slate-900 text-white text-[10px] p-2 rounded-xl shadow-lg pointer-events-none transition-opacity z-20 whitespace-nowrap border border-slate-800">
                    <p className="font-bold">{item.date}</p>
                    <p>Rev: ₹{item.revenue.toLocaleString('en-IN')}</p>
                    <p>Coll: ₹{item.collections.toLocaleString('en-IN')}</p>
                  </div>

                  <div className="w-full flex items-end justify-center gap-0.5 h-36">
                    <div
                      style={{ height: `${revHeight}%` }}
                      className="w-1/2 bg-gradient-to-t from-indigo-600 to-indigo-400 hover:from-indigo-700 hover:to-indigo-500 rounded-t-sm transition-all"
                      title={`Revenue: ₹${item.revenue}`}
                    />
                    <div
                      style={{ height: `${collHeight}%` }}
                      className="w-1/2 bg-gradient-to-t from-emerald-500 to-emerald-300 hover:from-emerald-600 hover:to-emerald-400 rounded-t-sm transition-all"
                      title={`Collections: ₹${item.collections}`}
                    />
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 truncate w-full text-center">{item.date}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-xs font-bold text-slate-600">
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-md bg-indigo-500" /> Total Revenue</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-md bg-emerald-400" /> Total Collections</div>
          </div>
        </div>

        {/* Revenue Comparison */}
        <div className="lg:col-span-4 glass-panel rounded-3xl p-6 shadow-xs flex flex-col justify-between border border-slate-200/90">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 font-heading">Revenue Comparison</h2>
            <p className="text-xs text-slate-500 font-medium mb-6">Today vs Yesterday vs Same Day Last Week</p>

            <div className="space-y-4">
              {[
                { label: "Today's Revenue", val: revenueComparison.today, color: "bg-indigo-600", text: "text-indigo-700" },
                { label: "Yesterday's Revenue", val: revenueComparison.yesterday, color: "bg-purple-500", text: "text-purple-700" },
                { label: "Same Day Last Week", val: revenueComparison.sameDayLastWeek, color: "bg-slate-400", text: "text-slate-700" },
              ].map((comp, idx) => {
                const maxVal = Math.max(revenueComparison.today, revenueComparison.yesterday, revenueComparison.sameDayLastWeek, 10000);
                const widthPct = Math.max(12, (comp.val / maxVal) * 100);

                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-600">{comp.label}</span>
                      <span className={comp.text}>{formatCurrency(comp.val)}</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div style={{ width: `${widthPct}%` }} className={`h-full ${comp.color} rounded-full transition-all`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50/80 p-3.5 rounded-2xl">
            <p className="text-xs font-bold text-slate-800">Comparative Insight:</p>
            <p className="text-[11px] font-medium text-slate-600 mt-0.5">
              {revenueComparison.today >= revenueComparison.yesterday
                ? "Today's revenue is performing higher than yesterday."
                : "Today's revenue is currently below yesterday's benchmark. Intensify admission follow-ups."}
            </p>
          </div>
        </div>
      </div>

      {/* 4 & 5. LEAD CONVERSION FUNNEL & BUSINESS LOSS ANALYSIS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lead Conversion Funnel */}
        <div className="lg:col-span-6 glass-panel rounded-3xl p-6 shadow-xs border border-slate-200/90">
          <h2 className="text-base font-extrabold text-slate-900 font-heading">Lead Conversion Funnel</h2>
          <p className="text-xs text-slate-500 font-medium mb-6">Stage-wise student journey, conversion rates & drop-offs</p>

          <div className="space-y-4">
            {[
              { stage: "1. Leads Received", count: conversionFunnel.leadsReceived, pct: 100, drop: `${conversionFunnel.dropOffRates.postLeadDropOff}% Drop-off`, color: "bg-blue-600" },
              { stage: "2. Follow-ups Completed", count: conversionFunnel.followupsCompleted, pct: conversionFunnel.stagePercentages.followupPct, drop: `${conversionFunnel.dropOffRates.postFollowupDropOff}% Drop-off`, color: "bg-purple-600" },
              { stage: "3. Demos Scheduled", count: conversionFunnel.demosScheduled, pct: conversionFunnel.stagePercentages.demoPct, drop: `${conversionFunnel.dropOffRates.postDemoDropOff}% Drop-off`, color: "bg-amber-500" },
              { stage: "4. Admissions Confirmed", count: conversionFunnel.admissionsConfirmed, pct: conversionFunnel.stagePercentages.admissionPct, drop: `Final Conversion`, color: "bg-emerald-600" },
            ].map((stg, idx) => (
              <div key={idx} className="bg-slate-50/80 border border-slate-200/60 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-800">{stg.stage}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-indigo-700">{stg.count} Students</span>
                    <span className="bg-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-extrabold">{stg.pct}%</span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div style={{ width: `${Math.max(5, stg.pct)}%` }} className={`h-full ${stg.color} transition-all`} />
                </div>
                <div className="flex justify-end">
                  <span className="text-[10px] font-semibold text-rose-500">{stg.drop}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Business Loss Analysis */}
        <div className="lg:col-span-6 glass-panel rounded-3xl p-6 shadow-xs flex flex-col justify-between border border-slate-200/90">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-extrabold text-slate-900 font-heading">Business Loss Analysis</h2>
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                Unrealized Revenue
              </span>
            </div>

            <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-4 mb-6">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-rose-600 font-heading">Formula Calculation</p>
              <p className="text-xs font-bold text-slate-700 mt-1">
                Business Loss = ({businessLossAnalysis.totalLeads} Total Leads – {businessLossAnalysis.totalAdmissions} Admissions) × {formatCurrency(businessLossAnalysis.avgAdmissionValue)} Avg Value
              </p>
              <p className="text-2xl font-extrabold text-rose-600 mt-2 font-heading">
                = {formatCurrency(businessLossAnalysis.estimatedBusinessLoss)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Potential Revenue</p>
                <p className="text-sm font-extrabold text-slate-800 mt-1 font-heading">{formatCurrency(businessLossAnalysis.potentialRevenue)}</p>
              </div>
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Actual Revenue</p>
                <p className="text-sm font-extrabold text-emerald-600 mt-1 font-heading">{formatCurrency(businessLossAnalysis.actualRevenue)}</p>
              </div>
              <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Lost Opportunity</p>
                <p className="text-sm font-extrabold text-rose-600 mt-1 font-heading">{businessLossAnalysis.lostOpportunityPct}%</p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-800">Executive Impact Statement:</p>
            <p className="text-xs text-slate-600 font-medium mt-1">
              Converting just 20% of today&apos;s lost leads would generate an additional <strong className="text-emerald-600">{formatCurrency(businessLossAnalysis.estimatedBusinessLoss * 0.2)}</strong> in revenue.
            </p>
          </div>
        </div>
      </div>

      {/* 6. BRAND PERFORMANCE BREAKDOWN */}
      <div className="glass-panel rounded-3xl p-6 shadow-xs border border-slate-200/90">
        <h2 className="text-base font-extrabold text-slate-900 mb-1 font-heading">Brand Performance Breakdown</h2>
        <p className="text-xs text-slate-500 font-medium mb-6">Cross-brand operational performance, collections & estimated loss</p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium">
            <thead>
              <tr className="bg-slate-50/80 border-y border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider font-heading">
                <th className="py-3 px-4">Brand Name</th>
                <th className="py-3 px-4">Total Leads</th>
                <th className="py-3 px-4">Admissions</th>
                <th className="py-3 px-4">Daily Collections</th>
                <th className="py-3 px-4">Conversion Rate</th>
                <th className="py-3 px-4">Estimated Business Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {brandPerformance.map((brand, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">{brand.brandName}</td>
                  <td className="py-3 px-4 font-semibold text-slate-700">{brand.totalLeads}</td>
                  <td className="py-3 px-4 font-extrabold text-indigo-600 font-heading">{brand.admissions}</td>
                  <td className="py-3 px-4 font-bold text-emerald-600">{formatCurrency(brand.dailyCollections)}</td>
                  <td className="py-3 px-4 font-bold text-purple-600">{brand.conversionRate}%</td>
                  <td className="py-3 px-4 font-bold text-rose-600">{formatCurrency(brand.estimatedBusinessLoss)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. COUNSELLOR / SALES EXECUTIVE PERFORMANCE DASHBOARD */}
      <div className="glass-panel rounded-3xl p-6 shadow-xs border border-slate-200/90">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 font-heading">Counsellor & Centre Head Performance Dashboard</h2>
            <p className="text-xs text-slate-500 font-medium">Ranked by admissions converted, conversion %, collections & follow-up status</p>
          </div>
          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
            {counsellorPerformance.length} Active Staff / Centre Heads
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium">
            <thead>
              <tr className="bg-slate-50/80 border-y border-slate-200 text-slate-600 font-extrabold uppercase text-[10px] tracking-wider font-heading">
                <th className="py-3 px-4">Counsellor / Centre Head</th>
                <th className="py-3 px-4">Brand Scope</th>
                <th className="py-3 px-4">Leads Assigned</th>
                <th className="py-3 px-4">Follow-ups Done</th>
                <th className="py-3 px-4">Admissions</th>
                <th className="py-3 px-4">Conversion %</th>
                <th className="py-3 px-4">Collections</th>
                <th className="py-3 px-4">Follow-up Rating</th>
                <th className="py-3 px-4">Status Tag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {counsellorPerformance.map((exec, idx) => (
                <tr key={idx} className={`hover:bg-slate-50/80 transition-colors ${exec.isTopPerformer ? "bg-emerald-50/30" : exec.isLowPerformer ? "bg-rose-50/30" : ""}`}>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {exec.name}
                    <p className="text-[10px] text-slate-400 font-normal">{exec.email}</p>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-600">{exec.brandScope}</td>
                  <td className="py-3 px-4 font-semibold text-slate-700">{exec.leadsAssigned}</td>
                  <td className="py-3 px-4 font-semibold text-indigo-600">{exec.followupsDone || 0}</td>
                  <td className="py-3 px-4 font-extrabold text-indigo-600 font-heading">{exec.admissionsConverted}</td>
                  <td className="py-3 px-4 font-bold text-purple-600">{exec.conversionPct}%</td>
                  <td className="py-3 px-4 font-bold text-emerald-600">{formatCurrency(exec.collectionsGenerated)}</td>
                  <td className="py-3 px-4 font-semibold text-slate-700">{exec.followupPerformance}</td>
                  <td className="py-3 px-4">
                    {exec.isTopPerformer && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-300">
                        🏆 Top Performer
                      </span>
                    )}
                    {exec.isLowPerformer && (
                      <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-rose-300">
                        ⚠️ Low Velocity
                      </span>
                    )}
                    {!exec.isTopPerformer && !exec.isLowPerformer && (
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8 & 9. LEAD SOURCE ANALYSIS & DAILY COLLECTION SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lead Source Analysis */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 shadow-xs border border-slate-200/90">
          <h2 className="text-base font-extrabold text-slate-900 font-heading">Lead Source Analysis (Marketing ROI)</h2>
          <p className="text-xs text-slate-500 font-medium mb-6">Evaluating lead acquisition channels by revenue contribution</p>

          <div className="space-y-3">
            {leadSourceAnalysis.map((src, idx) => (
              <div key={idx} className="bg-slate-50/80 border border-slate-200/60 rounded-2xl p-3.5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold text-slate-800 font-heading">{src.source}</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    {src.leadsGenerated} Leads • {src.admissions} Admissions ({src.conversionRate}%)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-extrabold text-emerald-600 font-heading">{formatCurrency(src.revenueContribution)}</p>
                  <p className="text-[10px] font-bold text-indigo-600">Revenue</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Collection Summary by Payment Mode */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 shadow-xs border border-slate-200/90">
          <h2 className="text-base font-extrabold text-slate-900 font-heading">Collection Summary by Mode</h2>
          <p className="text-xs text-slate-500 font-medium mb-6">Payment mode distribution across active admissions</p>

          <div className="space-y-4">
            {collectionSummaryByMode.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-700">{item.mode}</span>
                  <span className="text-emerald-600">{formatCurrency(item.amount)} ({item.percentage}%)</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div style={{ width: `${Math.max(5, item.percentage)}%` }} className="h-full bg-emerald-500 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 10 & 11. PENDING FEE / EMI SUMMARY & OPERATIONAL ALERTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pending Fee & Overdue EMI Summary */}
        <div className="lg:col-span-7 glass-panel rounded-3xl p-6 shadow-xs border border-slate-200/90">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-slate-900 font-heading">Pending Fee & Overdue EMI Summary</h2>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
              {pendingFeeSummary.overdueStudentsCount} Accounts Overdue
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-rose-600 uppercase font-heading">Overdue Balance</p>
              <p className="text-lg font-extrabold text-rose-600 mt-1 font-heading">{formatCurrency(pendingFeeSummary.overdueAmount)}</p>
            </div>
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-amber-600 uppercase font-heading">Upcoming Installments</p>
              <p className="text-lg font-extrabold text-amber-600 mt-1 font-heading">{formatCurrency(pendingFeeSummary.upcomingInstallmentsAmount)}</p>
            </div>
          </div>

          <p className="text-xs font-bold text-slate-800 mb-2 font-heading">Priority Students Requiring Immediate Follow-up:</p>
          <div className="space-y-2">
            {pendingFeeSummary.studentsRequiringFollowup.map((st, idx) => (
              <div key={idx} className="bg-slate-50/80 border border-slate-200/60 rounded-xl p-3 flex items-center justify-between text-xs font-medium">
                <div>
                  <p className="font-bold text-slate-900">{st.fullName}</p>
                  <p className="text-[10px] text-slate-500">{st.course} • 📱 {st.mobileNumber}</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-rose-600 font-heading">{formatCurrency(st.remainingBalance)}</p>
                  <p className="text-[10px] text-slate-400">Due: {st.nextDueDate}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operational Alerts Section */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 shadow-xs border border-slate-200/90">
          <h2 className="text-base font-extrabold text-slate-900 mb-1 font-heading">Operational Alerts</h2>
          <p className="text-xs text-slate-500 font-medium mb-6">Automated notifications requiring management review</p>

          <div className="space-y-3">
            {operationalAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border text-xs font-medium space-y-1 ${
                  alert.type === "critical"
                    ? "bg-rose-50/90 border-rose-200 text-rose-900"
                    : alert.type === "warning"
                    ? "bg-amber-50/90 border-amber-200 text-amber-900"
                    : "bg-indigo-50/90 border-indigo-200 text-indigo-900"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="font-heading">{alert.title}</span>
                  <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/80 border">{alert.category}</span>
                </div>
                <p className="text-[11px] opacity-90">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 12 & 13. TOMORROW'S TARGETS & AI BUSINESS INSIGHTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tomorrow's Business Targets */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 shadow-xs border border-slate-200/90">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-slate-900 font-heading">Tomorrow&apos;s Business Targets</h2>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
              Predictive Goals
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Revenue Target", val: formatCurrency(tomorrowTargets.revenueTarget), color: "text-indigo-600" },
              { label: "Collections Target", val: formatCurrency(tomorrowTargets.collectionsTarget), color: "text-emerald-600" },
              { label: "Admissions Goal", val: `${tomorrowTargets.admissionsTarget} Students`, color: "text-purple-600" },
              { label: "Lead Follow-ups", val: `${tomorrowTargets.leadFollowupsTarget} Calls`, color: "text-blue-600" },
              { label: "Demo Sessions", val: `${tomorrowTargets.demoSessionsTarget} Bookings`, color: "text-amber-600" },
              { label: "Fee Recovery", val: formatCurrency(tomorrowTargets.pendingFeeRecoveryTarget), color: "text-rose-600" },
            ].map((tgt, idx) => (
              <div key={idx} className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-3.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-heading">{tgt.label}</p>
                <p className={`text-base font-extrabold mt-1 font-heading ${tgt.color}`}>{tgt.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Business Insights Executive Summary */}
        <div className="lg:col-span-7 bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col justify-between border border-slate-800">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <div>
                  <h2 className="text-base font-extrabold text-white font-heading">Lead2Ledger AI Strategic Synthesis</h2>
                  <p className="text-[10px] text-indigo-300 font-medium">Automated executive intelligence summary</p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-800">
                AI Generated
              </span>
            </div>

            <p className="text-xs font-medium text-slate-300 mb-4 leading-relaxed">
              {aiInsights.executiveSummary}
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider font-heading">Key Achievements</p>
                <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5 mt-1">
                  {aiInsights.keyAchievements.map((ach, i) => (
                    <li key={i}>{ach}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider font-heading">Priority Actions for Tomorrow</p>
                <ul className="list-disc list-inside text-xs text-slate-300 space-y-0.5 mt-1">
                  {aiInsights.recommendedPriorityActions.map((act, i) => (
                    <li key={i}>{act}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
            <span>Lead2Ledger Decision Engine v4.0</span>
            <span>Empowering Data-Driven Governance</span>
          </div>
        </div>

      </div>

    </div>
  );
}
