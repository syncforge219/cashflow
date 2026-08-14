// Pure unit test for Teacher Dashboard Course & Data filtering logic

const allCourses = [
  { _id: "c1", name: "3ds Max", brand: "CADD MANTRA", category: "Design", duration: "100 Hours" },
  { _id: "c2", name: "Advance Excel", brand: "CADD MANTRA", category: "Office", duration: "100 Hours" },
  { _id: "c3", name: "Advance Python", brand: "CADD MANTRA", category: "Programming", duration: "100 Hours" },
  { _id: "c4", name: "AutoCAD for Civil & Architecture", brand: "CADD MANTRA", category: "CAD", duration: "100 Hours" },
  { _id: "c5", name: "Certificate Course in Photoshop", brand: "DESIGN GATEWAY", category: "Graphic Design", duration: "40 Hours" },
  { _id: "c6", name: "Revit Architecture", brand: "CADD MANTRA", category: "BIM", duration: "80 Hours" },
  { _id: "c7", name: "SolidWorks", brand: "CADD MANTRA", category: "Mechanical", duration: "60 Hours" },
];

const allBatches = [
  {
    _id: "b1",
    batchName: "AUTOCAD-CIVIL-MORNING",
    teacherId: "teacher_123",
    teacherName: "Tauseef Ansari",
    course: "AutoCAD for Civil & Architecture",
    brand: "CADD MANTRA",
    startDate: new Date("2026-01-01"),
    status: "Active",
  },
  {
    _id: "b2",
    batchName: "PYTHON-EVENING",
    teacherId: "teacher_456",
    teacherName: "Other Faculty",
    course: "Advance Python",
    brand: "CADD MANTRA",
    startDate: new Date("2026-01-01"),
    status: "Active",
  },
];

const allAdmissions = [
  { _id: "a1", fullName: "Student 1", mobileNumber: "9876543210", course: "AutoCAD for Civil & Architecture", batch: "AUTOCAD-CIVIL-MORNING", brand: "CADD MANTRA" },
  { _id: "a2", fullName: "Student 2", mobileNumber: "9876543211", course: "Advance Excel", batch: "EXCEL-BATCH", brand: "CADD MANTRA" },
  { _id: "a3", fullName: "Student 3", mobileNumber: "9876543212", course: "Advance Python", batch: "PYTHON-EVENING", brand: "CADD MANTRA" },
];

// Test Teacher: Tauseef Ansari, assigned to "AutoCAD for Civil & Architecture" and "Advance Excel"
const currentUser = {
  _id: "teacher_123",
  name: "Tauseef Ansari",
  email: "tauseef.sicces@gmail.com",
  brandScope: "CADD MANTRA",
  subjects: ["AutoCAD for Civil & Architecture", "Advance Excel"],
};

function runFilter(currentUser: any, allCourses: any[], allBatches: any[], allAdmissions: any[]) {
  const norm = (s: any) => (typeof s === "string" ? s.trim().toLowerCase() : "");

  const extractSubs = (val: any): string[] => {
    if (Array.isArray(val)) return val.map((s: any) => String(s).trim()).filter(Boolean);
    if (typeof val === "string" && val.trim()) {
      return val.split(",").map((s: string) => s.trim()).filter(Boolean);
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

  // 3. Filter courses strictly assigned to this teacher
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

  const enrolledStudentsList: any[] = [];
  allAdmissions.forEach((a: any) => {
    const batchMatch = a.batch && teacherBatchNames.includes(a.batch);
    const courseMatch = isTeacherCourse(a.course);
    const brandMatch = !isBrandRestricted || !a.brand || norm(a.brand) === userBrandScope;

    if (batchMatch || (courseMatch && brandMatch)) {
      enrolledStudentsList.push(a);
    }
  });

  return {
    teacherCourses,
    teacherBatches,
    enrolledStudentsList,
  };
}

console.log("=== RUNNING UNIT TEST FOR TEACHER ASSIGNED COURSES ===");
const result = runFilter(currentUser, allCourses, allBatches, allAdmissions);
console.log("Assigned Courses (Expected 2: AutoCAD for Civil & Architecture, Advance Excel):");
console.log(result.teacherCourses.map((c: any) => c.name));
console.log("Assigned Batches (Expected 1: AUTOCAD-CIVIL-MORNING):");
console.log(result.teacherBatches.map((b: any) => b.batchName));
console.log("Enrolled Students (Expected 2: Student 1, Student 2; NOT Student 3 who takes Advance Python):");
console.log(result.enrolledStudentsList.map((s: any) => `${s.fullName} (${s.course})`));

if (
  result.teacherCourses.length === 2 &&
  result.teacherCourses.some((c: any) => c.name === "AutoCAD for Civil & Architecture") &&
  result.teacherCourses.some((c: any) => c.name === "Advance Excel") &&
  !result.teacherCourses.some((c: any) => c.name === "Advance Python") &&
  !result.teacherCourses.some((c: any) => c.name === "Certificate Course in Photoshop") &&
  result.enrolledStudentsList.length === 2 &&
  !result.enrolledStudentsList.some((s: any) => s.fullName === "Student 3")
) {
  console.log("\n>>> ALL TESTS PASSED! Course & student scope filtering works precisely as expected. <<<");
} else {
  console.error("\n>>> TEST FAILED! <<<");
  process.exit(1);
}
