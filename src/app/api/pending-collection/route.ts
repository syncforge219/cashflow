import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Enquiry from "@/models/Enquiry";
import Task from "@/models/Task";
import Course from "@/models/Course";
import Batch from "@/models/Batch";
import User from "@/models/User";
import Brand from "@/models/Brand";
import { getUserFromCookies } from "@/lib/helper";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
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

    // Query all admissions with remaining balance > 0
    const query: any = { remainingBalance: { $gt: 0 } };

    // Brand Scoping for Logged-In User
    const userRole = (user.role || (user as any).crmRole || (user as any).designation || "").toLowerCase().trim();
    const rawUserBrand = (user.brandScope || (user as any)?.brand || (user as any)?.targetBrand || "").trim();

    const isSuperOrAdmin =
      userRole === "admin" ||
      userRole === "super admin" ||
      userRole === "super_admin" ||
      userRole === "director" ||
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
      query.brand = { $regex: activeBrandRegex };
    } else {
      if (brandFilter && brandFilter !== "All Brands" && brandFilter !== "all") {
        activeBrandRegex = new RegExp(`^${escapeRegExp(brandFilter.trim())}$`, "i");
        query.brand = { $regex: activeBrandRegex };
      }
    }

    if (courseFilter && courseFilter !== "All Courses" && courseFilter !== "all") {
      query.course = { $regex: new RegExp(`^${escapeRegExp(courseFilter.trim())}$`, "i") };
    }
    if (batchFilter && batchFilter !== "All Batches" && batchFilter !== "all") {
      query.batch = batchFilter.trim();
    }
    if (counsellorFilter && counsellorFilter !== "All Counsellors" && counsellorFilter !== "all") {
      query.counsellor = { $regex: new RegExp(`^${escapeRegExp(counsellorFilter.trim())}$`, "i") };
    }
    if (companyFilter && companyFilter !== "All Companies" && companyFilter !== "all") {
      query.companyAssigned = companyFilter.trim();
    }

    const admissions = await Admission.find(query).lean();
    const admissionIds = admissions.map((a: any) => a._id);

    // Fetch payments to find last payment date
    const payments = await Payment.find({ admissionId: { $in: admissionIds } })
      .sort({ createdAt: -1 })
      .lean();

    const paymentMap = new Map<string, any>();
    payments.forEach((p: any) => {
      const key = p.admissionId.toString();
      if (!paymentMap.has(key)) {
        paymentMap.set(key, p);
      }
    });

    // Fetch last follow-up tasks
    const tasks = await Task.find({
      linkedStudentId: { $in: admissionIds },
      taskType: { $in: ["Fee Follow-up", "Follow-up", "Lead Call"] }
    })
      .sort({ createdAt: -1 })
      .lean();

    const taskMap = new Map<string, any>();
    tasks.forEach((t: any) => {
      if (t.linkedStudentId) {
        const key = t.linkedStudentId.toString();
        if (!taskMap.has(key)) {
          taskMap.set(key, t);
        }
      }
    });

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Aging Bucket Counters
    const buckets = {
      dueToday: { amount: 0, count: 0, label: "Due Today" },
      next7Days: { amount: 0, count: 0, label: "Next 7 Days" },
      next15Days: { amount: 0, count: 0, label: "Next 15 Days" },
      next30Days: { amount: 0, count: 0, label: "Next 30 Days" },
      overdue31to60: { amount: 0, count: 0, label: "31–60 Days Overdue" },
      overdue61to90: { amount: 0, count: 0, label: "61–90 Days Overdue" },
      overdue90Plus: { amount: 0, count: 0, label: "90+ Days Overdue" },
      overdueTotal: { amount: 0, count: 0, label: "Total Overdue" },
      totalPending: { amount: 0, count: 0, label: "Total Pending" }
    };

    const records: any[] = [];

    admissions.forEach((adm: any) => {
      const admIdStr = adm._id.toString();
      const lastPayment = paymentMap.get(admIdStr);
      const lastTask = taskMap.get(admIdStr);

      // Determine next due date and pending amount by reconciling customEmiPlan with total paid amount
      let dueDate: Date | null = null;
      let pendingAmount = Number(adm.remainingBalance) || 0;
      const totalFee = Number(adm.finalFee || adm.totalFee || 0);
      const paidAmount = Math.max(0, totalFee - pendingAmount);

      if (adm.customEmiPlan && Array.isArray(adm.customEmiPlan) && adm.customEmiPlan.length > 0) {
        // Sort installments by due date ascending
        const sortedPlan = [...adm.customEmiPlan].sort(
          (a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        );

        let creditRemaining = paidAmount;
        const unpaidInstallments: any[] = [];

        for (const item of sortedPlan) {
          const itemAmt = Number(item.amount) || 0;
          if (item.isPaid || creditRemaining >= itemAmt) {
            creditRemaining = Math.max(0, creditRemaining - itemAmt);
          } else {
            unpaidInstallments.push({
              ...item,
              effectiveDueAmount: Math.max(0, itemAmt - creditRemaining)
            });
            creditRemaining = 0;
          }
        }

        if (unpaidInstallments.length > 0) {
          dueDate = new Date(unpaidInstallments[0].dueDate);
          pendingAmount = unpaidInstallments[0].effectiveDueAmount || unpaidInstallments[0].amount || pendingAmount;
        }
      }

      if (!dueDate) {
        dueDate = adm.downpaymentDueDate
          ? new Date(adm.downpaymentDueDate)
          : adm.admissionDate
          ? new Date(adm.admissionDate)
          : adm.createdAt
          ? new Date(adm.createdAt)
          : now;
      }

      // Calculate days difference
      const dueDateZero = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffTime = dueDateZero.getTime() - nowZero.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // negative = overdue, 0 = today, positive = future

      let categoryKey = "next30Days";
      let statusLabel = "Upcoming";

      if (diffDays < 0) {
        const daysOverdue = Math.abs(diffDays);
        statusLabel = `${daysOverdue} Days Overdue`;
        buckets.overdueTotal.amount += pendingAmount;
        buckets.overdueTotal.count += 1;

        if (daysOverdue <= 30) {
          categoryKey = "overdue31to60"; // Overdue up to 30 days
        } else if (daysOverdue <= 60) {
          categoryKey = "overdue31to60";
          buckets.overdue31to60.amount += pendingAmount;
          buckets.overdue31to60.count += 1;
        } else if (daysOverdue <= 90) {
          categoryKey = "overdue61to90";
          buckets.overdue61to90.amount += pendingAmount;
          buckets.overdue61to90.count += 1;
        } else {
          categoryKey = "overdue90Plus";
          buckets.overdue90Plus.amount += pendingAmount;
          buckets.overdue90Plus.count += 1;
        }
      } else if (diffDays === 0) {
        categoryKey = "dueToday";
        statusLabel = "Due Today";
        buckets.dueToday.amount += pendingAmount;
        buckets.dueToday.count += 1;
      } else if (diffDays <= 7) {
        categoryKey = "next7Days";
        statusLabel = `Due in ${diffDays} Days`;
        buckets.next7Days.amount += pendingAmount;
        buckets.next7Days.count += 1;
      } else if (diffDays <= 15) {
        categoryKey = "next15Days";
        statusLabel = `Due in ${diffDays} Days`;
        buckets.next15Days.amount += pendingAmount;
        buckets.next15Days.count += 1;
      } else {
        categoryKey = "next30Days";
        statusLabel = `Due in ${diffDays} Days`;
        buckets.next30Days.amount += pendingAmount;
        buckets.next30Days.count += 1;
      }

      buckets.totalPending.amount += adm.remainingBalance || 0;
      buckets.totalPending.count += 1;

      // Filter by bucket if specified
      if (bucketFilter && bucketFilter !== "all" && bucketFilter !== categoryKey && bucketFilter !== "all_overdue" && bucketFilter !== "totalPending") {
        if (bucketFilter === "overdue" && diffDays >= 0) return;
      }

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
        agreedFee: adm.finalFee || adm.courseFee || 0,
        remainingBalance: adm.remainingBalance || 0,
        pendingInstallmentAmount: pendingAmount,
        dueDate: dueDate.toISOString(),
        diffDays,
        statusLabel,
        categoryKey,
        lastPaymentDate: lastPayment ? lastPayment.paymentDate || lastPayment.createdAt : null,
        lastPaymentAmount: lastPayment ? lastPayment.amountReceived : 0,
        lastFollowupDate: lastTask ? lastTask.createdAt : null,
        lastFollowupNotes: lastTask ? lastTask.notes || lastTask.remarks : null,
        hasEmi: adm.hasEmi || false,
        numInstallments: adm.numInstallments || 1
      };

      if (searchQuery) {
        const matchName = rec.studentName.toLowerCase().includes(searchQuery);
        const matchId = rec.admissionId.toLowerCase().includes(searchQuery);
        const matchMobile = rec.mobileNumber.includes(searchQuery);
        const matchCourse = rec.course.toLowerCase().includes(searchQuery);
        const matchCounsellor = rec.counsellor.toLowerCase().includes(searchQuery);
        if (!matchName && !matchId && !matchMobile && !matchCourse && !matchCounsellor) return;
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
