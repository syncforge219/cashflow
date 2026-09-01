import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import { getUserFromCookies } from "@/lib/helper";
import { sendWhatsAppSuperAdminAdmissionAlert } from "@/lib/msg91";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();

    // Only admins can bulk-import
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Only admins can bulk-import admissions." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const rows: any[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No records provided." },
        { status: 400 }
      );
    }

    const results: { index: number; status: "ok" | "error"; admissionId?: string; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        let assignedBatchId = row.batchId?.trim() || "";
        if (!assignedBatchId && row.batch && row.batch !== "General Batch" && row.batch !== "Unassigned") {
          const Batch = (await import("@/models/Batch")).default;
          const matchingBatches = await Batch.find({ batchName: row.batch.trim() }).lean();
          if (matchingBatches.length === 1) {
            assignedBatchId = matchingBatches[0].batchId || matchingBatches[0]._id.toString();
          }
        }

        // All fields optional with safe defaults
        const record = {
          ...row,
          fullName: row.fullName?.trim() || `Student ${i + 1}`,
          mobileNumber: row.mobileNumber?.trim() || "0000000000",
          city: row.city?.trim() || "N/A",
          state: row.state?.trim() || "N/A",
          pincode: row.pincode?.trim() || "000000",
          counsellor: row.counsellor?.trim() || user.name || "Counsellor",
          course: row.course?.trim() || "General Course",
          batch: row.batch?.trim() || "General Batch",
          batchId: assignedBatchId,
          duration: row.duration?.trim() || "6 Months",
          academicYear: row.academicYear?.trim() || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          isHistoricalImport: true,
          importedBy: (user.email ?? user.name ?? "admin") as string,
          importedAt: new Date(),
          companyAssigned: row.companyAssigned?.trim() || "Unallocated",
          paymentMode: row.paymentMode?.trim() || "Cash",
          transactionNo: row.transactionNo?.trim() || `IMPORT-${i + 1}`,
          courseFee: Number(row.courseFee) || 0,
          finalFee: Number(row.finalFee) || 0,
          amountReceivedToday: Number(row.amountReceivedToday) || 0,
          remainingBalance: Number(row.remainingBalance) || 0,
          discountAmount: Number(row.discountAmount) || 0,
          scholarshipAmount: Number(row.scholarshipAmount) || 0,
          additionalDiscount: Number(row.additionalDiscount) || 0,
          totalDiscount: Number(row.totalDiscount) || 0,
          hasEmi: Boolean(row.hasEmi),
          numInstallments: Number(row.numInstallments) || 1,
          installmentAmount: Number(row.installmentAmount) || 0,
          discountApprovalStatus: row.discountApprovalStatus || "Approved",
          startDate: row.startDate ? new Date(row.startDate) : new Date(),
          admissionDate: row.admissionDate ? new Date(row.admissionDate) : new Date(),
          paymentDate: row.paymentDate ? new Date(row.paymentDate) : new Date(),
        };

        const admission = new Admission(record);
        await admission.save();

        sendWhatsAppSuperAdminAdmissionAlert({
          studentName: admission.fullName,
          admissionNumber: admission.admissionId || admission._id?.toString(),
          courseName: admission.course,
          brandName: admission.brand,
          batchName: admission.batch || "Regular Batch",
          counsellorName: admission.counsellor || "Advisor",
          amountPaid: admission.amountReceivedToday,
          registrationAmount: admission.registrationAmount,
          downpaymentAmount: admission.downpaymentAmount,
          paymentMode: admission.paymentMode,
        }).catch((err) => console.error("Async Bulk Admission Super Admin WhatsApp Error:", err));

        results.push({ index: i, status: "ok", admissionId: admission.admissionId ?? undefined });
      } catch (err: any) {
        results.push({ index: i, status: "error", error: err?.message || "Unknown error" });
      }
    }

    const successCount = results.filter((r) => r.status === "ok").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      success: true,
      message: `Import complete: ${successCount} inserted, ${errorCount} failed.`,
      successCount,
      errorCount,
      results,
    });
  } catch (err: any) {
    console.error("Bulk import error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
