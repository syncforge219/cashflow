import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Course from "@/models/Course";
import User from "@/models/User";
import Admission from "@/models/Admission";
import Batch from "@/models/Batch";
import Attendance from "@/models/Attendance";
import { getUserFromCookies } from "@/lib/helper";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const currentUser = await getUserFromCookies();

    // 1. Fetch raw data from MongoDB collections
    const [allCourses, allEnquiries, allAdmissions, allBatches, allAttendance] = await Promise.all([
      Course.find({}).lean(),
      Enquiry.find({}).sort({ createdAt: -1 }).lean(),
      Admission.find({}).lean(),
      Batch.find({}).lean(),
      Attendance.find({}).lean(),
    ]);

    // Assigned subjects & brand scope
    const assignedSubjects: string[] = Array.isArray(currentUser?.subjects)
      ? currentUser.subjects
      : Array.isArray(currentUser?.subject)
      ? currentUser.subject
      : typeof currentUser?.subject === "string"
      ? currentUser.subject.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];

    const userBrandScope = (currentUser?.brandScope || "").toLowerCase().trim();
    const teacherNameLower = (currentUser?.name || "").toLowerCase().trim();
    const teacherIdStr = currentUser?._id ? currentUser._id.toString() : "";

    // 2. Filter courses matching teacher's brand scope or assigned subjects
    const teacherCourses = allCourses.filter((c: any) => {
      const bMatches =
        !userBrandScope ||
        userBrandScope === "all" ||
        userBrandScope === "all brands" ||
        (c.brand || "").toLowerCase().trim() === userBrandScope;
      const sMatches =
        assignedSubjects.length === 0 ||
        assignedSubjects.some(
          (sub) =>
            (c.name || "").toLowerCase().includes(sub.toLowerCase()) ||
            (c.category || "").toLowerCase().includes(sub.toLowerCase())
        );
      return bMatches || sMatches;
    });

    // 3. Filter active batches assigned to this teacher / brand
    const teacherBatches = allBatches.filter((b: any) => {
      const idMatch = teacherIdStr && b.teacherId && b.teacherId.toString() === teacherIdStr;
      const nameMatch = teacherNameLower && (b.teacherName || "").toLowerCase().includes(teacherNameLower);
      const brandMatch =
        !userBrandScope ||
        userBrandScope === "all" ||
        userBrandScope === "all brands" ||
        (b.brand || "").toLowerCase().trim() === userBrandScope;

      return idMatch || nameMatch || brandMatch;
    });

    const teacherBatchNames = teacherBatches.map((b: any) => b.batchName);

    // 4. Filter enrolled students (from Admission and Enquiry collections)
    const enrolledStudentsList: any[] = [];
    const addedStudentIds = new Set<string>();

    allAdmissions.forEach((a: any) => {
      const batchMatch = teacherBatchNames.includes(a.batch);
      const brandMatch =
        !userBrandScope ||
        userBrandScope === "all" ||
        userBrandScope === "all brands" ||
        (a.brand || "").toLowerCase().trim() === userBrandScope;

      if (batchMatch || brandMatch) {
        const uid = a._id.toString();
        if (!addedStudentIds.has(uid)) {
          addedStudentIds.add(uid);
          enrolledStudentsList.push({
            _id: a._id,
            studentFullName: a.fullName,
            primaryPhoneMobile: a.mobileNumber,
            targetCourse: a.course,
            targetBrand: a.brand,
            enquiryId: a.admissionId || "ADM-LIVE",
            status: "Admitted",
            createdAt: a.createdAt,
          });
        }
      }
    });

    allEnquiries.forEach((e: any) => {
      const statusLower = (e.status || "").toLowerCase().trim();
      if (statusLower === "admitted" || statusLower === "admission done" || e.isAdmitted) {
        const brandMatch =
          !userBrandScope ||
          userBrandScope === "all" ||
          userBrandScope === "all brands" ||
          (e.targetBrand || "").toLowerCase().trim() === userBrandScope;

        const uid = e._id.toString();
        if (brandMatch && !addedStudentIds.has(uid)) {
          addedStudentIds.add(uid);
          enrolledStudentsList.push({
            _id: e._id,
            studentFullName: e.studentFullName,
            primaryPhoneMobile: e.primaryPhoneMobile,
            targetCourse: e.targetCourse,
            targetBrand: e.targetBrand,
            enquiryId: e.enquiryId || "ENQ-LIVE",
            status: "Admitted",
            createdAt: e.createdAt,
          });
        }
      }
    });

    // 5. Filter demos scheduled for this teacher/brand
    const extractedDemos: any[] = [];

    allEnquiries.forEach((e: any) => {
      const statusLower = (e.status || "").toLowerCase().trim();
      const courseMatches = assignedSubjects.some((sub: string) => {
        const subLower = sub.toLowerCase().trim();
        const targetLower = (e.targetCourse || "").toLowerCase().trim();
        return subLower.includes(targetLower) || targetLower.includes(subLower);
      });
      const brandMatches =
        !userBrandScope ||
        userBrandScope === "all" ||
        userBrandScope === "all brands" ||
        (e.targetBrand || "").toLowerCase().trim() === userBrandScope;

      if (e.isDemoScheduled || (Array.isArray(e.demos) && e.demos.length > 0) || statusLower.includes("demo")) {
        const enquiryDemos =
          Array.isArray(e.demos) && e.demos.length > 0
            ? e.demos
            : [
                {
                  date: e.demoDate,
                  time: e.demoTime,
                  mode: "Online / In-Person",
                  notes: e.demoNotes,
                  status: statusLower === "demo attended" ? "Completed" : "Scheduled",
                },
              ];

        enquiryDemos.forEach((d: any) => {
          const noteText = d.notes || e.demoNotes || "";
          const teacherMatch =
            (e.demoTeacher && e.demoTeacher.toLowerCase().includes(teacherNameLower)) ||
            noteText.toLowerCase().includes(teacherNameLower) ||
            (d.teacher && d.teacher.toLowerCase().includes(teacherNameLower)) ||
            courseMatches ||
            brandMatches;

          if (teacherMatch) {
            extractedDemos.push({
              _id: e._id,
              enquiryId: e.enquiryId || "ENQ-LIVE",
              studentFullName: e.studentFullName,
              primaryPhoneMobile: e.primaryPhoneMobile,
              targetCourse: e.targetCourse,
              targetBrand: e.targetBrand,
              demoDate: d.date || e.demoDate || "Scheduled",
              demoTime: d.time || e.demoTime || "TBD",
              demoMode: d.mode || "Online (Zoom/Google Meet)",
              assignedTeacher: d.teacher || e.demoTeacher || currentUser?.name || "Faculty",
              notes: d.notes || e.demoNotes || "Live Demo Session",
              status: d.status || (statusLower === "demo attended" ? "Completed" : "Scheduled"),
              createdAt: d.createdAt || e.createdAt,
            });
          }
        });
      }
    });

    // 6. Real Attendance Statistics from Attendance collection in MongoDB
    const teacherAttendanceLogs = allAttendance.filter((att: any) => {
      const bMatch = teacherBatchNames.includes(att.batchName) || (teacherIdStr && att.teacherId && att.teacherId.toString() === teacherIdStr);
      const brandMatch =
        !userBrandScope ||
        userBrandScope === "all" ||
        userBrandScope === "all brands" ||
        (att.brand || "").toLowerCase().trim() === userBrandScope;
      return bMatch || brandMatch;
    });

    let totalAttendancePresent = 0;
    let totalAttendanceStudents = 0;

    teacherAttendanceLogs.forEach((att: any) => {
      totalAttendancePresent += att.totalPresent || 0;
      totalAttendanceStudents += att.totalStudents || 0;
    });

    const attendanceRatePct =
      totalAttendanceStudents > 0
        ? ((totalAttendancePresent / totalAttendanceStudents) * 100).toFixed(1) + "%"
        : "0.0%";

    // 7. Dynamic Counts strictly from MongoDB
    const assignedSubjectsCount = assignedSubjects.length > 0 ? assignedSubjects.length : teacherCourses.length;
    const activeBatchesCount = teacherBatches.length;
    const totalDemosScheduled = extractedDemos.length;
    const totalDemosCompleted = extractedDemos.filter(
      (d) => d.status === "Completed" || d.status === "Attended" || d.status === "Demo Attended"
    ).length;
    const highPriorityDemosCount = extractedDemos.filter((d) => d.status === "Scheduled").length;

    const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayDayShort = dayNamesShort[new Date().getDay()];

    const todaysClassesCount = teacherBatches.filter((b: any) =>
      Array.isArray(b.days) ? b.days.includes(todayDayShort) : false
    ).length;

    const conversionRatePct =
      totalDemosScheduled > 0
        ? Math.min(100, Math.round((totalDemosCompleted / totalDemosScheduled) * 1000) / 10).toFixed(1) + "%"
        : enrolledStudentsList.length > 0 && totalDemosCompleted > 0
        ? "100.0%"
        : "0.0%";

    // 8. DYNAMIC DONUT CHART: Real Category Breakdown from MongoDB Courses (Normalized to 100%)
    const subjectCatMap: Record<string, number> = {};
    const sourceCourses = teacherCourses.length > 0 ? teacherCourses : allCourses;

    sourceCourses.forEach((item: any) => {
      const cat = item.category || item.name || "General Domain";
      subjectCatMap[cat] = (subjectCatMap[cat] || 0) + 1;
    });

    const totalCatItems = Object.values(subjectCatMap).reduce((a, b) => a + b, 0) || 1;
    const sortedCatNames = Object.keys(subjectCatMap).sort(
      (a, b) => subjectCatMap[b] - subjectCatMap[a]
    );

    const maxDisplay = 4;
    const topCats = sortedCatNames.slice(0, maxDisplay);
    const remainingCats = sortedCatNames.slice(maxDisplay);

    let otherCount = 0;
    remainingCats.forEach((c) => {
      otherCount += subjectCatMap[c];
    });

    const breakdownItems: { name: string; count: number }[] = topCats.map((c) => ({
      name: c,
      count: subjectCatMap[c],
    }));

    if (otherCount > 0) {
      breakdownItems.push({ name: "Other Domains", count: otherCount });
    }

    const colorPalette = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];
    let sumPct = 0;

    const subjectBreakdown = breakdownItems.map((item, idx) => {
      const pct = Math.floor((item.count / totalCatItems) * 100);
      sumPct += pct;
      return {
        name: item.name,
        pctNum: pct,
        hex: colorPalette[idx % colorPalette.length],
      };
    });

    // Remainder adjustment so total is ALWAYS 100%
    const remainder = 100 - sumPct;
    if (remainder > 0 && subjectBreakdown.length > 0) {
      subjectBreakdown[0].pctNum += remainder;
    }

    if (subjectBreakdown.length === 0) {
      subjectBreakdown.push({ name: "General Domain", pctNum: 100, hex: "#6366f1" });
    }

    // 9. DYNAMIC LINE CHART: Day-by-Day Activity Trend (Mon-Sun) aggregated live from MongoDB
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const trendMap: Record<string, { demos: number; classes: number; conversions: number }> = {
      Mon: { demos: 0, classes: 0, conversions: 0 },
      Tue: { demos: 0, classes: 0, conversions: 0 },
      Wed: { demos: 0, classes: 0, conversions: 0 },
      Thu: { demos: 0, classes: 0, conversions: 0 },
      Fri: { demos: 0, classes: 0, conversions: 0 },
      Sat: { demos: 0, classes: 0, conversions: 0 },
      Sun: { demos: 0, classes: 0, conversions: 0 },
    };

    extractedDemos.forEach((d) => {
      if (d.demoDate) {
        const dateObj = new Date(d.demoDate);
        if (!isNaN(dateObj.getTime())) {
          const dayLabel = dayNames[dateObj.getDay()];
          if (trendMap[dayLabel]) {
            trendMap[dayLabel].demos++;
            if (d.status === "Completed" || d.status === "Attended" || d.status === "Demo Attended") {
              trendMap[dayLabel].classes++;
            }
          }
        }
      }
    });

    teacherAttendanceLogs.forEach((att: any) => {
      if (att.date) {
        const dateObj = new Date(att.date);
        if (!isNaN(dateObj.getTime())) {
          const dayLabel = dayNames[dateObj.getDay()];
          if (trendMap[dayLabel]) {
            trendMap[dayLabel].classes += 1;
          }
        }
      }
    });

    enrolledStudentsList.forEach((s) => {
      if (s.createdAt) {
        const dateObj = new Date(s.createdAt);
        if (!isNaN(dateObj.getTime())) {
          const dayLabel = dayNames[dateObj.getDay()];
          if (trendMap[dayLabel]) {
            trendMap[dayLabel].conversions++;
          }
        }
      }
    });

    const weeklyTrendDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayLabel) => {
      return {
        dayLabel,
        demos: trendMap[dayLabel].demos,
        classes: trendMap[dayLabel].classes,
        conversions: trendMap[dayLabel].conversions,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        assignedSubjectsCount,
        activeBatchesCount,
        enrolledStudentsCount: enrolledStudentsList.length,
        demosScheduledCount: totalDemosScheduled,
        demosCompletedCount: totalDemosCompleted,
        highPriorityDemosCount,
        todaysClassesCount,
        conversionRatePct,
        attendanceRatePct,
        ratingScore: "4.9 ⭐",
        myBrandCourses: teacherCourses,
        extractedDemos,
        enrolledStudentsList,
        subjectBreakdown,
        weeklyTrendDays,
      },
    });
  } catch (error: any) {
    console.error("Error fetching faculty dashboard stats:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch faculty stats." },
      { status: 500 }
    );
  }
}
