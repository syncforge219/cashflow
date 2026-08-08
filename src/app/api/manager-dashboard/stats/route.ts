import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import User from "@/models/User";
import Company from "@/models/Company";
import { getUserFromCookies } from "@/lib/helper";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const currentUser = await getUserFromCookies();
    
    const { searchParams } = new URL(req.url);
    let selectedBrand = searchParams.get("brand");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    let targetStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let targetEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let startStr = todayStr;
    let endStr = todayStr;

    let isFiltered = false;
    if (startDateParam && endDateParam) {
      targetStart = new Date(startDateParam);
      targetStart.setHours(0, 0, 0, 0);
      targetEnd = new Date(endDateParam);
      targetEnd.setHours(23, 59, 59, 999);
      startStr = startDateParam;
      endStr = endDateParam;
      isFiltered = true;
    }

    const dateRangeFilter = { $gte: targetStart, $lte: targetEnd };
    const stringDateFilter = { $gte: startStr, $lte: endStr };

    // Get list of all available brands
    const companyBrands = await Company.distinct("brand");
    const enquiryBrands = await Enquiry.distinct("targetBrand");
    const admissionBrands = await Admission.distinct("brand");
    const brandSet = new Set<string>();
    [...companyBrands, ...enquiryBrands, ...admissionBrands].forEach((b) => {
      if (b && typeof b === "string" && b.trim()) {
        brandSet.add(b.trim());
      }
    });
    let availableBrands = Array.from(brandSet);

    let allowedBrands: string[] | null = null;
    if (currentUser?.brandScope && currentUser.brandScope !== "All Brands" && currentUser.brandScope !== "All") {
      allowedBrands = currentUser.brandScope.split(",").map((b: string) => b.trim());
      availableBrands = availableBrands.filter((b: string) => 
        allowedBrands!.some((ab: string) => ab.toLowerCase() === b.toLowerCase())
      );
    }

    // Build filter queries
    const filterByBrand = selectedBrand && selectedBrand !== "all" && selectedBrand !== "All Brands";
    const enquiryQuery: any = {};
    const admissionQuery: any = {};
    const companyQuery: any = {};

    if (allowedBrands) {
      if (filterByBrand && allowedBrands.some(b => b.toLowerCase() === selectedBrand!.toLowerCase())) {
        enquiryQuery.targetBrand = { $regex: new RegExp(`^${selectedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
        admissionQuery.brand = { $regex: new RegExp(`^${selectedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
        companyQuery.brand = { $regex: new RegExp(`^${selectedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
      } else {
        const regexArray = allowedBrands.map(b => new RegExp(`^${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
        enquiryQuery.targetBrand = { $in: regexArray };
        admissionQuery.brand = { $in: regexArray };
        companyQuery.brand = { $in: regexArray };
      }
    } else if (filterByBrand) {
      enquiryQuery.targetBrand = { $regex: new RegExp(`^${selectedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
      admissionQuery.brand = { $regex: new RegExp(`^${selectedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
      companyQuery.brand = { $regex: new RegExp(`^${selectedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }

    if (isFiltered) {
      enquiryQuery.createdAt = dateRangeFilter;
      admissionQuery.$or = [
        { admissionDate: dateRangeFilter },
        { $and: [{ admissionDate: { $exists: false } }, { createdAt: dateRangeFilter }] },
        { $and: [{ admissionDate: null }, { createdAt: dateRangeFilter }] }
      ];
    }

    // 1. KPI Calculations
    const totalLeads = await Enquiry.countDocuments(enquiryQuery);
    const convertedLeads = await Enquiry.countDocuments({ ...enquiryQuery, $or: [{ isAdmitted: true }, { status: { $in: ["Admitted", "Admission", "Converted"] } }] });
    const newLeads = await Enquiry.countDocuments(
      isFiltered ? { ...enquiryQuery, status: "New" } : { ...enquiryQuery, status: "New", createdAt: dateRangeFilter }
    );

    // Follow-ups scheduled in date range
    const followUpsToday = await Enquiry.countDocuments({
      ...enquiryQuery,
      "followUps.date": stringDateFilter
    });

    const admissionsCount = await Admission.countDocuments(admissionQuery);

    // Revenue, Collection, Pending Fees calculations
    const admissionsList = await Admission.find(admissionQuery).lean();
    let totalRevenue = 0;
    let totalPendingFees = 0;

    admissionsList.forEach((adm: any) => {
      totalRevenue += Number(adm.finalFee || 0);
      totalPendingFees += Number(adm.remainingBalance || 0);
    });

    // Total collections from Payment model
    const paymentQuery: any = {};
    const effectiveBrands = filterByBrand ? [selectedBrand!] : allowedBrands;

    if (effectiveBrands && effectiveBrands.length > 0) {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regexArray = effectiveBrands.map((b) => new RegExp(`^${escapeRegExp(b.trim())}$`, "i"));
      const brandAdmissions = await Admission.find({ brand: { $in: regexArray } }).select("_id").lean();
      const brandAdmissionIds = brandAdmissions.map((a: any) => a._id);

      paymentQuery.$or = [
        { brand: { $in: regexArray } },
        { admissionId: { $in: brandAdmissionIds } }
      ];
    }

    if (isFiltered) {
      paymentQuery.createdAt = dateRangeFilter;
    }
    const paymentsList = await Payment.find(paymentQuery).lean();
    let totalCollection = 0;
    paymentsList.forEach((p: any) => {
      totalCollection += Number(p.amountReceived || 0);
    });

    // Calculate unlinked course upgrades
    let unlinkedUpgradesCount = 0;
    for (const adm of admissionsList) {
      const isUpg = (adm as any).isUpgrade || (await Admission.exists({
        mobileNumber: (adm as any).mobileNumber,
        _id: { $ne: (adm as any)._id },
        createdAt: { $lt: (adm as any).createdAt }
      }));
      if (isUpg) {
        const hasEnquiry = await Enquiry.exists({
          primaryPhoneMobile: (adm as any).mobileNumber,
          targetCourse: (adm as any).course
        });
        if (!hasEnquiry) {
          unlinkedUpgradesCount++;
        }
      }
    }

    const totalLeadsCalculated = Math.max(totalLeads + unlinkedUpgradesCount, admissionsCount);
    const totalConvertedCalculated = convertedLeads + unlinkedUpgradesCount;

    // 2. Lead Pipeline Breakdown
    const pipelineStages = [
      { stage: "New Lead", status: "New", color: "bg-[#2563eb]" },
      { stage: "Demo Attended", status: "Demo Attended", color: "bg-[#06b6d4]" },
      { stage: "Admitted", status: "Admitted", color: "bg-[#10b981]" }
    ];

    const pipeline = await Promise.all(
      pipelineStages.map(async (item) => {
        let count = 0;
        if (item.stage === "Admitted") {
          const admittedEnquiries = await Enquiry.countDocuments({
            ...enquiryQuery,
            $or: [{ status: "Admitted" }, { isAdmitted: true }]
          });
          count = Math.max(admittedEnquiries, admissionsCount);
        } else {
          count = await Enquiry.countDocuments({ ...enquiryQuery, status: item.status });
        }
        const pct = totalLeadsCalculated > 0 ? ((count / totalLeadsCalculated) * 100).toFixed(1) + "%" : "0%";
        return { label: item.stage, count, pct, color: item.color };
      })
    );

    // 3. Dynamic Trend Data based on date range
    const fourteenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const trendStart = isFiltered ? targetStart : fourteenDaysAgo;
    const trendEnd = targetEnd;

    const trendDays: { dateLabel: string; newLeads: number; admissions: number; lostLeads: number }[] = [];
    let curDate = new Date(trendStart);

    let dayCount = 0;
    while (curDate <= trendEnd && dayCount < 31) {
      dayCount++;
      const dayStart = new Date(curDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(curDate);
      dayEnd.setHours(23, 59, 59, 999);

      const yyyy = dayStart.getFullYear();
      const mm = String(dayStart.getMonth() + 1).padStart(2, "0");
      const dd = String(dayStart.getDate()).padStart(2, "0");
      const dayStr = `${yyyy}-${mm}-${dd}`;
      const dayLabel = `${dayStart.getDate()} ${dayStart.toLocaleString("en-US", { month: "short" })}`;

      const dayEnquiryQuery = { ...enquiryQuery };
      delete dayEnquiryQuery.createdAt;

      const dayAdmissionQuery = { ...admissionQuery };
      delete dayAdmissionQuery.createdAt;
      delete dayAdmissionQuery.$or;

      const [dayNewLeads, dayAdmissions, dayLostDoc] = await Promise.all([
        Enquiry.countDocuments({ ...dayEnquiryQuery, createdAt: { $gte: dayStart, $lte: dayEnd } }),
        Admission.countDocuments({
          ...dayAdmissionQuery,
          $or: [
            { admissionDate: { $gte: dayStart, $lte: dayEnd } },
            { $and: [{ admissionDate: { $exists: false } }, { createdAt: { $gte: dayStart, $lte: dayEnd } }] },
            { $and: [{ admissionDate: null }, { createdAt: { $gte: dayStart, $lte: dayEnd } }] }
          ]
        }),
        import("@/models/LostLeadCounter").then((m) => m.default.findOne({ date: dayStr }).lean())
      ]);

      trendDays.push({
        dateLabel: dayLabel,
        newLeads: dayNewLeads,
        admissions: dayAdmissions,
        lostLeads: dayLostDoc ? dayLostDoc.count : 0
      });

      curDate.setDate(curDate.getDate() + 1);
    }

    // 4. Top Counsellors Stats
    const counsellorFilter: any = { role: "counsellor" };
    if (filterByBrand) {
      const escapeRegExp = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const bRegex = new RegExp(`(^|[,\\/|\\s])${escapeRegExp(selectedBrand!)}($|[,\\/|\\s])`, 'i');
      counsellorFilter.$or = [
        { brandScope: { $regex: bRegex } },
        { brandScope: { $in: ["All", "All Brands", "global", "*"] } }
      ];
    } else if (allowedBrands && allowedBrands.length > 0) {
      const escapeRegExp = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const regexes = allowedBrands.map(b => new RegExp(`(^|[,\\/|\\s])${escapeRegExp(b)}($|[,\\/|\\s])`, 'i'));
      counsellorFilter.$or = [
        { brandScope: { $in: regexes } },
        { brandScope: { $in: ["All", "All Brands", "global", "*"] } }
      ];
    }
    const counsellors = await User.find(counsellorFilter).lean();
    const counsellorStats = await Promise.all(
      counsellors.map(async (c: any, index) => {
        const cName = c.name;
        const cAdmissions = admissionsList.filter((a: any) => 
          (a.counsellor || "").trim().toLowerCase() === (cName || "").trim().toLowerCase()
        );
        const admCount = cAdmissions.length;
        const revSum = cAdmissions.reduce((acc: number, cur: any) => acc + Number(cur.finalFee || 0), 0);
        
        const totalAssignedEnquiries = await Enquiry.countDocuments({
          ...enquiryQuery,
          assignedCrmAdvisor: cName
        });

        const convRate = totalAssignedEnquiries > 0 
          ? ((admCount / totalAssignedEnquiries) * 100).toFixed(1) + "%"
          : (admCount > 0 ? "100%" : "0%");

        const initials = cName ? cName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() : "C";

        return {
          rank: index + 1,
          id: c._id,
          name: cName,
          initials,
          adm: admCount,
          rev: `₹${(revSum / 100000).toFixed(2)} L`,
          conv: convRate,
          rawRev: revSum
        };
      })
    );

    counsellorStats.sort((a, b) => b.adm - a.adm || b.rawRev - a.rawRev);
    counsellorStats.forEach((c, idx) => { c.rank = idx + 1; });

    // 5. Enquiries by Source Breakdown
    const normalizeSource = (srcRaw?: string) => {
      if (!srcRaw || !srcRaw.trim()) return "Direct Walkin";
      const s = srcRaw.toLowerCase().trim();
      if (s.includes("google")) return "Google Ads";
      if (s.includes("meta") || s.includes("facebook") || s.includes("insta")) return "Meta Ads";
      if (s.includes("walkin") || s.includes("walk-in") || s.includes("walk in")) return "Direct Walkin";
      if (s.includes("whatsapp")) return "WhatsApp";
      if (s.includes("telephonic") || s.includes("call") || s.includes("phone")) return "Call / Telephonic";
      if (s.includes("website") || s.includes("site") || s.includes("online")) return "Website";
      if (s.includes("seminar")) return "Seminar";
      if (s.includes("hoarding") || s.includes("banner")) return "Hoarding";
      if (s.includes("reference") || s.includes("referral")) return "Reference";
      if (s.includes("email")) return "Email";
      if (s.includes("paper")) return "Paper Ads";
      if (s.includes("campus")) return "Campus Visit";
      return srcRaw.trim();
    };

    const sourceColorMap: Record<string, { color: string; hex: string }> = {
      "Google Ads": { color: "bg-indigo-500", hex: "#6366f1" },
      "Meta Ads": { color: "bg-blue-500", hex: "#3b82f6" },
      "Direct Walkin": { color: "bg-emerald-500", hex: "#10b981" },
      "WhatsApp": { color: "bg-emerald-600", hex: "#059669" },
      "Call / Telephonic": { color: "bg-purple-500", hex: "#8b5cf6" },
      "Website": { color: "bg-amber-500", hex: "#f59e0b" },
      "Seminar": { color: "bg-rose-500", hex: "#f43f5e" },
      "Hoarding": { color: "bg-cyan-500", hex: "#06b6d4" },
      "Reference": { color: "bg-violet-600", hex: "#7c3aed" },
      "Email": { color: "bg-teal-500", hex: "#14b8a6" },
      "Paper Ads": { color: "bg-pink-500", hex: "#ec4899" },
      "Campus Visit": { color: "bg-fuchsia-500", hex: "#d946ef" },
      "Others": { color: "bg-sky-600", hex: "#0284c7" },
    };

    const rawEnquiries = await Enquiry.find(enquiryQuery).select("leadSource").lean();
    const sourceCountsMap: Record<string, number> = {};

    rawEnquiries.forEach((e: any) => {
      const norm = normalizeSource(e.leadSource);
      sourceCountsMap[norm] = (sourceCountsMap[norm] || 0) + 1;
    });

    const totalCounted = rawEnquiries.length;
    let enquiriesBySource = Object.entries(sourceCountsMap)
      .map(([label, count]) => {
        const pctNum = totalCounted > 0 ? (count / totalCounted) * 100 : 0;
        const colorInfo = sourceColorMap[label] || { color: "bg-sky-500", hex: "#0ea5e9" };
        return {
          label,
          count,
          pct: `${pctNum.toFixed(1)}%`,
          pctNum,
          color: colorInfo.color,
          hex: colorInfo.hex,
        };
      })
      .sort((a, b) => b.count - a.count);

    if (enquiriesBySource.length === 0) {
      enquiriesBySource = [
        {
          label: "Direct Walkin",
          count: 0,
          pct: "0.0%",
          pctNum: 0,
          color: "bg-emerald-500",
          hex: "#10b981",
        },
      ];
    }

    // 6. Follow-ups List in date range
    const todayEnquiries = await Enquiry.find({
      ...enquiryQuery,
      "followUps.date": stringDateFilter
    }).limit(5).lean();

    const todayFollowupsList = todayEnquiries.map((e: any) => {
      const todayFollowup = e.followUps?.find((f: any) => f.date >= startStr && f.date <= endStr);
      return {
        id: e._id,
        name: e.studentFullName,
        initials: e.studentFullName ? e.studentFullName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase() : "S",
        time: todayFollowup?.time || todayFollowup?.date || "Scheduled",
        action: todayFollowup?.typeOfContact || "Follow-up",
        phone: e.primaryPhoneMobile
      };
    });

    // 7. Recent System Activity
    const recentAdmissions = await Admission.find(admissionQuery).sort({ createdAt: -1 }).limit(3).lean();
    const recentEnquiries = await Enquiry.find(enquiryQuery).sort({ createdAt: -1 }).limit(3).lean();

    const recentActivity: { text: string; time: string; color: string }[] = [];

    recentAdmissions.forEach((a: any) => {
      recentActivity.push({
        text: `New admission: ${a.fullName} (${a.course || "Course"})`,
        time: new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        color: "text-indigo-500 bg-indigo-50"
      });
    });

    recentEnquiries.forEach((e: any) => {
      recentActivity.push({
        text: `New lead from ${e.leadSource || "direct"}: ${e.studentFullName}`,
        time: new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        color: "text-emerald-500 bg-emerald-50"
      });
    });

    const rawConv = totalLeadsCalculated > 0 ? (totalConvertedCalculated / totalLeadsCalculated) * 100 : 0;
    const conversionRateStr = Math.min(100, Math.max(0, Number(rawConv.toFixed(1)))).toFixed(1) + "%";

    return NextResponse.json({
      success: true,
      data: {
        selectedBrand: selectedBrand || "All Brands",
        availableBrands,
        kpis: {
          totalLeads: totalLeadsCalculated,
          newLeads,
          followUpsToday,
          admissions: admissionsCount,
          conversionRate: conversionRateStr,
          revenue: `₹${(totalRevenue / 100000).toFixed(2)} L`,
          collection: `₹${(totalCollection / 100000).toFixed(2)} L`,
          pendingFees: `₹${(totalPendingFees / 100000).toFixed(2)} L`,
        },
        pipeline,
        trendDays,
        topCounsellors: counsellorStats.slice(0, 5),
        enquiriesBySource,
        todayFollowups: todayFollowupsList,
        recentActivity: recentActivity.slice(0, 5)
      }
    });
  } catch (error: any) {
    console.error("Error in manager-dashboard stats:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to load stats" }, { status: 500 });
  }
}
