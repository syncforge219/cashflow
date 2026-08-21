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
      isoTag: "ISO 9001",
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

    // 3. Seed Products
    await QuotationProduct.deleteMany({ companyId });
    const products = await QuotationProduct.insertMany([
      {
        companyId,
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
        name: "HDPE PIPE 110MM, PE100, PN6",
        description: "6 Mtr Length High Density Polyethylene Pipe",
        sku: "HDP-110-PN6",
        hsnCode: "39172110",
        unit: "mtr",
        defaultRate: 230,
        gstRate: 18,
      },
      {
        companyId,
        name: "SPRINKLER PIPE 75MM Class 2",
        description: "ISI Marked Sprinkler Irrigation Pipe with Latch",
        sku: "SPK-75-CL2",
        hsnCode: "39173990",
        unit: "pc",
        defaultRate: 480,
        gstRate: 12,
      },
      {
        companyId,
        name: "PLB TELECOM DUCT 40/33 MM",
        description: "Permanently Lubricated HDPE Duct for Fiber Cable",
        sku: "PLB-4033",
        hsnCode: "39173290",
        unit: "mtr",
        defaultRate: 45,
        gstRate: 18,
      },
      {
        companyId,
        name: "HDPE COUPLER 160MM Electrofusion",
        description: "Electrofusion Coupling Joint Fitting",
        sku: "EF-COUPLER-160",
        hsnCode: "39174000",
        unit: "pc",
        defaultRate: 850,
        gstRate: 18,
      },
    ]);

    // Reset Counter
    await QuotationCounter.deleteMany({ companyId });
    await QuotationCounter.create({ companyId, financialYear: "2026-27", seq: 5 });

    // 4. Seed Quotations (including exact reference sample)
    await Quotation.deleteMany({ companyId });

    // Reference Quotation #1: APPL/2026-27/0001 (SENT)
    const subtotal1 = 1100 * 390 + 1300 * 230; // 429000 + 299000 = 728000
    const gst1 = Math.round(subtotal1 * 0.18); // 131040
    const grandTotal1 = subtotal1 + gst1; // 859040

    const q1 = {
      companyId,
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
          productId: products[0]._id,
          name: "HDPE PIPE 160MM, PE100, PN6",
          description: "6 Mtr Length",
          quantity: 1100,
          unit: "mtr",
          rate: 390,
          gstRate: 18,
          amount: 429000,
        },
        {
          productId: products[1]._id,
          name: "HDPE PIPE 110MM, PE100, PN6",
          description: "6 Mtr Length",
          quantity: 1300,
          unit: "mtr",
          rate: 230,
          gstRate: 18,
          amount: 299000,
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

    // Quotation #2: DRAFT
    const subtotal2 = 500 * 480; // 240000
    const gst2 = Math.round(subtotal2 * 0.12); // 28800
    const grandTotal2 = subtotal2 + gst2 + 5000; // 273800

    const q2 = {
      companyId,
      quotationNumber: "APPL/2026-27/0002",
      date: new Date("2026-08-21"),
      poNumber: "PO-RAM-904",
      customerId: customers[1]._id,
      customerName: customers[1].name,
      consigneeInfo: customers[1].name,
      customerAddress: customers[1].address,
      customerGstin: customers[1].gstin,
      deliveryLocation: "LUCKNOW SITE",
      items: [
        {
          productId: products[2]._id,
          name: "SPRINKLER PIPE 75MM Class 2",
          description: "ISI Marked Sprinkler Irrigation Pipe",
          quantity: 500,
          unit: "pc",
          rate: 480,
          gstRate: 12,
          amount: 240000,
        },
      ],
      subtotal: subtotal2,
      discount: 0,
      gstRate: 12,
      gstAmount: gst2,
      transportCharges: 5000,
      transportText: "₹5,000",
      grandTotal: grandTotal2,
      amountInWords: numberToIndianWords(grandTotal2),
      termsAndConditions: profile.defaultTerms,
      bankDetails: profile.bankDetails,
      status: "DRAFT",
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

    // Quotation #3: ACCEPTED
    const subtotal3 = 2000 * 45; // 90000
    const gst3 = Math.round(subtotal3 * 0.18); // 16200
    const grandTotal3 = subtotal3 + gst3; // 106200

    const q3 = {
      companyId,
      quotationNumber: "APPL/2026-27/0003",
      date: new Date("2026-08-15"),
      poNumber: "GANG-WATER-101",
      customerId: customers[2]._id,
      customerName: customers[2].name,
      consigneeInfo: customers[2].name,
      customerAddress: customers[2].address,
      customerGstin: customers[2].gstin,
      deliveryLocation: "JAIPUR WATER PLANT",
      items: [
        {
          productId: products[3]._id,
          name: "PLB TELECOM DUCT 40/33 MM",
          description: "Fiber Cable Duct",
          quantity: 2000,
          unit: "mtr",
          rate: 45,
          gstRate: 18,
          amount: 90000,
        },
      ],
      subtotal: subtotal3,
      discount: 0,
      gstRate: 18,
      gstAmount: gst3,
      transportCharges: 0,
      transportText: "included",
      grandTotal: grandTotal3,
      amountInWords: numberToIndianWords(grandTotal3),
      termsAndConditions: profile.defaultTerms,
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

    // Quotation #4: REJECTED
    const q4 = {
      companyId,
      quotationNumber: "APPL/2026-27/0004",
      date: new Date("2026-08-10"),
      poNumber: "PO-OLD-88",
      customerId: customers[1]._id,
      customerName: customers[1].name,
      consigneeInfo: customers[1].name,
      customerAddress: customers[1].address,
      customerGstin: customers[1].gstin,
      deliveryLocation: "KANPUR DEPOT",
      items: [
        {
          productId: products[4]._id,
          name: "HDPE COUPLER 160MM Electrofusion",
          description: "Fitting Coupler",
          quantity: 100,
          unit: "pc",
          rate: 850,
          gstRate: 18,
          amount: 85000,
        },
      ],
      subtotal: 85000,
      discount: 5000,
      gstRate: 18,
      gstAmount: 14400,
      transportCharges: 2000,
      transportText: "₹2,000",
      grandTotal: 96400,
      amountInWords: numberToIndianWords(96400),
      termsAndConditions: profile.defaultTerms,
      bankDetails: profile.bankDetails,
      status: "REJECTED",
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

    // Quotation #5: EXPIRED
    const q5 = {
      companyId,
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
          productId: products[0]._id,
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
