async function run() {
  const url = "https://lead2leadure.in/api/admin/sync-payment-companies";
  console.log("Fetching:", url);
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log("Response Status:", res.status);
    console.log("Response Text:", text);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}
run();
