import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import OfficeLocation from "@/models/OfficeLocation";
import { getUserFromCookies } from "@/lib/helper";

export async function GET(request: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const { searchParams } = new URL(request.url);
    let brand = searchParams.get("brand");

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    if (userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global") {
      brand = userBrand;
    }

    const query: any = {};
    if (brand && brand !== "All" && brand !== "All Brands") {
      query.brand = { $in: [brand, "All"] };
    }

    // Find the location specific to this brand first, or fallback to global location
    let officeLoc = null;
    if (brand && brand !== "All" && brand !== "All Brands") {
      officeLoc = await OfficeLocation.findOne({ brand: { $regex: new RegExp(`^${brand.trim()}$`, "i") } }).lean();
    }
    if (!officeLoc) {
      officeLoc = await OfficeLocation.findOne({ brand: { $in: ["All", "All Brands", "global", ""] } }).sort({ updatedAt: -1 }).lean();
    }
    if (!officeLoc) {
      officeLoc = await OfficeLocation.findOne({}).sort({ updatedAt: -1 }).lean();
    }

    // Fetch all brand location configurations
    const allLocations = await OfficeLocation.find({}).sort({ brand: 1 }).lean();

    return NextResponse.json({
      success: true,
      location: officeLoc || null,
      allLocations: allLocations || [],
    });
  } catch (error: any) {
    console.error("GET /api/staff-attendance/location Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch office location" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access" },
        { status: 401 }
      );
    }

    const roleLower = (user.role || "").toLowerCase().trim();
    const isAdmin =
      roleLower.includes("admin") ||
      roleLower.includes("head") ||
      roleLower.includes("manager") ||
      roleLower.includes("cfo") ||
      roleLower.includes("director");

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Only Admin or Managers can configure office location" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { latitude, longitude, radiusMeters, address, brand } = body;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: "Latitude and Longitude are required." },
        { status: 400 }
      );
    }

    const targetBrand = brand || user.brandScope || "All";

    // Upsert or create new location configuration
    const updatedLoc = await OfficeLocation.findOneAndUpdate(
      { brand: targetBrand },
      {
        latitude: Number(latitude),
        longitude: Number(longitude),
        radiusMeters: Number(radiusMeters) || 200,
        address: address || "",
        brand: targetBrand,
        updatedBy: user.name || user.email || "Admin",
      },
      { upsert: true, new: true, runValidators: true }
    );

    return NextResponse.json({
      success: true,
      message: "Office location updated successfully",
      location: updatedLoc,
    });
  } catch (error: any) {
    console.error("POST /api/staff-attendance/location Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save office location" },
      { status: 500 }
    );
  }
}
