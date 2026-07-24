async function testLogin(email, password) {
  console.time(`login-${email}`);
  try {
    const res = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    console.timeEnd(`login-${email}`);
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", data);
  } catch (err) {
    console.timeEnd(`login-${email}`);
    console.error("Fetch error:", err);
  }
}

async function runTests() {
  console.log("--- Test 1: Invalid Email Format ---");
  await testLogin("invalid-email", "password123");
  
  console.log("\n--- Test 2: Missing fields ---");
  await testLogin("", "");

  console.log("\n--- Test 3: Valid Email, non-existent user ---");
  await testLogin("nonexistent@example.com", "password123");
}

runTests();
