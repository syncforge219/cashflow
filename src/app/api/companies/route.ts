import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Company from "@/models/Company";
import Brand from "@/models/Brand";
import Payment from "@/models/Payment";
import Admission from "@/models/Admission";
import { getUserFromCookies } from "@/lib/helper";
import { runUppercaseDataMigration } from "@/lib/uppercaseMigration";

export async function GET(req: Request) {
  try {
    await dbConnect();
    await runUppercaseDataMigration();
    const user = await getUserFromCookies();

    const { searchParams } = new URL(req.url);
    const brandParam = searchParams.get("brand");

    let targetBrand = "";
    if (brandParam && brandParam !== "All Brands" && brandParam !== "ALL BRANDS" && brandParam !== "All") {
      targetBrand = brandParam.toUpperCase().trim();
    } else if (user && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "ALL BRANDS" && user.brandScope !== "All") {
      targetBrand = user.brandScope.toUpperCase().trim();
    }

    let query: any = {};
    if (targetBrand) {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const brandRegex = new RegExp(`^${escapeRegExp(targetBrand)}$`, "i");

      const scopeBrand = await Brand.findOne({
        $or: [{ name: brandRegex }, { code: brandRegex }]
      }).lean();

      const scopeBrandCompanies = (scopeBrand?.companies || []).map((c: string) => c.toUpperCase().trim());

      query.$or = [
        { brand: brandRegex }, 
        { brands: brandRegex },
        { name: { $in: scopeBrandCompanies.map(c => new RegExp(`^${escapeRegExp(c)}$`, "i")) } },
        { legalName: { $in: scopeBrandCompanies.map(c => new RegExp(`^${escapeRegExp(c)}$`, "i")) } }
      ];
    }

    let list = await Company.find(query).sort({ createdAt: -1 }).lean();

    // Reverse mapping: Find brands that have associated this company
    const allBrands = await Brand.find({}).lean();

    // Aggregate actual collected payments per company
    const paymentsByCompany = await Payment.aggregate([
      {
        $group: {
          _id: { $toUpper: { $trim: { input: "$company" } } },
          totalActualCollected: { $sum: "$amountReceived" }
        }
      }
    ]);

    // Aggregate committed/contracted fees per company from admissions
    const admissionsByCompany = await Admission.aggregate([
      {
        $group: {
          _id: { $toUpper: { $trim: { input: "$companyAssigned" } } },
          totalCommittedFee: {
            $sum: {
              $cond: [
                { $gt: ["$finalFee", 0] },
                "$finalFee",
                {
                  $cond: [
                    { $gt: ["$courseFee", 0] },
                    "$courseFee",
                    { $ifNull: ["$registrationAmount", 0] }
                  ]
                }
              ]
            }
          }
        }
      }
    ]);

    const normalizeKey = (n: string) =>
      (n || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .replace(/PRIVATELIMITED/g, "PVTLTD")
        .replace(/PVTLIMITED/g, "PVTLTD")
        .replace(/LIMITED/g, "LTD")
        .replace(/SERVICES/g, "")
        .replace(/GATEEWAY/g, "GATEWAY")
        .replace(/INSTITUTE/g, "INSTITUE")
        .replace(/LLP/g, "");

    list = list.map((company: any) => {
      const companyName = (company.name || "").toUpperCase().trim();
      const companyLegalName = (company.legalName || companyName).toUpperCase().trim();
      const cNorm = normalizeKey(companyName);

      const reversedBrands = allBrands
        .filter((b: any) => b.companies && b.companies.map((c: string) => c.toUpperCase().trim()).includes(companyName))
        .map((b: any) => (b.name || "").toUpperCase().trim());
      
      const finalBrandsSet = new Set([
        ...(company.brands || []).map((b: any) => String(b).toUpperCase().trim()),
        ...reversedBrands
      ]);
      if (company.brand) finalBrandsSet.add(String(company.brand).toUpperCase().trim());

      // Find actual collected payments for this company
      let actualCollected = 0;
      paymentsByCompany.forEach((p: any) => {
        if (!p._id || p._id === "CASH" || p._id === "UNALLOCATED" || p._id === "CASH (UNALLOCATED)") return;
        if (p._id === companyName || p._id === companyLegalName || normalizeKey(p._id) === cNorm) {
          actualCollected += Number(p.totalActualCollected) || 0;
        }
      });

      // Find committed/blocked fees for this company
      let blockedAmount = 0;
      admissionsByCompany.forEach((a: any) => {
        if (!a._id || a._id === "CASH" || a._id === "UNALLOCATED" || a._id === "CASH (UNALLOCATED)") return;
        if (a._id === companyName || a._id === companyLegalName || normalizeKey(a._id) === cNorm) {
          blockedAmount += Number(a.totalCommittedFee) || 0;
        }
      });

      // If blocked amount from admissions is 0 but company.collectedRevenue exists, keep existing record
      if (blockedAmount === 0 && Number(company.collectedRevenue) > 0) {
        blockedAmount = Number(company.collectedRevenue);
      }

      const cap = Number(company.annualCapacityCap) || 1949999;
      const remainingCapacity = Math.max(0, cap - blockedAmount);
      const capacityPercentage = cap > 0 ? Number(((blockedAmount / cap) * 100).toFixed(1)) : 0;

      return {
        ...company,
        name: companyName,
        legalName: companyLegalName,
        brands: Array.from(finalBrandsSet),
        annualCapacityCap: cap,
        collectedRevenue: blockedAmount, // Keep backwards compatibility with stored field
        actualCollected,
        blockedAmount,
        remainingCapacity,
        capacityPercentage
      };
    });

    return NextResponse.json({ success: true, companies: list });
  } catch (error: any) {
    console.error("Fetch Companies Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch companies" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const body = await req.json();
    const { name, legalName, gst, pan, bank, annualCapacityCap, address } = body;
    let { brands, brand } = body;

    let finalBrands = Array.isArray(brands) ? brands : brand ? [brand] : [];
    finalBrands = finalBrands.map((b: string) => b.toUpperCase().trim());

    if (user && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All") {
      if (finalBrands.length === 0) {
        finalBrands = [user.brandScope.toUpperCase().trim()];
      }
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const finalName = ((name || "").trim() || `New Company ${randomSuffix}`).toUpperCase();
    const finalLegalName = (legalName || finalName).trim().toUpperCase();

    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingComp = await Company.findOne({ name: { $regex: new RegExp(`^${escapeRegExp(finalName)}$`, "i") } });
    if (existingComp) {
      return NextResponse.json({ error: `Company '${existingComp.name}' already exists in database.` }, { status: 400 });
    }

    const newCompany = await Company.create({
      name: finalName,
      legalName: finalLegalName,
      gst: gst || "Not Provided",
      pan: pan || "Not Provided",
      bank: bank || "Bank Of India",
      annualCapacityCap: annualCapacityCap ? Number(annualCapacityCap) : 1949999,
      address: address || "No listed street, No City, No State, PIN",
      brands: finalBrands,
      status: "ACTIVE",
    });

    return NextResponse.json({ success: true, company: newCompany }, { status: 201 });
  } catch (error: any) {
    console.error("Create Company Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create company" }, { status: 500 });
  }
}
