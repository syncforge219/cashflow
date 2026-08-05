import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import dbConnect from "@/lib/db";
import Payment from "@/models/Payment";
import Admission from "@/models/Admission";
import Brand from "@/models/Brand";
import Company from "@/models/Company";
import { generateReceiptPdfBuffer } from "@/lib/pdfGenerator";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ receiptNo: string }> }
) {
  try {
    await dbConnect();
    const { receiptNo } = await params;

    if (!receiptNo) {
      return new NextResponse("Receipt number required", { status: 400 });
    }

    const payment = await Payment.findOne({ receiptNo }).lean();
    let admission: any = null;

    if (payment && payment.admissionId) {
      admission = await Admission.findById(payment.admissionId).lean();
    }

    const studentName = payment?.studentName || admission?.fullName || "Student";
    const admissionId = admission?.admissionId || "ADM-N/A";
    const courseName = admission?.course || "Course";
    const amountPaid = payment?.amountReceived || 0;
    const createdAtDate = payment?.createdAt ? new Date(payment.createdAt) : null;
    const pDate = payment?.paymentDate ? new Date(payment.paymentDate) : null;
    let paymentDateObj = new Date();

    if (createdAtDate && !isNaN(createdAtDate.getTime())) {
      paymentDateObj = createdAtDate;
      if (pDate && !isNaN(pDate.getTime())) {
        const isSameDay =
          createdAtDate.getFullYear() === pDate.getFullYear() &&
          createdAtDate.getMonth() === pDate.getMonth() &&
          createdAtDate.getDate() === pDate.getDate();

        if (!isSameDay) {
          paymentDateObj = new Date(
            pDate.getFullYear(),
            pDate.getMonth(),
            pDate.getDate(),
            createdAtDate.getHours(),
            createdAtDate.getMinutes(),
            createdAtDate.getSeconds()
          );
        }
      }
    } else if (pDate && !isNaN(pDate.getTime())) {
      const h = pDate.getHours();
      const m = pDate.getMinutes();
      if ((h === 5 && m === 30) || (h === 0 && m === 0)) {
        const now = new Date();
        paymentDateObj = new Date(
          pDate.getFullYear(),
          pDate.getMonth(),
          pDate.getDate(),
          now.getHours(),
          now.getMinutes()
        );
      } else {
        paymentDateObj = pDate;
      }
    }

    const paymentDate = paymentDateObj.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    const generatedAtStr = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    const finalFee = Number(admission?.finalFee || admission?.courseFee || 0);
    const remainingBalance = Number(admission?.remainingBalance ?? 0);
    const totalPaidToDate = Math.max(0, finalFee - remainingBalance);
    const targetBrandName = payment?.brand || admission?.brand || "CADD MANTRA";
    const brand = await Brand.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${targetBrandName}$`, "i") } },
        { code: { $regex: new RegExp(`^${targetBrandName}$`, "i") } },
      ],
    }).lean();

    // If brand has an uploaded custom receipt template PDF file, serve it directly
    if (brand && brand.receiptTemplateUrl && brand.receiptTemplateUrl.startsWith("/uploads/")) {
      try {
        const filePath = path.join(process.cwd(), "public", brand.receiptTemplateUrl);
        const fileBuffer = await readFile(filePath);
        return new NextResponse(Uint8Array.from(fileBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="Fee_Receipt_${receiptNo}.pdf"`,
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (err) {
        console.error("Error reading brand template PDF file:", err);
      }
    }

    const rawCompany = payment?.company || admission?.companyAssigned || brand?.companies?.[0];
    let companyObj: any = null;
    if (rawCompany && rawCompany !== "Cash" && rawCompany !== "Unallocated" && rawCompany !== "Cash (Unallocated)") {
      companyObj = await Company.findOne({
        $or: [
          { name: { $regex: new RegExp(`^${rawCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } },
          { legalName: { $regex: new RegExp(`^${rawCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } },
        ],
      }).lean();
    }

    const companyName = (rawCompany && rawCompany !== "Cash" && rawCompany !== "Unallocated" && rawCompany !== "Cash (Unallocated)")
      ? rawCompany
      : (companyObj?.legalName || companyObj?.name || "INSTITUTE OF CREATIVE STUDIES");

    const companyAddress = companyObj?.address || brand?.address || "No listed street, No City, No State, PIN";

    const pdfBuffer = generateReceiptPdfBuffer({
      receiptNo,
      studentName,
      admissionId,
      courseName,
      amountPaid,
      paymentDate,
      paymentMode: payment?.paymentMode || "Cash",
      referenceNo: payment?.referenceNo || "N/A",
      brandName: targetBrandName,
      brandAddress: brand?.address || "G 11 , Murli Bhawan , 10- A, Ashok Marg , Lucknow",
      companyName,
      companyAddress,
      totalFee: finalFee,
      totalPaidToDate,
      remainingBalance,
      generatedAtStr,
    });

    return new NextResponse(Uint8Array.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Fee_Receipt_${receiptNo}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Error generating receipt PDF route:", error);
    return new NextResponse("Failed to generate receipt PDF", { status: 500 });
  }
}
