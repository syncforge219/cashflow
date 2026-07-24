import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const admissions = await Admission.find({}).sort({ createdAt: -1 }).lean();

    const receipts = admissions.flatMap((a: any) => {
      const installments = a.installmentPlan || [];
      return installments
        .filter((inst: any) => inst.status === "Paid")
        .map((inst: any, idx: number) => ({
          receiptNo: inst.receiptNo || `REC-${a.admissionId || a._id}-${idx + 1}`,
          studentName: a.studentFullName,
          course: a.targetCourse,
          brand: a.targetBrand,
          amountPaid: inst.amountPaid || inst.amount,
          paymentMode: inst.paymentMode || a.paymentMode || "UPI",
          paymentDate: inst.paymentDate || inst.dueDate || a.createdAt,
          installmentNo: inst.installmentNo || idx + 1,
        }));
    });

    return NextResponse.json({ success: true, data: receipts });
  } catch (error: any) {
    console.error("Error in GET /api/receipts:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch receipts" },
      { status: 500 }
    );
  }
}
