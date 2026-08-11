process.env.DISABLE_CRON = "true";
import dbConnect from "../src/lib/db";
import { GET } from "../src/app/api/payments/route";
import User from "../src/models/User";
import mongoose from "mongoose";

// Simulating database helper logic

async function run() {
  await dbConnect();
  console.log("Connected to DB.");

  // Let's manually run the filter logic from route.ts to see what matches
  const testUser = async (username: string) => {
    const userDoc = await User.findOne({ $or: [{ email: username }, { username }] }).lean();
    if (!userDoc) {
      console.log(`User ${username} not found.`);
      return;
    }
    console.log(`\n--- Testing API for User: ${username} (BrandScope: "${userDoc.brandScope}") ---`);
    
    // Simulate what the GET endpoint does
    const companyParam = "SP DESIGN GATEWAY TRAINING SERVICES LLP";
    const userBrand = (userDoc.brandScope || (userDoc as any).brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    const andConditions: any[] = [];
    if (companyParam) {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cleanComp = companyParam.trim();
      const compRegex = new RegExp(`^${escapeRegExp(cleanComp)}$`, "i");

      const compAdmissions = await mongoose.model("Admission").find({
        companyAssigned: compRegex
      }).select("_id").lean();
      const compAdmissionIds = compAdmissions.map((a: any) => a._id);

      andConditions.push({
        $or: [
          { company: compRegex },
          { company: { $regex: new RegExp(escapeRegExp(cleanComp), "i") } },
          ...(compAdmissionIds.length > 0 ? [{ admissionId: { $in: compAdmissionIds } }] : [])
        ]
      });
    }

    const targetBrand = isBrandRestricted ? userBrand : null;
    if (targetBrand) {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const targetBrandsArr = targetBrand.split(",").map((b: string) => b.trim()).filter(Boolean);
      const regexArray = targetBrandsArr.map((b: string) => new RegExp(`^${escapeRegExp(b)}$`, "i"));

      const brandAdmissions = await mongoose.model("Admission").find({ brand: { $in: regexArray } }).select("_id").lean();
      const brandAdmissionIds = brandAdmissions.map((a: any) => a._id);

      andConditions.push({
        $or: [
          { brand: { $in: regexArray } },
          { admissionId: { $in: brandAdmissionIds } }
        ]
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};
    console.log("Constructed MongoDB Query:", JSON.stringify(query, null, 2));

    let payments = await mongoose.model("Payment").find(query)
      .populate("admissionId", "fullName admissionId brand course batch counsellor mobileNumber remainingBalance finalFee admissionDate companyAssigned")
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Pre-filtered Payments: ${payments.length}`);

    // Strict post-filtering
    if (targetBrand) {
      const targetBrandsLower = targetBrand.split(",").map((b: string) => b.trim().toLowerCase()).filter(Boolean);
      payments = payments.filter((p: any) => {
        const pb = (p.brand || p.admissionId?.brand || "").trim().toLowerCase();
        return targetBrandsLower.some((tb: string) => pb === tb || pb.includes(tb) || tb.includes(pb));
      });
    }
    console.log(`Post-filtered Payments: ${payments.length}`);
    payments.forEach((p: any) => {
      console.log(`- Receipt: ${p.receiptNo} | Student: ${p.studentName} | Brand: "${p.brand || p.admissionId?.brand}" | Company: "${p.company}"`);
    });
  };

  await testUser("admin@syncforge.com");
  await testUser("singhalchaitanya2006@gmail.com");
  await testUser("modiji@gmail.com");

  process.exit(0);
}

run().catch(console.error);
