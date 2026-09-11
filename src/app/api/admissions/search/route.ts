import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import { getUserFromCookies } from "@/lib/helper";

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || searchParams.get("mobile");
    const paramBrand = searchParams.get("brand");

    if (!q || !q.trim()) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    let allowedBrands: string[] | null = null;
    if (isBrandRestricted) {
      allowedBrands = userBrand.split(/[,/|]/).map((b: string) => b.trim()).filter(Boolean);
    }

    let brandMatchCondition: any = null;
    if (allowedBrands && allowedBrands.length > 0) {
      if (paramBrand && paramBrand !== "all" && paramBrand !== "All" && paramBrand !== "All Brands" && allowedBrands.some(b => b.toLowerCase() === paramBrand.trim().toLowerCase())) {
        const brandRegex = new RegExp(`^${escapeRegex(paramBrand.trim())}$`, "i");
        brandMatchCondition = { $or: [{ brand: brandRegex }, { targetBrand: brandRegex }] };
      } else {
        const regexArray = allowedBrands.map(b => new RegExp(`^${escapeRegex(b)}$`, "i"));
        brandMatchCondition = { $or: [{ brand: { $in: regexArray } }, { targetBrand: { $in: regexArray } }] };
      }
    } else if (paramBrand && paramBrand !== "all" && paramBrand !== "All" && paramBrand !== "All Brands") {
      const brandRegex = new RegExp(`^${escapeRegex(paramBrand.trim())}$`, "i");
      brandMatchCondition = { $or: [{ brand: brandRegex }, { targetBrand: brandRegex }] };
    }

    const trimmedQ = q.trim();
    const cleanDigits = trimmedQ.replace(/\D/g, "");

    if (!cleanDigits || cleanDigits.length < 5) {
      return NextResponse.json(
        { error: "Please enter a valid phone number (at least 5 digits)." },
        { status: 400 }
      );
    }

    // Match on last 10 digits if more were provided (e.g. +91 prefix), or the full digits entered
    const searchSlice = cleanDigits.length > 10 ? cleanDigits.slice(-10) : cleanDigits;
    const phoneRegex = new RegExp(`${escapeRegex(searchSlice)}$`);

    // 1. Search in Admission records by mobile number only (using indexed mobileNumber field)
    const admissionSearchQuery: any = {
      mobileNumber: phoneRegex,
    };
    if (brandMatchCondition) {
      admissionSearchQuery.$and = [brandMatchCondition];
    }

    const admissions = await Admission.find(admissionSearchQuery)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const formattedAdmissions = (admissions || []).map((admission: any) => ({
      ...admission,
      studentName: admission.fullName,
      admissionNumber: admission.admissionId,
      feeStatus: Number(admission.remainingBalance) === 0 ? "Paid In Full" : "Pending Balance",
      outstandingAmount: admission.remainingBalance,
      admissionDate: new Date(admission.admissionDate || admission.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    }));

    // 2. Search in Enquiry records by phone number only (Active Prospects only)
    const enquirySearchQuery: any = {
      isAdmitted: { $ne: true },
      status: { $nin: ["Admitted", "Closed", "Lost", "Converted", "Admission"] },
      primaryPhoneMobile: phoneRegex,
    };
    if (brandMatchCondition) {
      enquirySearchQuery.$and = [brandMatchCondition];
    }

    const enquiries = await Enquiry.find(enquirySearchQuery)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // 3. Consolidate & Group Enquiries by Phone Number
    // Multiple enquiries with the same phone number for different courses are counted as ONE enquiry
    const groupedEnquiriesMap = new Map<string, any>();

    for (const enquiry of enquiries) {
      const rawPhone = enquiry.primaryPhoneMobile || "";
      const phoneKey = rawPhone.replace(/\D/g, "").slice(-10) || rawPhone.trim();

      if (!groupedEnquiriesMap.has(phoneKey)) {
        const courseSet = new Set<string>();
        if (enquiry.targetCourse) {
          enquiry.targetCourse.split(",").map((c: string) => c.trim()).filter(Boolean).forEach((c: string) => courseSet.add(c));
        }
        if (Array.isArray(enquiry.courses)) {
          enquiry.courses.forEach((c: any) => c && courseSet.add(String(c).trim()));
        }
        if (Array.isArray(enquiry.targetCourses)) {
          enquiry.targetCourses.forEach((c: any) => c && courseSet.add(String(c).trim()));
        }

        groupedEnquiriesMap.set(phoneKey, {
          ...enquiry,
          enquiryIds: [enquiry.enquiryId].filter(Boolean),
          allCoursesSet: courseSet,
          allFollowUps: Array.isArray(enquiry.followUps) ? [...enquiry.followUps] : [],
          allEnquiries: [enquiry],
        });
      } else {
        const existing = groupedEnquiriesMap.get(phoneKey);
        // Merge courses from another enquiry with same phone number
        if (enquiry.targetCourse) {
          enquiry.targetCourse.split(",").map((c: string) => c.trim()).filter(Boolean).forEach((c: string) => existing.allCoursesSet.add(c));
        }
        if (Array.isArray(enquiry.courses)) {
          enquiry.courses.forEach((c: any) => c && existing.allCoursesSet.add(String(c).trim()));
        }
        if (Array.isArray(enquiry.targetCourses)) {
          enquiry.targetCourses.forEach((c: any) => c && existing.allCoursesSet.add(String(c).trim()));
        }

        if (enquiry.enquiryId && !existing.enquiryIds.includes(enquiry.enquiryId)) {
          existing.enquiryIds.push(enquiry.enquiryId);
        }

        if (Array.isArray(enquiry.followUps)) {
          existing.allFollowUps.push(...enquiry.followUps);
        }

        existing.allEnquiries.push(enquiry);
      }
    }

    const formattedEnquiries = Array.from(groupedEnquiriesMap.values()).map((grouped: any) => {
      const mergedCourses = Array.from(grouped.allCoursesSet).filter(Boolean);
      const displayCourse = mergedCourses.length > 0 ? mergedCourses.join(", ") : grouped.targetCourse || "General Course";

      let lastFollowUp = null;
      let nextFollowUp = null;

      if (grouped.allFollowUps && grouped.allFollowUps.length > 0) {
        const sortedFollowUps = [...grouped.allFollowUps].sort((a: any, b: any) => {
          const timeA = a.date && a.time ? new Date(`${a.date}T${a.time}`).getTime() : 0;
          const timeB = b.date && b.time ? new Date(`${b.date}T${b.time}`).getTime() : 0;
          return timeA - timeB;
        });

        const now = Date.now();
        const pastFollowUps = sortedFollowUps.filter((f: any) => {
          const t = f.date && f.time ? new Date(`${f.date}T${f.time}`).getTime() : 0;
          return t > 0 && t <= now;
        });
        const futureFollowUps = sortedFollowUps.filter((f: any) => {
          const t = f.date && f.time ? new Date(`${f.date}T${f.time}`).getTime() : 0;
          return t > now;
        });

        lastFollowUp = pastFollowUps.length > 0 ? pastFollowUps[pastFollowUps.length - 1] : null;
        nextFollowUp = futureFollowUps.length > 0 ? futureFollowUps[0] : null;
      }

      return {
        ...grouped,
        enquiryId: grouped.enquiryIds.join(", "),
        targetCourse: displayCourse,
        courses: mergedCourses,
        targetCourses: mergedCourses,
        followUps: grouped.allFollowUps,
        lastFollowUp: lastFollowUp ? `${lastFollowUp.date} at ${lastFollowUp.time}` : "None",
        nextFollowUp: nextFollowUp ? `${nextFollowUp.date} at ${nextFollowUp.time}` : "None",
        totalEnquiriesCombined: grouped.allEnquiries.length,
      };
    });

    const hasAdmissions = formattedAdmissions.length > 0;
    const hasEnquiries = formattedEnquiries.length > 0;

    let stage = "NOT_FOUND";
    if (hasAdmissions && hasEnquiries) {
      stage = "BOTH";
    } else if (hasAdmissions) {
      stage = "ADMISSION";
    } else if (hasEnquiries) {
      stage = "ENQUIRY";
    }

    return NextResponse.json({
      stage,
      admissions: formattedAdmissions,
      enquiries: formattedEnquiries,
      data: hasAdmissions ? formattedAdmissions : formattedEnquiries,
    });

  } catch (error: any) {
    console.error("Error searching admission database:", error);
    return NextResponse.json({ error: "Internal server error", message: error.message }, { status: 500 });
  }
}
