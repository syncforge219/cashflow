import fs from "fs";

if (typeof process.loadEnvFile === "function") {
  process.loadEnvFile(".env");
} else if (fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] = val;
    }
  });
}
process.env.DISABLE_CRON = "true";

import dbConnect from "../src/lib/db";
import User from "../src/models/User";
import Course from "../src/models/Course";
import Batch from "../src/models/Batch";

async function verify() {
  await dbConnect();
  console.log("Connected to MongoDB.");

  const teachers = await User.find({ role: "teacher" }).lean();
  console.log(`Found ${teachers.length} teachers in DB:`);

  const allCourses = await Course.find({}).lean();
  const allBatches = await Batch.find({}).lean();
  console.log(`Total Courses in DB: ${allCourses.length}, Total Batches in DB: ${allBatches.length}`);

  for (const t of teachers) {
    const extractSubs = (val: any): string[] => {
      if (Array.isArray(val)) return val.map((s: any) => String(s).trim()).filter(Boolean);
      if (typeof val === "string" && val.trim()) return val.split(",").map((s: string) => s.trim()).filter(Boolean);
      return [];
    };
    const assignedSubjects = Array.from(new Set([...extractSubs(t.subjects), ...extractSubs(t.subject)]));
    const teacherIdStr = t._id.toString();
    const teacherNameLower = (t.name || "").toLowerCase().trim();
    const userBrandScope = (t.brandScope || "").toLowerCase().trim();
    const isBrandRestricted =
      Boolean(userBrandScope) &&
      userBrandScope !== "all" &&
      userBrandScope !== "all brands" &&
      userBrandScope !== "*" &&
      userBrandScope !== "global";

    const teacherBatches = allBatches.filter((b: any) => {
      const bTeacherId = b.teacherId ? (b.teacherId._id || b.teacherId.id || b.teacherId).toString() : "";
      const idMatch = Boolean(teacherIdStr && bTeacherId && bTeacherId === teacherIdStr);
      const nameMatch = Boolean(teacherNameLower && (b.teacherName || "").toLowerCase().trim().includes(teacherNameLower));
      const isAssigned = Boolean(idMatch || nameMatch);
      const brandMatch = !isBrandRestricted || (b.brand || "").toLowerCase().trim() === userBrandScope;
      return isAssigned && brandMatch;
    });

    const teacherBatchCourses: string[] = [];
    teacherBatches.forEach((b: any) => {
      if (b.course && typeof b.course === "string") teacherBatchCourses.push(b.course.trim());
      if (Array.isArray(b.courses)) b.courses.forEach((c: any) => typeof c === "string" && teacherBatchCourses.push(c.trim()));
    });

    const norm = (s: any) => (typeof s === "string" ? s.trim().toLowerCase() : "");

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
      brand: t.brandScope || "Assigned Brand",
      category: "Specialized Course",
      duration: "Standard",
      fee: "N/A",
      status: "ACTIVE",
    }));

    const teacherCourses = [...matchedCourses, ...fallbackCourses];

    console.log(`\n========================================`);
    console.log(`Teacher: ${t.name} (${t.email})`);
    console.log(`Brand Scope: ${t.brandScope}`);
    console.log(`Assigned Subjects in Profile (${assignedSubjects.length}):`, assignedSubjects);
    console.log(`Assigned Batches: ${teacherBatches.length}`);
    console.log(`Total Filtered Courses: ${teacherCourses.length}`);
    console.log(`Course List:`, teacherCourses.map((c: any) => c.name));
  }

  process.exit(0);
}

verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
