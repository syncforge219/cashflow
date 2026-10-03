import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import { getUserFromCookies } from "@/lib/auth";
import Student from "@/models/Student";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import { logAuditEntry } from "@/lib/auditLogger";
import { normalizePhone } from "@/lib/studentHelper";
import { withOptionalTransaction } from "@/lib/transactionHelper";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const role = (user.role || "").toLowerCase().trim();
    const isAdmin = role === "admin" || role === "super admin" || role === "super_admin";
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden: Only Admin and Super Admin can execute unmerges." }, { status: 403 });
    }

    const body = await req.json();
    const { recordId, recordType } = body;

    if (!recordId || !recordType || !["Enquiry", "Admission"].includes(recordType)) {
      return NextResponse.json({ success: false, message: "Valid recordId and recordType ('Enquiry' | 'Admission') are required." }, { status: 400 });
    }

    let newStudent: any;
    let oldStudentId: any;

    await withOptionalTransaction(async (session) => {
        let recordDoc: any;
        if (recordType === "Enquiry") {
          recordDoc = await Enquiry.findById(recordId).session(session);
        } else {
          recordDoc = await Admission.findById(recordId).session(session);
        }

        if (!recordDoc) {
          throw new Error(`${recordType} record with id ${recordId} not found.`);
        }

        oldStudentId = recordDoc.studentId;

        // Extract student details for the detached record
        const fullName = (recordType === "Enquiry" ? recordDoc.studentFullName : recordDoc.fullName) || "Detached Student";
        const phone = normalizePhone(recordType === "Enquiry" ? recordDoc.primaryPhoneMobile : recordDoc.mobileNumber);
        const email = (recordType === "Enquiry" ? recordDoc.emailAddress : recordDoc.email) || "";
        const city = (recordType === "Enquiry" ? recordDoc.currentCity : recordDoc.city) || "";
        const parentName = (recordType === "Enquiry" ? recordDoc.parentsFullName : recordDoc.parentName) || "";
        const parentPhone = normalizePhone(recordType === "Enquiry" ? recordDoc.parentsPhoneNumber : recordDoc.parentPhone);

        // Create new distinct Student
        newStudent = new Student({
          fullName: fullName.trim(),
          primaryPhone: phone || "0000000000",
          email: email.toLowerCase().trim(),
          city: city.trim(),
          parentName: parentName.trim(),
          parentPhone,
          status: "ACTIVE",
        });
        await newStudent.save({ session });

        // Update record to point to new Student
        recordDoc.studentId = newStudent._id;
        await recordDoc.save({ session });

        // Write audit log entry
        await logAuditEntry({
          collectionName: "students",
          docId: newStudent._id,
          action: "UNMERGE",
          changedFields: [
            { field: "detachedFromStudentId", oldValue: oldStudentId ? oldStudentId.toString() : null, newValue: newStudent._id.toString() },
            { field: "recordType", oldValue: null, newValue: recordType },
            { field: "recordId", oldValue: null, newValue: recordId },
          ],
          userId: user._id,
        });
      });

    return NextResponse.json({
      success: true,
      message: `Successfully unmerged ${recordType} into new Student ${newStudent.studentCode}`,
      data: {
        newStudent,
        detachedRecordId: recordId,
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/students/merge-review/unmerge:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
