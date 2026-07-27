import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import { getUserFromCookies } from "@/lib/helper";

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
        // Required field validation (companyAssigned, paymentMode, transactionNo, paymentDate are optional)
        const required = ["fullName", "mobileNumber", "city", "state", "pincode", "counsellor", "course", "batch", "duration", "startDate", "academicYear", "admissionDate", "courseFee", "finalFee", "amountReceivedToday", "remainingBalance"];
        const missing = required.filter((f) => row[f] === undefined || row[f] === null || String(row[f]).trim() === "");

        if (missing.length > 0) {
          results.push({ index: i, status: "error", error: `Missing required fields: ${missing.join(", ")}` });
          continue;
        }

        // Mark as historical import
        const record = {
          ...row,
          isHistoricalImport: true,
          importedBy: (user.email ?? user.name ?? "admin") as string,
          importedAt: new Date(),
          // Optional fields — use sensible defaults if not provided
          companyAssigned: row.companyAssigned?.trim() || "Unallocated",
          paymentMode: row.paymentMode?.trim() || "Cash",
          transactionNo: row.transactionNo?.trim() || `IMPORT-${i + 1}`,
          // Ensure numeric fields
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
          // Parse dates safely
          startDate: row.startDate ? new Date(row.startDate) : new Date(),
          admissionDate: row.admissionDate ? new Date(row.admissionDate) : new Date(),
          paymentDate: row.paymentDate ? new Date(row.paymentDate) : new Date(),
        };

        const admission = new Admission(record);
        await admission.save();
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
