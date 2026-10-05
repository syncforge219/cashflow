import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Enquiry from "@/models/Enquiry";
import Task from "@/models/Task";
import Course from "@/models/Course";
import Batch from "@/models/Batch";
import User from "@/models/User";
import Brand from "@/models/Brand";
import Company from "@/models/Company";
import { getAuthenticatedUser } from "@/lib/auth";
import { studentBalanceLookupStages } from "@/lib/studentBalanceService";
import { buildFeeSchedule, agingOf, OVERDUE_BUCKETS } from "@/lib/feeSchedule";
import { todayKey, toDateKey } from "@/lib/dates";

/** "all"/"totalPending" show everything, "overdue" shows every overdue bucket, otherwise exact bucket. */
function matchesBucket(filter: string, categoryKey: string): boolean {
  if (filter === "all" || filter === "totalPending") return true;
  if (filter === "overdue" || filter === "overdueTotal") return OVERDUE_BUCKETS.includes(categoryKey as any);
  return filter === categoryKey;
}

export async function GET(req: Request) {
  try {
    await dbConnect();

    // 1. Authentication check
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Unauthenticated." },
        { status: 401 }
      );
    }

    // 2. Authorization & Role Validation
    const userRole = (user.role || (user as any).crmRole || (user as any).designation || "").toLowerCase().trim();

    // Block decommissioned or unauthorized roles
    if (userRole.includes("marketing")) {
      return NextResponse.json(
        { ok: false, message: "Forbidden." },
        { status: 403 }
      );
    }

    const allowedRoleKeywords = [
      "admin",
      "super admin",
      "super_admin",
      "director",
      "manager",
      "centre",
      "center",
      "head",
      "branch",
      "counsellor",
      "counselor",
      "sales",
      "crm",
      "cfo",
      "finance",
      "teacher",
      "faculty",
      "developer"
    ];

    const isAuthorizedRole = allowedRoleKeywords.some((keyword) => userRole.includes(keyword));
    if (!isAuthorizedRole) {
      return NextResponse.json(
        { ok: false, message: "Forbidden." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const brandFilter = searchParams.get("brand");
    const courseFilter = searchParams.get("course");
    const batchFilter = searchParams.get("batch");
    const counsellorFilter = searchParams.get("counsellor");
    const companyFilter = searchParams.get("company");
    const bucketFilter = searchParams.get("bucket");
    const searchQuery = searchParams.get("search")?.toLowerCase().trim();

    const escapeRegExp = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

    // Balance is computed from actual payments in the pipeline below (the stored field can be stale)
    const query: any = {};

    // Brand Scoping for Logged-In User
    const rawUserBrand = (user.brandScope || (user as any)?.brand || (user as any)?.targetBrand || "").trim();

    const isSuperOrAdmin =
      userRole === "admin" ||
      userRole === "super admin" ||
      userRole === "super_admin" ||
      userRole === "director" ||
      userRole.includes("cfo") ||
      userRole.includes("finance") ||
      (userRole.includes("admin") && !userRole.includes("centre") && !userRole.includes("center")) ||
      userRole.includes("director");

    const isBrandRestricted = Boolean(
      rawUserBrand &&
      !["all", "all brands", "all_brands", "global", "*"].includes(rawUserBrand.toLowerCase()) &&
      !isSuperOrAdmin
    );

    let activeBrandRegex: RegExp | null = null;
    let allowedBrandsList: string[] = [];

    if (isBrandRestricted) {
      const userBrands = rawUserBrand.split(/[,/|]/).map((b: string) => b.trim()).filter(Boolean);
      allowedBrandsList = userBrands;

      if (brandFilter && brandFilter !== "All Brands" && brandFilter !== "all") {
        const matched = userBrands.find((b: string) => b.toLowerCase() === brandFilter.toLowerCase());
        if (matched) {
          activeBrandRegex = new RegExp(`^${escapeRegExp(matched)}$`, "i");
        } else {
          activeBrandRegex = userBrands.length > 1
            ? new RegExp(`^(${userBrands.map(escapeRegExp).join("|")})$`, "i")
            : new RegExp(`^${escapeRegExp(userBrands[0] || rawUserBrand)}$`, "i");
        }
      } else {
        activeBrandRegex = userBrands.length > 1
          ? new RegExp(`^(${userBrands.map(escapeRegExp).join("|")})$`, "i")
          : new RegExp(`^${escapeRegExp(userBrands[0] || rawUserBrand)}$`, "i");
      }
    } else if (brandFilter && brandFilter !== "All Brands" && brandFilter !== "all") {
      activeBrandRegex = new RegExp(`^${escapeRegExp(brandFilter.trim())}$`, "i");
    }

    let brandCondition: any = null;
    if (activeBrandRegex) {
      const brandDocs = await Brand.find({
        $or: [{ name: { $regex: activeBrandRegex } }, { code: { $regex: activeBrandRegex } }]
      }).select("_id").lean();
      const brandIds = brandDocs.map(b => b._id);
      brandCondition = {
        $or: [
          ...(brandIds.length > 0 ? [{ brandId: { $in: brandIds } }] : []),
          { brand: { $regex: activeBrandRegex } }
        ]
      };
    }

    if (courseFilter && courseFilter !== "All Courses" && courseFilter !== "all") {
      query.course = { $regex: new RegExp(`^${escapeRegExp(courseFilter.trim())}$`, "i") };
    }
    if (batchFilter && batchFilter !== "All Batches" && batchFilter !== "all") {
      query.batch = batchFilter.trim();
    }

    let counsellorCondition: any = null;
    if (counsellorFilter && counsellorFilter !== "All Counsellors" && counsellorFilter !== "all") {
      const cReg = new RegExp(`^${escapeRegExp(counsellorFilter.trim())}$`, "i");
      const cUser = (mongoose.Types.ObjectId.isValid(counsellorFilter.trim())
        ? await User.findById(counsellorFilter.trim()).lean()
        : await User.findOne({ name: cReg }).lean()) as any;
      counsellorCondition = {
        $or: [
          ...(cUser ? [{ counsellorId: cUser._id }] : []),
          { counsellor: { $regex: cReg } }
        ]
      };
    }

    let companyCondition: any = null;
    if (companyFilter && companyFilter !== "All Companies" && companyFilter !== "all") {
      const compReg = new RegExp(`^${escapeRegExp(companyFilter.trim())}$`, "i");
      const compDoc = (mongoose.Types.ObjectId.isValid(companyFilter.trim())
        ? await Company.findById(companyFilter.trim()).lean()
        : await Company.findOne({ $or: [{ name: compReg }, { legalName: compReg }] }).lean()) as any;
      companyCondition = {
        $or: [
          ...(compDoc ? [{ companyId: compDoc._id }] : []),
          { companyAssigned: compReg }
        ]
      };
    }

    const andClauses: any[] = [];
    if (brandCondition) andClauses.push(brandCondition);
    if (counsellorCondition) andClauses.push(counsellorCondition);
    if (companyCondition) andClauses.push(companyCondition);
    if (andClauses.length > 0) {
      query.$and = andClauses;
    }

    const admissions = await Admission.aggregate([
      { $match: query },
      ...studentBalanceLookupStages(),
      { $match: { remainingBalance: { $gt: 0 } } },
    ]);
    const admissionIds = admissions.map((a: any) => a._id);

    // Latest payment per admission (by the date the money was received, not when it was keyed in)
    const payments = await Payment.find({ admissionId: { $in: admissionIds } })
      .select("admissionId paymentDate createdAt amountReceived")
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean();

    const paymentMap = new Map<string, any>();
    payments.forEach((p: any) => {
      const key = p.admissionId.toString();
      if (!paymentMap.has(key)) paymentMap.set(key, p);
    });

    // Latest follow-up task per admission
    const tasks = await Task.find({
      linkedStudentId: { $in: admissionIds.map((id: any) => id.toString()) },
      taskType: { $in: ["Fee Follow-up", "Fee Followup", "Follow-up", "EMI Recovery", "Fee Collection"] },
    })
      .select("linkedStudentId createdAt description title")
      .sort({ createdAt: -1 })
      .lean();

    const taskMap = new Map<string, any>();
    tasks.forEach((t: any) => {
      const key = String(t.linkedStudentId || "");
      if (key && !taskMap.has(key)) taskMap.set(key, t);
    });

    const today = todayKey();

    // Aging buckets. Overdue buckets hold the overdue amount; upcoming buckets hold the next instalment.
    const buckets: Record<string, { amount: number; count: number; label: string }> = {
      totalPending: { amount: 0, count: 0, label: "Total Pending" },
      overdueTotal: { amount: 0, count: 0, label: "Total Overdue" },
      overdue1to30: { amount: 0, count: 0, label: "1–30 Days Overdue" },
      overdue31to60: { amount: 0, count: 0, label: "31–60 Days Overdue" },
      overdue61to90: { amount: 0, count: 0, label: "61–90 Days Overdue" },
      overdue90Plus: { amount: 0, count: 0, label: "90+ Days Overdue" },
      dueToday: { amount: 0, count: 0, label: "Due Today" },
      next7Days: { amount: 0, count: 0, label: "Next 7 Days" },
      next15Days: { amount: 0, count: 0, label: "8–15 Days" },
      next30Days: { amount: 0, count: 0, label: "16–30 Days" },
      later: { amount: 0, count: 0, label: "After 30 Days" },
    };
    const add = (key: string, amount: number) => {
      buckets[key].amount = Math.round((buckets[key].amount + amount) * 100) / 100;
      buckets[key].count += 1;
    };

    const records: any[] = [];

    admissions.forEach((adm: any) => {
      const admIdStr = adm._id.toString();
      const lastPayment = paymentMap.get(admIdStr);
      const lastTask = taskMap.get(admIdStr);

      const schedule = buildFeeSchedule(
        adm,
        // Same fee and paid figures the balance pipeline used (paise -> rupees)
        { totalPaid: (Number(adm.paidAmountPaise) || 0) / 100, totalFee: (Number(adm.computedFinalFeePaise) || 0) / 100 },
        today
      );
      const next = schedule.nextDue;
      const aging = agingOf(schedule);
      if (!next || !aging) return; // nothing outstanding

      const { bucket: categoryKey, label: statusLabel, amount: amountForBucket, days: diffDays } = aging;
      if (diffDays < 0) add("overdueTotal", schedule.overdueAmount);

      add(categoryKey, amountForBucket);
      add("totalPending", schedule.outstanding);

      const rec = {
        _id: adm._id,
        admissionId: adm.admissionId || "ADM-N/A",
        studentName: adm.fullName || "Unknown",
        mobileNumber: adm.mobileNumber || "N/A",
        email: adm.email || "",
        brand: adm.brand || "CADD MANTRA",
        branch: adm.city || adm.branch || "Headquarters",
        course: adm.course || "General Course",
        batch: adm.batch || "General Batch",
        counsellor: adm.counsellor || "Staff",
        companyAssigned: adm.companyAssigned || adm.company || "N/A",
        agreedFee: schedule.totalFee,
        paidAmount: schedule.totalPaid,
        remainingBalance: schedule.outstanding,
        // What the student should pay now: everything overdue/due today, else the next instalment
        pendingInstallmentAmount: schedule.amountDueNow > 0 ? schedule.amountDueNow : next.dueAmount,
        overdueAmount: schedule.overdueAmount,
        nextInstallmentLabel: next.label,
        dueDate: next.dueDateKey, // IST calendar date "YYYY-MM-DD"
        diffDays,
        statusLabel,
        categoryKey,
        lastPaymentDate: lastPayment ? toDateKey(lastPayment.paymentDate || lastPayment.createdAt) : null,
        lastPaymentAmount: lastPayment ? lastPayment.amountReceived : 0,
        lastFollowupDate: lastTask ? toDateKey(lastTask.createdAt) : null,
        lastFollowupNotes: lastTask ? lastTask.description || lastTask.title || null : null,
        hasEmi: schedule.items.some((i) => i.kind === "EMI"),
        numInstallments: schedule.items.filter((i) => i.kind === "EMI").length || 1,
      };

      if (bucketFilter && !matchesBucket(bucketFilter, categoryKey)) return;

      if (searchQuery) {
        const haystack = [rec.studentName, rec.admissionId, rec.mobileNumber, rec.course, rec.counsellor]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchQuery)) return;
      }

      records.push(rec);
    });

    // Available filter lists scoped according to logged-in person's brand / active brand
    let availableBrands: string[] = [];
    if (isBrandRestricted) {
      availableBrands = allowedBrandsList.length > 0 ? allowedBrandsList : [rawUserBrand];
    } else {
      const brandDocs = await Brand.find({ status: { $ne: "INACTIVE" } }).select("name").lean();
      const admBrands = await Admission.distinct("brand");
      availableBrands = Array.from(new Set([...brandDocs.map((b: any) => b.name), ...admBrands].filter(Boolean))).sort();
    }

    // Determine query filter for courses, batches, counsellors, companies
    const brandFilterCondition = activeBrandRegex ? { brand: { $regex: activeBrandRegex } } : {};
    const admBrandCondition = activeBrandRegex
      ? { brand: { $regex: activeBrandRegex }, remainingBalance: { $gt: 0 } }
      : { remainingBalance: { $gt: 0 } };

    // 1. Available Courses
    const courseDocs = await Course.find({
      ...(activeBrandRegex ? { brand: { $regex: activeBrandRegex } } : {}),
      status: { $ne: "INACTIVE" }
    }).select("name").lean();
    const admCourses = await Admission.find(admBrandCondition).distinct("course");
    const admTargetCourses = await Admission.find(admBrandCondition).distinct("courses");
    const allCoursesList: string[] = [
      ...courseDocs.map((c: any) => c.name),
      ...admCourses,
      ...(Array.isArray(admTargetCourses) ? admTargetCourses.flat() : [])
    ]
      .filter(Boolean)
      .map((s: any) => String(s).trim())
      .filter((s: string) => s.length > 0);
    const availableCourses = Array.from(new Set(allCoursesList)).sort();

    // 2. Available Batches
    const batchDocs = await Batch.find(brandFilterCondition).select("batchName").lean();
    const admBatches = await Admission.find(admBrandCondition).distinct("batch");
    const allBatchesList: string[] = [
      ...batchDocs.map((b: any) => b.batchName),
      ...admBatches
    ]
      .filter(Boolean)
      .map((s: any) => String(s).trim())
      .filter((s: string) => s.length > 0);
    const availableBatches = Array.from(new Set(allBatchesList)).sort();

    // 3. Available Counsellors
    const counsellorRoles = [
      "counsellor",
      "counselor",
      "sales executive",
      "sales-executive",
      "crm",
      "crm-executive",
      "crm-advisor",
      "crm advisor",
      "crm executive"
    ];
    const counsellorUserQuery: any = { role: { $in: counsellorRoles } };
    if (activeBrandRegex) {
      counsellorUserQuery.$or = [
        { brandScope: { $regex: activeBrandRegex } },
        { brandScope: { $in: ["All", "All Brands", "ALL BRANDS", "global", "*", null, ""] } },
        { brandScope: { $exists: false } }
      ];
    }
    const counsellorDocs = await User.find(counsellorUserQuery).select("name").lean();
    const admCounsellors = await Admission.find(admBrandCondition).distinct("counsellor");
    const allCounsellorList: string[] = [
      ...counsellorDocs.map((u: any) => u.name),
      ...admCounsellors
    ]
      .filter(Boolean)
      .map((s: any) => String(s).trim())
      .filter((s: string) => s.length > 0);
    const availableCounsellors = Array.from(new Set(allCounsellorList)).sort();

    // 4. Available Companies
    const admCompanies1 = await Admission.find(admBrandCondition).distinct("companyAssigned");
    const admCompanies2 = await Admission.find(admBrandCondition).distinct("company");
    const allCompaniesList: string[] = [...admCompanies1, ...admCompanies2]
      .filter(Boolean)
      .map((s: any) => String(s).trim())
      .filter((s: string) => s.length > 0);
    const availableCompanies = Array.from(new Set(allCompaniesList)).sort();

    return NextResponse.json({
      ok: true,
      success: true,
      data: {
        buckets,
        records,
        filters: {
          availableBrands,
          availableCourses,
          availableBatches,
          availableCounsellors,
          availableCompanies
        }
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/pending-collection:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to load pending collections" }, { status: 500 });
  }
}
