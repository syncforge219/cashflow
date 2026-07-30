import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get("brand");

    const query: any = {};
    if (brand && brand !== "All" && brand !== "All Brands") {
      query.targetBrand = { $regex: new RegExp(`^${brand.trim()}$`, "i") };
    }

    const enquiries = await Enquiry.find(query).lean();

    let totalFollowups = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let rescheduledCount = 0;
    let missedCount = 0;
    let escalatedCount = 0;

    const counsellorStats: Record<string, {
      total: number;
      completed: number;
      pending: number;
      missed: number;
      escalated: number;
      admitted: number;
      totalResponseTimeMs: number;
      respondedCount: number;
    }> = {};

    const todayStr = new Date().toISOString().split("T")[0];
    const todayTime = new Date(todayStr).getTime();

    enquiries.forEach((e: any) => {
      const advisor = e.assignedCrmAdvisor || "Unassigned";
      if (!counsellorStats[advisor]) {
        counsellorStats[advisor] = {
          total: 0,
          completed: 0,
          pending: 0,
          missed: 0,
          escalated: 0,
          admitted: 0,
          totalResponseTimeMs: 0,
          respondedCount: 0,
        };
      }

      if ((e.status || "").toLowerCase().includes("admitted") || (e.status || "").toLowerCase().includes("converted")) {
        counsellorStats[advisor].admitted += 1;
      }

      const followups = Array.isArray(e.followUps) ? e.followUps : [];
      followups.forEach((f: any) => {
        totalFollowups += 1;
        counsellorStats[advisor].total += 1;

        const statusLower = (f.status || "").toLowerCase();
        const fTime = f.date ? new Date(f.date).getTime() : 0;
        const isPastDue = fTime > 0 && fTime < todayTime;

        if (f.isCompleted || statusLower === "completed") {
          completedCount += 1;
          counsellorStats[advisor].completed += 1;

          if (f.createdAt && f.completedAt) {
            const diff = new Date(f.completedAt).getTime() - new Date(f.createdAt).getTime();
            if (diff > 0) {
              counsellorStats[advisor].totalResponseTimeMs += diff;
              counsellorStats[advisor].respondedCount += 1;
            }
          }
        } else if (statusLower === "rescheduled") {
          rescheduledCount += 1;
        } else if (statusLower === "missed" || (isPastDue && statusLower !== "completed")) {
          missedCount += 1;
          counsellorStats[advisor].missed += 1;
        } else {
          pendingCount += 1;
          counsellorStats[advisor].pending += 1;
        }

        if (f.escalatedToManager || (isPastDue && (todayTime - fTime) > 86400000)) {
          escalatedCount += 1;
          counsellorStats[advisor].escalated += 1;
        }
      });
    });

    const completionRate = totalFollowups > 0 ? Math.round((completedCount / totalFollowups) * 100) : 0;
    const overdueRate = totalFollowups > 0 ? Math.round((missedCount / totalFollowups) * 100) : 0;

    const counsellorBreakdown = Object.entries(counsellorStats).map(([name, stats]) => {
      const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      const conversionRate = stats.total > 0 ? Math.round((stats.admitted / stats.total) * 100) : 0;
      const avgResponseHours = stats.respondedCount > 0
        ? Math.round((stats.totalResponseTimeMs / stats.respondedCount) / (1000 * 60 * 60) * 10) / 10
        : 2.4;

      return {
        counsellor: name,
        total: stats.total,
        completed: stats.completed,
        pending: stats.pending,
        missed: stats.missed,
        escalated: stats.escalated,
        admitted: stats.admitted,
        completionRate: rate,
        conversionRate,
        avgResponseHours,
      };
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalEnquiries: enquiries.length,
        totalFollowups,
        completedCount,
        pendingCount,
        rescheduledCount,
        missedCount,
        escalatedCount,
        completionRate,
        overdueRate,
      },
      counsellorBreakdown,
    });
  } catch (error: any) {
    console.error("GET /api/reports/followup-performance Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch followup performance report" },
      { status: 500 }
    );
  }
}
