import { todayKey } from "@/lib/dates";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import LostLeadCounter from "@/models/LostLeadCounter";
import User from "@/models/User";
import { sendWhatsAppTeacherDemoAlert, formatDDMMYYYY } from "@/lib/msg91";
import { syncEnquiryRefs } from "@/lib/referenceHelper";
import { getUserFromCookies } from "@/lib/helper";
import { logAuditEntry, diffAndLogAudit } from "@/lib/auditLogger";
import { brandSendsTeacherDemoAlert } from "@/lib/brandDefaults";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    // Normalize courses array if updating course fields
    const updateTarget = body.$set || body;
    if (updateTarget.isLookingForJob === true || updateTarget.isLookingForJob === "true") {
      updateTarget.isLookingForJob = true;
      updateTarget.courses = ["Looking for Job"];
      updateTarget.targetCourses = ["Looking for Job"];
      updateTarget.targetCourse = "Looking for Job";
      updateTarget.expectedCourseFee = "₹0";
    } else if (updateTarget.courses || updateTarget.targetCourses || updateTarget.targetCourse) {
      let coursesList: string[] = [];
      if (Array.isArray(updateTarget.courses) && updateTarget.courses.length > 0) {
        coursesList = updateTarget.courses.map((c: any) => String(c).trim()).filter(Boolean);
      } else if (Array.isArray(updateTarget.targetCourses) && updateTarget.targetCourses.length > 0) {
        coursesList = updateTarget.targetCourses.map((c: any) => String(c).trim()).filter(Boolean);
      } else if (typeof updateTarget.targetCourse === "string" && updateTarget.targetCourse.trim()) {
        coursesList = updateTarget.targetCourse.split(",").map((c: string) => c.trim()).filter(Boolean);
      }

      if (coursesList.length > 0) {
        updateTarget.courses = coursesList;
        updateTarget.targetCourses = coursesList;
        updateTarget.targetCourse = coursesList.join(", ");
        if (coursesList.includes("Looking for Job") && coursesList.length === 1) {
          updateTarget.isLookingForJob = true;
        } else {
          updateTarget.isLookingForJob = false;
        }
      }
    }

    const updateQuery = (body.$set || body.$push || body.$pull) ? body : { $set: body };
    const statusVal = body.status || (body.$set && body.$set.status);
    const isAdmittedVal = body.isAdmitted || (body.$set && body.$set.isAdmitted);

    if (statusVal === "Admitted" || isAdmittedVal === true) {
      const enquiry = await Enquiry.findById(id);
      if (enquiry) {
        if (enquiry.followUps && Array.isArray(enquiry.followUps)) {
          enquiry.followUps.forEach((f: any) => {
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
        (enquiry as any).status = "Admitted";
        (enquiry as any).isAdmitted = true;
        const changes = body.$set || (!body.$push && !body.$pull ? body : null);
        if (changes) {
          // A name change without its id must re-resolve the id in the pre-save hook,
          // otherwise the old brand/advisor id stays attached to the lead.
          if (changes.targetBrand && !changes.targetBrandId && changes.targetBrand !== enquiry.targetBrand) {
            (enquiry as any).targetBrandId = undefined;
          }
          if (
            changes.assignedCrmAdvisor &&
            !changes.assignedCrmAdvisorId &&
            changes.assignedCrmAdvisor !== enquiry.assignedCrmAdvisor
          ) {
            (enquiry as any).assignedCrmAdvisorId = undefined;
          }
          Object.assign(enquiry, changes);
        }
        await enquiry.save();
        return NextResponse.json({
          success: true,
          enquiry,
        });
      }
    }

    if (statusVal === "Lost") {
      const existingEnquiry = await Enquiry.findById(id);
      if (existingEnquiry && existingEnquiry.status !== "Lost") {
        const todayStr = todayKey();
        await LostLeadCounter.findOneAndUpdate(
          { date: todayStr },
          { $inc: { count: 1 } },
          { upsert: true, new: true }
        );
      }
    }

    await syncEnquiryRefs(updateQuery.$set || updateQuery);

    // Remember the demo as it was, so the teacher is only alerted when the demo actually changes
    // (the edit form re-sends every field, which used to re-trigger the WhatsApp on each save).
    const setData = body.$set || body;
    const touchesDemo = setData.isDemoScheduled === true || setData.demoDate || setData.demoTeacher;
    const previousDemo: any = touchesDemo
      ? await Enquiry.findById(id).select("demoDate demoTeacher").lean()
      : null;

    const updatedEnquiry = await Enquiry.findByIdAndUpdate(
      id,
      updateQuery,
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedEnquiry) {
      return NextResponse.json(
        { error: "Enquiry not found" },
        { status: 404 }
      );
    }

    // AUTO WHATSAPP TEACHER DEMO ALERT: only for brands with "WhatsApp the teacher" switched on (Brands page)
    const demoChanged =
      touchesDemo &&
      (String(previousDemo?.demoDate || "") !== String((updatedEnquiry as any).demoDate || "") ||
        String(previousDemo?.demoTeacher || "") !== String((updatedEnquiry as any).demoTeacher || ""));
    if (demoChanged) {
      const brandName = ((updatedEnquiry as any).targetBrand || "").trim();
      if (await brandSendsTeacherDemoAlert(brandName)) {
        const teacherName = ((updatedEnquiry as any).demoTeacher || setData.demoTeacher || "").trim();
        const demoDate = (updatedEnquiry as any).demoDate || setData.demoDate || "";
        const courseName = (updatedEnquiry as any).targetCourse || "Course";
        if (teacherName && demoDate) {
          User.findOne({ name: { $regex: new RegExp(`^${teacherName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } })
            .select("phone name")
            .lean()
            .then((teacher: any) => {
              const teacherPhone = teacher?.phone || "";
              if (teacherPhone) {
                return sendWhatsAppTeacherDemoAlert({
                  teacherName,
                  teacherMobile: teacherPhone,
                  demoDate,
                  courseName,
                  brandName,
                });
              } else {
                console.warn(`[Enquiry PATCH] Teacher "${teacherName}" has no phone — skipping teacher_demo WhatsApp.`);
              }
            })
            .then((res: any) => { if (res) console.log(`[Enquiry PATCH] Teacher demo alert sent to ${teacherName}:`, res); })
            .catch((err: any) => console.error("[Enquiry PATCH] Teacher demo WhatsApp error:", err));
        }
      }
    }

    return NextResponse.json({
      success: true,
      enquiry: updatedEnquiry,
    });
  } catch (error: any) {
    console.error("Error updating enquiry:", error);
    return NextResponse.json(
      { error: "Failed to update enquiry", message: error.message },
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

    const existingEnquiry = await Enquiry.findById(id);
    if (!existingEnquiry) {
      return NextResponse.json(
        { error: "Enquiry not found" },
        { status: 404 }
      );
    }

    const enquiryDoc = existingEnquiry as any;
    const phone = enquiryDoc.primaryPhoneMobile || enquiryDoc.mobileNumber;
    if (
      (enquiryDoc.status || "").toUpperCase() === "ADMITTED" ||
      (enquiryDoc.stage || "").toUpperCase() === "ADMITTED" ||
      enquiryDoc.isAdmitted === true
    ) {
      const admissionExists = await Admission.exists({
        $or: [
          { enquiryId: existingEnquiry._id.toString() },
          { enquiryId: existingEnquiry._id },
          ...(phone
            ? [
                { mobileNumber: phone },
                { primaryPhoneMobile: phone }
              ]
            : [])
        ]
      });

      if (admissionExists) {
        return NextResponse.json(
          { error: "Cannot delete an enquiry record while an active student admission record exists." },
          { status: 400 }
        );
      }
    }

    const user = await getUserFromCookies();
    const userId = (user as any)?._id || null;

    (existingEnquiry as any).isDeleted = true;
    (existingEnquiry as any).deletedAt = new Date();
    (existingEnquiry as any).deletedBy = userId;
    await existingEnquiry.save();

    await logAuditEntry({
      collectionName: "enquiries",
      docId: existingEnquiry._id,
      action: "SOFT_DELETE",
      changedFields: [{ field: "isDeleted", oldValue: false, newValue: true }],
      userId
    });

    const { searchParams } = new URL(req.url);
    const isLostLead = searchParams.get('lostLead') === 'true';

    if (isLostLead) {
      const todayStr = todayKey();
      await LostLeadCounter.findOneAndUpdate(
        { date: todayStr },
        { $inc: { count: 1 } },
        { upsert: true, new: true }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Enquiry deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting enquiry:", error);
    return NextResponse.json(
      { error: "Failed to delete enquiry", message: error.message },
      { status: 500 }
    );
  }
}

