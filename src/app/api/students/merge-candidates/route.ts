import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { getUserFromCookies } from "@/lib/auth";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import StudentMergeIgnore from "@/models/StudentMergeIgnore";
import { normalizePhone } from "@/lib/studentHelper";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const role = (user.role || "").toLowerCase().trim();
    const isAdmin = role === "admin" || role === "super admin" || role === "super_admin";
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden: Admin access required" }, { status: 403 });
    }

    // 1. Load active merge ignores
    const ignores = await StudentMergeIgnore.find({}).lean();
    const ignoreSet = new Set<string>();
    for (const ign of ignores) {
      ignoreSet.add(`${ign.recordIdA}::${ign.recordIdB}`);
      ignoreSet.add(`${ign.recordIdB}::${ign.recordIdA}`);
    }

    // 2. Fetch all non-deleted Enquiries and Admissions
    const enquiries = await Enquiry.find({ isDeleted: { $ne: true } })
      .select("_id enquiryId studentId studentFullName primaryPhoneMobile alternatePhoneMobile emailAddress parentsFullName parentsPhoneNumber currentCity targetCourses targetBrand createdAt")
      .lean();

    const admissions = await Admission.find({ isDeleted: { $ne: true } })
      .select("_id admissionId enquiryId studentId fullName mobileNumber email parentName parentPhone guardian2Name guardian2Phone city courses brand admissionDate createdAt")
      .lean();

    // Map of normalized phone -> list of records
    const phoneMap = new Map<string, any[]>();
    const emailMap = new Map<string, any[]>();

    // Index admissions
    for (const adm of admissions) {
      const p = normalizePhone(adm.mobileNumber);
      const e = (adm.email || "").toLowerCase().trim();
      const item = {
        type: "Admission",
        id: adm._id.toString(),
        businessId: adm.admissionId || "N/A",
        enquiryId: adm.enquiryId ? adm.enquiryId.toString() : null,
        studentId: adm.studentId ? adm.studentId.toString() : null,
        fullName: adm.fullName || "",
        primaryPhone: p,
        email: e,
        parentName: adm.parentName || "",
        parentPhone: normalizePhone(adm.parentPhone),
        guardian2Name: adm.guardian2Name || "",
        guardian2Phone: normalizePhone(adm.guardian2Phone),
        city: adm.city || "",
        courses: adm.courses || [],
        brand: adm.brand || "",
        date: adm.admissionDate || adm.createdAt,
      };

      if (p && p.length === 10) {
        if (!phoneMap.has(p)) phoneMap.set(p, []);
        phoneMap.get(p)!.push(item);
      }
      if (e && e.includes("@")) {
        if (!emailMap.has(e)) emailMap.set(e, []);
        emailMap.get(e)!.push(item);
      }
    }

    // Index enquiries
    for (const enq of enquiries) {
      const p = normalizePhone(enq.primaryPhoneMobile);
      const e = (enq.emailAddress || "").toLowerCase().trim();
      const item = {
        type: "Enquiry",
        id: enq._id.toString(),
        businessId: enq.enquiryId || "N/A",
        enquiryId: null,
        studentId: enq.studentId ? enq.studentId.toString() : null,
        fullName: enq.studentFullName || "",
        primaryPhone: p,
        email: e,
        parentName: enq.parentsFullName || "",
        parentPhone: normalizePhone(enq.parentsPhoneNumber),
        guardian2Name: "",
        guardian2Phone: "",
        city: enq.currentCity || "",
        courses: enq.targetCourses || [],
        brand: enq.targetBrand || "",
        date: enq.createdAt,
      };

      if (p && p.length === 10) {
        if (!phoneMap.has(p)) phoneMap.set(p, []);
        phoneMap.get(p)!.push(item);
      }
      if (e && e.includes("@")) {
        if (!emailMap.has(e)) emailMap.set(e, []);
        emailMap.get(e)!.push(item);
      }
    }

    // Identify candidate clusters for human review (Rule C: phone or email collision without explicit link)
    const reviewClusters: any[] = [];
    const seenClusterKeys = new Set<string>();

    for (const [phone, records] of phoneMap.entries()) {
      if (records.length <= 1) continue;

      // Check if all records are already linked to the exact same studentId
      const studentIds = new Set(records.map(r => r.studentId).filter(Boolean));
      if (studentIds.size === 1 && records.every(r => r.studentId)) {
        continue; // Already merged to same student
      }

      // Check if this is an explicit Admission.enquiryId pair (Rule A)
      if (records.length === 2) {
        const adm = records.find(r => r.type === "Admission");
        const enq = records.find(r => r.type === "Enquiry");
        if (adm && enq && adm.enquiryId === enq.id) {
          continue; // Rule A: handled automatically by backfill
        }
      }

      // Check if all pairs are in ignore set
      const unignored = records.filter((recA, idx) => {
        return records.some((recB, jdx) => {
          if (idx === jdx) return false;
          return !ignoreSet.has(`${recA.id}::${recB.id}`);
        });
      });

      if (unignored.length <= 1) continue;

      const clusterKey = `phone:${phone}`;
      if (seenClusterKeys.has(clusterKey)) continue;
      seenClusterKeys.add(clusterKey);

      // Analyze name discrepancies
      const distinctNames = Array.from(new Set(records.map(r => r.fullName.trim().toLowerCase())));
      const hasDiscrepancy = distinctNames.length > 1;

      reviewClusters.push({
        clusterId: clusterKey,
        matchField: "phone",
        matchValue: phone,
        hasDiscrepancy,
        discrepancyNote: hasDiscrepancy ? "Distinct names detected. Could be siblings or family shared phone." : "Exact name match across records.",
        records,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalClusters: reviewClusters.length,
        clusters: reviewClusters,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/students/merge-candidates:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
