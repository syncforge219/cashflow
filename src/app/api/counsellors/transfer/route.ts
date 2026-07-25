import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import Task from "@/models/Task";

export async function POST(request: Request) {
  try {
    await dbConnect();

    const body = await request.json();
    const {
      fromCounsellorId,
      toCounsellorId,
      transferEnquiries = true,
      transferAdmissions = true,
      transferTasks = true,
    } = body;

    if (!fromCounsellorId || !toCounsellorId) {
      return NextResponse.json(
        { error: "Source counsellor and target counsellor are required." },
        { status: 400 }
      );
    }

    if (fromCounsellorId === toCounsellorId) {
      return NextResponse.json(
        { error: "Source and target counsellors cannot be the same person." },
        { status: 400 }
      );
    }

    // Fetch counsellors
    const sourceUser = await User.findById(fromCounsellorId);
    const targetUser = await User.findById(toCounsellorId);

    if (!sourceUser || !targetUser) {
      return NextResponse.json(
        { error: "One or both counsellors were not found." },
        { status: 404 }
      );
    }

    // Verify brand scope overlap
    const parseBrands = (scopeStr: string) => {
      if (!scopeStr) return [];
      return scopeStr.split(/[,/|]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    };

    const sourceBrands = parseBrands(sourceUser.brandScope);
    const targetBrands = parseBrands(targetUser.brandScope);

    const isGlobal = (brands: string[]) =>
      brands.some((b) => ["all", "all brands", "global", "*"].includes(b));

    const sharesBrand =
      isGlobal(sourceBrands) ||
      isGlobal(targetBrands) ||
      sourceBrands.some((sb) => targetBrands.includes(sb));

    if (!sharesBrand) {
      return NextResponse.json(
        {
          error: `Cannot transfer data: Counsellors do not belong to the same brand (${sourceUser.brandScope || "N/A"} vs ${targetUser.brandScope || "N/A"}).`,
        },
        { status: 400 }
      );
    }

    const sourceNames = Array.from(
      new Set([
        sourceUser.name,
        sourceUser.email,
        sourceUser._id.toString(),
      ].filter(Boolean))
    );

    const targetName = targetUser.name;

    let enquiriesTransferred = 0;
    let admissionsTransferred = 0;
    let tasksTransferred = 0;

    // Flexible regex search pattern (substring match, case insensitive)
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameOrEmailPatterns = sourceNames.map((n) => new RegExp(escapeRegex(n.trim()), "i"));

    // 1. Transfer Enquiries
    if (transferEnquiries) {
      const result = await Enquiry.updateMany(
        {
          $or: nameOrEmailPatterns.map((pattern) => ({
            assignedCrmAdvisor: pattern,
          })),
        },
        {
          $set: { assignedCrmAdvisor: targetName },
        }
      );
      enquiriesTransferred = result.modifiedCount || 0;
    }

    // 2. Transfer Admissions
    if (transferAdmissions) {
      const result = await Admission.updateMany(
        {
          $or: nameOrEmailPatterns.map((pattern) => ({
            counsellor: pattern,
          })),
        },
        {
          $set: { counsellor: targetName },
        }
      );
      admissionsTransferred = result.modifiedCount || 0;
    }

    // 3. Transfer Tasks
    if (transferTasks) {
      const result = await Task.updateMany(
        {
          $or: nameOrEmailPatterns.map((pattern) => ({
            assignedTo: pattern,
          })),
        },
        {
          $set: { assignedTo: targetName },
        }
      );
      tasksTransferred = result.modifiedCount || 0;
    }

    // 4. Update Stored Metrics on User Models
    const sourceRev = sourceUser.currentRevenue || 0;
    const sourceAdm = sourceUser.admissionsRecorded || 0;

    // Reset source user's static metrics to 0
    await User.findByIdAndUpdate(fromCounsellorId, {
      $set: {
        currentRevenue: 0,
        admissionsRecorded: 0,
      },
    });

    // Transfer static metrics to target user
    if (sourceRev > 0 || sourceAdm > 0) {
      await User.findByIdAndUpdate(toCounsellorId, {
        $inc: {
          currentRevenue: sourceRev,
          admissionsRecorded: sourceAdm,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully transferred data from ${sourceUser.name} to ${targetName}.`,
      transferred: {
        enquiries: enquiriesTransferred,
        admissions: admissionsTransferred,
        tasks: tasksTransferred,
        revenueTransferred: sourceRev,
        admissionsTransferred: sourceAdm,
      },
    });
  } catch (error: any) {
    console.error("Counsellor Data Transfer API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to transfer counsellor data." },
      { status: 500 }
    );
  }
}
