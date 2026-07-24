async function testFullStats() {
  try {
    const res = await fetch("http://localhost:3000/api/admin-dashboard/stats");
    const data = await res.json();
    console.log("KPIS:", JSON.stringify(data.data.kpis, null, 2));
    console.log("Enquiries By Source:", JSON.stringify(data.data.enquiriesBySource, null, 2));
    console.log("Pipeline:", JSON.stringify(data.data.pipeline, null, 2));
    console.log("Counsellor Performance Count:", data.data.counsellorPerformance.length);
    console.log("Brand Performance Count:", data.data.brandPerformance.length);
    console.log("Company Utilization Count:", data.data.companyUtilization.length);
    console.log("Work Queue:", JSON.stringify(data.data.workQueue, null, 2));
    console.log("Recent Activity Count:", data.data.recentActivity.length);
    console.log("Enquiries List Count:", data.data.enquiriesList.length);
  } catch (err) {
    console.error("Error:", err);
  }
}

testFullStats();
