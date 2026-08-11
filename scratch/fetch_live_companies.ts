async function run() {
  const url = "https://lead2leadure.in/api/companies";
  console.log("Fetching:", url);
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.companies) {
      const sicces = data.companies.find((c: any) => c.name === "SICCES PRIVATE LIMITED");
      if (sicces) {
        console.log("SICCES PRIVATE LIMITED Brands on Live:", sicces.brands);
      } else {
        console.log("SICCES PRIVATE LIMITED not found in response.");
      }
    }
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}
run();
