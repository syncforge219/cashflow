import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Task from "@/models/Task";
import Attendance from "@/models/Attendance";
import Company from "@/models/Company";
import Enquiry from "@/models/Enquiry";
import Notification from "@/models/Notification";
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

    // Role check: brand manager / centre head brand scoping
    const userRole = (user.role || "").toLowerCase();
    const isBrandManager =
      userRole === "brand_manager" ||
      userRole === "brand-manager" ||
      userRole === "brand manager" ||
      userRole === "manager" ||
      userRole === "centre head" ||
      userRole === "centre_head" ||
      userRole === "center head" ||
      userRole === "center_head";
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
      userRole === "brand manager" ||
      userRole === "manager" ||
      userRole === "centre head" ||
      userRole === "centre_head" ||
      userRole === "center head" ||
      userRole === "center_head";

    if (!isAuthorized) {
      return NextResponse.json({ success: false, message: "Forbidden: Only Admins, Brand Managers and Centre Heads can edit student records." }, { status: 403 });
    }

    const body = await req.json();

    const existingDoc = await Admission.findById(id);
    if (!existingDoc) {
      return NextResponse.json({ success: false, message: "Student record not found" }, { status: 404 });
    }

    // Role check: brand manager / centre head scope
    const isBrandManager =
      userRole === "brand_manager" ||
      userRole === "brand-manager" ||
      userRole === "brand manager" ||
      userRole === "manager" ||
      userRole === "centre head" ||
      userRole === "centre_head" ||
      userRole === "center head" ||
      userRole === "center_head";
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
    const regAmt = body.registrationAmount !== undefined ? Number(body.registrationAmount) : (body.amountReceivedToday !== undefined ? Number(body.amountReceivedToday) : (existingDoc.registrationAmount || existingDoc.amountReceivedToday || 0));
    const dpAmt = body.downpaymentAmount !== undefined ? Number(body.downpaymentAmount) : (existingDoc.downpaymentAmount || 0);

    const calculatedBalance = Math.max(0, finalFee - regAmt - dpAmt);

    const rawEmiPlan = body.customEmiPlan !== undefined ? body.customEmiPlan : existingDoc.customEmiPlan;
    const formattedEmiPlan = Array.isArray(rawEmiPlan)
      ? rawEmiPlan.map((item: any) => ({
          ...item,
          dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
          amount: Number(item.amount) || 0,
          isPaid: Boolean(item.isPaid),
          paidDate: item.isPaid ? (item.paidDate ? new Date(item.paidDate) : new Date()) : null,
        }))
      : undefined;

    let remainingBalance = existingDoc.remainingBalance;
    if (Array.isArray(formattedEmiPlan) && formattedEmiPlan.length > 0) {
      const unpaidSum = formattedEmiPlan
        .filter((e: any) => !e.isPaid)
        .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
      remainingBalance = unpaidSum;
    } else if (body.remainingBalance !== undefined) {
      remainingBalance = Number(body.remainingBalance);
    } else {
      remainingBalance = calculatedBalance;
    }

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
      amountReceivedToday: body.registrationAmount !== undefined ? Number(body.registrationAmount) : (body.amountReceivedToday !== undefined ? Number(body.amountReceivedToday) : existingDoc.amountReceivedToday),
      registrationAmount: body.registrationAmount !== undefined ? Number(body.registrationAmount) : existingDoc.registrationAmount,
      downpaymentAmount: body.downpaymentAmount !== undefined ? Number(body.downpaymentAmount) : existingDoc.downpaymentAmount,
      downpaymentDueDate: body.downpaymentDueDate ? new Date(body.downpaymentDueDate) : existingDoc.downpaymentDueDate,
      remainingBalance,
      paymentMode: body.paymentMode !== undefined ? body.paymentMode.trim() : existingDoc.paymentMode,
      transactionNo: body.transactionNo !== undefined ? body.transactionNo.trim() : existingDoc.transactionNo,
      hasEmi: body.hasEmi !== undefined ? Boolean(body.hasEmi) : existingDoc.hasEmi,
      numInstallments: body.numInstallments !== undefined ? Number(body.numInstallments) : existingDoc.numInstallments,
      installmentAmount: body.installmentAmount !== undefined ? Number(body.installmentAmount) : existingDoc.installmentAmount,
      customEmiPlan: formattedEmiPlan !== undefined ? formattedEmiPlan : existingDoc.customEmiPlan,
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
    const isAuthorized =
      userRole === "admin" ||
      userRole === "super admin" ||
      userRole === "super_admin" ||
      userRole === "brand_manager" ||
      userRole === "brand-manager" ||
      userRole === "brand manager" ||
      userRole === "manager" ||
      userRole === "centre head" ||
      userRole === "centre_head" ||
      userRole === "center head" ||
      userRole === "center_head";

    if (!isAuthorized) {
      return NextResponse.json({ success: false, message: "Forbidden: You do not have permission to delete student records." }, { status: 403 });
    }

    const admission = await Admission.findById(id);
    if (!admission) {
      return NextResponse.json({ success: false, message: "Student record not found or already deleted" }, { status: 404 });
    }

    // 1. Delete associated Payment Receipts
    await Payment.deleteMany({
      $or: [
        { admissionId: id },
        { admissionId: admission._id },
        { studentName: admission.fullName },
        { mobileNumber: admission.mobileNumber }
      ]
    });

    // 2. Delete associated Tasks (SOP tasks, followups, EMI reminders)
    await Task.deleteMany({
      $or: [
        { linkedStudentId: id },
        { linkedStudentId: admission._id?.toString() },
        { linkedStudentName: admission.fullName }
      ]
    });

    // 3. Remove Attendance Records for this student from batch sheets
    await Attendance.updateMany(
      {},
      {
        $pull: {
          records: {
            $or: [
              { admissionId: admission.admissionId },
              { admissionId: id },
              { studentName: admission.fullName },
              { mobileNumber: admission.mobileNumber }
            ]
          }
        }
      }
    );

    // 4. Reverse Company Collected Revenue Cap
    const regAmt = Number(admission.registrationAmount || admission.amountReceivedToday) || 0;
    if (regAmt > 0 && admission.companyAssigned && admission.companyAssigned !== "Cash" && admission.companyAssigned !== "Unallocated") {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const compRegex = new RegExp(`^${escapeRegExp(admission.companyAssigned.trim())}$`, "i");
      await Company.updateOne(
        { name: { $regex: compRegex } },
        { $inc: { collectedRevenue: -regAmt } }
      );
    }

    // 5. Reset linked Enquiry status if present
    if (admission.enquiryId) {
      await Enquiry.findByIdAndUpdate(admission.enquiryId, {
        status: "Closed / Lost",
        stage: "Closed / Lost",
        remarks: "Admission deleted via Student 360",
        isConverted: false,
        isAdmitted: false
      });
    } else if (admission.mobileNumber) {
      await Enquiry.updateMany(
        { mobileNumber: admission.mobileNumber },
        { 
          status: "Closed / Lost",
          stage: "Closed / Lost",
          isConverted: false,
          isAdmitted: false
        }
      );
    }

    // 6. Delete Notifications mentioning this student
    if (admission.fullName) {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nameRegex = new RegExp(escapeRegExp(admission.fullName.trim()), "i");
      await Notification.deleteMany({ message: { $regex: nameRegex } });
    }

    // 7. Delete main Admission record
    await Admission.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: "Student record and all associated payments, tasks, attendance, and receipts deleted successfully." });
  } catch (error: any) {
    console.error("Error in DELETE /api/admissions/[id]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete student record" },
      { status: 500 }
    );
  }
}
