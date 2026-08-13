import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import CorporateTraining from "@/models/CorporateTraining";
import { getUserFromCookies } from "@/lib/helper";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const training = await CorporateTraining.findById(id).lean();

    if (!training) {
      return NextResponse.json({ success: false, error: "Corporate training not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: training });
  } catch (error: any) {
    console.error("Error in GET /api/corporate-trainings/[id]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const training = await CorporateTraining.findById(id);
    if (!training) {
      return NextResponse.json({ success: false, error: "Corporate training not found" }, { status: 404 });
    }

    // Action 1: Record additional installment payment
    if (body.action === "recordPayment" || body.newPayment) {
      const paymentAmount = Number(body.newPayment?.amount || body.paymentAmount) || 0;
      if (paymentAmount <= 0) {
        return NextResponse.json({ success: false, error: "Valid payment amount is required" }, { status: 400 });
      }

      const year = new Date().getFullYear();
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const receiptNo = `CORP-REC-${year}-${randNum}`;

      const newRecord = {
        receiptNo,
        amount: paymentAmount,
        date: body.newPayment?.date ? new Date(body.newPayment.date) : new Date(),
        paymentMode: body.newPayment?.paymentMode || body.paymentMode || "Bank Transfer / NEFT",
        referenceNo: body.newPayment?.referenceNo || body.referenceNo || "",
        remarks: body.newPayment?.remarks || body.remarks || "Corporate Training Installment",
        recordedBy: user?.name || "Staff",
      };

      training.paymentHistory.push(newRecord);
      training.amountReceived = (training.amountReceived || 0) + paymentAmount;
      training.remainingBalance = Math.max(0, (training.totalAmount || 0) - training.amountReceived);

      if (training.remainingBalance === 0 && training.status === "Payment Pending") {
        training.status = "Ongoing";
      }

      await training.save();

      return NextResponse.json({
        success: true,
        message: `Payment of ₹${paymentAmount.toLocaleString("en-IN")} recorded successfully (${receiptNo})`,
        data: training,
        receipt: newRecord,
      });
    }

    // Action 2: General update of training fields
    const {
      companyName,
      contactPerson,
      contactPhone,
      contactEmail,
      trainingProgram,
      description,
      trainingMode,
      numberOfParticipants,
      location,
      faculty,
      facultyId,
      facultyEmail,
      facultyPhone,
      startDate,
      endDate,
      durationHours,
      totalAmount,
      brand,
      companyAssigned,
      salesExecutive,
      centreHead,
      status,
      remarks,
    } = body;

    if (companyName) training.companyName = companyName.trim();
    if (contactPerson !== undefined) training.contactPerson = contactPerson.trim();
    if (contactPhone !== undefined) training.contactPhone = contactPhone.trim();
    if (contactEmail !== undefined) training.contactEmail = contactEmail.trim();
    if (trainingProgram) training.trainingProgram = trainingProgram.trim();
    if (description !== undefined) training.description = description.trim();
    if (trainingMode) training.trainingMode = trainingMode;
    if (numberOfParticipants !== undefined) training.numberOfParticipants = Number(numberOfParticipants) || 1;
    if (location !== undefined) training.location = location.trim();
    if (faculty) training.faculty = faculty.trim();
    if (facultyId !== undefined) training.facultyId = facultyId || undefined;
    if (facultyEmail !== undefined) training.facultyEmail = facultyEmail.trim();
    if (facultyPhone !== undefined) training.facultyPhone = facultyPhone.trim();
    if (startDate) training.startDate = new Date(startDate);
    if (endDate) training.endDate = new Date(endDate);
    if (durationHours !== undefined) training.durationHours = durationHours.trim();

    if (totalAmount !== undefined) {
      training.totalAmount = Number(totalAmount) || 0;
      training.remainingBalance = Math.max(0, training.totalAmount - (training.amountReceived || 0));
    }

    if (brand) training.brand = brand;
    if (companyAssigned) training.companyAssigned = companyAssigned;
    if (salesExecutive !== undefined) training.salesExecutive = salesExecutive.trim();
    if (centreHead !== undefined) training.centreHead = centreHead.trim();
    if (status) training.status = status;
    if (remarks !== undefined) training.remarks = remarks.trim();

    await training.save();

    return NextResponse.json({
      success: true,
      message: `Corporate Training ${training.trainingId} updated successfully!`,
      data: training,
    });
  } catch (error: any) {
    console.error("Error in PUT /api/corporate-trainings/[id]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const userRole = (user?.role || "").toLowerCase().trim();

    const isAuthorized =
      userRole === "admin" ||
      userRole === "super admin" ||
      userRole === "super_admin" ||
      userRole === "director" ||
      userRole.includes("manager") ||
      userRole.includes("head");

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Only Admins and Centre Heads can delete trainings" }, { status: 403 });
    }

    const { id } = await context.params;
    const deleted = await CorporateTraining.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Corporate training not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Corporate training ${deleted.trainingId} deleted successfully.`,
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/corporate-trainings/[id]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
