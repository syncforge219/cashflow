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
    const cleanQ = trimmedQ.replace(/[\s-]/g, "");

    const safeQ = escapeRegex(trimmedQ);
    const safeCleanQ = escapeRegex(cleanQ);

    const regex = new RegExp(safeQ, "i");
    const cleanRegex = new RegExp(safeCleanQ, "i");
    const mobileSlice = cleanQ.length > 5 ? escapeRegex(cleanQ.slice(-10)) : safeCleanQ;

    // 1. Search in Admission records (Student Name & Student Mobile only)
    const admissionSearchQuery: any = {
      $or: [
        { fullName: regex },
        { mobileNumber: cleanRegex },
        { mobileNumber: { $regex: mobileSlice, $options: "i" } },
      ],
    };
    if (brandMatchCondition) {
      admissionSearchQuery.$and = [brandMatchCondition];
    }

    const admissions = await Admission.find(admissionSearchQuery).sort({ createdAt: -1 }).limit(50);

    const formattedAdmissions = (admissions || []).map((admission: any) => ({
      ...admission.toObject(),
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

    // 2. Search in Enquiry records (Active Prospects only - Student Name & Student Mobile only)
    const enquirySearchQuery: any = {
      isAdmitted: { $ne: true },
      status: { $nin: ["Admitted", "Closed", "Lost", "Converted", "Admission"] },
      $or: [
        { studentFullName: regex },
        { primaryPhoneMobile: cleanRegex },
        { primaryPhoneMobile: { $regex: mobileSlice, $options: "i" } },
      ],
    };
    if (brandMatchCondition) {
      enquirySearchQuery.$and = [brandMatchCondition];
    }

    const enquiries = await Enquiry.find(enquirySearchQuery).sort({ createdAt: -1 }).limit(50);

    const formattedEnquiries = (enquiries || []).map((enquiry: any) => {
      let lastFollowUp = null;
      let nextFollowUp = null;

      if (enquiry.followUps && Array.isArray(enquiry.followUps) && enquiry.followUps.length > 0) {
        const sortedFollowUps = [...enquiry.followUps].sort((a: any, b: any) => {
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
        ...enquiry.toObject(),
        lastFollowUp: lastFollowUp ? `${lastFollowUp.date} at ${lastFollowUp.time}` : "None",
        nextFollowUp: nextFollowUp ? `${nextFollowUp.date} at ${nextFollowUp.time}` : "None",
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
