const mongoose = require("mongoose");
const uri = "mongodb://syncforgesolutions_db_user:MySecurePassword12@ac-du9jgwf-shard-00-01.jq4axfo.mongodb.net:27017,ac-du9jgwf-shard-00-00.jq4axfo.mongodb.net:27017,ac-du9jgwf-shard-00-02.jq4axfo.mongodb.net:27017/syncforge_db?ssl=true&authSource=admin&retryWrites=true&w=majority&appName=Cluster0";

async function checkAllCollections() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const usersCount = await db.collection("users").countDocuments();
  const teachers = await db.collection("users").find({ role: "teacher" }).toArray();
  const batchesCount = await db.collection("batches").countDocuments();
  const batches = await db.collection("batches").find({}).toArray();
  const coursesCount = await db.collection("courses").countDocuments();
  const courses = await db.collection("courses").find({}).toArray();
  const admissionsCount = await db.collection("admissions").countDocuments();
  const admissions = await db.collection("admissions").find({}).toArray();
  const enquiriesCount = await db.collection("enquiries").countDocuments();
  const attendanceCount = await db.collection("attendances").countDocuments();

  console.log("=== DB COUNTS ===");
  console.log("Users:", usersCount, "Teachers count:", teachers.length);
  console.log("Teachers list:", teachers.map(t => ({ id: t._id, name: t.name, email: t.email, brandScope: t.brandScope, subjects: t.subjects || t.subject })));
  console.log("Batches count:", batchesCount);
  console.log("Batches list:", batches.map(b => ({ id: b._id, name: b.batchName, course: b.course, teacherName: b.teacherName, brand: b.brand })));
  console.log("Courses count:", coursesCount);
  console.log("Courses list:", courses.map(c => ({ id: c._id, name: c.name || c.courseName, category: c.category, brand: c.brand })));
  console.log("Admissions count:", admissionsCount);
  console.log("Admissions list:", admissions.map(a => ({ id: a._id, fullName: a.fullName, course: a.course, batch: a.batch, brand: a.brand })));
  console.log("Enquiries count:", enquiriesCount);
  console.log("Attendance logs count:", attendanceCount);

  await mongoose.disconnect();
}

checkAllCollections().catch(console.error);
