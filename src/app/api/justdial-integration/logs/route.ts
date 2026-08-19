import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import JustdialLeadLog from "@/models/JustdialLeadLog";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";

    const query: any = {};
    if (status && status !== "ALL") {
      query.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { leadName: searchRegex },
        { mobile: searchRegex },
        { email: searchRegex },
        { category: searchRegex },
        { matchedCourse: searchRegex },
        { assignedCounselor: searchRegex },
        { enquiryId: searchRegex },
        { responseMessage: searchRegex },
      ];
    }

    const total = await JustdialLeadLog.countDocuments(query);
    const logs = await JustdialLeadLog.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error fetching Justdial logs:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch Justdial activity logs" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await dbConnect();
    await JustdialLeadLog.deleteMany({});
    return NextResponse.json({
      success: true,
      message: "Justdial activity logs cleared successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to clear logs" },
      { status: 500 }
    );
  }
}
