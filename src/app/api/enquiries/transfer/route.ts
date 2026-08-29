import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Task from "@/models/Task";
import User from "@/models/User";
import { getUserFromCookies } from "@/lib/helper";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const currentUser = await getUserFromCookies();

    const body = await req.json();
    const {
      enquiryIds = [],
      targetAdvisor,
      targetAdvisorId,
      sourceAdvisor,
      transferScope = "selected", // "selected" | "counsellor_pending" | "all_pending"
      transferRemarks,
      rescheduleDate,
      brandScope,
    } = body;

    if (!targetAdvisor || typeof targetAdvisor !== "string" || !targetAdvisor.trim()) {
      return NextResponse.json(
        { success: false, error: "Target counsellor / employee name is required." },
        { status: 400 }
      );
    }

    const cleanTargetAdvisor = targetAdvisor.trim();

    // Verify target counsellor user if targetAdvisorId provided
    let targetUser: any = null;
    if (targetAdvisorId) {
      targetUser = await User.findById(targetAdvisorId).select("name email role brandScope");
    } else {
      targetUser = await User.findOne({
        name: new RegExp(`^${cleanTargetAdvisor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      }).select("name email role brandScope");
    }

    // Determine brand scope filter from user or parameter
    const effectiveBrand = brandScope || currentUser?.brandScope || "";
    const isGlobalBrand = !effectiveBrand || ["all", "all brands", "global", "*"].includes(effectiveBrand.toLowerCase());

    let query: any = {};

    if (transferScope === "selected" && Array.isArray(enquiryIds) && enquiryIds.length > 0) {
      query._id = { $in: enquiryIds };
    } else if (transferScope === "counsellor_pending" && sourceAdvisor) {
      query.assignedCrmAdvisor = new RegExp(`^${sourceAdvisor.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
      query.status = { $nin: ["Lost", "Admitted", "Do Not Call", "Do Not Followup", "Completed"] };
      if (!isGlobalBrand) {
        query.targetBrand = new RegExp(effectiveBrand.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      }
    } else if (transferScope === "all_pending") {
      query.status = { $nin: ["Lost", "Admitted", "Do Not Call", "Do Not Followup", "Completed"] };
      if (!isGlobalBrand) {
        query.targetBrand = new RegExp(effectiveBrand.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      }
    } else if (Array.isArray(enquiryIds) && enquiryIds.length > 0) {
      query._id = { $in: enquiryIds };
    } else {
      return NextResponse.json(
        { success: false, error: "No leads selected or invalid transfer scope." },
        { status: 400 }
      );
    }

    // Fetch matching enquiries
    const matchingEnquiries = await Enquiry.find(query);

    if (!matchingEnquiries || matchingEnquiries.length === 0) {
      return NextResponse.json(
        { success: false, error: "No matching pending leads found to transfer." },
        { status: 404 }
      );
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const nowIso = new Date().toISOString();
    const performerName = currentUser?.name ? `${currentUser.name} (${currentUser.role || "Centre Head"})` : "Centre Head";
    const noteText = transferRemarks?.trim() ? ` Note: ${transferRemarks.trim()}` : "";

    let updatedCount = 0;
    const transferredEnquiryIds: string[] = [];

    for (const enq of matchingEnquiries) {
      const oldAdvisor = enq.assignedCrmAdvisor || "Unassigned";
      enq.assignedCrmAdvisor = cleanTargetAdvisor;

      // Update follow-up records
      if (!enq.followUps) {
        enq.followUps = [] as any;
      }
      let hasPendingTask = false;

      (enq.followUps as any[]).forEach((f: any) => {
        const isPending = !f.isCompleted && (f.status || "").toLowerCase() !== "completed" && (f.status || "").toLowerCase() !== "cancelled";
        if (isPending) {
          hasPendingTask = true;
          f.assignedTo = cleanTargetAdvisor;
          if (rescheduleDate) {
            f.date = rescheduleDate;
          }
          f.remarks = f.remarks
            ? `${f.remarks} [Transferred from ${oldAdvisor} to ${cleanTargetAdvisor} by ${performerName}.${noteText}]`
            : `Transferred from ${oldAdvisor} to ${cleanTargetAdvisor} by ${performerName}.${noteText}`;
        }
      });

      // If no pending follow-up object existed, add a new pending follow-up assigned to the new counsellor
      if (!hasPendingTask) {
        (enq.followUps as any).push({
          date: rescheduleDate || enq.followUpDate || todayStr,
          time: "11:00 AM",
          priority: enq.priorityLevel || "Medium",
          typeOfContact: "Telephonic",
          remarks: `Follow-up transferred from ${oldAdvisor} to ${cleanTargetAdvisor} by ${performerName}.${noteText}`,
          assignedTo: cleanTargetAdvisor,
          status: "Pending",
          plannedBy: performerName,
          isCompleted: false,
          createdAt: new Date(),
        });
      }

      if (rescheduleDate) {
        enq.followUpDate = rescheduleDate;
      }

      await enq.save();
      updatedCount++;
      if (enq.enquiryId) transferredEnquiryIds.push(enq.enquiryId);
    }

    // Also update any standalone Task documents linked to these enquiries
    if (transferredEnquiryIds.length > 0 || query._id) {
      try {
        await Task.updateMany(
          {
            $or: [
              { linkedEnquiryId: { $in: transferredEnquiryIds } },
              { linkedStudentId: { $in: matchingEnquiries.map((e) => e._id.toString()) } },
            ],
            status: { $in: ["Pending", "In Progress", "Overdue"] },
          },
          {
            $set: {
              assignedTo: cleanTargetAdvisor,
              assignedRole: targetUser?.role || "counsellor",
            },
          }
        );
      } catch (taskErr) {
        console.error("Non-critical error updating Task models on lead transfer:", taskErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully transferred ${updatedCount} lead(s) to ${cleanTargetAdvisor}.`,
      transferredCount: updatedCount,
      targetAdvisor: cleanTargetAdvisor,
    });
  } catch (error: any) {
    console.error("Enquiry Followup Transfer API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to transfer pending followups." },
      { status: 500 }
    );
  }
}
