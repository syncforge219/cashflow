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
      return NextResponse.json({ success: false, message: "Forbidden: Only Admin and Super Admin can approve merges." }, { status: 403 });
    }

    const body = await req.json();
    const { recordIds, winningValues, existingStudentId } = body;

    if (!Array.isArray(recordIds) || recordIds.length < 2) {
      return NextResponse.json({ success: false, message: "At least two records are required to perform a merge." }, { status: 400 });
    }

    if (!winningValues?.fullName || !winningValues?.primaryPhone) {
      return NextResponse.json({ success: false, message: "Winning fullName and primaryPhone are required." }, { status: 400 });
    }

    const cleanPhone = normalizePhone(winningValues.primaryPhone);
    const cleanParentPhone = normalizePhone(winningValues.parentPhone);
    const cleanGuardian2Phone = normalizePhone(winningValues.guardian2Phone);

    let masterStudent: any;

    await withOptionalTransaction(async (session) => {
        // 1. Resolve or create Master Student
        if (existingStudentId && mongoose.Types.ObjectId.isValid(existingStudentId)) {
          masterStudent = await Student.findById(existingStudentId).session(session);
        }

        if (!masterStudent) {
          masterStudent = new Student({
            fullName: winningValues.fullName.trim(),
            primaryPhone: cleanPhone,
            alternatePhone: winningValues.alternatePhone || "",
            email: (winningValues.email || "").toLowerCase().trim(),
            city: winningValues.city || "",
            parentName: winningValues.parentName || "",
            parentPhone: cleanParentPhone,
            guardian2Name: winningValues.guardian2Name || "",
            guardian2Phone: cleanGuardian2Phone,
            address: winningValues.address || "",
            status: "ACTIVE",
          });
          await masterStudent.save({ session });
        } else {
          // Update master student with winning values
          masterStudent.fullName = winningValues.fullName.trim();
          masterStudent.primaryPhone = cleanPhone;
          if (winningValues.email) masterStudent.email = winningValues.email.toLowerCase().trim();
          if (winningValues.city) masterStudent.city = winningValues.city.trim();
          if (winningValues.parentName) masterStudent.parentName = winningValues.parentName.trim();
          if (cleanParentPhone) masterStudent.parentPhone = cleanParentPhone;
          if (winningValues.guardian2Name) masterStudent.guardian2Name = winningValues.guardian2Name.trim();
          if (cleanGuardian2Phone) masterStudent.guardian2Phone = cleanGuardian2Phone;
          if (winningValues.address) masterStudent.address = winningValues.address.trim();
          await masterStudent.save({ session });
        }

        // 2. Update all selected Enquiries and Admissions
        const enqIds = recordIds.filter((r: any) => r.type === "Enquiry").map((r: any) => new mongoose.Types.ObjectId(r.id));
        const admIds = recordIds.filter((r: any) => r.type === "Admission").map((r: any) => new mongoose.Types.ObjectId(r.id));

        if (enqIds.length > 0) {
          await Enquiry.updateMany(
            { _id: { $in: enqIds } },
            { $set: { studentId: masterStudent._id } },
            session ? { session } : {}
          );
        }

        if (admIds.length > 0) {
          await Admission.updateMany(
            { _id: { $in: admIds } },
            { $set: { studentId: masterStudent._id } },
            session ? { session } : {}
          );
        }

        // 3. Write audit log entry
        const changedFields = [
          { field: "fullName", oldValue: null, newValue: masterStudent.fullName },
          { field: "primaryPhone", oldValue: null, newValue: masterStudent.primaryPhone },
          { field: "linkedRecords", oldValue: null, newValue: recordIds },
        ];

        await logAuditEntry({
          collectionName: "students",
          docId: masterStudent._id,
          action: "MERGE",
          changedFields,
          userId: user._id,
        });
      });

    return NextResponse.json({
      success: true,
      message: `Successfully merged ${recordIds.length} records into Student ${masterStudent.studentCode}`,
      data: {
        student: masterStudent,
      },
    });
  } catch (error: any) {
    console.error("Error in POST /api/students/merge-review/confirm:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
