import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import User from "@/models/User";
import Task from "@/models/Task";
import { sendWhatsAppWelcomeEnquiry, sendWhatsAppSuperAdminEnquiryAlert } from "@/lib/msg91";


import { verifyRecaptchaToken } from "@/lib/recaptcha";

// Handling OPTIONS request for CORS preflight
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    await dbConnect();

    let body: any = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      const entries = Array.from(formData.entries());
      entries.forEach(([k, v]) => {
        body[k] = v;
      });
    } else {
      const text = await req.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = {};
      }
    }

    // Server-side Google reCAPTCHA v3 verification
    const recaptchaToken = body.recaptchaToken || body["g-recaptcha-response"];
    if (recaptchaToken) {
      const recaptchaCheck = await verifyRecaptchaToken(recaptchaToken, "public_enquiry_submit", 0.5);
      if (!recaptchaCheck.success) {
        console.warn(`[reCAPTCHA Blocked] Google Form Submission blocked: ${recaptchaCheck.error}`);
        return NextResponse.json(
          {
            success: false,
            error: recaptchaCheck.error || "reCAPTCHA verification failed. Submission blocked.",
          },
          { status: 400 }
        );
      }
    }

    // 1. Normalize field keys for Google Forms / External Webhooks
    const studentFullName =
      body.studentFullName ||
      body.fullName ||
      body.name ||
      body["Student Name"] ||
      body["Full Name"] ||
      body["Student Full Name"] ||
      "Google Form Lead";

    let rawMobile =
      body.primaryPhoneMobile ||
      body.mobileNumber ||
      body.mobile ||
      body.phone ||
      body["Mobile Number"] ||
      body["Phone Number"] ||
      "0000000000";

    const cleanDigits = String(rawMobile).replace(/\D/g, "").slice(-10);
    const primaryPhoneMobile = cleanDigits.length === 10 ? `+91 ${cleanDigits}` : String(rawMobile).trim();

    const emailAddress =
      body.emailAddress ||
      body.email ||
      body["Email Address"] ||
      body["Email"] ||
      "";

    const currentCity =
      body.currentCity ||
      body.city ||
      body["City"] ||
      body["Current City"] ||
      "N/A";

    const targetBrand = (
      body.targetBrand ||
      body.brand ||
      body["Target Brand"] ||
      body["Brand"] ||
      "CADD MANTRA"
    ).toUpperCase().trim();

    let coursesList: string[] = [];
    if (Array.isArray(body.courses) && body.courses.length > 0) {
      coursesList = body.courses.map((c: any) => String(c).trim()).filter(Boolean);
    } else if (Array.isArray(body.targetCourses) && body.targetCourses.length > 0) {
      coursesList = body.targetCourses.map((c: any) => String(c).trim()).filter(Boolean);
    } else if (typeof body.targetCourse === "string" && body.targetCourse.trim()) {
      coursesList = body.targetCourse.split(",").map((c: string) => c.trim()).filter(Boolean);
    } else if (typeof body.course === "string" && body.course.trim()) {
      coursesList = body.course.split(",").map((c: string) => c.trim()).filter(Boolean);
    }

    if (coursesList.length === 0) {
      coursesList = ["General Course"];
    }

    const targetCourse = coursesList.join(", ");

    const leadSource =
      body.leadSource ||
      body.source ||
      body["Lead Source"] ||
      "Google Form";

    const remarks =
      body.remarks ||
      body.notes ||
      body["Remarks"] ||
      body["Comments"] ||
      "Submitted via Google Form";

    // 2. Auto-Assignment to Brand Centre Head (or Round-Robin Centre Head)
    const escapeRegExp = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const brandRegex = new RegExp(`(^|[,\\/|\\s])${escapeRegExp(targetBrand)}($|[,\\/|\\s])`, 'i');

    const centreHeadRoles = [
      "centre head",
      "centre_head",
      "center head",
      "center_head",
      "centre-head",
      "center-head",
      "branch head",
      "branch_head",
      "brand manager",
      "brand_manager",
      "brand-manager"
    ];

    // Find Centre Head matching the target brand
    const brandCentreHeads = await User.find({
      role: { $in: centreHeadRoles },
      $or: [
        { brandScope: { $regex: brandRegex } },
        { brandScope: { $in: ["All", "All Brands", "global", "*"] } }
      ]
    }).lean();

    const brandCounsellors = await User.find({
      role: { $in: ["counsellor", "counselor", "sales executive", "sales-executive"] },
      $or: [
        { brandScope: { $regex: brandRegex } },
        { brandScope: { $in: ["All", "All Brands", "global", "*"] } }
      ]
    }).lean();

    let assignedAdvisor = "Unassigned";

    if (brandCentreHeads.length > 0) {
      // Pick Centre Head for the brand (round-robin if multiple Centre Heads exist)
      const headLeadCounts = await Promise.all(
        brandCentreHeads.map(async (h: any) => {
          const count = await Enquiry.countDocuments({ assignedCrmAdvisor: h.name });
          return { name: h.name, count };
        })
      );
      headLeadCounts.sort((a, b) => a.count - b.count);
      assignedAdvisor = headLeadCounts[0].name;
    } else {
      // Fallback 1: Any Centre Head in database
      const globalCentreHead = await User.findOne({
        role: { $in: centreHeadRoles }
      }).lean();

      if (globalCentreHead && globalCentreHead.name) {
        assignedAdvisor = globalCentreHead.name;
      } else if (brandCounsellors.length > 0) {
        // Fallback 2: Round-Robin among brand counsellors if no Centre Head user exists
        const advisorLeadCounts = await Promise.all(
          brandCounsellors.map(async (c: any) => {
            const count = await Enquiry.countDocuments({ assignedCrmAdvisor: c.name });
            return { name: c.name, count };
          })
        );
        advisorLeadCounts.sort((a, b) => a.count - b.count);
        assignedAdvisor = advisorLeadCounts[0].name;
      }
    }

    // 3. Create Enquiry Document
    const newEnquiry = await Enquiry.create({
      studentFullName,
      date: body.date?.trim() || new Date().toISOString().split("T")[0],
      primaryPhoneMobile,
      emailAddress,
      currentCity,
      targetBrand,
      targetCourse,
      targetCourses: coursesList,
      courses: coursesList,
      assignedCrmAdvisor: assignedAdvisor,
      leadSource,
      priorityLevel: "High",
      remarks,
      status: "New",
    });

    // 4. Create Task for Assigned Advisor & Send WhatsApp Welcome
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);
      await Task.create({
        title: `Google Form Lead: ${studentFullName}`,
        description: `New lead received from Google Form (${targetBrand} - ${targetCourse}). Please contact lead immediately.`,
        taskType: "Lead Call",
        linkedStudentName: studentFullName,
        linkedEnquiryId: newEnquiry._id.toString(),
        assignedTo: assignedAdvisor,
        priority: "High",
        status: "Pending",
        dueDate,
      });

      // Dispatch MSG91 WhatsApp Welcome Enquiry message (welcome_enquiry template)
      if (primaryPhoneMobile) {
        sendWhatsAppWelcomeEnquiry({
          studentName: studentFullName || "Student",
          mobileNumber: primaryPhoneMobile,
          brandName: targetBrand || "CADD Mantra",
          courseName: targetCourse || "Course",
        }).then((res) => console.log(`[Public Form API] Welcome enquiry WhatsApp sent to ${primaryPhoneMobile}:`, res))
          .catch((err) => console.error("[Public Form API] Welcome enquiry WhatsApp error:", err));
      }

      // Dispatch Super Admin Enquiry Alert WhatsApp (enquiry_msg template)
      sendWhatsAppSuperAdminEnquiryAlert({
        studentName: studentFullName || "Student",
        studentMobile: primaryPhoneMobile || "N/A",
        courseName: targetCourse || "General Course",
        brandName: targetBrand || "CADD Mantra",
        counsellorName: assignedAdvisor || "Unassigned",
        leadSource: leadSource || "Google Form",
        date: newEnquiry.date,
      }).then((res) => console.log(`[Public Form API] Super Admin Enquiry Alert WhatsApp sent:`, res))
        .catch((err) => console.error("[Public Form API] Super Admin Enquiry Alert WhatsApp error:", err));
    } catch (taskErr) {
      console.error("Failed creating Google Form lead task/WhatsApp:", taskErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Enquiry stored successfully from Google Form!",
        enquiryId: newEnquiry.enquiryId || newEnquiry._id,
        assignedAdvisor,
        brand: targetBrand,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    console.error("Google Form Enquiry API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process Google Form submission" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
