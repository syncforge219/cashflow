import dbConnect from "@/lib/db";
import Brand from "@/models/Brand";
import Company from "@/models/Company";
import User from "@/models/User";
import Counsellor from "@/models/Counsellor";
import Admission from "@/models/Admission";
import Enquiry from "@/models/Enquiry";
import Course from "@/models/Course";
import Batch from "@/models/Batch";
import Expense from "@/models/Expense";

let migrationRan = false;

/**
 * Migration helper that converts all existing saved Brand and Company names (and their references)
 * in MongoDB from lowercase/mixed-case to UPPERCASE.
 */
export async function runUppercaseDataMigration() {
  if (migrationRan) return;
  try {
    await dbConnect();
    console.log("[Uppercase Migration] Running check for saved brand & company records...");

    // 1. Migrate Brand documents
    const brands = await Brand.find({}).lean();
    for (const b of brands) {
      const upperName = (b.name || "").trim().toUpperCase();
      const upperCode = (b.code || "").trim().toUpperCase();
      const upperCompanies = (b.companies || []).map((c: string) => c.trim().toUpperCase());

      if (
        b.name !== upperName ||
        b.code !== upperCode ||
        JSON.stringify(b.companies || []) !== JSON.stringify(upperCompanies)
      ) {
        await Brand.findByIdAndUpdate(b._id, {
          name: upperName,
          code: upperCode,
          companies: upperCompanies,
        });
      }
    }

    // 2. Migrate Company documents
    const companies = await Company.find({}).lean();
    for (const c of companies) {
      const upperName = (c.name || "").trim().toUpperCase();
      const upperLegal = (c.legalName || c.name || "").trim().toUpperCase();
      const upperBrands = (c.brands || []).map((b: string) => b.trim().toUpperCase());
      const upperBrand = (c as any).brand ? (c as any).brand.trim().toUpperCase() : undefined;

      let updatePayload: any = {
        name: upperName,
        legalName: upperLegal,
        brands: upperBrands,
      };
      if (upperBrand) updatePayload.brand = upperBrand;

      if (
        c.name !== upperName ||
        c.legalName !== upperLegal ||
        JSON.stringify(c.brands || []) !== JSON.stringify(upperBrands)
      ) {
        await Company.findByIdAndUpdate(c._id, updatePayload);
      }
    }

    // 3. Migrate Users & Counsellors brandScope
    const users = await User.find({}).lean();
    for (const u of users) {
      if (u.brandScope && u.brandScope !== "All Brands" && u.brandScope !== "All") {
        const upperScope = u.brandScope.trim().toUpperCase();
        if (u.brandScope !== upperScope) {
          await User.findByIdAndUpdate(u._id, { brandScope: upperScope });
        }
      }
    }

    const counsellors = await Counsellor.find({}).lean();
    for (const c of counsellors) {
      if (c.brandScope && c.brandScope !== "All Brands" && c.brandScope !== "All") {
        const upperScope = c.brandScope.trim().toUpperCase();
        if (c.brandScope !== upperScope) {
          await Counsellor.findByIdAndUpdate(c._id, { brandScope: upperScope });
        }
      }
    }

    // 4. Migrate Admissions brand/company
    const admissions = await Admission.find({}).lean();
    for (const a of admissions) {
      let update: any = {};
      if (a.brand && a.brand.toUpperCase() !== a.brand) update.brand = a.brand.toUpperCase().trim();
      if ((a as any).targetBrand && (a as any).targetBrand.toUpperCase() !== (a as any).targetBrand) {
        update.targetBrand = (a as any).targetBrand.toUpperCase().trim();
      }
      if ((a as any).company && (a as any).company.toUpperCase() !== (a as any).company) {
        update.company = (a as any).company.toUpperCase().trim();
      }

      if (Object.keys(update).length > 0) {
        await Admission.findByIdAndUpdate(a._id, update);
      }
    }

    // 5. Migrate Enquiries brand/targetBrand
    const enquiries = await Enquiry.find({}).lean();
    for (const e of enquiries) {
      let update: any = {};
      if ((e as any).brand && (e as any).brand.toUpperCase() !== (e as any).brand) {
        update.brand = (e as any).brand.toUpperCase().trim();
      }
      if (e.targetBrand && e.targetBrand.toUpperCase() !== e.targetBrand) {
        update.targetBrand = e.targetBrand.toUpperCase().trim();
      }

      if (Object.keys(update).length > 0) {
        await Enquiry.findByIdAndUpdate(e._id, update);
      }
    }

    // 6. Migrate Courses, Batches, Expenses
    const courses = await Course.find({}).lean();
    for (const crs of courses) {
      if ((crs as any).brand && (crs as any).brand.toUpperCase() !== (crs as any).brand) {
        await Course.findByIdAndUpdate(crs._id, { brand: (crs as any).brand.toUpperCase().trim() });
      }
    }

    const batches = await Batch.find({}).lean();
    for (const btc of batches) {
      if (btc.brand && btc.brand.toUpperCase() !== btc.brand) {
        await Batch.findByIdAndUpdate(btc._id, { brand: btc.brand.toUpperCase().trim() });
      }
    }

    const expenses = await Expense.find({}).lean();
    for (const exp of expenses) {
      let update: any = {};
      if ((exp as any).brand && (exp as any).brand.toUpperCase() !== (exp as any).brand) {
        update.brand = (exp as any).brand.toUpperCase().trim();
      }
      if ((exp as any).company && (exp as any).company.toUpperCase() !== (exp as any).company) {
        update.company = (exp as any).company.toUpperCase().trim();
      }
      if (Object.keys(update).length > 0) {
        await Expense.findByIdAndUpdate(exp._id, update);
      }
    }

    // 7. Fix isUpgrade classification for Admission documents
    const allAdmissions = await Admission.find({}).sort({ createdAt: 1 }).lean();
    const seenMobiles = new Set<string>();

    for (const adm of allAdmissions) {
      const mobile = (adm.mobileNumber || "").trim();
      if (!mobile) continue;

      if (!seenMobiles.has(mobile)) {
        // First admission record for this student -> Fresh Student Admission
        seenMobiles.add(mobile);
        if (adm.isUpgrade === true) {
          await Admission.findByIdAndUpdate(adm._id, { isUpgrade: false });
        }
      } else {
        // Subsequent course admission for existing student -> Course Upgrade
        if (adm.isUpgrade !== true) {
          await Admission.findByIdAndUpdate(adm._id, { isUpgrade: true });
        }
      }
    }

    migrationRan = true;
    console.log("[Uppercase Migration] Successfully converted existing saved brand & company data to UPPERCASE.");
  } catch (err) {
    console.error("[Uppercase Migration] Error during migration:", err);
  }
}
