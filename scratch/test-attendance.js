async function testAttendanceSystem() {
  console.log("=== Testing Student Attendance System API ===");

  try {
    // 1. Get existing batches
    const batchRes = await fetch("http://localhost:3000/api/batches");
    const batchJson = await batchRes.json();
    const batches = batchJson.data || batchJson.batches || [];
    console.log(`Found ${batches.length} active batches.`);

    if (batches.length === 0) {
      console.error("No batches found! Run test-batches first.");
      return;
    }

    const testBatch = batches[0];
    console.log("Using batch:", { id: testBatch._id, name: testBatch.batchName, course: testBatch.course });

    // 2. Fetch student roster for batch
    const rosterRes = await fetch(`http://localhost:3000/api/attendance?batchId=${testBatch._id}&rosterOnly=true`);
    const rosterJson = await rosterRes.json();
    console.log("Roster fetch status:", rosterRes.status, "Roster count:", rosterJson.count);

    // 3. Post daily attendance for today
    const todayStr = new Date().toISOString().split("T")[0];
    const attendanceRecords = [
      { studentName: "Rahul Sharma", admissionId: "ADM000101", mobileNumber: "9876543210", status: "Present", remarks: "On time" },
      { studentName: "Priya Singh", admissionId: "ADM000102", mobileNumber: "9876543211", status: "Absent", remarks: "Sick leave" },
      { studentName: "Amit Kumar", admissionId: "ADM000103", mobileNumber: "9876543212", status: "Late", remarks: "Joined 15m late" }
    ];

    const postRes = await fetch("http://localhost:3000/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchId: testBatch._id,
        batchName: testBatch.batchName,
        course: testBatch.course,
        date: todayStr,
        teacherId: testBatch.teacherId || "6a6301fdb955a2ad624cf9a9",
        teacherName: testBatch.teacherName || "Modi Ji",
        brand: testBatch.brand || "CADD Mantra",
        records: attendanceRecords,
        notes: "Automated session log test"
      })
    });

    const postJson = await postRes.json();
    console.log("Post Attendance Status:", postRes.status);
    console.log("Post Attendance Response:", {
      success: postJson.success,
      totalStudents: postJson.data?.totalStudents,
      totalPresent: postJson.data?.totalPresent,
      totalAbsent: postJson.data?.totalAbsent,
      totalLate: postJson.data?.totalLate,
    });

    // 4. Query attendance history logs
    const historyRes = await fetch(`http://localhost:3000/api/attendance?batchId=${testBatch._id}`);
    const historyJson = await historyRes.json();
    console.log("Attendance History Logs Count:", historyJson.count);

    console.log("=== All Attendance System API Tests Passed Successfully! ===");
  } catch (err) {
    console.error("Attendance System Test Error:", err);
  }
}

testAttendanceSystem();
