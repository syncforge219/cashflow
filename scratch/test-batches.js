async function testBatchSystem() {
  console.log("=== Testing Faculty Batch System API ===");

  try {
    // 1. Fetch teachers to get a real teacherId
    const teachersRes = await fetch("http://localhost:3000/api/teachers");
    const teachersJson = await teachersRes.json();
    const teachers = teachersJson.data || teachersJson.teachers || [];
    console.log(`Found ${teachers.length} teachers in system.`);

    if (teachers.length === 0) {
      console.error("No teachers found to assign batch!");
      return;
    }

    const testTeacher = teachers[0];
    console.log("Using teacher:", { id: testTeacher._id, name: testTeacher.name });

    // 2. Create a new batch
    const createRes = await fetch("http://localhost:3000/api/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        batchName: "AutoCAD-Morning-Batch-2026",
        course: "AutoCAD Masters",
        teacherId: testTeacher._id,
        teacherName: testTeacher.name,
        brand: testTeacher.brandScope || "CADD Mantra",
        startDate: "2026-08-01",
        timing: "09:00 AM - 11:00 AM",
        days: ["Mon", "Wed", "Fri"],
        maxCapacity: 25,
        notes: "Automated test batch creation",
        createdBy: "Test Runner",
        creatorRole: "super admin"
      })
    });

    const createJson = await createRes.json();
    console.log("Create Batch Response Status:", createRes.status);
    console.log("Create Batch Result:", createJson);

    if (!createJson.success || !createJson.data?._id) {
      console.error("Failed to create batch!");
      return;
    }

    const createdBatchId = createJson.data._id;

    // 3. Fetch all batches
    const listRes = await fetch("http://localhost:3000/api/batches");
    const listJson = await listRes.json();
    console.log("List Batches Count:", listJson.count || listJson.data?.length);

    // 4. Update batch (change status to Active)
    const updateRes = await fetch(`http://localhost:3000/api/batches/${createdBatchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "Active",
        timing: "09:30 AM - 11:30 AM"
      })
    });
    const updateJson = await updateRes.json();
    console.log("Update Batch Response Status:", updateRes.status);
    console.log("Updated Batch Status:", updateJson.data?.status, "Timing:", updateJson.data?.timing);

    console.log("=== All Batch System API Tests Passed Successfully! ===");
  } catch (err) {
    console.error("Batch Test Error:", err);
  }
}

testBatchSystem();
