import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import CorporateTraining from "@/models/CorporateTraining";
import { getUserFromCookies } from "@/lib/helper";

export async function GET(request: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();

    const userRole = (user?.role || "").toLowerCase().trim();
    const isAuthorized =
      userRole === "admin" ||
      userRole === "super admin" ||
      userRole === "super_admin" ||
      userRole === "director" ||
      userRole === "brand_manager" ||
      userRole === "brand-manager" ||
      userRole === "brand manager" ||
      userRole === "manager" ||
      userRole === "centre head" ||
      userRole === "centre_head" ||
      userRole === "center head" ||
      userRole === "center_head" ||
      userRole === "counsellor" ||
      userRole === "counselor" ||
      userRole.includes("counsellor") ||
      userRole.includes("counselor");

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get("q") || "";
    const brandParam = searchParams.get("brand") || "";
    const statusParam = searchParams.get("status") || "";
    const facultyParam = searchParams.get("faculty") || "";
    const startDateParam = searchParams.get("startDate") || "";
    const endDateParam = searchParams.get("endDate") || "";
    const sortParam = searchParams.get("sort") || "date-desc";

    const query: any = {};

    // Role-based scoping
    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted =
      userBrand &&
      userBrand !== "All Brands" &&
      userBrand !== "All" &&
      userBrand !== "*" &&
      userBrand !== "global";

    if (isBrandRestricted) {
      const regex = new RegExp(userBrand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ brand: { $regex: regex } }, { brand: { $in: ["All Brands", "All", "global", "*"] } }];
    } else if (brandParam && brandParam !== "All Brands" && brandParam !== "All") {
      query.brand = brandParam;
    }

    if (statusParam && statusParam !== "All" && statusParam !== "All Statuses") {
      query.status = statusParam;
    }

    if (facultyParam && facultyParam !== "All" && facultyParam !== "All Faculty") {
      query.faculty = { $regex: new RegExp(facultyParam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };
    }

    // Date Range Filter
    if (startDateParam || endDateParam) {
      const dateFilter: any = {};
      if (startDateParam) {
        dateFilter.$gte = new Date(startDateParam);
      }
      if (endDateParam) {
        const endD = new Date(endDateParam);
        endD.setHours(23, 59, 59, 999);
        dateFilter.$lte = endD;
      }
      query.startDate = dateFilter;
    }

    // Search Query across multiple fields
    if (searchQuery.trim()) {
      const qRegex = new RegExp(searchQuery.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const searchOr = [
        { companyName: { $regex: qRegex } },
        { trainingProgram: { $regex: qRegex } },
        { faculty: { $regex: qRegex } },
        { trainingId: { $regex: qRegex } },
        { contactPerson: { $regex: qRegex } },
        { contactPhone: { $regex: qRegex } },
        { contactEmail: { $regex: qRegex } },
        { location: { $regex: qRegex } },
        { brand: { $regex: qRegex } },
        { companyAssigned: { $regex: qRegex } },
        { salesExecutive: { $regex: qRegex } },
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    // Sort order
    let sortObj: any = { startDate: -1, createdAt: -1 };
    if (sortParam === "date-asc") {
      sortObj = { startDate: 1, createdAt: 1 };
    } else if (sortParam === "amount-desc") {
      sortObj = { totalAmount: -1 };
    } else if (sortParam === "amount-asc") {
      sortObj = { totalAmount: 1 };
    } else if (sortParam === "name-asc") {
      sortObj = { companyName: 1 };
    } else if (sortParam === "name-desc") {
      sortObj = { companyName: -1 };
    }

    const trainings = await CorporateTraining.find(query).sort(sortObj).lean();

    return NextResponse.json({
      success: true,
      data: trainings,
      count: trainings.length,
    });
  } catch (error: any) {
    console.error("Error in GET /api/corporate-trainings:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch corporate trainings" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();

    const userRole = (user?.role || "").toLowerCase().trim();
    const isAuthorized =
      userRole === "admin" ||
      userRole === "super admin" ||
      userRole === "super_admin" ||
      userRole === "director" ||
      userRole === "brand_manager" ||
      userRole === "brand-manager" ||
      userRole === "brand manager" ||
      userRole === "manager" ||
      userRole === "centre head" ||
      userRole === "centre_head" ||
      userRole === "center head" ||
      userRole === "center_head" ||
      userRole === "counsellor" ||
      userRole === "counselor" ||
      userRole.includes("counsellor") ||
      userRole.includes("counselor");

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 403 });
    }

    const body = await request.json();
    const {
      companyName,
      contactPerson,
      contactPhone,
      contactEmail,
      trainingProgram,
      description,
      trainingMode,
      numberOfParticipants,
      location,
      faculty,
      facultyId,
      facultyEmail,
      facultyPhone,
      startDate,
      endDate,
      durationHours,
      totalAmount,
      amountReceived,
      paymentMode,
      brand,
      companyAssigned,
      salesExecutive,
      centreHead,
      status,
      remarks,
      initialPaymentRemarks,
    } = body;

    if (!companyName || !companyName.trim()) {
      return NextResponse.json({ success: false, error: "Client Organization Name is required" }, { status: 400 });
    }
    if (!trainingProgram || !trainingProgram.trim()) {
      return NextResponse.json({ success: false, error: "Training Program / Course Title is required" }, { status: 400 });
    }
    if (!faculty || !faculty.trim()) {
      return NextResponse.json({ success: false, error: "Faculty / Lead Trainer Name is required" }, { status: 400 });
    }
    if (!startDate) {
      return NextResponse.json({ success: false, error: "Training Start Date is required" }, { status: 400 });
    }
    if (!endDate) {
      return NextResponse.json({ success: false, error: "Training End Date is required" }, { status: 400 });
    }

    const totalAmtNum = Number(totalAmount) || 0;
    const amountRcvdNum = Number(amountReceived) || 0;
    const remainingBal = Math.max(0, totalAmtNum - amountRcvdNum);

    const paymentHistory: any[] = [];
    if (amountRcvdNum > 0) {
      const year = new Date().getFullYear();
      const randNum = Math.floor(1000 + Math.random() * 9000);
      paymentHistory.push({
        receiptNo: `CORP-REC-${year}-${randNum}`,
        amount: amountRcvdNum,
        date: new Date(),
        paymentMode: paymentMode || "Bank Transfer / NEFT",
        remarks: initialPaymentRemarks || "Initial Advance / Registration Payment",
        recordedBy: user?.name || "System",
      });
    }

    const defaultSalesExec =
      salesExecutive ||
      (userRole.includes("counsellor") || userRole.includes("counselor") ? user?.name : "Direct");

    const defaultCentreHead =
      centreHead ||
      (userRole.includes("manager") || userRole.includes("head") ? user?.name : "Main Centre");

    const isValidId = (val: any) =>
      val && typeof val === "string" && val.length === 24 && /^[0-9a-fA-F]{24}$/.test(val);

    const newTraining = new CorporateTraining({
      companyName: companyName.trim(),
      contactPerson: contactPerson?.trim() || "",
      contactPhone: contactPhone?.trim() || "",
      contactEmail: contactEmail?.trim() || "",
      trainingProgram: trainingProgram.trim(),
      description: description?.trim() || "",
      trainingMode: trainingMode || "Offline (Client Site)",
      numberOfParticipants: Number(numberOfParticipants) || 1,
      location: location?.trim() || "",
      faculty: faculty.trim(),
      facultyId: isValidId(facultyId) ? facultyId : undefined,
      facultyEmail: facultyEmail?.trim() || "",
      facultyPhone: facultyPhone?.trim() || "",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      durationHours: durationHours?.trim() || "",
      totalAmount: totalAmtNum,
      amountReceived: amountRcvdNum,
      remainingBalance: remainingBal,
      paymentMode: paymentMode || "Bank Transfer / NEFT",
      paymentHistory,
      brand: brand || user?.brandScope || "CADD MANTRA",
      companyAssigned: companyAssigned || "INSTITUTE OF CREATIVE STUDIES",
      salesExecutive: defaultSalesExec,
      salesExecutiveId: isValidId(user?._id) ? user?._id : undefined,
      centreHead: defaultCentreHead,
      centreHeadId: isValidId(user?._id) && (userRole.includes("manager") || userRole.includes("head")) ? user?._id : undefined,
      status: status || (remainingBal === 0 && totalAmtNum > 0 ? "Ongoing" : "Scheduled"),
      createdBy: isValidId(user?._id) ? user?._id : undefined,
      createdByName: user?.name || "Staff",
      createdByRole: user?.role || "Admin",
      remarks: remarks?.trim() || "",
    });

    await newTraining.save();

    return NextResponse.json({
      success: true,
      message: `Corporate Training ${newTraining.trainingId} added successfully!`,
      data: newTraining,
    });
  } catch (error: any) {
    console.error("Error in POST /api/corporate-trainings:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create corporate training" },
      { status: 500 }
    );
  }
}
