import { NextResponse } from "next/server";
import { getDailyBiReportData } from "@/lib/dailyBiService";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    
    let targetDate = new Date();
    if (dateParam) {
      const parsed = new Date(dateParam);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }

    const data = await getDailyBiReportData(targetDate);

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error("Error in GET /api/reports/daily-bi:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch Daily Business Intelligence Report" },
      { status: 500 }
    );
  }
}
