import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Admission from "@/models/Admission";
import Enquiry from "@/models/Enquiry";

export async function POST(request: Request) {
  try {
    await dbConnect();

    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      photoUrl,
      brandScope,
      joiningDate,
      annualTarget,
      currentRevenue,
      admissionsRecorded,
      password,
    } = body;

    // Validation
    if (!firstName || !lastName || !email || !brandScope || !password) {
      return NextResponse.json(
        { error: "Required fields (First Name, Last Name, Email, Brand Scope, Password) are missing" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if email already registered
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Hash temporary password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with role "counsellor" and counsellor-specific fields
    const newUser = await User.create({
      name: `${firstName} ${lastName}`,
      email: cleanEmail,
      password: hashedPassword,
      role: "counsellor",
      phone,
      photoUrl,
      brandScope,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      annualTarget: annualTarget ? Number(annualTarget) : 500000,
      currentRevenue: currentRevenue ? Number(currentRevenue) : 0,
      admissionsRecorded: admissionsRecorded ? Number(admissionsRecorded) : 0,
    });

    // Return user without password
    const userObj = newUser.toObject();
    delete userObj.password;

    return NextResponse.json(
      { success: true, counsellor: userObj },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Counsellor Registration API Error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during registration" },
      { status: 500 }
    );
  }
}

// GET: Fetch all users with role "counsellor" or "sales executive" with live admission metrics calculation
export async function GET() {
  try {
    await dbConnect();
    const counsellors = await User.find({ role: { $in: ["counsellor", "sales executive", "sales-executive"] } }).select("-password").sort({ createdAt: -1 });
    const admissions = await Admission.find({});
    const allEnquiries = await Enquiry.find({});
    const admittedEnquiries = allEnquiries.filter((enq: any) => enq.status === "Admitted");

    const counsellorsWithLiveStats = counsellors.map((c: any) => {
      const cObj = c.toObject();
      const cName = (c.name || "").toLowerCase().trim();
      const cEmail = (c.email || "").toLowerCase().trim();
      const cId = c._id.toString();

      const matchesCounsellor = (val: string) => {
        if (!val) return false;
        const low = val.toLowerCase().trim();
        return (
          low === cName ||
          low === cEmail ||
          low === cId ||
          (cName && low.includes(cName)) ||
          (cName && cName.includes(low))
        );
      };

      // 1. Find matching Admissions
      const matchingAdmissions = admissions.filter((adm: any) =>
        matchesCounsellor(adm.counsellor)
      );

      // 2. Find matching Admitted Enquiries
      const matchingAdmittedEnquiries = admittedEnquiries.filter((enq: any) =>
        matchesCounsellor(enq.assignedCrmAdvisor)
      );

      // 3. Find all assigned Enquiries
      const totalAssignedEnquiries = allEnquiries.filter((enq: any) =>
        matchesCounsellor(enq.assignedCrmAdvisor)
      );

      const admissionRev = matchingAdmissions.reduce((sum: number, adm: any) => {
        const paid =
          adm.amountReceivedToday ||
          Number(adm.finalFee || 0) - Number(adm.remainingBalance || 0);
        return sum + Math.max(Number(paid) || 0, 0);
      }, 0);

      const enquiryRev = matchingAdmittedEnquiries.reduce((sum: number, enq: any) => {
        const fee = parseFloat(
          String(enq.feesCollected || enq.expectedConversionFee || "0").replace(/[^0-9.]/g, "")
        );
        return sum + (isNaN(fee) ? 0 : fee);
      }, 0);

      const calculatedRevenue = Math.max(admissionRev, enquiryRev);
      const calculatedAdmissionsCount = Math.max(
        matchingAdmissions.length,
        matchingAdmittedEnquiries.length
      );

      const hasAssignedData =
        matchingAdmissions.length > 0 ||
        totalAssignedEnquiries.length > 0 ||
        matchingAdmittedEnquiries.length > 0;

      const finalRevenue = hasAssignedData
        ? calculatedRevenue
        : (c.currentRevenue || 0);

      const finalAdmissionsCount = hasAssignedData
        ? calculatedAdmissionsCount
        : (c.admissionsRecorded || 0);

      return {
        ...cObj,
        currentRevenue: finalRevenue,
        admissionsRecorded: finalAdmissionsCount,
      };
    });

    return NextResponse.json({ success: true, counsellors: counsellorsWithLiveStats });
  } catch (error: any) {
    console.error("Counsellor Fetch API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch counsellors" },
      { status: 500 }
    );
  }
}
