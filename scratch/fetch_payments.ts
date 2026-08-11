async function run() {
  const url = "http://localhost:3000/api/payments?company=SP%20DESIGN%20GATEWAY%20TRAINING%20SERVICES%20LLP";
  console.log("Fetching:", url);
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("Response Status:", res.status);
    console.log("Response Body:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}
run();
