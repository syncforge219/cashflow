async function run() {
  const url = "https://lead2leadure.in/api/companies";
  const res = await fetch(url);
  const data = await res.json();
  if (data.companies) {
    const sicces = data.companies.find((c: any) => c.name === "SICCES PRIVATE LIMITED");
    console.log("SICCES PRIVATE LIMITED full object from LIVE API:");
    console.log(JSON.stringify(sicces, null, 2));
  }
}
run();
