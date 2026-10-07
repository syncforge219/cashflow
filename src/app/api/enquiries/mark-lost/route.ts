import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import LostLeadCounter from "@/models/LostLeadCounter";
import { getUserFromCookies } from "@/lib/helper";
import { logAuditEntry } from "@/lib/auditLogger";

export async function POST(req: Request) {
  try {
    const { enquiryId, date } = await req.json();

    if (!enquiryId || !date) {
      return NextResponse.json({ message: "enquiryId and date are required" }, { status: 400 });
    }

    await dbConnect();

    const existingEnquiry = await Enquiry.findById(enquiryId);
    if (!existingEnquiry) {
      return NextResponse.json({ message: "Enquiry not found" }, { status: 404 });
    }

    const enquiryDoc = existingEnquiry as any;
    const phone = enquiryDoc.primaryPhoneMobile || enquiryDoc.mobileNumber;

    const admissionExists = await Admission.exists({
      $or: [
        { enquiryId: existingEnquiry._id.toString() },
        { enquiryId: existingEnquiry._id },
        ...(phone
          ? [
              { mobileNumber: phone },
              { primaryPhoneMobile: phone }
            ]
          : [])
      ]
    });

    if (admissionExists) {
      return NextResponse.json({ message: "Cannot mark an enquiry as lost while an active student admission record exists." }, { status: 400 });
    }

    // 1. Mark lost and soft-delete (same as DELETE /api/enquiries/[id]?lostLead=true).
    //    A hard delete here bypassed the soft-delete/restore and audit trail and lost the lead for good.
    const user = await getUserFromCookies();
    const userId = (user as any)?._id || null;
    const oldStatus = enquiryDoc.status ?? null;
    enquiryDoc.status = "Lost";
    (enquiryDoc.followUps || []).forEach((f: any) => {
      const s = (f.status || "").toLowerCase();
      if (!f.isCompleted && s !== "completed" && s !== "cancelled") {
        f.status = "Cancelled";
        f.isCompleted = true;
      }
    });
    enquiryDoc.isDeleted = true;
    enquiryDoc.deletedAt = new Date();
    enquiryDoc.deletedBy = userId;
    const enquiry = await existingEnquiry.save();

    await logAuditEntry({
      collectionName: "enquiries",
      docId: existingEnquiry._id,
      action: "SOFT_DELETE",
      changedFields: [
        { field: "status", oldValue: oldStatus, newValue: "Lost" },
        { field: "isDeleted", oldValue: false, newValue: true },
      ],
      userId,
    });

    // 2. Increment the lost lead counter for the given date
    await LostLeadCounter.findOneAndUpdate(
      { date: date },
      { $inc: { count: 1 } },
      { new: true, upsert: true }
    );

    return NextResponse.json({ message: "Lead marked as lost successfully", enquiry });
  } catch (error: any) {
    console.error("Error marking lead as lost:", error);
    return NextResponse.json({ message: error.message || "Failed to mark lead as lost" }, { status: 500 });
  }
}
