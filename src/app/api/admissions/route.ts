import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Enquiry from "@/models/Enquiry";
import Payment from "@/models/Payment";
import Company from "@/models/Company";
import Brand from "@/models/Brand";
import Task from "@/models/Task";
import Batch from "@/models/Batch";
import Course from "@/models/Course";
import User from "@/models/User";
import Notification from "@/models/Notification";
import { getUserFromCookies, escapeRegex } from "@/lib/helper";
import { sendWhatsAppFeeReceipt, sendWhatsAppBrandWelcome, sendWhatsAppSuperAdminAdmissionAlert } from "@/lib/msg91";
import { sendAdmissionConfirmationEmail } from "@/lib/emailService";
import { getFinancialYear, getFinancialYearRange } from "@/lib/financialYearHelper";
import { syncAdmissionRefs } from "@/lib/referenceHelper";
import { logAuditEntry } from "@/lib/auditLogger";
import { validateDeletedAccess } from "@/lib/softDeleteAccess";
import { withOptionalTransaction } from "@/lib/transactionHelper";
import { studentBalanceLookupStages } from "@/lib/studentBalanceService";
import { resolveBrandName } from "@/lib/brandDefaults";
import { BatchRuleError, resolveBatchForAssignment } from "@/lib/batchRules";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const data = await req.json();

    if (user && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All") {
      data.brand = data.brand || user.brandScope;
    }

    // Fallbacks for optional form fields
    data.fullName = data.fullName?.trim() || "Student";
    const cleanPhone = (data.mobileNumber || data.primaryPhoneMobile || "0000000000").trim();
    data.mobileNumber = cleanPhone;
    data.primaryPhoneMobile = cleanPhone;
    data.parentsFullName = data.parentsFullName?.trim() || data.parentName?.trim() || "";
    data.parentsPhoneNumber = data.parentsPhoneNumber?.trim() || data.parentPhone?.trim() || "";
    data.parentName = data.parentsFullName;
    data.parentPhone = data.parentsPhoneNumber;
    data.city = data.city?.trim() || "N/A";
    data.state = data.state?.trim() || "N/A";
    data.pincode = data.pincode?.trim() || "000000";
    data.counsellor = data.counsellor?.trim() || user?.name || "Counsellor";
    
    // Process multi-selected courses
    let coursesList: string[] = [];
    if (Array.isArray(data.courses) && data.courses.length > 0) {
      coursesList = data.courses.map((c: any) => String(c).trim()).filter(Boolean);
    } else if (Array.isArray(data.targetCourses) && data.targetCourses.length > 0) {
      coursesList = data.targetCourses.map((c: any) => String(c).trim()).filter(Boolean);
    } else if (typeof data.course === "string" && data.course.trim()) {
      coursesList = data.course.split(",").map((c: string) => c.trim()).filter(Boolean);
    }

    if (coursesList.length === 0) {
      coursesList = ["General Course"];
    }

    // 1. Resolve Batch & BatchId
    let finalBatchName = (data.batch || "").trim() || "General Batch";
    let finalBatchId: any = null;
    const rawBatchId = typeof data.batchId === "string" ? data.batchId.trim() : (data.batchId ? String(data.batchId).trim() : "");

    if (rawBatchId && rawBatchId !== "Unassigned" && rawBatchId !== "General Batch") {
      // The batch must exist, be open, match the student's brand and have a free seat
      // (an unknown id used to be stored anyway, pointing at a batch that doesn't exist)
      try {
        const batchDoc = await resolveBatchForAssignment(rawBatchId, { studentBrand: data.brand });
        finalBatchName = batchDoc.batchName;
        finalBatchId = batchDoc._id;
        if (!String(data.brand || "").trim() && batchDoc.brand) data.brand = batchDoc.brand;
      } catch (err: any) {
        if (err instanceof BatchRuleError) {
          return NextResponse.json({ success: false, message: err.message, error: err.message }, { status: err.status });
        }
        throw err;
      }
    } else if (finalBatchName && finalBatchName !== "General Batch" && finalBatchName !== "Unassigned") {
      // Only resolve batchId if exactly one batch exists with this name to avoid guessing across duplicate batch names
      const matchingBatches = await Batch.find({ batchName: finalBatchName }).lean();
      if (matchingBatches.length === 1) {
        finalBatchId = matchingBatches[0]._id;
        finalBatchName = matchingBatches[0].batchName;
      }
    }

    data.courses = coursesList;
    data.targetCourses = coursesList;
    data.course = coursesList.join(", ");
    data.batch = finalBatchName;
    data.batchId = finalBatchId;
    data.duration = data.duration?.trim() || "6 Months";
    data.startDate = data.startDate ? new Date(data.startDate) : new Date();
    data.academicYear = data.academicYear?.trim() || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    data.admissionDate = data.admissionDate ? new Date(data.admissionDate) : new Date();
    data.courseFee = Number(data.courseFee) || 0;
    data.finalFee = Number(data.finalFee) || 0;
    data.paymentMode = data.paymentMode?.trim() || "Cash";
    data.registrationAmount = Number(data.registrationAmount !== undefined ? data.registrationAmount : data.amountReceivedToday) || 0;
    data.amountReceivedToday = data.registrationAmount;
    data.downpaymentAmount = Number(data.downpaymentAmount) || 0;
    data.downpaymentDueDate = data.downpaymentDueDate ? new Date(data.downpaymentDueDate) : undefined;
    data.remainingBalance = Math.max(
      0,
      data.finalFee - data.registrationAmount - data.downpaymentAmount
    );

    // Reconcile custom EMI plan so its total strictly matches remainingBalance
    if (Array.isArray(data.customEmiPlan) && data.customEmiPlan.length > 0) {
      const planSum = data.customEmiPlan.reduce((sum: number, item: any) => sum + (Number(item?.amount) || 0), 0);
      if (planSum !== data.remainingBalance && data.remainingBalance >= 0) {
        const count = data.customEmiPlan.length;
        const baseAmt = Math.floor(data.remainingBalance / count);
        const remainder = data.remainingBalance - baseAmt * count;
        data.customEmiPlan = data.customEmiPlan.map((item: any, idx: number) => ({
          ...item,
          amount: idx === count - 1 ? baseAmt + remainder : baseAmt
        }));
      }
    }
    data.paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
    data.companyAssigned = data.companyAssigned?.trim() || "Cash";
    data.brand = await resolveBrandName(data.brand, user?.brandScope);

    // Auto Company Allocation Engine: Respect explicitly selected company if provided by user
    let finalCompany = (data.companyAssigned || data.company || "").trim();

    if (!finalCompany || finalCompany === "Auto" || finalCompany === "Select Company..." || finalCompany === "Unallocated" || finalCompany === "Cash (Unallocated)") {
      if (data.paymentMode && data.paymentMode !== "Cash") {
        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const brandStr = (data.brand || "").trim();
        const brandRegex = new RegExp(`^${escapeRegExp(brandStr)}$`, "i");

        const brandDoc = await Brand.findOne({ name: { $regex: brandRegex } }).lean();
        const brandCompanies = brandDoc?.companies || [];

        const safeCompRegexes = brandCompanies.map((c: string) => new RegExp(`^${escapeRegExp(c.trim())}$`, "i"));

        const availableCompanies = await Company.find({
          $or: [
            { brand: { $regex: brandRegex } },
            { brands: { $regex: brandRegex } },
            ...(safeCompRegexes.length > 0 ? [{ name: { $in: safeCompRegexes } }] : [])
          ],
          status: "ACTIVE"
        });

        if (availableCompanies.length > 0) {
          const { label: currentFY } = getFinancialYearRange();
          const getRemCap = (c: any) => {
            const cap = Number(c.annualCapacityCap || 1949999);
            const collected = c.currentFinancialYear === currentFY ? Number(c.collectedRevenue || 0) : 0;
            return Math.max(0, cap - collected);
          };

          availableCompanies.sort((a, b) => getRemCap(b) - getRemCap(a));

          finalCompany = availableCompanies[0].name;
        } else {
          finalCompany = "Unallocated";
        }
      } else {
        finalCompany = "Cash";
      }
    }


    // Course Wise Max Discount Limit Validation & Notification Trigger
    const courseDoc = await Course.findOne({
      $or: [{ name: data.course }, { code: data.course }]
    }).lean();

    const maxAllowedLimit = Number(courseDoc?.maxDiscountLimit || 5000);
    const totalDiscountGiven = Number(data.discountAmount || 0) + Number(data.scholarshipAmount || 0) + Number(data.additionalDiscount || 0);

    data.maxDiscountLimitAtAdmission = maxAllowedLimit;

    if (totalDiscountGiven > maxAllowedLimit) {
      data.discountApprovalStatus = "Pending Approval";
    } else {
      data.discountApprovalStatus = "Approved";
    }

    data.companyAssigned = finalCompany;

    // Determine if this is an Upgrade or Fresh Admission
    if (data.enquiryId || data.isUpgrade === false) {
      data.isUpgrade = false;
    } else if (data.isUpgrade === true) {
      data.isUpgrade = true;
    } else if (data.mobileNumber) {
      const existingAdmCount = await Admission.countDocuments({
        mobileNumber: data.mobileNumber.trim(),
        status: { $ne: "Cancelled" }
      });
      data.isUpgrade = existingAdmCount > 0;
    } else {
      data.isUpgrade = false;
    }

    // Helper to cancel uncompleted follow-ups & sync counsellor name to enquiry
    const cancelUncompletedFollowUps = (enquiryDoc: any) => {
      enquiryDoc.status = "Admitted";
      enquiryDoc.isAdmitted = true;
      if (data.counsellor) {
        enquiryDoc.assignedCrmAdvisor = data.counsellor;
      }

      if (enquiryDoc.followUps && Array.isArray(enquiryDoc.followUps)) {
        enquiryDoc.followUps.forEach((f: any) => {
          const currentStatus = (f.status || "").toLowerCase();
          if (!f.isCompleted && currentStatus !== "completed" && currentStatus !== "cancelled") {
            f.status = "Cancelled";
            f.isCompleted = true;
            f.remarks = f.remarks
              ? `${f.remarks} [Auto-cancelled: Admission created]`
              : "Auto-cancelled: Admission created";
          }
        });
      }
    };

    let admission: any = null;
    let initialPaymentObj: any = null;
    const matchedEnquiryIds: string[] = [];

    // 4. Wrap the admission write, company ledger, enquiry update, task updates, and initial payment in a single transaction (with standalone fallback)
    await withOptionalTransaction(async (session) => {
        // A. Update Ledger (block entire student fee in company collectedRevenue for active cycle) inside transaction
        if (finalCompany && finalCompany !== "Cash" && finalCompany !== "Unallocated" && finalCompany !== "Cash (Unallocated)") {
          const amountToBlock = Number(data.finalFee) > 0
            ? Number(data.finalFee)
            : (Number(data.courseFee) > 0 ? Number(data.courseFee) : Number(data.amountReceivedToday));

          if (amountToBlock > 0) {
            let targetComp = null;
            if (data.companyId) {
              targetComp = await Company.findById(data.companyId).session(session);
            }
            if (!targetComp) {
              const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const compRegex = new RegExp(`^${escapeRegExp(finalCompany.trim())}$`, "i");
              targetComp = await Company.findOne({
                $or: [{ name: { $regex: compRegex } }, { legalName: { $regex: compRegex } }]
              }).session(session);
            }

            if (targetComp) {
              const { label: currentFY } = getFinancialYearRange();
              const admDate = data.admissionDate ? new Date(data.admissionDate) : new Date();
              const admFY = getFinancialYear(admDate);

              if (targetComp.currentFinancialYear === admFY) {
                targetComp.collectedRevenue = (targetComp.collectedRevenue || 0) + amountToBlock;
              } else if (admFY === currentFY) {
                targetComp.currentFinancialYear = currentFY;
                targetComp.collectedRevenue = amountToBlock;
                targetComp.alerted80Percent = false;
              }
              await targetComp.save({ session });
            }
          }
        }

        // B. Save Admission within transaction
        await syncAdmissionRefs(data, session);
        admission = new Admission(data);
        await admission.save({ session });

        // C. Trigger Notification inside transaction if discount exceeds max limit
        if (totalDiscountGiven > maxAllowedLimit) {
          try {
            await Notification.create([
              {
                title: `Discount Approval Request: ${admission.fullName}`,
                message: `${admission.counsellor || 'Counsellor'} offered ₹${totalDiscountGiven.toLocaleString('en-IN')} discount on ${admission.course} (Max allowed limit: ₹${maxAllowedLimit.toLocaleString('en-IN')}). Admin approval required.`,
                type: "discount_approval",
                admissionId: admission._id.toString(),
                studentFullName: admission.fullName,
                courseName: admission.course,
                requestedDiscount: totalDiscountGiven,
                maxAllowedDiscount: maxAllowedLimit,
                requestedBy: admission.counsellor || "Staff",
                status: "Pending",
                read: false
              }
            ], session ? { session } : undefined);
          } catch (notifErr) {
            console.error("Failed creating Notification:", notifErr);
          }
        }

        // D. Enquiry cascade:
        let enq: any = null;
        if (data.enquiryId) {
          if (mongoose.Types.ObjectId.isValid(String(data.enquiryId))) {
            enq = await Enquiry.findById(data.enquiryId).session(session);
          }
          if (!enq) {
            enq = await Enquiry.findOne({ enquiryId: String(data.enquiryId) }).session(session);
          }
        }

        // If enquiryId was not provided or didn't match, check by student phone
        if (!enq && cleanPhone && cleanPhone !== "0000000000") {
          const last10 = cleanPhone.slice(-10);
          enq = await Enquiry.findOne({
            $or: [
              { primaryPhoneMobile: { $regex: last10 } },
              { parentsPhoneNumber: { $regex: last10 } },
              { secondaryPhone: { $regex: last10 } }
            ]
          }).sort({ createdAt: -1 }).session(session);
        }

        if (enq) {
          if (enq.studentFullName && admission.fullName && enq.studentFullName.trim() !== admission.fullName.trim()) {
            const userId = (user as any)?._id || (user as any)?.id || null;
            await logAuditEntry({
              collectionName: "enquiries",
              docId: enq._id,
              action: "UPDATE",
              changedFields: [{
                field: "studentFullName",
                oldValue: enq.studentFullName,
                newValue: admission.fullName.trim()
              }],
              userId
            });
          }

          cancelUncompletedFollowUps(enq);
          await Enquiry.updateOne(
            { _id: enq._id },
            {
              $set: {
                status: "Admitted",
                isAdmitted: true,
                actualAdmissionFee: Number(admission.finalFee || admission.courseFee || 0),
                assignedCrmAdvisor: admission.counsellor || enq.assignedCrmAdvisor,
                assignedCrmAdvisorId: admission.counsellorId || enq.assignedCrmAdvisorId,
                studentFullName: admission.fullName || enq.studentFullName,
                followUps: enq.followUps
              }
            },
            session ? { session } : {}
          );
          matchedEnquiryIds.push(enq._id.toString());
          if (enq.enquiryId) matchedEnquiryIds.push(enq.enquiryId);
        } else {
          console.warn(`[POST /api/admissions] No matching enquiry found for admission ${admission.admissionId || "new"}.`);
        }

        // Also check if any other enquiries match this student's phone and mark them admitted/cancelled
        if (cleanPhone && cleanPhone !== "0000000000") {
          const last10 = cleanPhone.slice(-10);
          const validObjectIds = matchedEnquiryIds
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
            .map((id) => new mongoose.Types.ObjectId(id));

          const otherEnqs = await Enquiry.find({
            _id: { $nin: validObjectIds },
            $or: [
              { primaryPhoneMobile: { $regex: last10 } },
              { parentsPhoneNumber: { $regex: last10 } },
              { secondaryPhone: { $regex: last10 } }
            ],
            status: { $ne: "Admitted" }
          }).session(session);

          for (const otherEnq of otherEnqs) {
            cancelUncompletedFollowUps(otherEnq);
            await Enquiry.updateOne(
              { _id: otherEnq._id },
              {
                $set: {
                  status: "Admitted",
                  isAdmitted: true,
                  followUps: otherEnq.followUps
                }
              },
              session ? { session } : {}
            );
            matchedEnquiryIds.push(otherEnq._id.toString());
            if (otherEnq.enquiryId) matchedEnquiryIds.push(otherEnq.enquiryId);
          }
        }

        // Interim Cascade Bridge (Prompt 1 Extension - Req 5):
        if (admission.studentId) {
          const { syncPrompt1CascadeToStudent } = await import("@/lib/studentHelper");
          await syncPrompt1CascadeToStudent(
            admission.studentId,
            {
              fullName: admission.fullName,
              mobileNumber: admission.mobileNumber,
              email: admission.email,
              city: admission.city,
              parentName: admission.parentName || admission.parentsFullName,
              parentPhone: admission.parentPhone || admission.parentsPhoneNumber,
            },
            session
          );
        }

        // E. Cancel/close any pending lead call/demo/follow-up tasks for this student/enquiry inside transaction
        const taskOrFilters: any[] = [];
        if (matchedEnquiryIds.length > 0) {
          taskOrFilters.push({ linkedEnquiryId: { $in: matchedEnquiryIds } });
        }
        if (admission._id) {
          taskOrFilters.push({ linkedStudentId: admission._id.toString() });
        }
        if (admission.fullName) {
          taskOrFilters.push({ linkedStudentName: admission.fullName });
        }
        if (admission.studentFullName) {
          taskOrFilters.push({ linkedStudentName: admission.studentFullName });
        }

        if (taskOrFilters.length > 0) {
          await Task.updateMany(
            {
              $or: taskOrFilters,
              taskType: { $in: ["Lead Call", "Demo", "Follow-up", "General"] },
              status: { $in: ["Pending", "In Progress", "Overdue"] }
            },
            {
              $set: {
                status: "Completed",
                completedAt: new Date()
              }
            },
            session ? { session } : {}
          );
        }

        // F. Generate initial Payment record inside transaction
        const initialCollectedAmount = Number(data.amountReceivedToday !== undefined ? data.amountReceivedToday : data.registrationAmount) || 0;
        if (initialCollectedAmount > 0) {
          const initialPayment = new Payment({
            admissionId: admission._id,
            studentName: admission.fullName, // Name as issued
            amountReceived: initialCollectedAmount,
            paymentMode: data.paymentMode || "Cash",
            referenceNo: data.transactionNo || "N/A",
            company: finalCompany,
            companyId: admission.companyId,
            brand: data.brand,
            brandId: admission.brandId,
            paymentDate: admission.admissionDate ? new Date(admission.admissionDate) : (data.admissionDate ? new Date(data.admissionDate) : (data.paymentDate ? new Date(data.paymentDate) : new Date())),
            particulars: {
              courseFeeDue: 0,
              registrationFeeDue: Number(data.registrationAmount || data.amountReceivedToday || initialCollectedAmount),
              materialFeeDue: 0,
              examFeeDue: 0
            },
            remarks: "Initial registration payment upon admission"
          });
          initialPaymentObj = await initialPayment.save({ session });
        }

        // G. AUTO TASK ENGINE: Generate 4 SOP Tasks inside transaction
        const due24h = new Date();
        due24h.setDate(due24h.getDate() + 1);
        const due48h = new Date();
        due48h.setDate(due48h.getDate() + 2);
        const counsellorName = admission.counsellor || user?.name || "Unassigned";

        await Task.create([
          {
            title: `Document Collection & Verification: ${admission.fullName}`,
            description: `Collect Govt ID proof, past marksheets, and passport photo for ${admission.course}.`,
            taskType: "Document Collection",
            linkedType: "Admission",
            linkedStudentName: admission.fullName,
            linkedStudentId: admission._id.toString(),
            assignedTo: counsellorName,
            priority: "High",
            status: "Pending",
            dueDate: due24h,
            checklist: [
              { text: "Verify Aadhaar / Govt Identity Card", isCompleted: false },
              { text: "Upload educational marksheets & photo", isCompleted: false }
            ],
            autoTriggerSource: "Auto Event: New Admission SOP Step 1"
          },
          {
            title: `First Installment Receipt & Ledger Sync: ${admission.fullName}`,
            description: `Ensure registration fee receipt is issued and ledger is verified.`,
            taskType: "Fee Collection",
            linkedType: "Admission",
            linkedStudentName: admission.fullName,
            linkedStudentId: admission._id.toString(),
            assignedTo: counsellorName,
            priority: "High",
            status: "Pending",
            dueDate: due24h,
            checklist: [
              { text: "Confirm payment credit in bank/ledger", isCompleted: true },
              { text: "Generate official PDF payment receipt", isCompleted: true }
            ],
            autoTriggerSource: "Auto Event: New Admission SOP Step 2"
          },
          {
            title: `Batch Allocation & LMS Credentials: ${admission.fullName}`,
            description: `Assign batch timing in ERP and send LMS portal credentials.`,
            taskType: "Batch Allocation",
            linkedType: "Admission",
            linkedStudentName: admission.fullName,
            linkedStudentId: admission._id.toString(),
            assignedTo: counsellorName,
            priority: "Medium",
            status: "Pending",
            dueDate: due48h,
            checklist: [
              { text: "Allocate batch schedule in ERP Engine", isCompleted: false },
              { text: "Create student LMS portal account", isCompleted: false }
            ],
            autoTriggerSource: "Auto Event: New Admission SOP Step 3"
          },
          {
            title: `Send Welcome Onboarding Package: ${admission.fullName}`,
            description: `Deliver official welcome onboarding handbook & WhatsApp package.`,
            taskType: "Welcome Onboarding",
            linkedType: "Admission",
            linkedStudentName: admission.fullName,
            linkedStudentId: admission._id.toString(),
            assignedTo: counsellorName,
            priority: "Medium",
            status: "Pending",
            dueDate: due48h,
            checklist: [
              { text: "Send Welcome WhatsApp message & student handbook", isCompleted: false },
              { text: "Add student to official batch WhatsApp group", isCompleted: false }
            ],
            autoTriggerSource: "Auto Event: New Admission SOP Step 4"
          }
        ], session ? { session } : undefined);
      });

    // Trigger Admission Confirmation Email directly to Student's Email
    const studentEmail = (admission.email || data.email || data.emailAddress || "").trim();

    if (studentEmail) {
      const emailPayload = {
        ...admission.toObject(),
        email: studentEmail
      };
      sendAdmissionConfirmationEmail(emailPayload)
        .then((res) => console.log(`[Admission API] Admission email sent directly to student (${studentEmail}). Res:`, res))
        .catch((err) => console.error("[Admission API] Admission email error:", err));
    } else {
      console.warn(`[Admission API] No student email provided for ${admission.fullName} (${admission.admissionId}). Email not sent.`);
    }

    // Trigger MSG91 Brand Welcome WhatsApp Message directly to Student's Mobile
    if (admission.mobileNumber) {
      sendWhatsAppBrandWelcome({
        studentName: admission.fullName,
        mobileNumber: admission.mobileNumber,
        courseName: admission.course,
        brandName: admission.brand,
        counsellorName: admission.counsellor,
        admissionId: admission.admissionId,
      })
        .then((res) => console.log(`[Admission API] Brand welcome WhatsApp sent to ${admission.mobileNumber}. Res:`, res))
        .catch((err) => console.error("[Admission API] Brand welcome WhatsApp error:", err));
    }

    return NextResponse.json(
      { success: true, message: "Admission generated successfully", data: admission, payment: initialPaymentObj },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Admission Creation Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to generate admission" },
      { status: 500 }
    );
  }
}


