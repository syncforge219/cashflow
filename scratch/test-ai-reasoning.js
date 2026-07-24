async function testReasoningAI() {
  const queries = [
    "Why are lead conversion rates dropping and what should we do?",
    "Analyze our net profit and explain if we are making money",
    "If candidate A has 20 leads and candidate B has 10 leads with 5 admissions, who is performing better and why?"
  ];

  for (const q of queries) {
    console.log("\n=======================================================");
    console.log("PROMPT:", q);
    try {
      const res = await fetch("http://localhost:3000/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: q,
          userRole: "admin",
          userName: "Admin User",
          userEmail: "admin@coachflow.com"
        })
      });
      const data = await res.json();
      console.log("RESPONSE ANSWER:\n", data.answer);
    } catch (err) {
      console.error("Test AI reasoning failed:", err);
    }
  }
}

testReasoningAI();
