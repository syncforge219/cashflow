import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Company from "@/models/Company";
import Brand from "@/models/Brand";
import { getUserFromCookies } from "@/lib/helper";

export async function GET() {
  try {
    await dbConnect();
    const user = await getUserFromCookies();

    let query: any = {};
    if (user && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All") {
      const scopeBrand = await Brand.findOne({ name: user.brandScope }).lean();
      const scopeBrandCompanies = scopeBrand?.companies || [];
      query.$or = [
        { brand: user.brandScope }, 
        { brands: user.brandScope },
        { name: { $in: scopeBrandCompanies } }
      ];
    }

    let list = await Company.find(query).sort({ createdAt: -1 }).lean();
    
    // Reverse mapping: Find brands that have associated this company
    const allBrands = await Brand.find({}).lean();
    list = list.map((company: any) => {
      const reversedBrands = allBrands
        .filter((b: any) => b.companies && b.companies.includes(company.name))
        .map((b: any) => b.name);
      
      const finalBrandsSet = new Set([...(company.brands || []), ...reversedBrands]);
      if (company.brand) finalBrandsSet.add(company.brand); // backward compatibility
      
      return {
        ...company,
        brands: Array.from(finalBrandsSet)
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

    if (user && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All") {
      if (finalBrands.length === 0) {
        finalBrands = [user.brandScope];
      }
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const finalName = (name || "").trim() || `New Company ${randomSuffix}`;

    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingComp = await Company.findOne({ name: { $regex: new RegExp(`^${escapeRegExp(finalName)}$`, "i") } });
    if (existingComp) {
      return NextResponse.json({ error: `Company '${existingComp.name}' already exists in database.` }, { status: 400 });
    }

    const newCompany = await Company.create({
      name: finalName,
      legalName: legalName || finalName,
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
