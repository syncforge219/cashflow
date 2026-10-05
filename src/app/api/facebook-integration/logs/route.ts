import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import FacebookLeadLog from "@/models/FacebookLeadLog";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";

    const query: any = {};
    if (status && status !== "ALL") query.status = status;

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { leadName: searchRegex },
        { mobile: searchRegex },
        { email: searchRegex },
        { leadgenId: searchRegex },
        { formId: searchRegex },
        { campaignName: searchRegex },
        { enquiryId: searchRegex },
        { errorDetails: searchRegex },
      ];
    }

    const [total, logs] = await Promise.all([
      FacebookLeadLog.countDocuments(query),
      FacebookLeadLog.find(query).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error("Error fetching Facebook logs:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch logs" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await dbConnect();
    // Keep SUCCESS rows: they are the record of which Meta leads were already imported
    const { deletedCount } = await FacebookLeadLog.deleteMany({ status: { $ne: "SUCCESS" } });
    return NextResponse.json({
      success: true,
      message: `Cleared ${deletedCount} failed/duplicate log entries. Successful imports are kept to prevent re-importing.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Failed to clear logs" }, { status: 500 });
  }
}
