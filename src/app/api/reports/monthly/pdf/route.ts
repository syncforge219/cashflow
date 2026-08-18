import { NextRequest, NextResponse } from "next/server";
import { getMonthlyReportStats } from "@/lib/dailyReportService";
import { generateMonthlyReportPdfBuffer } from "@/lib/pdfGenerator";

export async function GET(req: NextRequest) {
  try {
    const stats = await getMonthlyReportStats();
    const pdfBuffer = generateMonthlyReportPdfBuffer(stats);

    const safeMonth = (stats.monthStr || stats.dateStr || "Monthly").replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Monthly_Executive_Report_${safeMonth}.pdf`;

    return new NextResponse(Uint8Array.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error: any) {
    console.error("Error generating monthly report PDF:", error);
    return new NextResponse("Failed to generate monthly report PDF", { status: 500 });
  }
}
