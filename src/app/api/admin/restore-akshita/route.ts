import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";

export async function GET() {
  try {
    await dbConnect();

    // Check if Akshita already exists
    let admission = await Admission.findOne({
      $or: [{ admissionId: "ADM000007" }, { mobileNumber: "9454960684" }]
    });

    const generate18EmiItems = (totalAmount: number) => {
      const perInst = Math.round(totalAmount / 18);
      const plan = [];
      const baseDate = new Date("2026-08-01T00:00:00.000Z");
      for (let i = 1; i <= 18; i++) {
        const dueDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 15);
        plan.push({
          installmentName: `Installment ${i}`,
          dueDate,
          amount: i === 18 ? totalAmount - perInst * 17 : perInst,
          isPaid: false
        });
      }
      return plan;
    };

    if (!admission) {
      admission = await Admission.create({
        admissionId: "ADM000007",
        fullName: "AKSHITA Gupta",
        mobileNumber: "9454960684",
        primaryPhoneMobile: "9454960684",
        email: "guptaakshita737@gmail.com",
        parentName: "Guardian",
        parentPhone: "8953031943",
        parentsFullName: "Guardian",
        parentsPhoneNumber: "8953031943",
        brand: "DESIGN GATEWAY",
        companyAssigned: "SP DESIGN GATEWAY TRAINING SERVICES",
        course: "MBA in Interior Design",
        courses: ["MBA in Interior Design"],
        targetCourses: ["MBA in Interior Design"],
        batch: "General Batch",
        duration: "1 Year",
        academicYear: "2026-2027",
        admissionDate: new Date("2026-07-31T00:00:00.000Z"),
        courseFee: 265000,
        finalFee: 265000,
        registrationAmount: 35000,
        amountReceivedToday: 35000,
        downpaymentAmount: 0,
        remainingBalance: 230000,
        paymentMode: "Bank Transfer",
        hasEmi: true,
        numInstallments: 18,
        customEmiPlan: generate18EmiItems(230000),
        counsellor: "Sahej Sharma",
        createdAt: new Date("2026-07-31T00:00:00.000Z")
      });

      await Payment.create({
        admissionId: admission._id,
        studentName: "AKSHITA Gupta",
        amountReceived: 35000,
        paymentMode: "Bank Transfer",
        referenceNo: "REG-ADM000007",
        company: "SP DESIGN GATEWAY TRAINING SERVICES",
        brand: "DESIGN GATEWAY",
        paymentDate: new Date("2026-07-31T00:00:00.000Z"),
        remarks: "Initial registration payment"
      });
    } else {
      // If found under different admissionId, ensure admissionId is ADM000007
      if (admission.admissionId !== "ADM000007") {
        admission.admissionId = "ADM000007";
        await admission.save();
      }
    }

    return NextResponse.json({ success: true, message: "Akshita Gupta record active in MongoDB", data: admission });
  } catch (error: any) {
    console.error("Error restoring Akshita Gupta:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
