"use client";

import React from "react";

interface ClientDirectoryLeadsTableProps {
  filteredEnquiries: any[];
  isLoading: boolean;
  onSelectLead: (lead: any) => void;
  onRefresh?: () => void;
  getAdvisorsForBrand?: (brand?: string) => string[];
  showBrandColumn?: boolean;
  accentHoverColor?: "indigo" | "emerald";
  dateOffset?: number;
  setDateOffset?: React.Dispatch<React.SetStateAction<number>>;
  isCustomDateRangeActive?: boolean;
  targetDate?: Date;
}

export default function ClientDirectoryLeadsTable({
  filteredEnquiries,
  isLoading,
  onSelectLead,
  onRefresh,
  getAdvisorsForBrand,
  showBrandColumn = true,
  accentHoverColor = "indigo",
  dateOffset = 0,
  setDateOffset,
  isCustomDateRangeActive = false,
  targetDate = new Date(),
}: ClientDirectoryLeadsTableProps) {
  const hoverTextClass =
    accentHoverColor === "emerald"
      ? "group-hover:text-emerald-600"
      : "group-hover:text-indigo-600";

  const focusRingClass =
    accentHoverColor === "emerald"
      ? "focus:ring-emerald-500/20 hover:border-emerald-300"
      : "focus:ring-indigo-500/20 hover:border-indigo-300";

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden flex-1 flex flex-col justify-between">
      {/* Table Title bar */}
      <div className="flex items-center justify-between border-b border-slate-100 p-4 shrink-0 select-none">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Client Directory Leads ({filteredEnquiries.length})
        </h2>
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refresh enquiries"
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4.5 w-4.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Real Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[12.5px] font-semibold text-slate-600 uppercase tracking-wider select-none">
              <th className="py-3.5 px-5">Enquiry No</th>
              <th className="py-3.5 px-5">Basic Details</th>
              <th className="py-3.5 px-5">Course Requested</th>
              {showBrandColumn && <th className="py-3.5 px-5">Registered Brand</th>}
              <th className="py-3.5 px-5">Advisor</th>
              <th className="py-3.5 px-5">Source</th>
              <th className="py-3.5 px-5">Status</th>
              <th className="py-3.5 px-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
            {isLoading ? (
              <tr>
                <td
                  colSpan={showBrandColumn ? 8 : 7}
                  className="py-10 text-center text-sm text-slate-500 font-medium"
                >
                  Loading enquiries...
                </td>
              </tr>
            ) : filteredEnquiries.length === 0 ? (
              <tr>
                <td
                  colSpan={showBrandColumn ? 8 : 7}
                  className="py-10 text-center text-sm text-slate-500 font-medium"
                >
                  No enquiries found.
                </td>
              </tr>
            ) : (
              filteredEnquiries.map((lead, idx) => {
                const advisors = getAdvisorsForBrand
                  ? getAdvisorsForBrand(lead.targetBrand)
                  : lead.assignedCrmAdvisor
                  ? [lead.assignedCrmAdvisor]
                  : [];

                return (
                  <tr
                    key={lead._id || idx}
                    onClick={() => onSelectLead(lead)}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                  >
                    {/* Enquiry No & Date */}
                    <td
                      className={`py-3.5 px-5 text-slate-900 font-bold ${hoverTextClass} transition-colors whitespace-nowrap`}
                    >
                      <div
                        className={`font-mono text-[14.5px] font-semibold text-slate-800 ${hoverTextClass} tracking-tight`}
                      >
                        {lead.enquiryId}
                      </div>
                      <div className="text-[13px] text-slate-600 font-medium font-mono mt-1 flex items-center gap-1">
                        <span>📅</span>
                        <span>
                          {lead.date ||
                            (lead.createdAt
                              ? new Date(lead.createdAt).toISOString().split("T")[0]
                              : "N/A")}
                        </span>
                      </div>
                    </td>

                    {/* Basic Details */}
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900 text-[15.5px] tracking-tight">
                        {lead.studentFullName}
                      </div>
                      <div className="text-[13.5px] text-slate-600 font-medium font-mono flex items-center gap-2 mt-1">
                        <span className="text-slate-700 font-semibold">
                          {lead.primaryPhoneMobile}
                        </span>
                        {lead.emailAddress && (
                          <>
                            <span className="text-slate-400">•</span>
                            <span
                              className="text-[13px] text-slate-500 font-normal truncate max-w-[170px]"
                              title={lead.emailAddress}
                            >
                              {lead.emailAddress}
                            </span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Course requested */}
                    <td className="py-3.5 px-5 font-semibold text-slate-800 text-[14px] leading-snug">
                      {lead.isLookingForJob || lead.targetCourse === "Looking for Job" ? (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs font-sans">
                          💼 Looking for Job
                        </span>
                      ) : (
                        <span className="block max-w-[200px]">{lead.targetCourse || "-"}</span>
                      )}
                    </td>

                    {/* Brand */}
                    {showBrandColumn && (
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center text-[13px] font-bold bg-slate-100 text-slate-800 rounded-lg px-2.5 py-1 border border-slate-200 shadow-2xs whitespace-nowrap">
                          {lead.targetBrand || "Default Brand"}
                        </span>
                      </td>
                    )}

                    {/* Advisor dropdown */}
                    <td className="py-3.5 px-5">
                      {getAdvisorsForBrand ? (
                        <select
                          value={lead.assignedCrmAdvisor || ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                            e.stopPropagation();
                            const newAdvisor = e.target.value;
                            try {
                              const res = await fetch(`/api/enquiries/${lead._id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ assignedCrmAdvisor: newAdvisor }),
                              });
                              if (res.ok && onRefresh) {
                                onRefresh();
                              }
                            } catch (err) {
                              console.error("Failed to update advisor:", err);
                            }
                          }}
                          className={`text-[13.5px] font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 ${focusRingClass} transition-all cursor-pointer shadow-2xs`}
                        >
                          <option value="">Unassigned</option>
                          {advisors.map((adv: any) => (
                            <option key={adv} value={adv}>
                              {adv}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          defaultValue={lead.assignedCrmAdvisor}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-[13.5px] font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 ${focusRingClass} transition-all cursor-pointer shadow-2xs`}
                        >
                          <option value={lead.assignedCrmAdvisor || ""}>
                            {lead.assignedCrmAdvisor || "Unassigned"}
                          </option>
                        </select>
                      )}
                    </td>

                    {/* Source */}
                    <td className="py-3.5 px-5 text-slate-700 font-medium text-[14px]">
                      {lead.leadSource || "Direct"}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center text-[12.5px] font-bold bg-blue-50 text-blue-700 rounded-lg px-2.5 py-0.5 border border-blue-200/80 uppercase tracking-wide group-hover:bg-indigo-50 group-hover:text-indigo-700 group-hover:border-indigo-200 transition-colors">
                        {lead.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (
                            confirm(
                              `Are you sure you want to delete enquiry "${lead.studentFullName}" (${lead.enquiryId})?`
                            )
                          ) {
                            try {
                              const res = await fetch(`/api/enquiries/${lead._id}`, {
                                method: "DELETE",
                              });
                              const data = await res.json();
                              if (res.ok && data.success) {
                                if (onRefresh) onRefresh();
                              } else {
                                alert(data.error || data.message || "Failed to delete enquiry.");
                              }
                            } catch (err) {
                              console.error(err);
                            }
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Delete Enquiry"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.75}
                          stroke="currentColor"
                          className="w-4.5 h-4.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Date Pagination */}
      {setDateOffset && (
        <div
          className={`flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50 shrink-0 ${
            isCustomDateRangeActive ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <button
            onClick={() => setDateOffset((prev) => prev + 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-3.5 h-3.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Previous Day
          </button>

          <div className="flex flex-col items-center">
            <span className="text-xs font-bold text-slate-700">
              {isCustomDateRangeActive
                ? "Custom Range Active"
                : dateOffset === 0
                ? "All Leads (Newest First)"
                : dateOffset === 1
                ? "Yesterday's Leads"
                : targetDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
            </span>
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
              {isCustomDateRangeActive
                ? "Clear dates to use pagination"
                : dateOffset === 0
                ? "Showing active directory"
                : `Page ${dateOffset + 1}`}
            </span>
          </div>

          <button
            onClick={() => setDateOffset((prev) => Math.max(0, prev - 1))}
            disabled={dateOffset === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Next Day
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-3.5 h-3.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
