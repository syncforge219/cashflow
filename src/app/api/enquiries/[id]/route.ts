import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import LostLeadCounter from "@/models/LostLeadCounter";

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
    if (updateTarget.courses || updateTarget.targetCourses || updateTarget.targetCourse) {
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
        if (body.$set) {
          Object.assign(enquiry, body.$set);
        } else if (!body.$push && !body.$pull) {
          Object.assign(enquiry, body);
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
        const todayStr = new Date().toISOString().split("T")[0];
        await LostLeadCounter.findOneAndUpdate(
          { date: todayStr },
          { $inc: { count: 1 } },
          { upsert: true, new: true }
        );
      }
    }

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

    const deletedEnquiry = await Enquiry.findByIdAndDelete(id);

    const { searchParams } = new URL(req.url);
    const isLostLead = searchParams.get('lostLead') === 'true';

    if (isLostLead) {
      const todayStr = new Date().toISOString().split("T")[0];
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