export async function GET(req: Request) {
  try {
    await dbConnect();

    const user = await getUserFromCookies();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    let brand = searchParams.get("brand");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const filterParam = searchParams.get("filter");
    const batchParam = searchParams.get("batch");
    const companyParam = searchParams.get("company");
    const counsellorParam = searchParams.get("counsellor") || searchParams.get("counsellorId");

    const deletedAccess = validateDeletedAccess(user, searchParams);
    if (deletedAccess.errorResponse) {
      return deletedAccess.errorResponse;
    }

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    let allowedBrands: string[] | null = null;
    if (isBrandRestricted) {
      allowedBrands = userBrand.split(/[,/|]/).map((b: string) => b.trim()).filter(Boolean);
    }

    const query: any = {};
    const andConditions: any[] = [];

    if (deletedAccess.onlyDeleted) {
      andConditions.push({ isDeleted: true });
    }

    if (companyParam && companyParam !== "all" && companyParam !== "All") {
      const cRegex = new RegExp(`^${companyParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i");
      const compDoc = (mongoose.Types.ObjectId.isValid(companyParam)
        ? await Company.findById(companyParam).lean()
        : await Company.findOne({ $or: [{ name: cRegex }, { legalName: cRegex }] }).lean()) as any;
      if (compDoc) {
        andConditions.push({ $or: [{ companyId: compDoc._id }, { companyAssigned: cRegex }] });
      } else {
        andConditions.push({ companyAssigned: cRegex });
      }
    }

    if (counsellorParam && counsellorParam !== "all" && counsellorParam !== "All") {
      const coRegex = new RegExp(`^${counsellorParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i");
      const userDoc = (mongoose.Types.ObjectId.isValid(counsellorParam)
        ? await User.findById(counsellorParam).lean()
        : await User.findOne({ name: coRegex }).lean()) as any;
      if (userDoc) {
        andConditions.push({ $or: [{ counsellorId: userDoc._id }, { counsellor: coRegex }] });
      } else {
        andConditions.push({ counsellor: coRegex });
      }
    }

    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      const cleanQ = q.replace(/[\s-]/g, "");
      const cleanRegex = new RegExp(escapeRegex(cleanQ), "i");

      andConditions.push({
        $or: [
          { fullName: regex },
          { admissionId: regex },
          { mobileNumber: cleanRegex },
          { email: regex },
          { course: regex },
          { brand: regex },
        ]
      });
    }

    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    let brandMatchCondition: any = null;
    let targetBrandStrings: string[] = [];
    if (allowedBrands && allowedBrands.length > 0) {
      if (brand && brand !== "all" && brand !== "All" && brand !== "All Brands" && allowedBrands.some(b => b.toLowerCase() === brand!.toLowerCase())) {
        targetBrandStrings = [brand.trim()];
      } else {
        targetBrandStrings = allowedBrands;
      }
    } else if (brand && brand !== "all" && brand !== "All" && brand !== "All Brands") {
      targetBrandStrings = brand.split(/[,/|]/).map(b => b.trim()).filter(Boolean);
    }

    if (targetBrandStrings.length > 0) {
      const regexArray = targetBrandStrings.map(b => new RegExp(`^${escapeRegExp(b)}$`, "i"));
      const brandDocs = await Brand.find({
        $or: [
          { name: { $in: regexArray } },
          { code: { $in: regexArray } },
          { _id: { $in: targetBrandStrings.filter(s => mongoose.Types.ObjectId.isValid(s)) } }
        ]
      }).select("_id").lean();
      const brandIds = brandDocs.map(b => b._id);

      brandMatchCondition = {
        $or: [
          ...(brandIds.length > 0 ? [{ brandId: { $in: brandIds } }] : []),
          { brand: { $in: regexArray } },
          { targetBrand: { $in: regexArray } }
        ]
      };
      andConditions.push(brandMatchCondition);
    }

    const batchIdParam = searchParams.get("batchId");
    const exactBatchParam = searchParams.get("exactBatch");

    if (batchIdParam) {
      const trimmedBId = batchIdParam.trim();
      const idMatches: any[] = [{ batchId: trimmedBId }];
      if (mongoose.Types.ObjectId.isValid(trimmedBId)) {
        idMatches.push({ batchId: new mongoose.Types.ObjectId(trimmedBId) });
      }

      let batchDoc: any = null;
      try {
        const bQuery: any[] = [{ batchId: trimmedBId }];
        if (mongoose.Types.ObjectId.isValid(trimmedBId)) {
          bQuery.push({ _id: new mongoose.Types.ObjectId(trimmedBId) });
        }
        batchDoc = await Batch.findOne({ $or: bQuery }).lean();
        if (batchDoc) {
          if (batchDoc.batchId && batchDoc.batchId !== trimmedBId) {
            idMatches.push({ batchId: batchDoc.batchId });
          }
          if (batchDoc._id) {
            idMatches.push({ batchId: batchDoc._id });
            idMatches.push({ batchId: batchDoc._id.toString() });
          }
        }
      } catch (_) {}

      // Only if no direct batchId assignments exist and exactly 1 batch has this name, fall back to legacy records
      if (batchDoc && batchDoc.batchName && batchDoc.course && batchDoc.brand) {
        const directCount = await Admission.countDocuments({ $or: idMatches });
        if (directCount === 0) {
          const matchingBatchesCount = await Batch.countDocuments({
            batchName: { $regex: new RegExp(`^${escapeRegExp(batchDoc.batchName.trim())}$`, "i") }
          });

          if (matchingBatchesCount === 1) {
            idMatches.push({
              batch: { $regex: new RegExp(`^${escapeRegExp(batchDoc.batchName.trim())}$`, "i") },
              brand: { $regex: new RegExp(`^${escapeRegExp(batchDoc.brand.trim())}$`, "i") },
              course: { $regex: new RegExp(`^${escapeRegExp(batchDoc.course.trim())}$`, "i") },
              $or: [{ batchId: { $exists: false } }, { batchId: "" }, { batchId: null }]
            });
          }
        }
      }

      andConditions.push({ $or: idMatches });
    } else if (batchParam) {
      const resolvedBatchName = batchParam.trim();
      if (exactBatchParam === "true") {
        andConditions.push({ batch: resolvedBatchName });
      } else {
        andConditions.push({ batch: { $regex: new RegExp(`^${escapeRegExp(resolvedBatchName)}$`, "i") } });
      }
    }

    let targetStart: Date | null = null;
    let targetEnd: Date | null = null;

    if (startDateParam && endDateParam) {
      targetStart = new Date(startDateParam);
      targetStart.setHours(0, 0, 0, 0);
      targetEnd = new Date(endDateParam);
      targetEnd.setHours(23, 59, 59, 999);
    } else if (filterParam === "today") {
      targetStart = new Date();
      targetStart.setHours(0, 0, 0, 0);
      targetEnd = new Date();
      targetEnd.setHours(23, 59, 59, 999);
    } else if (filterParam === "thisMonth") {
      const now = new Date();
      targetStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      targetEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    if (targetStart && targetEnd) {
      andConditions.push({
        $or: [
          { admissionDate: { $gte: targetStart, $lte: targetEnd } },
          { $and: [{ admissionDate: { $exists: false } }, { createdAt: { $gte: targetStart, $lte: targetEnd } }] },
          { $and: [{ admissionDate: null }, { createdAt: { $gte: targetStart, $lte: targetEnd } }] }
        ]
      });
    }

    if (andConditions.length > 0) {
      query.$and = andConditions;
    }

    const enquiryQuery: any = {};
    if (query.brand) {
      enquiryQuery.targetBrand = query.brand;
    }
    if (targetStart && targetEnd) {
      enquiryQuery.createdAt = { $gte: targetStart, $lte: targetEnd };
    }
    // Count unique prospective students by phone number so multiple enquiries for different courses are counted as 1 enquiry
    const distinctPhones = await Enquiry.distinct("primaryPhoneMobile", enquiryQuery);
    const rawEnquiriesCount = distinctPhones.filter((p: any) => p && String(p).trim()).length;

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const matchStage = Object.keys(query).length > 0 ? [{ $match: query }] : [];

    if (pageParam || limitParam) {
      const page = Math.max(1, parseInt(pageParam || "1", 10));
      const limit = Math.max(1, parseInt(limitParam || "25", 10));
      const skip = (page - 1) * limit;

      const [admissions, total] = await Promise.all([
        Admission.aggregate([
          ...matchStage,
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          ...studentBalanceLookupStages(),
        ]),
        Admission.countDocuments(query),
      ]);
      const totalEnquiries = Math.max(rawEnquiriesCount, total);

      return NextResponse.json({
        success: true,
        data: admissions,
        totalEnquiries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        }
      });
    }

    const admissions = await Admission.aggregate([
      ...matchStage,
      { $sort: { createdAt: -1 } },
      ...studentBalanceLookupStages(),
    ]);
    const totalEnquiries = Math.max(rawEnquiriesCount, admissions.length);

    return NextResponse.json({ success: true, data: admissions, totalEnquiries });
  } catch (error: any) {
    console.error("Fetch Admissions Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch admissions" },
      { status: 500 }
    );
  }
}
