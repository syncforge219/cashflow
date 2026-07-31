import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import JustdialConfig from "@/models/JustdialConfig";

export async function GET() {
  try {
    await dbConnect();
    let config = await JustdialConfig.findOne({}).lean();
    if (!config) {
      const created = await JustdialConfig.create({
        connectorType: "Justdial Lead Connector Push API",
        leadSource: "JustDial",
        leadStage: "New / Fresh Inquiry",
        counselorName: "HO - TARANG SINGHAL - SICCES PVT LTD",
        defaultCourse: "",
        apiKey: "JD-CF-API-KEY-984729103847",
        apiLastUpdatedTime: new Date(),
        courseMappings: [],
      });
      config = created.toObject();
    }
    return NextResponse.json({ success: true, data: config });
  } catch (error: any) {
    console.error("Error fetching Justdial config:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch Justdial config" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();

    const {
      connectorType,
      leadSource,
      leadStage,
      counselorName,
      defaultCourse,
      apiKey,
      courseMappings,
    } = body;

    let config = await JustdialConfig.findOne({});
    if (!config) {
      config = new JustdialConfig({
        connectorType,
        leadSource,
        leadStage,
        counselorName,
        defaultCourse,
        apiKey,
        apiLastUpdatedTime: new Date(),
        courseMappings: courseMappings || [],
      });
    } else {
      config.connectorType = connectorType ?? config.connectorType;
      config.leadSource = leadSource ?? config.leadSource;
      config.leadStage = leadStage ?? config.leadStage;
      config.counselorName = counselorName ?? config.counselorName;
      config.defaultCourse = defaultCourse ?? config.defaultCourse;
      config.apiKey = apiKey ?? config.apiKey;
      config.apiLastUpdatedTime = new Date();
      config.courseMappings = courseMappings || [];
    }

    await config.save();
    return NextResponse.json({ success: true, message: "Justdial Integration configuration saved successfully!", data: config });
  } catch (error: any) {
    console.error("Error saving Justdial config:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save Justdial config" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await dbConnect();
    await JustdialConfig.deleteMany({});
    return NextResponse.json({ success: true, message: "Justdial integration config reset/deleted." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
