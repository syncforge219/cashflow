import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { readFile } from "fs/promises";
import path from "path";
import dbConnect from "@/lib/db";
import Payment from "@/models/Payment";
import Admission from "@/models/Admission";
import Brand from "@/models/Brand";
import Company from "@/models/Company";
import { generateReceiptPdfBuffer } from "@/lib/pdfGenerator";
import { htmlToPdfBuffer } from "@/lib/puppeteerPdf";
import { generateOfficialReceiptHtml, ReceiptHtmlData } from "@/lib/receiptHtmlGenerator";

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function generatePdfFromDb({
  receiptNoParam,
  paymentIdParam,
  admissionIdParam,
}: {
  receiptNoParam?: string | null;
  paymentIdParam?: string | null;
  admissionIdParam?: string | null;
}) {
  await dbConnect();
  const receiptNo = (receiptNoParam || "").trim();
  const paymentId = (paymentIdParam || "").trim();
  const admissionId = (admissionIdParam || "").trim();

  if (!receiptNo && !paymentId && !admissionId) {
    return new NextResponse("Receipt number, payment ID, or admission ID required", { status: 400 });
  }

  let payment: any = null;
  if (paymentId && mongoose.Types.ObjectId.isValid(paymentId)) {
    payment = await Payment.findById(paymentId).lean();
  }

  if (!payment && receiptNo) {
    payment = await Payment.findOne({
      $or: [
        { receiptNo },
        { receiptNo: decodeURIComponent(receiptNo) },
        { receiptNo: { $regex: new RegExp(`^${escapeRegExp(receiptNo)}$`, "i") } },
      ],
    }).lean();
  }

  let admission: any = null;
  const paymentAny = payment as any;
  const targetAdmissionId = payment?.admissionId || admissionId;
  if (targetAdmissionId && mongoose.Types.ObjectId.isValid(targetAdmissionId)) {
    admission = await Admission.findById(targetAdmissionId).lean();
  } else if (paymentAny?.admissionNumber) {
    admission = await Admission.findOne({
      $or: [
        { admissionId: paymentAny.admissionNumber },
        { _id: mongoose.Types.ObjectId.isValid(paymentAny.admissionNumber) ? paymentAny.admissionNumber : undefined },
      ].filter(Boolean),
    }).lean();
  }

  const effectiveReceiptNo = payment?.receiptNo || receiptNo || "REC-OFFICIAL";
  const studentName = payment?.studentName || admission?.fullName || "Student";
  const effectiveAdmissionId = admission?.admissionId || "ADM-N/A";
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
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const generatedAtStr = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const finalFee = Number(admission?.finalFee || admission?.courseFee || 0);
  const allPayments = admission?._id
    ? await Payment.find({ admissionId: admission._id }).select("amountReceived").lean()
    : [];
  const totalPaidToDate = allPayments.length > 0
    ? allPayments.reduce((sum: number, p: any) => sum + (Number(p.amountReceived) || 0), 0)
    : Number(payment?.amountReceived || 0);
  const remainingBalance = Math.max(0, finalFee - totalPaidToDate);
  const targetBrandName = payment?.brand || admission?.brand || "";
  const brand = await Brand.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${escapeRegExp(targetBrandName.trim())}$`, "i") } },
      { code: { $regex: new RegExp(`^${escapeRegExp(targetBrandName.trim())}$`, "i") } },
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
          "Content-Disposition": `attachment; filename="Fee_Receipt_${effectiveReceiptNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf"`,
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    } catch (err) {
      console.error("Error reading brand template PDF file:", err);
    }
  }

  const targetCompName =
    (payment?.company && payment.company !== "Cash" && payment.company !== "Unallocated" && payment.company !== "Cash (Unallocated)" && payment.company !== "Auto" ? payment.company : null) ||
    (admission?.companyAssigned && admission.companyAssigned !== "Cash" && admission.companyAssigned !== "Unallocated" && admission.companyAssigned !== "Cash (Unallocated)" && admission.companyAssigned !== "Auto" ? admission.companyAssigned : null) ||
    (admission?.company && admission.company !== "Cash" && admission.company !== "Unallocated" ? admission.company : null);

  let companyObj: any = null;
  if (targetCompName) {
    companyObj = await Company.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${escapeRegExp(targetCompName.trim())}$`, "i") } },
        { legalName: { $regex: new RegExp(`^${escapeRegExp(targetCompName.trim())}$`, "i") } },
      ],
    }).lean();
  }

  if (!companyObj && targetBrandName) {
    companyObj = await Company.findOne({
      $or: [
        { brands: { $regex: new RegExp(`^${escapeRegExp(targetBrandName.trim())}$`, "i") } },
        { brand: { $regex: new RegExp(`^${escapeRegExp(targetBrandName.trim())}$`, "i") } },
      ],
    }).lean();
  }

  const companyName = companyObj?.legalName || companyObj?.name || targetCompName || brand?.companies?.[0] || targetBrandName || "";
  const companyAddress = companyObj?.address || brand?.address || "No listed street, No City, No State, PIN";
  const brandLogoUrl = brand?.logoUrl || (brand?.receiptTemplateUrl && !brand.receiptTemplateUrl.toLowerCase().endsWith(".pdf") ? brand.receiptTemplateUrl : null);

  const receiptData: ReceiptHtmlData = {
    receiptNo: effectiveReceiptNo,
    studentName,
    admissionId: effectiveAdmissionId,
    courseName,
    amountPaid,
    paymentDate,
    paymentMode: payment?.paymentMode || "Online",
    referenceNo: payment?.referenceNo || "N/A",
    particulars: typeof paymentAny?.particulars === "string" ? paymentAny.particulars : "Course Fee / Registration Payment Received",
    brandName: targetBrandName,
    brandAddress: brand?.address || "",
    brandLogoUrl,
    companyName,
    companyAddress,
    batch: admission?.batch || admission?.city || "General Batch",
    city: admission?.city || "",
    finalFee,
    totalPaidToDate,
    remainingBalance,
    downpaymentAmount: admission?.downpaymentAmount,
    downpaymentDueDate: admission?.downpaymentDueDate,
    customEmiPlan: admission?.customEmiPlan,
    terms: brand?.receiptTerms ? [brand.receiptTerms] : undefined,
  };

  const safeFilename = `Fee_Receipt_${effectiveReceiptNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

  // 1. Try Puppeteer for pixel-perfect official receipt matching modal exactly
  try {
    const html = generateOfficialReceiptHtml(receiptData);
    const pdfBuffer = await htmlToPdfBuffer(html);
    return new NextResponse(Uint8Array.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (pupErr) {
    console.warn("Puppeteer failed to generate receipt, falling back to pdfGenerator:", pupErr);
  }

  // 2. Fallback to vector generator
  const pdfBuffer = generateReceiptPdfBuffer({
    receiptNo: effectiveReceiptNo,
    studentName,
    admissionId: effectiveAdmissionId,
    courseName,
    amountPaid,
    paymentDate,
    paymentMode: payment?.paymentMode || "Cash",
    referenceNo: payment?.referenceNo || "N/A",
    brandName: targetBrandName,
    brandAddress: brand?.address || "",
    companyName,
    companyAddress,
    totalFee: finalFee,
    totalPaidToDate,
    remainingBalance,
    downpaymentAmount: admission?.downpaymentAmount,
    downpaymentDueDate: admission?.downpaymentDueDate,
    customEmiPlan: admission?.customEmiPlan,
    generatedAtStr,
  });

  return new NextResponse(Uint8Array.from(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    return await generatePdfFromDb({
      receiptNoParam: searchParams.get("receiptNo"),
      paymentIdParam: searchParams.get("paymentId"),
      admissionIdParam: searchParams.get("admissionId"),
    });
  } catch (error: any) {
    console.error("Error generating receipt PDF download route:", error);
    return new NextResponse("Failed to generate receipt PDF", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { html, receiptNo, paymentId, admissionId } = body;
    const effectiveReceiptNo = receiptNo || "REC-OFFICIAL";
    const safeFilename = `Fee_Receipt_${effectiveReceiptNo.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

    if (html && typeof html === "string" && html.trim().length > 50) {
      try {
        const pdfBuffer = await htmlToPdfBuffer(html);
        return new NextResponse(Uint8Array.from(pdfBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${safeFilename}"`,
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          },
        });
      } catch (err) {
        console.warn("Puppeteer failed on POST html, falling back to database generator:", err);
      }
    }

    return await generatePdfFromDb({
      receiptNoParam: receiptNo,
      paymentIdParam: paymentId,
      admissionIdParam: admissionId,
    });
  } catch (error: any) {
    console.error("Error in POST /api/receipts/download-pdf:", error);
    return new NextResponse("Failed to generate receipt PDF", { status: 500 });
  }
}
