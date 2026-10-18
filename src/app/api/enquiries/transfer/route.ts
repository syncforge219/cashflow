import { todayKey } from "@/lib/dates";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import Enquiry from "@/models/Enquiry";
import Task from "@/models/Task";
import User from "@/models/User";
import Brand from "@/models/Brand";
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
      targetAdvisors,
      distributionPercent,
      sourceAdvisor,
      sourceAdvisorId,
      transferScope = "selected", // "selected" | "counsellor_pending" | "all_pending"
      transferRemarks,
      rescheduleDate,
      brandScope,
      course, // Optional course filter: "All" or specific course name e.g. "AutoCAD"
    } = body;

    // Normalize target advisors list (supports multiple counsellors or single counsellor)
    let targetList: Array<{ name: string; id?: string; userDoc?: any }> = [];
    if (Array.isArray(targetAdvisors) && targetAdvisors.length > 0) {
      for (const item of targetAdvisors) {
        if (typeof item === "string" && item.trim()) {
          targetList.push({ name: item.trim() });
        } else if (item && typeof item === "object" && item.name && typeof item.name === "string" && item.name.trim()) {
          targetList.push({ name: item.name.trim(), id: item.id || item._id });
        }
      }
    } else if (targetAdvisor && typeof targetAdvisor === "string" && targetAdvisor.trim()) {
      const parts = targetAdvisor.split(",").map((p: string) => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        targetList = parts.map((name: string) => ({ name }));
      } else {
        targetList = [{ name: targetAdvisor.trim(), id: targetAdvisorId }];
      }
    }

    if (targetList.length === 0) {
      return NextResponse.json(
        { success: false, error: "Target counsellor / employee name is required." },
        { status: 400 }
      );
    }

    // Resolve User documents for each target counsellor
    for (const t of targetList) {
      let tUser: any = null;
      if (t.id && mongoose.Types.ObjectId.isValid(t.id)) {
        tUser = await User.findById(t.id).select("name email role brandScope");
      } else {
        tUser = await User.findOne({
          name: new RegExp(`^${t.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
        }).select("name email role brandScope");
      }
      t.userDoc = tUser;
      if (tUser) {
        t.id = tUser._id.toString();
        t.name = tUser.name || t.name;
      }
    }

    let sourceUser: any = null;
    if (sourceAdvisorId && mongoose.Types.ObjectId.isValid(sourceAdvisorId)) {
      sourceUser = await User.findById(sourceAdvisorId).lean();
    } else if (sourceAdvisor) {
      sourceUser = await User.findOne({
        name: new RegExp(`^${sourceAdvisor.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      }).lean();
    }

    // Determine brand scope filter from user or parameter
    const effectiveBrand = brandScope || currentUser?.brandScope || "";
    const isGlobalBrand = !effectiveBrand || ["all", "all brands", "global", "*"].includes(effectiveBrand.toLowerCase());

    let brandDoc: any = null;
    if (!isGlobalBrand) {
      const bRegex = new RegExp(`^${effectiveBrand.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
      brandDoc = (mongoose.Types.ObjectId.isValid(effectiveBrand)
        ? await Brand.findById(effectiveBrand).lean()
        : await Brand.findOne({ $or: [{ name: bRegex }, { code: bRegex }] }).lean()) as any;
    }

    let query: any = {};

    if (transferScope === "selected" && Array.isArray(enquiryIds) && enquiryIds.length > 0) {
      query._id = { $in: enquiryIds };
    } else if (transferScope === "course_wise" || transferScope === "course_pending") {
      if (!course || typeof course !== "string" || !course.trim() || course.toLowerCase() === "all") {
        return NextResponse.json(
          { success: false, error: "A specific course name is required for course-wise transfer." },
          { status: 400 }
        );
      }
      query.status = { $nin: ["Lost", "Admitted", "Do Not Call", "Do Not Followup", "Completed"] };
      if (sourceAdvisor || sourceUser) {
        const sRegex = sourceAdvisor ? new RegExp(`^${sourceAdvisor.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") : null;
        if (sourceUser) {
          query.$or = [{ assignedCrmAdvisorId: sourceUser._id }];
          if (sRegex) query.$or.push({ assignedCrmAdvisor: sRegex });
        } else if (sRegex) {
          query.assignedCrmAdvisor = sRegex;
        }
      }
      if (!isGlobalBrand) {
        const bRegex = new RegExp(effectiveBrand.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        if (brandDoc) {
          const brandClause = { $or: [{ targetBrandId: brandDoc._id }, { targetBrand: bRegex }] };
          if (query.$or) {
            query.$and = [{ $or: query.$or }, brandClause];
            delete query.$or;
          } else {
            query.$or = brandClause.$or;
          }
        } else {
          query.targetBrand = bRegex;
        }
      }
      if (Array.isArray(enquiryIds) && enquiryIds.length > 0) {
        if (query.$and) {
          query.$and.push({ _id: { $in: enquiryIds } });
        } else {
          query._id = { $in: enquiryIds };
        }
      }
    } else if (transferScope === "counsellor_pending" && (sourceAdvisor || sourceUser)) {
      const sRegex = sourceAdvisor ? new RegExp(`^${sourceAdvisor.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") : null;
      if (sourceUser) {
        query.$or = [{ assignedCrmAdvisorId: sourceUser._id }];
        if (sRegex) query.$or.push({ assignedCrmAdvisor: sRegex });
      } else if (sRegex) {
        query.assignedCrmAdvisor = sRegex;
      }
      query.status = { $nin: ["Lost", "Admitted", "Do Not Call", "Do Not Followup", "Completed"] };
      if (!isGlobalBrand) {
        const bRegex = new RegExp(effectiveBrand.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        if (brandDoc) {
          const brandClause = { $or: [{ targetBrandId: brandDoc._id }, { targetBrand: bRegex }] };
          if (query.$or) {
            query.$and = [{ $or: query.$or }, brandClause];
            delete query.$or;
          } else {
            query.$or = brandClause.$or;
          }
        } else {
          query.targetBrand = bRegex;
        }
      }
    } else if (transferScope === "all_pending") {
      query.status = { $nin: ["Lost", "Admitted", "Do Not Call", "Do Not Followup", "Completed"] };
      if (!isGlobalBrand) {
        const bRegex = new RegExp(effectiveBrand.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        if (brandDoc) {
          query.$or = [{ targetBrandId: brandDoc._id }, { targetBrand: bRegex }];
        } else {
          query.targetBrand = bRegex;
        }
      }
    } else if (Array.isArray(enquiryIds) && enquiryIds.length > 0) {
      query._id = { $in: enquiryIds };
    } else {
      return NextResponse.json(
        { success: false, error: "No leads selected or invalid transfer scope." },
        { status: 400 }
      );
    }

    // Optional course filter: only transfer leads matching this course
    if (course && typeof course === "string" && course.trim() && course !== "All" && course !== "all") {
      const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const cRegex = new RegExp(escapeRegex(course.trim()), "i");
      const courseClause = {
        $or: [
          { targetCourse: cRegex },
          { courses: cRegex },
          { targetCourses: cRegex },
        ],
      };
      if (query.$and) {
        query.$and.push(courseClause);
      } else if (query.$or) {
        query.$and = [{ $or: query.$or }, courseClause];
        delete query.$or;
      } else {
        query.$and = [courseClause];
      }
    }

    // Fetch matching enquiries
    const matchingEnquiries = await Enquiry.find(query);

    if (!matchingEnquiries || matchingEnquiries.length === 0) {
      const courseNotFoundMsg = course && course !== "All" ? ` for course "${course.trim()}"` : "";
      return NextResponse.json(
        { success: false, error: `No matching pending leads found to transfer${courseNotFoundMsg}.` },
        { status: 404 }
      );
    }

    const totalFound = matchingEnquiries.length;
    const numericPercent =
      typeof distributionPercent === "number" && !isNaN(distributionPercent) && distributionPercent > 0 && distributionPercent <= 100
        ? distributionPercent
        : 100;

    // Slice leads to transfer according to percentage
    const leadsToTransferCount =
      numericPercent < 100
        ? Math.max(1, Math.min(totalFound, Math.round(totalFound * (numericPercent / 100))))
        : totalFound;

    const enquiriesToTransfer = matchingEnquiries.slice(0, leadsToTransferCount);

    const todayStr = todayKey();
    const performerName = currentUser?.name ? `${currentUser.name} (${currentUser.role || "Centre Head"})` : "Centre Head";
    const courseNote = course && course !== "All" ? ` [Course: ${course.trim()}]` : "";
    const noteText = `${courseNote}${transferRemarks?.trim() ? ` Note: ${transferRemarks.trim()}` : ""}`;

    let updatedCount = 0;
    const countByAdvisor: Record<string, number> = {};
    const idsByAdvisor: Record<string, string[]> = {};

    for (const t of targetList) {
      countByAdvisor[t.name] = 0;
      idsByAdvisor[t.name] = [];
    }

    // Reassign leads round-robin across selected target counsellors
    for (let i = 0; i < enquiriesToTransfer.length; i++) {
      const enq = enquiriesToTransfer[i];
      const assignedTarget = targetList[i % targetList.length];
      const cleanTargetAdvisor = assignedTarget.name;
      const targetUser = assignedTarget.userDoc;

      countByAdvisor[cleanTargetAdvisor] = (countByAdvisor[cleanTargetAdvisor] || 0) + 1;
      idsByAdvisor[cleanTargetAdvisor].push(enq._id.toString());
      if (enq.enquiryId) idsByAdvisor[cleanTargetAdvisor].push(enq.enquiryId);

      const oldAdvisor = enq.assignedCrmAdvisor || "Unassigned";
      enq.assignedCrmAdvisor = cleanTargetAdvisor;
      if (targetUser?._id) {
        enq.assignedCrmAdvisorId = targetUser._id;
      }

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
    }

    // Update standalone Task documents linked to these enquiries for each counsellor
    for (const target of targetList) {
      const linkedIds = idsByAdvisor[target.name] || [];
      if (linkedIds.length > 0) {
        try {
          await Task.updateMany(
            {
              $or: [
                { linkedEnquiryId: { $in: linkedIds } },
                { linkedStudentId: { $in: linkedIds } },
              ],
              status: { $in: ["Pending", "In Progress", "Overdue"] },
            },
            {
              $set: {
                assignedTo: target.name,
                assignedRole: target.userDoc?.role || "counsellor",
              },
            }
          );
        } catch (taskErr) {
          console.error("Non-critical error updating Task models on lead transfer:", taskErr);
        }
      }
    }

    const courseMsg = course && course !== "All" ? ` in course "${course.trim()}"` : "";
    const advisorsSummary = targetList.map((t) => `${t.name} (${countByAdvisor[t.name] || 0} leads)`).join(", ");

    let successMessage = "";
    if (targetList.length > 1) {
      successMessage = `Successfully transferred ${updatedCount} of ${totalFound} lead(s) (${numericPercent}%)${courseMsg} distributed across ${targetList.length} counsellors: ${advisorsSummary}.`;
    } else {
      successMessage = numericPercent < 100
        ? `Successfully transferred ${updatedCount} of ${totalFound} lead(s) (${numericPercent}%)${courseMsg} to ${targetList[0].name}.`
        : `Successfully transferred ${updatedCount} lead(s)${courseMsg} to ${targetList[0].name}.`;
    }

    return NextResponse.json({
      success: true,
      message: successMessage,
      transferredCount: updatedCount,
      totalCount: totalFound,
      distributionPercent: numericPercent,
      targetAdvisor: targetList.length === 1 ? targetList[0].name : targetList.map((t) => t.name).join(", "),
      targetAdvisors: targetList.map((t) => ({ name: t.name, count: countByAdvisor[t.name] || 0 })),
    });
  } catch (error: any) {
    console.error("Enquiry Followup Transfer API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to transfer pending followups." },
      { status: 500 }
    );
  }
}
