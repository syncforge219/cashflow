import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Enquiry from "@/models/Enquiry";
import Task from "@/models/Task";
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

    // Query all admissions with remaining balance > 0
    const query: any = { remainingBalance: { $gt: 0 } };

    // Brand Scoping for Brand Manager / Centre Head / Counsellor
    const userRole = (user.role || (user as any).crmRole || (user as any).designation || "").toLowerCase().trim();
    const userBrandScope = (user.brandScope || "").toLowerCase().trim();
    const isCrmRole = userRole === "crm" || userRole === "crm executive" || userRole === "crm_executive" || userRole.includes("crm");

    if (
      userBrandScope &&
      userBrandScope !== "all" &&
      userBrandScope !== "all brands" &&
      userBrandScope !== "*" &&
      userRole !== "admin" &&
      userRole !== "super admin" &&
      userRole !== "super_admin" &&
      !isCrmRole
    ) {
      query.brand = { $regex: new RegExp(`^${userBrandScope.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") };
    }

    if (brandFilter && brandFilter !== "All Brands" && brandFilter !== "all") {
      query.brand = { $regex: new RegExp(`^${brandFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") };
    }
    if (courseFilter && courseFilter !== "All Courses" && courseFilter !== "all") {
      query.course = { $regex: new RegExp(courseFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i") };
    }
    if (batchFilter && batchFilter !== "All Batches" && batchFilter !== "all") {
      query.batch = batchFilter;
    }
    if (counsellorFilter && counsellorFilter !== "All Counsellors" && counsellorFilter !== "all") {
      query.counsellor = counsellorFilter;
    }
    if (companyFilter && companyFilter !== "All Companies" && companyFilter !== "all") {
      query.companyAssigned = companyFilter;
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

    // Available filter lists
    const allAdmissionsUnfiltered = await Admission.find({ remainingBalance: { $gt: 0 } }).lean();
    const availableBrands = Array.from(new Set(allAdmissionsUnfiltered.map((a: any) => a.brand).filter(Boolean)));
    const availableCourses = Array.from(new Set(allAdmissionsUnfiltered.map((a: any) => a.course).filter(Boolean)));
    const availableBatches = Array.from(new Set(allAdmissionsUnfiltered.map((a: any) => a.batch).filter(Boolean)));
    const availableCounsellors = Array.from(new Set(allAdmissionsUnfiltered.map((a: any) => a.counsellor).filter(Boolean)));
    const availableCompanies = Array.from(new Set(allAdmissionsUnfiltered.map((a: any) => a.companyAssigned || a.company).filter(Boolean)));

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
