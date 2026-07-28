import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Task from "@/models/Task";
import { getUserFromCookies } from "@/lib/helper";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const admission = await Admission.findById(id).lean();
    if (!admission) {
      return NextResponse.json({ success: false, message: "Student record not found" }, { status: 404 });
    }

    // Role check: brand manager brand scoping
    const userRole = (user.role || "").toLowerCase();
    const isBrandManager = userRole === "brand_manager" || userRole === "brand-manager" || userRole === "brand manager";
    if (isBrandManager && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All") {
      const studentBrand = (admission as any).brand || "";
      if (studentBrand.toLowerCase() !== user.brandScope.toLowerCase()) {
        return NextResponse.json({ success: false, message: "Access denied for this brand student" }, { status: 403 });
      }
    }

    // Fetch related payment history & tasks
    const payments = await Payment.find({ admissionId: id }).sort({ createdAt: -1 }).lean();
    const tasks = await Task.find({
      $or: [
        { linkedStudentId: id },
        { linkedStudentName: (admission as any).fullName }
      ]
    }).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      data: {
        admission,
        payments,
        tasks
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/admissions/[id]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch student details" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const userRole = (user.role || "").toLowerCase();
    const isAuthorized =
      userRole === "admin" ||
      userRole === "super admin" ||
      userRole === "super_admin" ||
      userRole === "brand_manager" ||
      userRole === "brand-manager" ||
      userRole === "brand manager";

    if (!isAuthorized) {
      return NextResponse.json({ success: false, message: "Forbidden: Only Admins and Brand Managers can edit student records." }, { status: 403 });
    }

    const body = await req.json();

    const existingDoc = await Admission.findById(id);
    if (!existingDoc) {
      return NextResponse.json({ success: false, message: "Student record not found" }, { status: 404 });
    }

    // Role check: brand manager scope
    const isBrandManager = userRole === "brand_manager" || userRole === "brand-manager" || userRole === "brand manager";
    if (isBrandManager && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All") {
      const studentBrand = existingDoc.brand || "";
      if (studentBrand.toLowerCase() !== user.brandScope.toLowerCase()) {
        return NextResponse.json({ success: false, message: "Access denied for this brand student" }, { status: 403 });
      }
    }

    // Recalculate fees if modified
    const courseFee = body.courseFee !== undefined ? Number(body.courseFee) : existingDoc.courseFee;
    const finalFee = body.finalFee !== undefined ? Number(body.finalFee) : existingDoc.finalFee;
    const amountReceivedToday = body.amountReceivedToday !== undefined ? Number(body.amountReceivedToday) : existingDoc.amountReceivedToday;

    // Calculate total payments recorded for this admission
    const paymentsSumResult = await Payment.aggregate([
      { $match: { admissionId: existingDoc._id } },
      { $group: { _id: null, total: { $sum: "$amountReceived" } } }
    ]);
    const totalPaymentsReceived = (paymentsSumResult[0]?.total || 0);

    const calculatedBalance = Math.max(0, finalFee - totalPaymentsReceived);
    const remainingBalance = body.remainingBalance !== undefined ? Number(body.remainingBalance) : calculatedBalance;

    const updatePayload = {
      fullName: body.fullName !== undefined ? body.fullName.trim() : existingDoc.fullName,
      mobileNumber: body.mobileNumber !== undefined ? body.mobileNumber.trim() : existingDoc.mobileNumber,
      email: body.email !== undefined ? body.email.trim() : existingDoc.email,
      parentName: body.parentName !== undefined ? body.parentName.trim() : (body.parentsFullName || existingDoc.parentName),
      parentPhone: body.parentPhone !== undefined ? body.parentPhone.trim() : (body.parentsPhoneNumber || existingDoc.parentPhone),
      parentsFullName: body.parentsFullName !== undefined ? body.parentsFullName.trim() : (body.parentName || existingDoc.parentsFullName),
      parentsPhoneNumber: body.parentsPhoneNumber !== undefined ? body.parentsPhoneNumber.trim() : (body.parentPhone || existingDoc.parentsPhoneNumber),
      address: body.address !== undefined ? body.address.trim() : existingDoc.address,
      city: body.city !== undefined ? body.city.trim() : existingDoc.city,
      state: body.state !== undefined ? body.state.trim() : existingDoc.state,
      pincode: body.pincode !== undefined ? body.pincode.trim() : existingDoc.pincode,
      dob: body.dob !== undefined ? body.dob : existingDoc.dob,
      gender: body.gender !== undefined ? body.gender : existingDoc.gender,
      counsellor: body.counsellor !== undefined ? body.counsellor.trim() : existingDoc.counsellor,
      brand: body.brand !== undefined ? body.brand.trim() : existingDoc.brand,
      course: body.course !== undefined ? body.course.trim() : existingDoc.course,
      batch: body.batch !== undefined ? body.batch.trim() : existingDoc.batch,
      duration: body.duration !== undefined ? body.duration.trim() : existingDoc.duration,
      startDate: body.startDate ? new Date(body.startDate) : existingDoc.startDate,
      academicYear: body.academicYear !== undefined ? body.academicYear.trim() : existingDoc.academicYear,
      admissionDate: body.admissionDate ? new Date(body.admissionDate) : existingDoc.admissionDate,
      companyAssigned: body.companyAssigned !== undefined ? body.companyAssigned.trim() : existingDoc.companyAssigned,
      courseFee,
      finalFee,
      amountReceivedToday,
      remainingBalance,
      paymentMode: body.paymentMode !== undefined ? body.paymentMode.trim() : existingDoc.paymentMode,
      transactionNo: body.transactionNo !== undefined ? body.transactionNo.trim() : existingDoc.transactionNo,
      hasEmi: body.hasEmi !== undefined ? Boolean(body.hasEmi) : existingDoc.hasEmi,
      numInstallments: body.numInstallments !== undefined ? Number(body.numInstallments) : existingDoc.numInstallments,
      installmentAmount: body.installmentAmount !== undefined ? Number(body.installmentAmount) : existingDoc.installmentAmount,
      customEmiPlan: body.customEmiPlan !== undefined ? body.customEmiPlan : existingDoc.customEmiPlan,
    };

    const updatedDoc = await Admission.findByIdAndUpdate(id, updatePayload, { new: true });

    return NextResponse.json({
      success: true,
      message: "Student record updated successfully",
      data: updatedDoc
    });
  } catch (error: any) {
    console.error("Error in PUT /api/admissions/[id]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update student details" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const userRole = (user.role || "").toLowerCase();
    const isAuthorized = userRole === "admin" || userRole === "super admin" || userRole === "super_admin";
    if (!isAuthorized) {
      return NextResponse.json({ success: false, message: "Forbidden: Only Admins can delete student records." }, { status: 403 });
    }

    await Admission.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: "Student record deleted successfully" });
  } catch (error: any) {
    console.error("Error in DELETE /api/admissions/[id]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete student record" },
      { status: 500 }
    );
  }
}
