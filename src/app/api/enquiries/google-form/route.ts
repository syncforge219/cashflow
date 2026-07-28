import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import User from "@/models/User";
import Task from "@/models/Task";

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

    const targetCourse =
      body.targetCourse ||
      body.course ||
      body["Target Course"] ||
      body["Course"] ||
      "General Course";

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

    // 2. Round-Robin Auto-Assignment to Brand Counsellor
    const escapeRegExp = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const brandRegex = new RegExp(`(^|[,\\/|\\s])${escapeRegExp(targetBrand)}($|[,\\/|\\s])`, 'i');

    const brandCounsellors = await User.find({
      role: { $in: ["counsellor", "counselor", "sales executive", "sales-executive"] },
      $or: [
        { brandScope: { $regex: brandRegex } },
        { brandScope: { $in: ["All", "All Brands", "global", "*"] } }
      ]
    }).lean();

    let assignedAdvisor = "Unassigned";
    if (brandCounsellors.length > 0) {
      // Pick next advisor round-robin based on existing enquiry count
      const advisorLeadCounts = await Promise.all(
        brandCounsellors.map(async (c: any) => {
          const count = await Enquiry.countDocuments({ assignedCrmAdvisor: c.name });
          return { name: c.name, count };
        })
      );
      advisorLeadCounts.sort((a, b) => a.count - b.count);
      assignedAdvisor = advisorLeadCounts[0].name;
    }

    // 3. Create Enquiry Document
    const newEnquiry = await Enquiry.create({
      studentFullName,
      primaryPhoneMobile,
      emailAddress,
      currentCity,
      targetBrand,
      targetCourse,
      assignedCrmAdvisor: assignedAdvisor,
      leadSource,
      priorityLevel: "High",
      remarks,
      status: "New",
    });

    // 4. Create Task for Assigned Advisor
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
    } catch (taskErr) {
      console.error("Failed creating Google Form lead task:", taskErr);
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
