import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Task from "@/models/Task";
import Attendance from "@/models/Attendance";
import Company from "@/models/Company";
import Enquiry from "@/models/Enquiry";
import Notification from "@/models/Notification";
import { getUserFromCookies } from "@/lib/helper";
import { getFinancialYear, getFinancialYearRange } from "@/lib/financialYearHelper";
import { syncAdmissionRefs } from "@/lib/referenceHelper";
import { getStudentBalance, recomputeAndStoreAdmissionBalance } from "@/lib/studentBalanceService";
import { logAuditEntry, diffAndLogAudit } from "@/lib/auditLogger";
import { withOptionalTransaction } from "@/lib/transactionHelper";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const user = await getUserFromCookies();

    const admFilter = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { admissionId: id };

    const admission = await Admission.findOne(admFilter).lean();
    if (!admission) {
      return NextResponse.json({ success: false, message: "Student record not found" }, { status: 404 });
    }

    // Role check: brand manager / centre head brand scoping if user session is present
    if (user) {
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
    }

    // Fetch related payment history & tasks
    const admIdStr = admission._id ? admission._id.toString() : id;
    const rawPayments = await Payment.find({ admissionId: admission._id }).sort({ createdAt: 1 }).lean();

    // Reconcile initial payment if it erroneously included future uncollected downpayment
    if (rawPayments.length === 1 && admission.registrationAmount && admission.downpaymentAmount) {
      const p = rawPayments[0];
      const sum = Number(admission.registrationAmount) + Number(admission.downpaymentAmount);
      if (Number(p.amountReceived) === sum && Number(admission.registrationAmount) > 0) {
        await Payment.updateOne({ _id: p._id }, { $set: { amountReceived: Number(admission.registrationAmount) } });
        p.amountReceived = Number(admission.registrationAmount);

        const correctBal = Math.max(0, Number(admission.finalFee || admission.courseFee || 0) - Number(admission.registrationAmount));
        await Admission.updateOne({ _id: admission._id }, { $set: { remainingBalance: correctBal, amountReceivedToday: Number(admission.registrationAmount) } });
        (admission as any).remainingBalance = correctBal;
        (admission as any).amountReceivedToday = Number(admission.registrationAmount);
      }
    }

    const payments = [...rawPayments].reverse().map((p: any) => ({
      ...p,
      studentName: (admission as any).fullName || p.studentName,
      originalIssuedName: p.studentName,
    }));

    // Authoritatively compute true balance from payment collection
    try {
      const balanceInfo = await getStudentBalance(admission._id);
      const prevBal = Number((admission as any).remainingBalance ?? 0);
      const prevPaid = Number((admission as any).amountReceivedToday ?? 0);

      (admission as any).remainingBalance = balanceInfo.remainingBalance;
      (admission as any).amountReceivedToday = balanceInfo.totalPaid;
      (admission as any).paidAmount = balanceInfo.totalPaid;

      // Heal persisted Admission in MongoDB if stored balance or paid amount drifted
      if (prevBal !== balanceInfo.remainingBalance || prevPaid !== balanceInfo.totalPaid) {
        await Admission.updateOne(
          { _id: admission._id },
          {
            $set: {
              remainingBalance: balanceInfo.remainingBalance,
              remainingBalancePaise: balanceInfo.remainingBalancePaise,
              amountReceivedToday: balanceInfo.totalPaid,
              amountReceivedTodayPaise: balanceInfo.totalPaidPaise,
            }
          }
        );
      }
    } catch (balErr) {
      console.warn("[Admissions API] getStudentBalance notice:", balErr);
    }

    const tasks = await Task.find({
      $or: [
        { linkedStudentId: id },
        { linkedStudentId: admIdStr },
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
      userRole === "center_head" ||
      userRole === "teacher" ||
      userRole === "faculty" ||
      userRole === "instructor" ||
      userRole === "counsellor" ||
      userRole === "counselor";

    if (!isAuthorized) {
      return NextResponse.json({ success: false, message: "Forbidden: Authorized roles only can edit student records." }, { status: 403 });
    }

    const body = await req.json();
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const trimmedId = decodeURIComponent(id || "").trim();

    const orConditions: any[] = [];
    if (mongoose.Types.ObjectId.isValid(trimmedId)) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(trimmedId) });
    }
    if (trimmedId) {
      orConditions.push({ admissionId: trimmedId });
      orConditions.push({ admissionId: { $regex: new RegExp(`^${escapeRegExp(trimmedId)}$`, "i") } });
      orConditions.push({ mobileNumber: trimmedId });
    }
    if (body.admissionId) {
      const cleanAdmId = String(body.admissionId).trim();
      orConditions.push({ admissionId: cleanAdmId });
      orConditions.push({ admissionId: { $regex: new RegExp(`^${escapeRegExp(cleanAdmId)}$`, "i") } });
    }
    if (body.mobileNumber) {
      orConditions.push({ mobileNumber: String(body.mobileNumber).trim() });
    }
    if (body.fullName) {
      orConditions.push({ fullName: { $regex: new RegExp(`^${escapeRegExp(String(body.fullName).trim())}$`, "i") } });
    }

    let existingDoc = orConditions.length > 0 ? await Admission.findOne({ $or: orConditions }) : null;
    if (!existingDoc) {
      // Check Enquiry collection if only batch update
      if (body.batch !== undefined || body.batchId !== undefined) {
        const Enquiry = (await import("@/models/Enquiry")).default;
        const enqDoc = orConditions.length > 0 ? await Enquiry.findOne({ $or: orConditions }) : null;
        if (enqDoc) {
          await Enquiry.updateOne(
            { _id: enqDoc._id },
            { $set: { batch: body.batch || "Unassigned", batchId: body.batchId || "" } }
          );
          return NextResponse.json({
            success: true,
            message: "Enquiry batch updated successfully",
            data: enqDoc,
          });
        }
      }
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
      const studentBrand = (existingDoc.brand || "").trim().toLowerCase();
      const userScope = user.brandScope.trim().toLowerCase();
      if (studentBrand && userScope && studentBrand !== userScope) {
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
    const totalPaymentsReceived = paymentsSumResult.length > 0 ? Number(paymentsSumResult[0].total) : regAmt;

    const calculatedBalance = Math.max(0, finalFee - totalPaymentsReceived);

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
    const hasLedgerPayments = await Payment.exists({ admissionId: existingDoc._id });
    if (hasLedgerPayments) {
      // Authoritative balance strictly from verified payments in ledger
      const balanceInfo = await getStudentBalance(existingDoc._id);
      remainingBalance = balanceInfo.remainingBalance;
    } else if (Array.isArray(formattedEmiPlan) && formattedEmiPlan.length > 0) {
      const unpaidSum = formattedEmiPlan
        .filter((e: any) => !e.isPaid)
        .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
      remainingBalance = unpaidSum;
    } else if (body.remainingBalance !== undefined) {
      remainingBalance = Number(body.remainingBalance);
    } else {
      remainingBalance = calculatedBalance;
    }

    let assignedBatchName = body.batch !== undefined ? body.batch.trim() : existingDoc.batch;
    let assignedBatchId = body.batchId !== undefined ? body.batchId : existingDoc.batchId;

    if (body.batch === "Unassigned" || body.batch === "General Batch" || body.batch === "" || body.batch === null || body.batchId === "" || body.batchId === null || assignedBatchName === "General Batch" || assignedBatchName === "Unassigned") {
      assignedBatchName = assignedBatchName === "General Batch" ? "General Batch" : "Unassigned";
      assignedBatchId = null;
    } else if (body.batchId && String(body.batchId).trim()) {
      const Batch = (await import("@/models/Batch")).default;
      const trimmedBId = String(body.batchId).trim();
      const bQuery: any[] = [{ batchId: trimmedBId }];
      if (mongoose.Types.ObjectId.isValid(trimmedBId)) {
        bQuery.push({ _id: new mongoose.Types.ObjectId(trimmedBId) });
      }
      const batchDoc = await Batch.findOne({ $or: bQuery }).lean();
      if (batchDoc) {
        assignedBatchName = batchDoc.batchName;
        assignedBatchId = batchDoc._id;
      } else if (mongoose.Types.ObjectId.isValid(trimmedBId)) {
        assignedBatchId = new mongoose.Types.ObjectId(trimmedBId);
      } else {
        assignedBatchId = null;
      }
    } else if (body.batch && body.batch !== "Unassigned" && body.batch !== "General Batch") {
      const Batch = (await import("@/models/Batch")).default;
      const matchingBatches = await Batch.find({ batchName: body.batch.trim() }).lean();
      if (matchingBatches.length === 1) {
        assignedBatchId = matchingBatches[0]._id;
        assignedBatchName = matchingBatches[0].batchName;
      } else if (!mongoose.Types.ObjectId.isValid(assignedBatchId)) {
        assignedBatchId = null;
      }
    }

    if (assignedBatchId && !mongoose.Types.ObjectId.isValid(assignedBatchId)) {
      assignedBatchId = null;
    }

    // Fast-path for batch allocation / unassignment:
    const bodyKeys = Object.keys(body);
    const isOnlyBatchUpdate = bodyKeys.every((k) => k === "batch" || k === "batchId" || k === "reason" || k === "admissionId" || k === "mobileNumber" || k === "fullName");
    if (isOnlyBatchUpdate) {
      const updatedDoc = await Admission.findOneAndUpdate(
        { _id: existingDoc._id },
        { $set: { batch: assignedBatchName, batchId: assignedBatchId } },
        { new: true }
      );
      return NextResponse.json({
        success: true,
        message: assignedBatchName === "Unassigned" ? "Student removed from batch successfully" : "Student allocated to batch successfully",
        data: updatedDoc,
      });
    }

    const updatePayload: any = {
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
      batch: assignedBatchName,
      batchId: assignedBatchId,
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
      lastFollowupDate: body.lastFollowupDate ? new Date(body.lastFollowupDate) : existingDoc.lastFollowupDate,
      lastFollowupNotes: body.lastFollowupNotes !== undefined ? body.lastFollowupNotes : existingDoc.lastFollowupNotes,
      nextFollowupDate: body.nextFollowupDate ? new Date(body.nextFollowupDate) : existingDoc.nextFollowupDate,
      ptpDate: body.ptpDate ? new Date(body.ptpDate) : existingDoc.ptpDate,
      ptpAmount: body.ptpAmount !== undefined ? Number(body.ptpAmount) : existingDoc.ptpAmount,
    };

    if (body.feeFollowup) {
      (updatePayload as any)["$push"] = {
        feeFollowups: {
          ...body.feeFollowup,
          ptpDate: body.feeFollowup.ptpDate ? new Date(body.feeFollowup.ptpDate) : undefined,
          nextFollowupDate: body.feeFollowup.nextFollowupDate ? new Date(body.feeFollowup.nextFollowupDate) : undefined,
          createdAt: new Date()
        }
      };
    }

    // 5. Audit log student name changes and sensitive fields before applying write
    const isNameChanging = body.fullName !== undefined && body.fullName.trim() !== (existingDoc.fullName || "").trim();
    if (isNameChanging) {
      const userId = (user as any)?._id || (user as any)?.id || null;
      await logAuditEntry({
        collectionName: "admissions",
        docId: existingDoc._id,
        action: "UPDATE",
        changedFields: [{
          field: "fullName",
          oldValue: existingDoc.fullName,
          newValue: body.fullName.trim()
        }],
        userId
      });
    }

    await diffAndLogAudit({
      collectionName: "admissions",
      docId: existingDoc._id,
      action: "UPDATE",
      oldDoc: typeof existingDoc.toObject === "function" ? existingDoc.toObject() : existingDoc,
      newDoc: { ...(typeof existingDoc.toObject === "function" ? existingDoc.toObject() : existingDoc), ...updatePayload },
      userId: (user as any)?._id
    });

    // Re-balance company collected revenue parameters if company assigned or final fee changes
    const oldCompany = (existingDoc.companyAssigned || "").trim();
    const newCompany = (updatePayload.companyAssigned || "").trim();

    const oldFee = Number(existingDoc.finalFee) > 0 ? Number(existingDoc.finalFee) : (Number(existingDoc.courseFee) || 0);
    const newFee = Number(updatePayload.finalFee) > 0 ? Number(updatePayload.finalFee) : (Number(updatePayload.courseFee) || 0);
    const isOldValidComp = oldCompany && oldCompany !== "Cash" && oldCompany !== "Unallocated" && oldCompany !== "Cash (Unallocated)";
    const isNewValidComp = newCompany && newCompany !== "Cash" && newCompany !== "Unallocated" && newCompany !== "Cash (Unallocated)";

    const effectiveAdmDate = existingDoc.admissionDate ? new Date(existingDoc.admissionDate) : (existingDoc.createdAt ? new Date(existingDoc.createdAt) : new Date());
    const admFY = getFinancialYear(effectiveAdmDate);
    const { label: currentFY } = getFinancialYearRange();

    // 4. Wrap admission write, company update, enquiry update, and task updates in a single transaction (with standalone fallback)
    let updatedDoc: any = null;

    await withOptionalTransaction(async (session) => {
        // Re-balance company capacity if needed
        if (isOldValidComp && isNewValidComp && oldCompany.toLowerCase() === newCompany.toLowerCase()) {
          const feeDiff = newFee - oldFee;
          if (feeDiff !== 0) {
            const compTargetId = updatePayload.companyId || existingDoc.companyId;
            let comp = compTargetId ? await Company.findById(compTargetId).session(session) : null;
            if (!comp) {
              const compRegex = new RegExp(`^${escapeRegExp(newCompany)}$`, "i");
              comp = await Company.findOne({ $or: [{ name: { $regex: compRegex } }, { legalName: { $regex: compRegex } }] }).session(session);
            }
            if (comp) {
              if (comp.currentFinancialYear === admFY || (!comp.currentFinancialYear && admFY === currentFY)) {
                comp.collectedRevenue = Math.max(0, (comp.collectedRevenue || 0) + feeDiff);
                comp.currentFinancialYear = admFY;
                await comp.save({ session });
              }
            }
          }
        } else {
          if (isOldValidComp && oldFee > 0) {
            let oldComp = existingDoc.companyId ? await Company.findById(existingDoc.companyId).session(session) : null;
            if (!oldComp) {
              const oldCompRegex = new RegExp(`^${escapeRegExp(oldCompany)}$`, "i");
              oldComp = await Company.findOne({ $or: [{ name: { $regex: oldCompRegex } }, { legalName: { $regex: oldCompRegex } }] }).session(session);
            }
            if (oldComp && (oldComp.currentFinancialYear === admFY || (!oldComp.currentFinancialYear && admFY === currentFY))) {
              oldComp.collectedRevenue = Math.max(0, (oldComp.collectedRevenue || 0) - oldFee);
              await oldComp.save({ session });
            }
          }
          if (isNewValidComp && newFee > 0) {
            let newComp = updatePayload.companyId ? await Company.findById(updatePayload.companyId).session(session) : null;
            if (!newComp) {
              const newCompRegex = new RegExp(`^${escapeRegExp(newCompany)}$`, "i");
              newComp = await Company.findOne({ $or: [{ name: { $regex: newCompRegex } }, { legalName: { $regex: newCompRegex } }] }).session(session);
            }
            if (newComp) {
              if (newComp.currentFinancialYear === admFY) {
                newComp.collectedRevenue = (newComp.collectedRevenue || 0) + newFee;
              } else if (admFY === currentFY) {
                newComp.currentFinancialYear = currentFY;
                newComp.collectedRevenue = newFee;
                newComp.alerted80Percent = false;
              }
              await newComp.save({ session });
            }
          }
        }

        // A. Admission write inside transaction
        await syncAdmissionRefs(updatePayload, session);
        updatedDoc = await Admission.findOneAndUpdate({ _id: existingDoc._id }, updatePayload, { new: true, session });

        // B. Reconcile registration payment date and particulars if registration amount changed.
        // NOTE: We do NOT update Payment.studentName (receipts are financial records that keep name as issued).
        const currentAdmDate = updatedDoc?.admissionDate ? new Date(updatedDoc.admissionDate) : (existingDoc.admissionDate ? new Date(existingDoc.admissionDate) : new Date());
        const effectiveRegAmt = Number(updatedDoc?.registrationAmount !== undefined ? updatedDoc.registrationAmount : (updatedDoc?.amountReceivedToday || 0));

        const firstPayment = await Payment.findOne({ admissionId: existingDoc._id }).sort({ createdAt: 1 }).session(session);
        if (firstPayment) {
          firstPayment.paymentDate = currentAdmDate;
          if (effectiveRegAmt > 0) {
            if (!firstPayment.particulars) {
              firstPayment.particulars = {
                courseFeeDue: 0,
                courseFeeDuePaise: 0,
                registrationFeeDue: effectiveRegAmt,
                registrationFeeDuePaise: Math.round(effectiveRegAmt * 100),
                materialFeeDue: 0,
                materialFeeDuePaise: 0,
                examFeeDue: 0,
                examFeeDuePaise: 0,
              };
            } else {
              firstPayment.particulars.registrationFeeDue = effectiveRegAmt;
              (firstPayment.particulars as any).registrationFeeDuePaise = Math.round(effectiveRegAmt * 100);
            }
          }
          if (updatedDoc?.brand) firstPayment.brand = updatedDoc.brand;
          if (updatedDoc?.brandId) firstPayment.brandId = updatedDoc.brandId;
          if (updatedDoc?.companyAssigned) firstPayment.company = updatedDoc.companyAssigned;
          if (updatedDoc?.companyId) firstPayment.companyId = updatedDoc.companyId;
          await firstPayment.save({ session });
        } else if (effectiveRegAmt > 0) {
          const newRegPayment = new Payment({
            admissionId: existingDoc._id,
            studentName: existingDoc.fullName, // Keep original name as issued
            amountReceived: effectiveRegAmt,
            paymentMode: updatedDoc?.paymentMode || existingDoc.paymentMode || "Cash",
            referenceNo: updatedDoc?.transactionNo || existingDoc.transactionNo || "N/A",
            company: updatedDoc?.companyAssigned || existingDoc.companyAssigned || "Cash",
            companyId: updatedDoc?.companyId || existingDoc.companyId,
            brand: updatedDoc?.brand || existingDoc.brand || "Cadd Mantra",
            brandId: updatedDoc?.brandId || existingDoc.brandId,
            paymentDate: currentAdmDate,
            particulars: {
              courseFeeDue: 0,
              registrationFeeDue: effectiveRegAmt,
              materialFeeDue: 0,
              examFeeDue: 0,
            },
            remarks: "Initial registration payment upon admission",
          });
          await newRegPayment.save({ session });
        }

        if (hasLedgerPayments || (await Payment.exists({ admissionId: existingDoc._id }).session(session))) {
          await recomputeAndStoreAdmissionBalance(existingDoc._id, session);
          updatedDoc = await Admission.findById(existingDoc._id).session(session);
        }

        // C. Synchronize linked Enquiry:
        // 1. Remove mobile-number fallback. Only cascade to enquiry linked by Admission.enquiryId (exact _id match).
        // 2. If enquiryId is missing, do not update any enquiry — log a warning instead.
        // 3. Use Enquiry.updateOne since an admission links to exactly one enquiry.
        const targetEnquiryId = updatedDoc?.enquiryId || existingDoc?.enquiryId;
        if (targetEnquiryId && mongoose.Types.ObjectId.isValid(String(targetEnquiryId))) {
          const enqUpdatePayload: any = {};
          if (updatedDoc?.fullName) enqUpdatePayload.studentFullName = updatedDoc.fullName;
          if (updatedDoc?.mobileNumber) enqUpdatePayload.primaryPhoneMobile = updatedDoc.mobileNumber;
          if (updatedDoc?.email) enqUpdatePayload.emailAddress = updatedDoc.email;
          if (updatedDoc?.counsellor) enqUpdatePayload.assignedCrmAdvisor = updatedDoc.counsellor;
          if (updatedDoc?.counsellorId) enqUpdatePayload.assignedCrmAdvisorId = updatedDoc.counsellorId;
          if (updatedDoc?.brand) enqUpdatePayload.targetBrand = updatedDoc.brand;
          if (updatedDoc?.brandId) enqUpdatePayload.targetBrandId = updatedDoc.brandId;
          if (updatedDoc?.parentName || updatedDoc?.parentsFullName) {
            enqUpdatePayload.parentsFullName = updatedDoc.parentName || updatedDoc.parentsFullName;
          }
          if (updatedDoc?.parentPhone || updatedDoc?.parentsPhoneNumber) {
            enqUpdatePayload.parentsPhoneNumber = updatedDoc.parentPhone || updatedDoc.parentsPhoneNumber;
          }
          if (updatedDoc?.city && updatedDoc.city !== "N/A") {
            enqUpdatePayload.currentCity = updatedDoc.city;
          }

          if (Object.keys(enqUpdatePayload).length > 0) {
            await Enquiry.updateOne(
              { _id: new mongoose.Types.ObjectId(String(targetEnquiryId)) },
              { $set: enqUpdatePayload },
              session ? { session } : {}
            );
          }
        } else {
          console.warn(`[PUT /api/admissions/${id}] Admission has no linked enquiryId; skipping enquiry update.`);
        }

        // D. Synchronize Task linked student name inside transaction
        if (updatedDoc?.fullName) {
          await Task.updateMany(
            {
              $or: [
                { linkedStudentId: existingDoc._id.toString() },
                { linkedStudentId: existingDoc.admissionId },
                { linkedStudentName: existingDoc.fullName }
              ]
            },
            { $set: { linkedStudentName: updatedDoc.fullName } },
            session ? { session } : {}
          );
        }

        // E. Interim Cascade Bridge (Prompt 1 Extension - Req 5):
        // Until Phase 4 is complete, updates to Admission must also update the linked Student record.
        const targetStudentId = updatedDoc?.studentId || existingDoc?.studentId;
        if (targetStudentId) {
          const { syncPrompt1CascadeToStudent } = await import("@/lib/studentHelper");
          await syncPrompt1CascadeToStudent(
            targetStudentId,
            {
              fullName: updatedDoc?.fullName,
              mobileNumber: updatedDoc?.mobileNumber,
              email: updatedDoc?.email,
              city: updatedDoc?.city,
              parentName: updatedDoc?.parentName,
              parentsFullName: updatedDoc?.parentsFullName,
              parentPhone: updatedDoc?.parentPhone,
              parentsPhoneNumber: updatedDoc?.parentsPhoneNumber,
            },
            session
          );
        }
      });

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

    const admFilter = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { admissionId: id };

    const admission = await Admission.findOne(admFilter);
    if (!admission) {
      return NextResponse.json({ success: false, message: "Student record not found or already deleted" }, { status: 404 });
    }

    // Match records by this admission's IDs only. The old name OR phone matching also hit
    // other students (same name, siblings sharing a parent phone, or everyone with an empty
    // phone), and restore only brings back admissionId-linked payments.
    const fullName = (admission.fullName || "").trim();
    const mobileNumber = (admission.mobileNumber || "").trim();
    const hasLegacyIdentity = fullName !== "" && mobileNumber !== "";
    const linkedIds = Array.from(
      new Set([id, admission._id.toString(), admission.admissionId].filter(Boolean).map(String))
    );

    // 1. Soft delete associated Payment Receipts
    const paymentDeleteConditions: any[] = [{ admissionId: admission._id }];
    if (fullName) {
      // Payments store no phone; only orphaned legacy receipts (no admissionId) fall back to name.
      paymentDeleteConditions.push({ admissionId: null, studentName: fullName });
    }
    await Payment.updateMany(
      { $or: paymentDeleteConditions },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: (user as any)?._id || null } }
    );

    // 2. Delete associated Tasks (SOP tasks, followups, EMI reminders)
    await Task.deleteMany({ linkedStudentId: { $in: linkedIds } });

    // 3. Remove Attendance Records for this student from batch sheets
    const attendanceConditions: any[] = [{ admissionId: { $in: linkedIds } }];
    if (hasLegacyIdentity) {
      attendanceConditions.push({ studentName: fullName, mobileNumber });
    }
    await Attendance.updateMany(
      {},
      { $pull: { records: { $or: attendanceConditions } } }
    );

    // 4. Reverse Company Blocked Revenue Cap (unblock full student fee)
    const amountToUnblock = Number(admission.finalFee) > 0 
      ? Number(admission.finalFee) 
      : (Number(admission.courseFee) > 0 ? Number(admission.courseFee) : (Number(admission.registrationAmount || admission.amountReceivedToday) || 0));

    if (amountToUnblock > 0 && admission.companyAssigned && admission.companyAssigned !== "Cash" && admission.companyAssigned !== "Unallocated" && admission.companyAssigned !== "Cash (Unallocated)") {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const compRegex = new RegExp(`^${escapeRegExp(admission.companyAssigned.trim())}$`, "i");
      const comp = await Company.findOne({ $or: [{ name: { $regex: compRegex } }, { legalName: { $regex: compRegex } }] });
      const effectiveAdmDate = admission.admissionDate ? new Date(admission.admissionDate) : (admission.createdAt ? new Date(admission.createdAt) : new Date());
      const admFY = getFinancialYear(effectiveAdmDate);
      const { label: currentFY } = getFinancialYearRange();

      if (comp && (comp.currentFinancialYear === admFY || (!comp.currentFinancialYear && admFY === currentFY))) {
        comp.collectedRevenue = Math.max(0, (comp.collectedRevenue || 0) - amountToUnblock);
        await comp.save();
      }
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
    // (By admission ID: a name substring match deleted e.g. "Ramesh" alerts when deleting "Ram".)
    await Notification.deleteMany({ admissionId: { $in: linkedIds } });

    // 7. Soft delete main Admission record
    (admission as any).isDeleted = true;
    (admission as any).deletedAt = new Date();
    (admission as any).deletedBy = (user as any)?._id || null;
    await admission.save();

    await logAuditEntry({
      collectionName: "admissions",
      docId: admission._id,
      action: "SOFT_DELETE",
      changedFields: [{ field: "isDeleted", oldValue: false, newValue: true }],
      userId: (user as any)?._id
    });

    return NextResponse.json({ success: true, message: "Student record and all associated payments, tasks, attendance, and receipts deleted successfully." });
  } catch (error: any) {
    console.error("Error in DELETE /api/admissions/[id]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete student record" },
      { status: 500 }
    );
  }
}
