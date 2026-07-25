async function testTeacherStats() {
  console.log("=== Testing Teacher Dashboard Stats API ===");
  try {
    const res = await fetch("http://localhost:3000/api/teacher-dashboard/stats");
    const json = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response JSON:", JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

testTeacherStats();
