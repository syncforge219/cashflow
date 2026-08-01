import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Enquiry from "@/models/Enquiry";
import Payment from "@/models/Payment";
import Company from "@/models/Company";
import Brand from "@/models/Brand";
import Task from "@/models/Task";
import Course from "@/models/Course";
import Notification from "@/models/Notification";
import { getUserFromCookies } from "@/lib/helper";
import { sendWhatsAppFeeReceipt, sendWhatsAppBrandWelcome } from "@/lib/msg91";
import { sendAdmissionConfirmationEmail } from "@/lib/emailService";

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
    data.mobileNumber = data.mobileNumber?.trim() || "0000000000";
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

    // Strict Duplicate Admission Guard: A student with the same Name/Mobile and Course cannot be added multiple times
    const studentFullName = (data.fullName || "").trim();
    const cleanMobile = (data.mobileNumber || "").trim();
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex = studentFullName ? new RegExp(`^${escapeRegExp(studentFullName)}$`, "i") : null;
    const courseRegexes = coursesList.map((c) => new RegExp(escapeRegExp(c), "i"));

    const duplicateFilter: any = {
      $or: [
        ...(cleanMobile ? [{ mobileNumber: cleanMobile }] : []),
        ...(nameRegex ? [{ fullName: nameRegex }] : [])
      ],
      $and: [
        {
          $or: [
            { course: { $in: courseRegexes } },
            { courses: { $elemMatch: { $in: courseRegexes } } },
            { targetCourses: { $elemMatch: { $in: courseRegexes } } }
          ]
        }
      ]
    };

    const existingStudentAdmission = await Admission.findOne(duplicateFilter);
    if (existingStudentAdmission) {
      return NextResponse.json({
        success: false,
        message: `Duplicate Admission Blocked: Student "${existingStudentAdmission.fullName}" is already enrolled in "${existingStudentAdmission.course}" (Admission ID: ${existingStudentAdmission.admissionId}). A student cannot be admitted to the same course multiple times.`
      }, { status: 400 });
    }

    if (coursesList.length === 0) {
      coursesList = ["General Course"];
    }

    data.courses = coursesList;
    data.targetCourses = coursesList;
    data.course = coursesList.join(", ");
    data.batch = data.batch?.trim() || "General Batch";
    data.duration = data.duration?.trim() || "6 Months";
    data.startDate = data.startDate ? new Date(data.startDate) : new Date();
    data.academicYear = data.academicYear?.trim() || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    data.admissionDate = data.admissionDate ? new Date(data.admissionDate) : new Date();
    data.courseFee = Number(data.courseFee) || 0;
    data.finalFee = Number(data.finalFee) || 0;
    data.paymentMode = data.paymentMode?.trim() || "Cash";
    data.registrationAmount = Number(data.registrationAmount || data.amountReceivedToday) || 0;
    data.amountReceivedToday = data.registrationAmount;
    data.downpaymentAmount = Number(data.downpaymentAmount) || 0;
    data.downpaymentDueDate = data.downpaymentDueDate ? new Date(data.downpaymentDueDate) : undefined;
    data.remainingBalance = Math.max(0, data.finalFee - data.registrationAmount - data.downpaymentAmount);
    data.paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();
    data.companyAssigned = data.companyAssigned?.trim() || "Cash";
    data.brand = data.brand?.trim() || "Cadd Mantra";

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
          availableCompanies.sort((a, b) => {
            const capA = (a.annualCapacityCap || 1949999) - (a.collectedRevenue || 0);
            const capB = (b.annualCapacityCap || 1949999) - (b.collectedRevenue || 0);
            return capB - capA;
          });

          finalCompany = availableCompanies[0].name;
        } else {
          finalCompany = "Unallocated";
        }
      } else {
        finalCompany = "Cash";
      }
    }

    // Update Ledger (increment collectedRevenue)
    if (finalCompany && finalCompany !== "Cash" && finalCompany !== "Unallocated" && finalCompany !== "Cash (Unallocated)") {
      if (Number(data.amountReceivedToday) > 0) {
        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const compRegex = new RegExp(`^${escapeRegExp(finalCompany.trim())}$`, "i");
        await Company.updateOne(
          { $or: [{ name: { $regex: compRegex } }, { legalName: { $regex: compRegex } }] },
          { $inc: { collectedRevenue: Number(data.amountReceivedToday) } }
        );
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

    const admission = new Admission(data);
    await admission.save();

    // Trigger Notification for Admin if discount exceeds max limit
    if (totalDiscountGiven > maxAllowedLimit) {
      try {
        await Notification.create({
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
        });
      } catch (notifErr) {
        console.error("Failed creating Notification:", notifErr);
      }
    }

    // Helper to cancel uncompleted follow-ups & sync counsellor name to enquiry
    const cancelUncompletedFollowUps = (enquiryDoc: any) => {
      enquiryDoc.status = "Admitted";
      enquiryDoc.isAdmitted = true;
      if (admission.counsellor) {
        enquiryDoc.assignedCrmAdvisor = admission.counsellor;
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

    const matchedEnquiryIds: string[] = [];

    // Automatically update original enquiry status to Admitted & cancel all pending follow-ups
    if (data.enquiryId) {
      const enqFilter = mongoose.Types.ObjectId.isValid(data.enquiryId)
        ? { _id: data.enquiryId }
        : { enquiryId: data.enquiryId };

      const enqs = await Enquiry.find(enqFilter);
      for (const enq of enqs) {
        cancelUncompletedFollowUps(enq);
        await enq.save();
        matchedEnquiryIds.push(enq._id.toString());
      }
    }

    if (data.mobileNumber) {
      const cleanDigits = String(data.mobileNumber).replace(/\D/g, "").slice(-10);
      if (cleanDigits.length === 10) {
        const queryFilter: any = {
          primaryPhoneMobile: { $regex: cleanDigits },
          status: { $nin: ["Admitted", "Closed", "Lost", "Converted"] },
        };
        if (data.course) {
          queryFilter.targetCourse = data.course;
        }

        const matchingEnquiries = await Enquiry.find(queryFilter);
        for (const enq of matchingEnquiries) {
          cancelUncompletedFollowUps(enq);
          await enq.save();
          if (!matchedEnquiryIds.includes(enq._id.toString())) {
            matchedEnquiryIds.push(enq._id.toString());
          }
        }
      }
    }

    // Direct Admission: If no matching lead exists, automatically create a Lead/Enquiry with exact same details
    if (matchedEnquiryIds.length === 0) {
      try {
        const directEnquiry = new Enquiry({
          studentFullName: admission.fullName,
          primaryPhoneMobile: admission.mobileNumber,
          parentsFullName: admission.parentName || admission.parentsFullName,
          parentsPhoneNumber: admission.parentPhone || admission.parentsPhoneNumber,
          emailAddress: admission.email,
          currentCity: admission.city,
          targetBrand: admission.brand,
          targetCourse: admission.course,
          assignedCrmAdvisor: admission.counsellor || data.counsellor || "Counsellor",
          leadSource: "Direct Admission / Walk-in",
          expectedCourseFee: `₹${Number(admission.finalFee || admission.courseFee || 0).toLocaleString('en-IN')}`,
          priorityLevel: "High",
          status: "Admitted",
          remarks: `Direct admission created by ${admission.counsellor || 'Counsellor'}`
        });
        await directEnquiry.save();
        matchedEnquiryIds.push(directEnquiry._id.toString());
      } catch (enqCreateErr) {
        console.error("Failed to auto-create Lead for Direct Admission:", enqCreateErr);
      }
    }

    // Cancel/close any pending lead call tasks for this student/enquiry
    if (matchedEnquiryIds.length > 0 || admission.fullName) {
      await Task.updateMany(
        {
          $or: [
            { linkedEnquiryId: { $in: matchedEnquiryIds } },
            { linkedStudentId: admission._id.toString() },
            { linkedStudentName: admission.fullName }
          ],
          taskType: { $in: ["Lead Call", "Demo", "General"] },
          status: { $in: ["Pending", "In Progress"] }
        },
        {
          $set: {
            status: "Completed",
            completedAt: new Date()
          }
        }
      );
    }

    // Automatically generate a Payment record for the initial payment collected during admission (Registration + Downpayment)
    let initialPaymentObj = null;
    const initialCollectedAmount = Number(data.amountReceivedToday) > 0
      ? Number(data.amountReceivedToday)
      : ((Number(data.registrationAmount) || 0) + (Number(data.downpaymentAmount) || 0));

    if (initialCollectedAmount > 0) {
      const initialPayment = new Payment({
        admissionId: admission._id,
        studentName: admission.fullName,
        amountReceived: initialCollectedAmount,
        paymentMode: data.paymentMode || "Cash",
        referenceNo: data.transactionNo || "N/A",
        company: finalCompany,
        brand: data.brand,
        paymentDate: admission.paymentDate || new Date(),
        particulars: {
          courseFeeDue: 0,
          registrationFeeDue: Number(data.registrationAmount || 0),
          materialFeeDue: 0,
          examFeeDue: 0
        },
        remarks: "Initial payment upon admission"
      });
      initialPaymentObj = await initialPayment.save();

      // Trigger MSG91 WhatsApp Fee Receipt notification
      try {
        if (admission.mobileNumber) {
          sendWhatsAppFeeReceipt({
            studentName: admission.fullName,
            mobileNumber: admission.mobileNumber,
            courseName: admission.course,
            amountPaid: Number(data.amountReceivedToday),
            paymentDate: new Date(initialPaymentObj.createdAt || Date.now()).toLocaleDateString("en-IN"),
            receiptNo: initialPaymentObj.receiptNo,
          }).catch((err) => console.error("Async MSG91 WhatsApp Error:", err));
        }
      } catch (waErr) {
        console.error("Failed to trigger WhatsApp receipt:", waErr);
      }
    }

    // AUTO TASK ENGINE: Generate 4 SOP Tasks for Admission Onboarding
    try {
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
      ]);
    } catch (taskErr) {
      console.error("Auto task SOP generation failed on admission:", taskErr);
    }

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

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    if (isBrandRestricted) {
      brand = userBrand;
    }

    let query: any = {};
    if (q) {
      const regex = new RegExp(q, "i");
      const cleanQ = q.replace(/[\s-]/g, "");
      const cleanRegex = new RegExp(cleanQ, "i");

      query.$or = [
        { fullName: regex },
        { admissionId: regex },
        { mobileNumber: cleanRegex },
        { email: regex },
      ];
    }

    if (brand && brand !== "all" && brand !== "All" && brand !== "All Brands") {
      query.brand = { $regex: new RegExp(`^${brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") };
    }

    if (startDateParam && endDateParam) {
      const sDate = new Date(startDateParam);
      sDate.setHours(0, 0, 0, 0);
      const eDate = new Date(endDateParam);
      eDate.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: sDate, $lte: eDate };
    } else if (filterParam === "today") {
      const sDate = new Date();
      sDate.setHours(0, 0, 0, 0);
      const eDate = new Date();
      eDate.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: sDate, $lte: eDate };
    } else if (filterParam === "thisMonth") {
      const now = new Date();
      const sDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const eDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      query.createdAt = { $gte: sDate, $lte: eDate };
    }

    const enquiryQuery: any = {};
    if (brand && brand !== "all" && brand !== "All") {
      enquiryQuery.targetBrand = brand;
    }
    if (query.createdAt) {
      enquiryQuery.createdAt = query.createdAt;
    }
    const rawEnquiriesCount = await Enquiry.countDocuments(enquiryQuery);

    const admissions = await Admission.find(query).sort({ createdAt: -1 });
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
