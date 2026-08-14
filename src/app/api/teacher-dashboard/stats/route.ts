import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Course from "@/models/Course";
import User from "@/models/User";
import Admission from "@/models/Admission";
import Batch from "@/models/Batch";
import Attendance from "@/models/Attendance";
import { getUserFromCookies } from "@/lib/helper";
import { computeBatchStatus, isBatchActiveOnDate, getLocalDateStr } from "@/lib/batchHelper";

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

    // Normalize string helper
    const norm = (s: any) => (typeof s === "string" ? s.trim().toLowerCase() : "");

    // Extract assigned subjects safely from both currentUser.subjects and currentUser.subject
    const extractSubs = (val: any): string[] => {
      if (Array.isArray(val)) return val.map((s: any) => String(s).trim()).filter(Boolean);
      if (typeof val === "string" && val.trim()) {
        return val
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
      return [];
    };

    const assignedSubjects = Array.from(
      new Set([...extractSubs(currentUser?.subjects), ...extractSubs(currentUser?.subject)])
    );

    const userBrandScope = norm(currentUser?.brandScope);
    const isBrandRestricted =
      Boolean(userBrandScope) &&
      userBrandScope !== "all" &&
      userBrandScope !== "all brands" &&
      userBrandScope !== "*" &&
      userBrandScope !== "global";

    const teacherNameLower = norm(currentUser?.name);
    const teacherIdStr = currentUser?._id ? currentUser._id.toString() : "";

    // 2. Filter active batches assigned to this teacher
    const teacherBatches = allBatches.filter((b: any) => {
      const bTeacherId = b.teacherId ? (b.teacherId._id || b.teacherId.id || b.teacherId).toString() : "";
      const idMatch = Boolean(teacherIdStr && bTeacherId && bTeacherId === teacherIdStr);
      const nameMatch = Boolean(teacherNameLower && norm(b.teacherName).includes(teacherNameLower));
      const isAssigned = Boolean(idMatch || nameMatch);

      const brandMatch = !isBrandRestricted || norm(b.brand) === userBrandScope;

      return isAssigned && brandMatch;
    });

    const teacherBatchNames = teacherBatches.map((b: any) => b.batchName).filter(Boolean);
    const teacherBatchCourses: string[] = [];
    teacherBatches.forEach((b: any) => {
      if (b.course && typeof b.course === "string" && b.course.trim()) {
        teacherBatchCourses.push(b.course.trim());
      }
      if (Array.isArray(b.courses)) {
        b.courses.forEach((c: any) => {
          if (c && typeof c === "string" && c.trim()) {
            teacherBatchCourses.push(c.trim());
          }
        });
      }
    });

    // 3. Filter courses strictly assigned to this teacher (assigned subjects + courses of assigned batches)
    const matchedCourses = allCourses.filter((c: any) => {
      const brandMatch = !isBrandRestricted || !c.brand || norm(c.brand) === userBrandScope;
      if (!brandMatch) return false;

      const cNameNorm = norm(c.name);
      const cCodeNorm = norm(c.code);

      const subjectMatch = assignedSubjects.some((sub: string) => {
        const subNorm = norm(sub);
        if (!subNorm) return false;
        return cNameNorm === subNorm || cCodeNorm === subNorm || cNameNorm.includes(subNorm) || subNorm.includes(cNameNorm);
      });

      const batchMatch = teacherBatchCourses.some((bc: string) => {
        const bcNorm = norm(bc);
        if (!bcNorm) return false;
        return cNameNorm === bcNorm || cCodeNorm === bcNorm || cNameNorm.includes(bcNorm) || bcNorm.includes(cNameNorm);
      });

      return subjectMatch || batchMatch;
    });

    // Create fallback courses for assigned subjects not found in Course collection so they still display
    const matchedCourseNames = new Set(matchedCourses.map((c: any) => norm(c.name)));
    const unmappedSubjects = assignedSubjects.filter((sub: string) => {
      const subNorm = norm(sub);
      return !Array.from(matchedCourseNames).some((cn) => cn === subNorm || cn.includes(subNorm) || subNorm.includes(cn));
    });

    const fallbackCourses = unmappedSubjects.map((sub: string) => ({
      _id: `subj-${sub}`,
      name: sub,
      code: sub.toUpperCase().replace(/\s+/g, "_"),
      brand: currentUser?.brandScope || "Assigned Brand",
      category: "Specialized Course",
      duration: "Standard",
      fee: "N/A",
      status: "ACTIVE",
    }));

    const teacherCourses = [...matchedCourses, ...fallbackCourses];

    // Helper to check if a course is taught by this teacher
    const isTeacherCourse = (targetCourseName: string) => {
      if (!targetCourseName) return false;
      const targetNorm = norm(targetCourseName);
      return (
        teacherCourses.some((c: any) => {
          const cNameNorm = norm(c.name);
          return cNameNorm === targetNorm || cNameNorm.includes(targetNorm) || targetNorm.includes(cNameNorm);
        }) ||
        assignedSubjects.some((sub: string) => {
          const subNorm = norm(sub);
          return subNorm === targetNorm || subNorm.includes(targetNorm) || targetNorm.includes(subNorm);
        }) ||
        teacherBatchCourses.some((bc: string) => {
          const bcNorm = norm(bc);
          return bcNorm === targetNorm || bcNorm.includes(targetNorm) || targetNorm.includes(bcNorm);
        })
      );
    };

    // 4. Filter enrolled students (from Admission and Enquiry collections with deduplication)
    const enrolledStudentsList: any[] = [];
    const addedStudentIds = new Set<string>();
    const addedStudentKeys = new Set<string>();

    allAdmissions.forEach((a: any) => {
      const batchMatch = a.batch && teacherBatchNames.includes(a.batch);
      const courseMatch = isTeacherCourse(a.course);
      const brandMatch = !isBrandRestricted || !a.brand || norm(a.brand) === userBrandScope;

      if (batchMatch || (courseMatch && brandMatch)) {
        const uid = a._id.toString();
        const mobileKey = (a.mobileNumber || "").trim();
        const courseKey = norm(a.course);
        const studentKey = mobileKey ? `${mobileKey}_${courseKey}` : uid;

        if (!addedStudentIds.has(uid) && !addedStudentKeys.has(studentKey)) {
          addedStudentIds.add(uid);
          addedStudentKeys.add(studentKey);

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
      const statusLower = norm(e.status);
      if (statusLower === "admitted" || statusLower === "admission done" || e.isAdmitted) {
        const courseMatch = isTeacherCourse(e.targetCourse);
        const brandMatch = !isBrandRestricted || !e.targetBrand || norm(e.targetBrand) === userBrandScope;

        if (courseMatch && brandMatch) {
          const uid = e._id.toString();
          const mobileKey = (e.primaryPhoneMobile || "").trim();
          const courseKey = norm(e.targetCourse);
          const studentKey = mobileKey ? `${mobileKey}_${courseKey}` : uid;

          if (!addedStudentIds.has(uid) && !addedStudentKeys.has(studentKey)) {
            addedStudentIds.add(uid);
            addedStudentKeys.add(studentKey);

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
      }
    });

    // 5. Filter demos scheduled for this teacher
    const extractedDemos: any[] = [];

    allEnquiries.forEach((e: any) => {
      const statusLower = norm(e.status);
      const courseMatch = isTeacherCourse(e.targetCourse);
      const brandMatch = !isBrandRestricted || !e.targetBrand || norm(e.targetBrand) === userBrandScope;

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
          const noteText = norm(d.notes || e.demoNotes || "");
          const demoTeacherNorm = norm(d.teacher || e.demoTeacher || "");

          const directTeacherMatch =
            Boolean(teacherNameLower && (demoTeacherNorm.includes(teacherNameLower) || noteText.includes(teacherNameLower)));
          const isAssignedDemo = (directTeacherMatch || courseMatch) && brandMatch;

          if (isAssignedDemo) {
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
      const bMatch = att.batchName && teacherBatchNames.includes(att.batchName);
      const idMatch = Boolean(teacherIdStr && att.teacherId && att.teacherId.toString() === teacherIdStr);
      const nameMatch = Boolean(teacherNameLower && norm(att.teacherName).includes(teacherNameLower));
      const brandMatch = !isBrandRestricted || !att.brand || norm(att.brand) === userBrandScope;

      return (bMatch || idMatch || nameMatch) && brandMatch;
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
    const assignedSubjectsCount = teacherCourses.length > 0 ? teacherCourses.length : assignedSubjects.length;
    const activeBatches = teacherBatches.filter(
      (b: any) => computeBatchStatus(b.startDate, b.endDate, b.status) === "Active"
    );
    const activeBatchesCount = activeBatches.length;
    const totalDemosScheduled = extractedDemos.length;
    const totalDemosCompleted = extractedDemos.filter(
      (d) => d.status === "Completed" || d.status === "Attended" || d.status === "Demo Attended"
    ).length;
    const highPriorityDemosCount = extractedDemos.filter((d) => d.status === "Scheduled").length;

    const todayDate = new Date();
    const todayDateStr = getLocalDateStr(todayDate);
    const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayDayShort = dayNamesShort[todayDate.getDay()];

    const todaysClassesCount = teacherBatches.filter((b: any) =>
      isBatchActiveOnDate(b, todayDateStr, todayDayShort)
    ).length;

    const conversionRatePct =
      totalDemosScheduled > 0
        ? Math.min(100, Math.round((totalDemosCompleted / totalDemosScheduled) * 1000) / 10).toFixed(1) + "%"
        : enrolledStudentsList.length > 0 && totalDemosCompleted > 0
        ? "100.0%"
        : "0.0%";

    // 8. DYNAMIC DONUT CHART: Real Category Breakdown from MongoDB Courses (Normalized to 100%)
    const subjectCatMap: Record<string, number> = {};
    const sourceCourses = teacherCourses;

    sourceCourses.forEach((item: any) => {
      const cat = item.category || item.name || "Specialized Domain";
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
      subjectBreakdown.push({ name: "No Assigned Courses", pctNum: 100, hex: "#6366f1" });
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
