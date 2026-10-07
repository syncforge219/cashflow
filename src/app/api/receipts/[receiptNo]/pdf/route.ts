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

    const payment = await Payment.findOne({
      $or: [
        { receiptNo },
        { receiptNo: decodeURIComponent(receiptNo) },
        { receiptNo: { $regex: new RegExp(`^${escapeRegExp(receiptNo.trim())}$`, "i") } },
      ],
    }).lean();

    let admission: any = null;
    const paymentAny = payment as any;
    if (payment && payment.admissionId && mongoose.Types.ObjectId.isValid(payment.admissionId)) {
      admission = await Admission.findById(payment.admissionId).lean();
    } else if (paymentAny?.admissionNumber) {
      admission = await Admission.findOne({
        $or: [
          { admissionId: paymentAny.admissionNumber },
          { _id: mongoose.Types.ObjectId.isValid(paymentAny.admissionNumber) ? paymentAny.admissionNumber : undefined },
        ].filter(Boolean),
      }).lean();
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
            "Content-Disposition": `inline; filename="Fee_Receipt_${receiptNo}.pdf"`,
            "Cache-Control": "public, max-age=3600",
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
      receiptNo,
      studentName,
      admissionId,
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

    // 1. Try Puppeteer for exact official PDF
    try {
      const html = generateOfficialReceiptHtml(receiptData);
      const pdfBuffer = await htmlToPdfBuffer(html);
      return new NextResponse(Uint8Array.from(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="Fee_Receipt_${receiptNo}.pdf"`,
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      });
    } catch (pupErr) {
      console.warn("Puppeteer failed on [receiptNo]/pdf, falling back to pdfGenerator:", pupErr);
    }

    // 2. Fallback to vector generator
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
        "Content-Disposition": `inline; filename="Fee_Receipt_${receiptNo}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Error generating receipt PDF route:", error);
    return new NextResponse("Failed to generate receipt PDF", { status: 500 });
  }
}
