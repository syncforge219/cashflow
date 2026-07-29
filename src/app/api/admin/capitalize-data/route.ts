import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Company from "@/models/Company";
import Brand from "@/models/Brand";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import Expense from "@/models/Expense";
import Payment from "@/models/Payment";

export async function GET() {
  try {
    await dbConnect();

    // 1. CAPITALIZE COMPANIES
    const companies = await Company.find({});
    let updatedCompanies = 0;
    for (const c of companies) {
      if (c.name) c.name = String(c.name).toUpperCase().trim();
      if (c.legalName) c.legalName = String(c.legalName).toUpperCase().trim();
      if (Array.isArray(c.brands)) {
        c.brands = c.brands.map((b: string) => (b ? String(b).toUpperCase().trim() : b));
      }
      await c.save();
      updatedCompanies++;
    }

    // 2. CAPITALIZE BRANDS
    const brands = await Brand.find({});
    let updatedBrands = 0;
    for (const b of brands) {
      if (b.name) b.name = String(b.name).toUpperCase().trim();
      if (b.code) b.code = String(b.code).toUpperCase().trim();
      if (Array.isArray(b.companies)) {
        b.companies = b.companies.map((comp: string) => (comp ? String(comp).toUpperCase().trim() : comp));
      }
      await b.save();
      updatedBrands++;
    }

    // 3. CAPITALIZE ENQUIRIES
    const enquiries = await Enquiry.find({});
    let updatedEnquiries = 0;
    for (const enq of enquiries) {
      if (enq.targetBrand) enq.targetBrand = String(enq.targetBrand).toUpperCase().trim();
      if (enq.companyAssigned) enq.companyAssigned = String(enq.companyAssigned).toUpperCase().trim();
      await enq.save();
      updatedEnquiries++;
    }

    // 4. CAPITALIZE ADMISSIONS
    const admissions = await Admission.find({});
    let updatedAdmissions = 0;
    for (const adm of admissions) {
      if (adm.brand) adm.brand = String(adm.brand).toUpperCase().trim();
      if (adm.brandName) adm.brandName = String(adm.brandName).toUpperCase().trim();
      if (adm.company) adm.company = String(adm.company).toUpperCase().trim();
      if (adm.companyAssigned) adm.companyAssigned = String(adm.companyAssigned).toUpperCase().trim();
      await adm.save();
      updatedAdmissions++;
    }

    // 5. CAPITALIZE EXPENSES
    const expenses = await Expense.find({});
    let updatedExpenses = 0;
    for (const exp of expenses) {
      if (exp.brand) exp.brand = String(exp.brand).toUpperCase().trim();
      if (exp.company) exp.company = String(exp.company).toUpperCase().trim();
      await exp.save();
      updatedExpenses++;
    }

    // 6. CAPITALIZE PAYMENTS
    const payments = await Payment.find({});
    let updatedPayments = 0;
    for (const pay of payments) {
      if (pay.brand) pay.brand = String(pay.brand).toUpperCase().trim();
      if (pay.company) pay.company = String(pay.company).toUpperCase().trim();
      await pay.save();
      updatedPayments++;
    }

    return NextResponse.json({
      success: true,
      message: "Successfully converted all existing companies, brands, enquiries, admissions, expenses, and payments data to CAPSLOCK / UPPERCASE",
      details: {
        updatedCompanies,
        totalCompanies: companies.length,
        updatedBrands,
        totalBrands: brands.length,
        updatedEnquiries,
        totalEnquiries: enquiries.length,
        updatedAdmissions,
        totalAdmissions: admissions.length,
        updatedExpenses,
        totalExpenses: expenses.length,
        updatedPayments,
        totalPayments: payments.length,
      },
    });
  } catch (error: any) {
    console.error("Error capitalizing data:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to capitalize data" },
      { status: 500 }
    );
  }
}
