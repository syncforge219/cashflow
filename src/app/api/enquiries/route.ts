import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Task from "@/models/Task";
import { getUserFromCookies } from "@/lib/helper";
import { sendWhatsAppDemoReminder, sendWhatsAppWelcomeEnquiry } from "@/lib/msg91";
import { verifyRecaptchaToken } from "@/lib/recaptcha";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();

    const body = await req.json();

    // Verify reCAPTCHA v3 if token is present (e.g. public API calls)
    const recaptchaToken = body.recaptchaToken || body["g-recaptcha-response"];
    if (recaptchaToken) {
      const recaptchaCheck = await verifyRecaptchaToken(recaptchaToken, "public_enquiry_submit", 0.5);
      if (!recaptchaCheck.success) {
        console.warn(`[reCAPTCHA Blocked] Enquiry API blocked: ${recaptchaCheck.error}`);
        return NextResponse.json(
          { success: false, message: recaptchaCheck.error || "reCAPTCHA verification failed." },
          { status: 400 }
        );
      }
    }

    if (user && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All") {
      body.targetBrand = body.targetBrand || user.brandScope;
    }

    // Fallbacks and mandatory field validations
    const fullName = body.studentFullName?.trim();
    if (!fullName) {
      return NextResponse.json(
        { success: false, message: "Student full name is required." },
        { status: 400 }
      );
    }
    body.studentFullName = fullName;
    body.date = body.date?.trim() || new Date().toISOString().split("T")[0];
    body.primaryPhoneMobile = body.primaryPhoneMobile?.trim() || "+91 0000000000";
    body.currentCity = body.currentCity?.trim() || "N/A";
    
    // Process multi-selected courses
    let coursesList: string[] = [];
    if (Array.isArray(body.courses) && body.courses.length > 0) {
      coursesList = body.courses.map((c: any) => String(c).trim()).filter(Boolean);
    } else if (Array.isArray(body.targetCourses) && body.targetCourses.length > 0) {
      coursesList = body.targetCourses.map((c: any) => String(c).trim()).filter(Boolean);
    } else if (typeof body.targetCourse === "string" && body.targetCourse.trim()) {
      coursesList = body.targetCourse.split(",").map((c: string) => c.trim()).filter(Boolean);
    }

    if (coursesList.length === 0) {
      coursesList = ["General Course"];
    }

    body.courses = coursesList;
    body.targetCourses = coursesList;
    body.targetCourse = coursesList.join(", ");
    body.targetBrand = body.targetBrand?.trim() || "Cadd Mantra";
    body.assignedCrmAdvisor = body.assignedCrmAdvisor?.trim() || user?.name || "Unassigned";

    // Check for duplicate primary phone number for any of the target courses (only for real non-default numbers)
    if (body.primaryPhoneMobile && coursesList.length > 0 && !body.primaryPhoneMobile.includes("0000000000")) {
      const cleanDigits = String(body.primaryPhoneMobile).replace(/\D/g, "").slice(-10);
      if (cleanDigits.length === 10) {
        const existingEnquiry = await Enquiry.findOne({
          $or: [
            { targetCourse: { $in: coursesList } },
            { courses: { $in: coursesList } },
            { targetCourses: { $in: coursesList } }
          ],
          primaryPhoneMobile: { $regex: cleanDigits }
        });

        if (existingEnquiry) {
          return NextResponse.json(
            { 
              success: false, 
              message: `A lead with primary phone number '${body.primaryPhoneMobile}' already exists for one of the selected courses.` 
            },
            { status: 400 }
          );
        }
      }
    }

    // Handle follow-up task construction if scheduled or followUpDate provided
    const isFollowUpScheduled = body.isFollowUpScheduled === true || body.isFollowUpScheduled === "true";
    const followUpDateStr = body.followUpDate ? String(body.followUpDate).trim() : "";

    if ((isFollowUpScheduled || followUpDateStr) && (!Array.isArray(body.followUps) || body.followUps.length === 0)) {
      const fDate = followUpDateStr || body.date || new Date().toISOString().split("T")[0];
      const fTime = body.followUpTime ? String(body.followUpTime).trim() : "10:00";
      const fPriority = body.followUpPriority ? String(body.followUpPriority).trim() : (body.priorityLevel || "Medium");
      const fType = body.followUpType ? String(body.followUpType).trim() : "Phone Call";
      const fNotes = body.followUpNotes ? String(body.followUpNotes).trim() : (body.remarks || "");
      const reminderStr = body.reminder ? String(body.reminder).trim() : "None";
      const advisor = body.assignedCrmAdvisor || user?.name || "Unassigned";

      body.followUpDate = fDate;
      body.followUps = [
        {
          date: fDate,
          time: fTime,
          priority: fPriority,
          typeOfContact: fType,
          remarks: fNotes,
          nextAction: reminderStr && reminderStr !== "None" ? `Reminder: ${reminderStr}` : "",
          status: "Pending",
          plannedBy: user?.name || advisor,
          assignedTo: advisor,
          isCompleted: false,
          isRecurring: false,
          recurringRule: "none",
          escalatedToManager: false,
          createdAt: new Date(),
        },
      ];
    } else if (followUpDateStr && !body.followUpDate) {
      body.followUpDate = followUpDateStr;
    }

    // Handle demo class construction if scheduled
    if (body.isDemoScheduled && body.demoDate && (!Array.isArray(body.demos) || body.demos.length === 0)) {
      body.demos = [
        {
          date: String(body.demoDate).trim(),
          time: body.demoTime ? String(body.demoTime).trim() : "10:00 AM",
          mode: body.demoMode ? String(body.demoMode).trim() : "Online",
          notes: body.demoNotes ? String(body.demoNotes).trim() : "",
          status: "Scheduled",
          createdAt: new Date(),
        },
      ];
    }

    const newEnquiry = await Enquiry.create(body);

    // AUTO WHATSAPP WELCOME ENQUIRY: Dispatch welcome_enquiry template upon lead creation
    try {
      const recipientPhone = newEnquiry.primaryPhoneMobile || newEnquiry.parentsPhoneNumber || body.primaryPhoneMobile || body.parentsPhoneNumber || "";
      if (recipientPhone) {
        sendWhatsAppWelcomeEnquiry({
          studentName: newEnquiry.studentFullName || body.studentFullName || "Student",
          mobileNumber: recipientPhone,
          brandName: newEnquiry.targetBrand || (newEnquiry as any).brand || body.targetBrand || body.brand || "CADD Mantra",
          courseName: newEnquiry.targetCourse || body.targetCourse || "Course",
        }).then((res) => console.log(`[Enquiry API] Welcome enquiry WhatsApp sent to ${recipientPhone}:`, res))
          .catch((err) => console.error("[Enquiry API] Welcome enquiry WhatsApp error:", err));
      }
    } catch (waErr) {
      console.error("[Enquiry API] Error triggering welcome enquiry WhatsApp:", waErr);
    }

    // AUTO TASK ENGINE: Generate Call Lead task
    try {
      let dueDate = new Date();
      if (followUpDateStr) {
        const timePart = body.followUpTime || "10:00";
        const parsed = new Date(`${followUpDateStr}T${timePart}:00`);
        if (!isNaN(parsed.getTime())) {
          dueDate = parsed;
        } else {
          dueDate.setDate(dueDate.getDate() + 1);
        }
      } else {
        dueDate.setDate(dueDate.getDate() + 1);
      }
      await Task.create({
        title: `Call Lead: ${newEnquiry.studentFullName}`,
        description: `Initial contact & course counseling call for ${newEnquiry.targetCourse || 'Program'}.`,
        taskType: "Lead Call",
        linkedStudentName: newEnquiry.studentFullName,
        linkedEnquiryId: newEnquiry._id.toString(),
        assignedTo: newEnquiry.assignedCrmAdvisor || "Unassigned",
        priority: newEnquiry.priorityLevel === "High" ? "High" : "Medium",
        status: "Pending",
        dueDate,
        checklist: [
          { text: "Call candidate and introduce institute programs", isCompleted: false },
          { text: "Verify course preference & learning timeline", isCompleted: false },
          { text: "Schedule free Demo session or campus visit", isCompleted: false }
        ],
        autoTriggerSource: "Auto Event: Lead Registered"
      });



      // AUTO WHATSAPP DEMO REMINDER: If demo scheduled on creation
      if (body.isDemoScheduled && body.demoDate) {
        const mobile = newEnquiry.primaryPhoneMobile || newEnquiry.parentsPhoneNumber || "";
        if (mobile) {
          sendWhatsAppDemoReminder({
            studentName: newEnquiry.studentFullName,
            mobileNumber: mobile,
            courseName: newEnquiry.targetCourse,
            demoDate: body.demoDate,
            demoTime: body.demoTime || "11:00 AM",
            demoMode: body.demoMode || "Online",
          }).catch((waErr) => console.error("Auto WhatsApp demo reminder error on create:", waErr));
        }
      }
    } catch (taskErr) {
      console.error("Auto task trigger error on enquiry create:", taskErr);
    }

    return NextResponse.json(
      { success: true, data: newEnquiry, message: "Enquiry created successfully" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating enquiry:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create enquiry" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const { searchParams } = new URL(req.url);
    const paramBrand = searchParams.get("brand") || searchParams.get("targetBrand");

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    let query: any = {};
    if (isBrandRestricted) {
      query.targetBrand = { $regex: new RegExp(`^${userBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") };
    } else if (paramBrand && paramBrand !== "All Brands" && paramBrand !== "All") {
      query.targetBrand = { $regex: new RegExp(`^${paramBrand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") };
    }

    const enquiries = await Enquiry.find(query).sort({ createdAt: -1 });

    return NextResponse.json(
      { success: true, data: enquiries },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching enquiries:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch enquiries" },
      { status: 500 }
    );
  }
}
