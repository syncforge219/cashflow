import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import LostLeadCounter from "@/models/LostLeadCounter";

export async function POST(req: Request) {
  try {
    const { enquiryId, date } = await req.json();

    if (!enquiryId || !date) {
      return NextResponse.json({ message: "enquiryId and date are required" }, { status: 400 });
    }

    await dbConnect();

    const existingEnquiry = await Enquiry.findById(enquiryId);
    if (!existingEnquiry) {
      return NextResponse.json({ message: "Enquiry not found" }, { status: 404 });
    }

    const enquiryDoc = existingEnquiry as any;
    const phone = enquiryDoc.primaryPhoneMobile || enquiryDoc.mobileNumber;

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
      return NextResponse.json({ message: "Cannot mark an enquiry as lost while an active student admission record exists." }, { status: 400 });
    }

    // 1. Physically delete the enquiry instead of marking it as lost
    const enquiry = await Enquiry.findByIdAndDelete(enquiryId);

    // 2. Increment the lost lead counter for the given date
    await LostLeadCounter.findOneAndUpdate(
      { date: date },
      { $inc: { count: 1 } },
      { new: true, upsert: true }
    );

    return NextResponse.json({ message: "Lead marked as lost successfully", enquiry });
  } catch (error: any) {
    console.error("Error marking lead as lost:", error);
    return NextResponse.json({ message: error.message || "Failed to mark lead as lost" }, { status: 500 });
  }
}
