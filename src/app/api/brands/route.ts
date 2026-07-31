import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Brand from "@/models/Brand";
import Company from "@/models/Company";
import User from "@/models/User";
import Admission from "@/models/Admission";
import Counsellor from "@/models/Counsellor";
import Enquiry from "@/models/Enquiry";
import { runUppercaseDataMigration } from "@/lib/uppercaseMigration";

export async function GET() {
  try {
    await dbConnect();
    await runUppercaseDataMigration();
    const brands = await Brand.find({}).sort({ createdAt: -1 }).lean();

    const enrichedBrands = await Promise.all(brands.map(async (brand: any) => {
      brand.name = (brand.name || "").toUpperCase().trim();
      brand.code = (brand.code || "").toUpperCase().trim();
      brand.companies = (brand.companies || []).map((c: any) => String(c).toUpperCase().trim());

      const brandRegex = new RegExp(`^${brand.name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, 'i');

      // 1. Legal Entities (Companies linked to this brand)
      const entities = await Company.find({ 
        $or: [
          { brand: brandRegex }, 
          { brands: { $elemMatch: { $regex: brandRegex } } },
          { name: { $in: brand.companies || [] } }
        ] 
      }).lean();

      // 2. Admissions & Revenue
      const admissions = await Admission.find({ 
        $or: [{ brand: brandRegex }, { targetBrand: brandRegex }] 
      }).lean();
      
      let totalRevenue = 0;
      admissions.forEach((a: any) => {
        totalRevenue += Number(a.amountPaid ?? a.finalFee ?? a.totalCourseFee ?? 0);
      });

      // Also check Enquiries with status Admitted
      const admittedEnquiries = await Enquiry.find({
        $or: [{ targetBrand: brandRegex }, { brand: brandRegex }],
        status: "Admitted"
      }).lean();

      admittedEnquiries.forEach((e: any) => {
        if (!admissions.some((a: any) => a.studentFullName === e.studentFullName || a.fullName === e.studentFullName || a.admissionId === e.enquiryId)) {
          const feeStr = String(e.feesCollected || e.expectedCourseFee || "0").replace(/[^0-9.]/g, "");
          totalRevenue += parseFloat(feeStr) || 0;
        }
      });

      // 3. Active Counsellors / Staff
      const counsellorsFromModel = await Counsellor.countDocuments({
        $or: [{ brandScope: brandRegex }, { brand: brandRegex }]
      });

      const counsellorsFromUsers = await User.countDocuments({
        role: { $in: ["counsellor", "counselor"] },
        $or: [{ brandScope: brandRegex }, { brand: brandRegex }]
      });

      const counsellorsCount = Math.max(counsellorsFromModel, counsellorsFromUsers, 1);

      // 4. Centre Heads Count
      const brandManagersCount = await User.countDocuments({
        role: { $in: ["brand manager", "brand-manager", "centre head", "centre-head"] },
        $or: [{ brandScope: brandRegex }, { brand: brandRegex }]
      });

      // 5. Enquiries / CRM Leads & Performance Stats
      const enquiries = await Enquiry.find({
        $or: [{ targetBrand: brandRegex }, { brand: brandRegex }]
      }).lean();

      const totalEnquiries = enquiries.length;
      const demosConducted = enquiries.filter((e: any) => 
        e.isDemoScheduled || (e.demos && e.demos.length > 0) || e.status === "Demo Scheduled" || e.status === "Demo Attended"
      ).length;
      const convertedEnquiriesCount = enquiries.filter((e: any) => e.isAdmitted || e.status === "Admitted" || e.status === "Admission" || e.status === "Converted").length;
      const admissionsCount = Math.max(admissions.length, convertedEnquiriesCount);
      const totalLeadsBase = Math.max(totalEnquiries, admissionsCount);
      const rawConv = totalLeadsBase > 0 ? (admissionsCount / totalLeadsBase) * 100 : 0;
      const conversionRate = Math.min(100, Math.max(0, Number(rawConv.toFixed(1)))).toFixed(1);

      return {
        ...brand,
        stats: {
          entitiesCount: entities.length,
          revenue: totalRevenue,
          counsellorsCount,
          brandManagersCount: Math.max(brandManagersCount, 1),
          totalEnquiries,
          demosConducted,
          admissionsCount,
          conversionRate: `${conversionRate}%`
        },
        legalEntities: entities,
      };
    }));

    return NextResponse.json({ success: true, brands: enrichedBrands });
  } catch (error: any) {
    console.error("Fetch Brands Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch brands" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    let { name, code, logoUrl, description, phone, email, website, address, companies, receiptTemplateUrl, receiptTerms, youtubeUrl, facebookUrl, instagramUrl } = body;

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    name = (name?.trim() || `New Brand ${randomSuffix}`).toUpperCase();
    code = (code?.trim() || `BRD-${randomSuffix}`).toUpperCase();
    companies = Array.isArray(companies) ? Array.from(new Set(companies.map((c: string) => c.toUpperCase().trim()))) : [];

    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingBrand = await Brand.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${escapeRegExp(name.trim())}$`, "i") } },
        ...(code ? [{ code: { $regex: new RegExp(`^${escapeRegExp(code.trim())}$`, "i") } }] : [])
      ]
    });

    if (existingBrand) {
      return NextResponse.json(
        { error: `Brand '${existingBrand.name}' already exists in database.` },
        { status: 400 }
      );
    }

    const newBrand = await Brand.create({
      name,
      code,
      logoUrl,
      description,
      phone,
      email,
      website,
      address,
      companies: Array.isArray(companies) ? Array.from(new Set(companies)) : [],
      receiptTemplateUrl,
      receiptTerms,
      youtubeUrl,
      facebookUrl,
      instagramUrl,
      status: "ACTIVE",
    });

    return NextResponse.json({ success: true, brand: newBrand }, { status: 201 });
  } catch (error: any) {
    console.error("Create Brand Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create brand" }, { status: 500 });
  }
}
