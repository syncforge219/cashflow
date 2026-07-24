async function testBulkUploadWithCounsellor() {
  const sampleLeads = [
    {
      name: "Vikram Test Lead",
      mobile: "+91 9111222333",
      email: "vikram@example.com",
      city: "Delhi",
      course: "Full Stack Web Dev",
      brand: "TechPro",
      remarks: "Assigned directly via test script"
    }
  ];

  try {
    const res = await fetch("http://localhost:3000/api/enquiries/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leads: sampleLeads,
        assignedCounsellor: "Rahul Sharma"
      })
    });

    const data = await res.json();
    console.log("Upload Status:", res.status);
    console.log("Upload Response:", data);
  } catch (err) {
    console.error("Upload test failed:", err);
  }
}

testBulkUploadWithCounsellor();
