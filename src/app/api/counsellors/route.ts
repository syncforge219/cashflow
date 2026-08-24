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
      role,
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

    // Create user with role and counsellor/crm fields
    const newUser = await User.create({
      name: `${firstName} ${lastName}`,
      email: cleanEmail,
      password: hashedPassword,
      role: role || "counsellor",
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
    delete (userObj as any).password;

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

import { getUserFromCookies } from "@/lib/helper";

// GET: Fetch users by role with live admission metrics calculation
export async function GET(request: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get("role");
    let brandParam = searchParams.get("brand") || searchParams.get("brandScope");

    // Default brandParam to logged in user's brandScope if not explicitly provided
    if (!brandParam && user && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All" && user.brandScope !== "*") {
      brandParam = user.brandScope;
    }

    const allStaffRoles = [
      "counsellor",
      "sales executive",
      "sales-executive",
      "sales advisor",
      "crm",
      "crm-executive",
      "crm-advisor",
      "crm advisor",
      "crm executive",
      "centre head",
      "center head",
      "centre-head",
      "center-head",
      "branch manager",
      "manager",
      "brand manager",
      "brand-manager"
    ];

    const roleQuery = roleParam === "crm"
      ? { $in: ["crm", "crm-executive", "crm-advisor", "crm advisor", "crm executive"] }
      : roleParam === "counsellor_only"
      ? { $in: ["counsellor"] }
      : { $in: allStaffRoles };

    const query: any = { role: roleQuery };

    if (brandParam && brandParam !== "All Brands" && brandParam !== "All" && brandParam !== "global") {
      const escapeRegExp = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const brandRegex = new RegExp(`(^|[,\\/|\\s])${escapeRegExp(brandParam.trim())}($|[,\\/|\\s])`, 'i');
      query.$or = [
        { brandScope: { $regex: brandRegex } },
        { brandScope: { $in: ["All", "All Brands", "global", "*"] } }
      ];
    }

    const counsellors = await User.find(query).select("-password").sort({ createdAt: -1 });
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
        if (low === "unassigned" || low === "n/a" || low === "counsellor" || low === "staff" || low === "cadd mantra" || low === "design gateway") return false;
        if (low === cName || low === cEmail || low === cId) return true;

        if (cName) {
          const dbTokens = low.split(/\s+/).filter((t: string) => t.length > 1);
          const cTokens = cName.split(/\s+/).filter((t: string) => t.length > 1);
          if (cTokens.length > 0 && dbTokens.length > 0) {
            if (cTokens.every((ct: string) => dbTokens.includes(ct)) || dbTokens.every((dt: string) => cTokens.includes(dt))) {
              return true;
            }
          }
        }
        return false;
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

    const devRoles = [
      "software developer",
      "software_developer",
      "developer",
      "software engineer",
      "tech lead",
    ];

    const filteredCounsellors = counsellorsWithLiveStats.filter((c: any) => {
      const r = (c.role || "").toLowerCase().trim();
      return !devRoles.some((devRole) => r === devRole || r.includes("developer") || r.includes("engineer"));
    });

    return NextResponse.json({ success: true, counsellors: filteredCounsellors });
  } catch (error: any) {
    console.error("Counsellor Fetch API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch counsellors" },
      { status: 500 }
    );
  }
}
