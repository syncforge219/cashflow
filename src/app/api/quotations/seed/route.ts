import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import QuotationProfile from "@/models/QuotationProfile";
import QuotationCustomer from "@/models/QuotationCustomer";
import QuotationProduct from "@/models/QuotationProduct";
import Quotation from "@/models/Quotation";
import QuotationCounter from "@/models/QuotationCounter";
import { numberToIndianWords } from "@/lib/numberToWords";

export async function POST() {
  try {
    await dbConnect();
    const companyId = "DEFAULT_COMPANY";

    // 1. Seed Company Profile
    await QuotationProfile.deleteMany({ companyId });
    const profile = await QuotationProfile.create({
      companyId,
      name: "AARAM PLASTICS PVT. LTD.",
      logo: "",
      gstin: "08AABCA5691D1ZS",
      cin: "U25209RJ1996PTC011513",
      description: "Manufacturers of : ISI MARKED 'GANGOTRI' HDPE PIPES, SPRINKLER SYSTEM AND PLB TELECOM DUCTS",
      address: "101, Vinayak Complex, Station Road",
      city: "JAIPUR",
      state: "Rajasthan",
      pincode: "302 001",
      phone: "0141-4059826",
      telefax: "0141-2370336",
      email: "appl_jaipur@rediffmail.com",
      website: "www.aaramplastics.com",
      worksAddress: "G-232, Sitapura Ind. Area, Tonk Road, JAIPUR - 302 022 (Raj.) Tel. : 0141-2771862",
      isoTag: "",
      bankDetails: {
        bankName: "STATE BANK OF INDIA",
        branch: "SITAPURA IND. AREA JAIPUR",
        accountNumber: "61330464677",
        ifsc: "SBIN0031792",
        rtgsCode: "SBIN0031792",
      },
      authorizedSignatory: "AUTHORISED SIGNATORY",
      defaultTerms: [
        "GST CHARGE EXTRA",
        "TRANSPORTATION INCLUDED",
        "PAYMENT ADVANCE",
        "ALL PIPE 6MTR LENGTH",
        "MATERIAL DELIVERD WITHIN 7DAYS",
      ],
      prefix: "APPL",
    });

    // 2. Seed Customers
    await QuotationCustomer.deleteMany({ companyId });
    const customers = await QuotationCustomer.insertMany([
      {
        companyId,
        name: "M/S ARVA ASSOCIATES",
        contactPerson: "Rajesh Sharma",
        address: "BUNGALOW NO 55 CANTT, SADAR BAZAR",
        city: "JHANSI",
        state: "Uttar Pradesh",
        pincode: "284001",
        gstin: "09AFIPA8247C1ZM",
        phone: "+91 9876543210",
        email: "arva.associates@gmail.com",
      },
      {
        companyId,
        name: "SHREE RAM INFRA LTD",
        contactPerson: "Amit Verma",
        address: "Plot 42, Industrial Area Phase 2",
        city: "LUCKNOW",
        state: "Uttar Pradesh",
        pincode: "226012",
        gstin: "09AABCS1234F1Z5",
        phone: "+91 9123456789",
        email: "contact@shreeraminfra.com",
      },
      {
        companyId,
        name: "GANGOTRI WATER CORP",
        contactPerson: "Vikas Gupta",
        address: "Near Water Works Tower, Tonk Road",
        city: "JAIPUR",
        state: "Rajasthan",
        pincode: "302015",
        gstin: "08AAACG9876E1ZH",
        phone: "+91 9414012345",
        email: "info@gangotriwater.org",
      },
    ]);

    // 3. Seed Products across Software, Digital Marketing, Products & Services
    await QuotationProduct.deleteMany({ companyId });
    const products = await QuotationProduct.insertMany([
      // Software / SaaS Products
      {
        companyId,
        category: "SOFTWARE",
        billingCycle: "MONTHLY",
        name: "Enterprise ERP SaaS Subscription",
        description: "Cloud-hosted multi-module ERP software subscription per active user seat",
        sku: "SW-ERP-USER-M",
        hsnCode: "998314",
        unit: "seat/mo",
        defaultRate: 1500,
        gstRate: 18,
      },
      {
        companyId,
        category: "SOFTWARE",
        billingCycle: "YEARLY",
        name: "Custom Software & Web Application Development",
        description: "Full-stack web application development, deployment, and API integration",
        sku: "SW-DEV-PROJ",
        hsnCode: "998313",
        unit: "project",
        defaultRate: 250000,
        gstRate: 18,
      },
      // Digital Marketing Services
      {
        companyId,
        category: "DIGITAL_MARKETING",
        billingCycle: "MONTHLY",
        name: "Full-Stack SEO & Content Marketing Retainer",
        description: "On-page, off-page technical SEO, monthly 8 blog articles & keyword rank tracking",
        sku: "DM-SEO-MONTHLY",
        hsnCode: "998365",
        unit: "month",
        defaultRate: 35000,
        gstRate: 18,
      },
      {
        companyId,
        category: "DIGITAL_MARKETING",
        billingCycle: "QUARTERLY",
        name: "Google Ads & Social Media Ad Campaign Management",
        description: "PPC strategy, ad copy creation, audience targeting, and weekly performance reporting",
        sku: "DM-ADS-QTR",
        hsnCode: "998366",
        unit: "quarter",
        defaultRate: 90000,
        gstRate: 18,
      },
      // Physical Products / Manufacturing
      {
        companyId,
        category: "PRODUCT",
        billingCycle: "ONE_TIME",
        name: "HDPE PIPE 160MM, PE100, PN6",
        description: "6 Mtr Length High Density Polyethylene Pipe",
        sku: "HDP-160-PN6",
        hsnCode: "39172110",
        unit: "mtr",
        defaultRate: 390,
        gstRate: 18,
      },
      {
        companyId,
        category: "PRODUCT",
        billingCycle: "ONE_TIME",
        name: "SPRINKLER PIPE 75MM Class 2",
        description: "ISI Marked Sprinkler Irrigation Pipe with Latch",
        sku: "SPK-75-CL2",
        hsnCode: "39173990",
        unit: "pc",
        defaultRate: 480,
        gstRate: 12,
      },
      // IT Services & Consulting
      {
        companyId,
        category: "SERVICE",
        billingCycle: "YEARLY",
        name: "Annual IT Infrastructure & Security AMC",
        description: "24/7 server monitoring, automated backups, patches, and emergency support",
        sku: "SVC-AMC-ANNUAL",
        hsnCode: "998315",
        unit: "year",
        defaultRate: 120000,
        gstRate: 18,
      },
    ]);

    // Reset Counter
    await QuotationCounter.deleteMany({ companyId });
    await QuotationCounter.create({ companyId, financialYear: "2026-27", seq: 5 });

    // 4. Seed Quotations across Categories
    await Quotation.deleteMany({ companyId });

    // Reference Quotation #1: PRODUCT (One-Time)
    const subtotal1 = 1100 * 390 + 1300 * 230; // 728000
    const gst1 = Math.round(subtotal1 * 0.18); // 131040
    const grandTotal1 = subtotal1 + gst1;

    const q1 = {
      companyId,
      category: "PRODUCT",
      billingCycle: "ONE_TIME",
      contractPeriod: "One-Time Delivery",
      quotationNumber: "APPL/2026-27/0001",
      date: new Date("2026-08-20"),
      poNumber: "APPL/2026-27",
      customerId: customers[0]._id,
      customerName: customers[0].name,
      consigneeInfo: "BUNGALOW NO 55 CANTT\nSADAR BAZAR, JHANSI-284001",
      customerAddress: customers[0].address,
      customerGstin: customers[0].gstin,
      deliveryLocation: "CHITRAKOOT",
      items: [
        {
          productId: products[4]._id,
          name: "HDPE PIPE 160MM, PE100, PN6",
          description: "6 Mtr Length",
          quantity: 1100,
          unit: "mtr",
          rate: 390,
          gstRate: 18,
          amount: 429000,
        },
      ],
      subtotal: subtotal1,
      discount: 0,
      gstRate: 18,
      gstAmount: gst1,
      transportCharges: 0,
      transportText: "included",
      grandTotal: grandTotal1,
      amountInWords: numberToIndianWords(grandTotal1),
      termsAndConditions: profile.defaultTerms,
      bankDetails: profile.bankDetails,
      status: "SENT",
      createdBy: "Abhigyan Mishra (CFO)",
      companyName: profile.name,
      companyGstin: profile.gstin,
      companyCin: profile.cin,
      companyDescription: profile.description,
      companyAddress: profile.address,
      companyPhone: profile.phone,
      companyEmail: profile.email,
      companyWebsite: profile.website,
      companyWorksAddress: profile.worksAddress,
      authorizedSignatory: profile.authorizedSignatory,
    };

    // Quotation #2: SOFTWARE (Monthly SaaS Subscription)
    const subtotal2 = 25 * 1500; // 25 seat/mo = 37,500
    const gst2 = Math.round(subtotal2 * 0.18); // 6,750
    const grandTotal2 = subtotal2 + gst2; // 44,250

    const q2 = {
      companyId,
      category: "SOFTWARE",
      billingCycle: "MONTHLY",
      contractPeriod: "12 Months Commitment",
      quotationNumber: "APPL/2026-27/0002",
      date: new Date("2026-08-21"),
      poNumber: "SW-SAAS-2026",
      customerId: customers[1]._id,
      customerName: customers[1].name,
      consigneeInfo: customers[1].name,
      customerAddress: customers[1].address,
      customerGstin: customers[1].gstin,
      deliveryLocation: "Cloud Deployment",
      items: [
        {
          productId: products[0]._id,
          name: "Enterprise ERP SaaS Subscription",
          description: "25 Active User Seats with Cloud Backups & Premium Support",
          quantity: 25,
          unit: "seat/mo",
          rate: 1500,
          gstRate: 18,
          amount: 37500,
        },
      ],
      subtotal: subtotal2,
      discount: 0,
      gstRate: 18,
      gstAmount: gst2,
      transportCharges: 0,
      transportText: "N/A (Digital)",
      grandTotal: grandTotal2,
      amountInWords: numberToIndianWords(grandTotal2),
      termsAndConditions: [
        "BILLING IN ADVANCE EVERY MONTH",
        "12 MONTHS MINIMUM CONTRACT PERIOD",
        "99.9% UPTIME SLA GUARANTEED",
        "INCLUDES 24/7 EMAIL & PHONE SUPPORT",
        "GST 18% APPLICABLE EXTRA AS PER GOVT NORMS",
      ],
      bankDetails: profile.bankDetails,
      status: "SENT",
      createdBy: "Abhigyan Mishra (CFO)",
      companyName: profile.name,
      companyGstin: profile.gstin,
      companyCin: profile.cin,
      companyDescription: profile.description,
      companyAddress: profile.address,
      companyPhone: profile.phone,
      companyEmail: profile.email,
      companyWebsite: profile.website,
      companyWorksAddress: profile.worksAddress,
      authorizedSignatory: profile.authorizedSignatory,
    };

    // Quotation #3: DIGITAL MARKETING (Quarterly Retainer)
    const subtotal3 = 1 * 90000; // 90,000 / quarter
    const gst3 = Math.round(subtotal3 * 0.18); // 16,200
    const grandTotal3 = subtotal3 + gst3; // 106,200

    const q3 = {
      companyId,
      category: "DIGITAL_MARKETING",
      billingCycle: "QUARTERLY",
      contractPeriod: "Q3-Q4 2026 Campaign",
      quotationNumber: "APPL/2026-27/0003",
      date: new Date("2026-08-15"),
      poNumber: "DM-RETAINER-01",
      customerId: customers[2]._id,
      customerName: customers[2].name,
      consigneeInfo: customers[2].name,
      customerAddress: customers[2].address,
      customerGstin: customers[2].gstin,
      deliveryLocation: "Digital Marketing Campaign",
      items: [
        {
          productId: products[3]._id,
          name: "Google Ads & Social Media Ad Campaign Management",
          description: "Includes Keyword Optimization, Ad Copies, Graphic Banners, and Analytics Dashboards",
          quantity: 1,
          unit: "quarter",
          rate: 90000,
          gstRate: 18,
          amount: 90000,
        },
      ],
      subtotal: subtotal3,
      discount: 0,
      gstRate: 18,
      gstAmount: gst3,
      transportCharges: 0,
      transportText: "N/A (Digital Services)",
      grandTotal: grandTotal3,
      amountInWords: numberToIndianWords(grandTotal3),
      termsAndConditions: [
        "PAYMENT 100% IN ADVANCE AT THE START OF EACH QUARTER",
        "AD SPEND BUDGET TO BE PAID DIRECTLY BY CLIENT TO GOOGLE/META",
        "MONTHLY STRATEGY & ROI REPORTING CALL INCLUDED",
        "MINIMUM 6 MONTHS ENGAGEMENT",
      ],
      bankDetails: profile.bankDetails,
      status: "ACCEPTED",
      createdBy: "CFO Executive",
      companyName: profile.name,
      companyGstin: profile.gstin,
      companyCin: profile.cin,
      companyDescription: profile.description,
      companyAddress: profile.address,
      companyPhone: profile.phone,
      companyEmail: profile.email,
      companyWebsite: profile.website,
      companyWorksAddress: profile.worksAddress,
      authorizedSignatory: profile.authorizedSignatory,
    };

    // Quotation #4: SERVICE (Annual AMC)
    const q4 = {
      companyId,
      category: "SERVICE",
      billingCycle: "YEARLY",
      contractPeriod: "1 Year Contract",
      quotationNumber: "APPL/2026-27/0004",
      date: new Date("2026-08-10"),
      poNumber: "SVC-AMC-99",
      customerId: customers[1]._id,
      customerName: customers[1].name,
      consigneeInfo: customers[1].name,
      customerAddress: customers[1].address,
      customerGstin: customers[1].gstin,
      deliveryLocation: "Lucknow Corporate HQ",
      items: [
        {
          productId: products[6]._id,
          name: "Annual IT Infrastructure & Security AMC",
          description: "Full year 24/7 on-site and remote server management",
          quantity: 1,
          unit: "year",
          rate: 120000,
          gstRate: 18,
          amount: 120000,
        },
      ],
      subtotal: 120000,
      discount: 10000,
      gstRate: 18,
      gstAmount: 19800,
      transportCharges: 0,
      transportText: "Included",
      grandTotal: 129800,
      amountInWords: numberToIndianWords(129800),
      termsAndConditions: [
        "50% ADVANCE UPON SIGNING, 50% AFTER 6 MONTHS",
        "INCLUDES 4 PREVENTIVE MAINTENANCE VISITS PER YEAR",
        "PARTS REPLACEMENT BILLED SEPARATELY AT ACTUALS",
      ],
      bankDetails: profile.bankDetails,
      status: "DRAFT",
      createdBy: "CFO Executive",
      companyName: profile.name,
      companyGstin: profile.gstin,
      companyCin: profile.cin,
      companyDescription: profile.description,
      companyAddress: profile.address,
      companyPhone: profile.phone,
      companyEmail: profile.email,
      companyWebsite: profile.website,
      companyWorksAddress: profile.worksAddress,
      authorizedSignatory: profile.authorizedSignatory,
    };

    // Quotation #5: EXPIRED sample
    const q5 = {
      companyId,
      category: "PRODUCT",
      billingCycle: "ONE_TIME",
      contractPeriod: "Immediate",
      quotationNumber: "APPL/2026-27/0005",
      date: new Date("2026-07-01"),
      poNumber: "EXPIRED-REQ-001",
      customerId: customers[0]._id,
      customerName: customers[0].name,
      consigneeInfo: customers[0].name,
      customerAddress: customers[0].address,
      customerGstin: customers[0].gstin,
      deliveryLocation: "JHANSI SITE",
      items: [
        {
          productId: products[4]._id,
          name: "HDPE PIPE 160MM, PE100, PN6",
          description: "6 Mtr Length",
          quantity: 300,
          unit: "mtr",
          rate: 390,
          gstRate: 18,
          amount: 117000,
        },
      ],
      subtotal: 117000,
      discount: 0,
      gstRate: 18,
      gstAmount: 21060,
      transportCharges: 0,
      transportText: "included",
      grandTotal: 138060,
      amountInWords: numberToIndianWords(138060),
      termsAndConditions: profile.defaultTerms,
      bankDetails: profile.bankDetails,
      status: "EXPIRED",
      createdBy: "Admin",
      companyName: profile.name,
      companyGstin: profile.gstin,
      companyCin: profile.cin,
      companyDescription: profile.description,
      companyAddress: profile.address,
      companyPhone: profile.phone,
      companyEmail: profile.email,
      companyWebsite: profile.website,
      companyWorksAddress: profile.worksAddress,
      authorizedSignatory: profile.authorizedSignatory,
    };

    const seededQuotations = await Quotation.insertMany([q1, q2, q3, q4, q5]);

    return NextResponse.json({
      success: true,
      message: "Quotation suite seeded successfully with company profile, 3 customers, 5 products, and 5 sample quotations!",
      seeded: {
        profile,
        customersCount: customers.length,
        productsCount: products.length,
        quotationsCount: seededQuotations.length,
      },
    });
  } catch (error: any) {
    console.error("Error seeding quotation data:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
