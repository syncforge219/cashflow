async function run() {
  const url = "https://lead2leadure.in/api/admin/fix-sicces-brands";
  console.log("Calling:", url);
  const res = await fetch(url);
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}
run();
