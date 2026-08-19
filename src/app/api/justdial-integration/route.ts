import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import JustdialConfig from "@/models/JustdialConfig";
import JustdialLeadLog from "@/models/JustdialLeadLog";

export async function GET() {
  try {
    await dbConnect();
    let config = await JustdialConfig.findOne({}).lean();

    if (!config) {
      const created = await JustdialConfig.create({
        connectorType: "Justdial Lead Connector Push API",
        leadSource: "JustDial",
        leadStage: "New / Fresh Inquiry",
        defaultBrand: "CADD MANTRA",
        counselorName: "HO - TARANG SINGHAL - SICCES PVT LTD",
        defaultCourse: "",
        apiKey: "JD-CF-API-KEY-984729103847",
        requireApiKey: false,
        autoAssignAdvisor: true,
        sendWelcomeWhatsApp: true,
        sendAdminAlertWhatsApp: true,
        createFollowUpTask: true,
        pullApiUrl: "",
        pullApiClientId: "",
        pullApiKey: "",
        pullApiMobile: "",
        apiLastUpdatedTime: new Date(),
        totalLeadsReceived: 0,
        courseMappings: [],
      });
      config = created.toObject();
    }

    const totalLogsCount = await JustdialLeadLog.countDocuments({});
    const successLogsCount = await JustdialLeadLog.countDocuments({ status: "SUCCESS" });

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        stats: {
          totalLeadsReceived: config.totalLeadsReceived || 0,
          lastLeadReceivedAt: config.lastLeadReceivedAt || null,
          totalLogsCount,
          successLogsCount,
        },
      },
    });
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
      defaultBrand,
      counselorName,
      defaultCourse,
      apiKey,
      requireApiKey,
      autoAssignAdvisor,
      sendWelcomeWhatsApp,
      sendAdminAlertWhatsApp,
      createFollowUpTask,
      pullApiUrl,
      pullApiClientId,
      pullApiKey,
      pullApiMobile,
      courseMappings,
    } = body;

    let config = await JustdialConfig.findOne({});
    if (!config) {
      config = new JustdialConfig({
        connectorType: connectorType || "Justdial Lead Connector Push API",
        leadSource: leadSource || "JustDial",
        leadStage: leadStage || "New / Fresh Inquiry",
        defaultBrand: defaultBrand || "CADD MANTRA",
        counselorName: counselorName || "HO - TARANG SINGHAL - SICCES PVT LTD",
        defaultCourse: defaultCourse || "",
        apiKey: apiKey || "JD-CF-API-KEY-984729103847",
        requireApiKey: Boolean(requireApiKey),
        autoAssignAdvisor: autoAssignAdvisor !== false,
        sendWelcomeWhatsApp: sendWelcomeWhatsApp !== false,
        sendAdminAlertWhatsApp: sendAdminAlertWhatsApp !== false,
        createFollowUpTask: createFollowUpTask !== false,
        pullApiUrl: pullApiUrl || "",
        pullApiClientId: pullApiClientId || "",
        pullApiKey: pullApiKey || "",
        pullApiMobile: pullApiMobile || "",
        apiLastUpdatedTime: new Date(),
        courseMappings: courseMappings || [],
      });
    } else {
      if (connectorType !== undefined) config.connectorType = connectorType;
      if (leadSource !== undefined) config.leadSource = leadSource;
      if (leadStage !== undefined) config.leadStage = leadStage;
      if (defaultBrand !== undefined) config.defaultBrand = defaultBrand;
      if (counselorName !== undefined) config.counselorName = counselorName;
      if (defaultCourse !== undefined) config.defaultCourse = defaultCourse;
      if (apiKey !== undefined) config.apiKey = apiKey;
      if (requireApiKey !== undefined) config.requireApiKey = Boolean(requireApiKey);
      if (autoAssignAdvisor !== undefined) config.autoAssignAdvisor = Boolean(autoAssignAdvisor);
      if (sendWelcomeWhatsApp !== undefined) config.sendWelcomeWhatsApp = Boolean(sendWelcomeWhatsApp);
      if (sendAdminAlertWhatsApp !== undefined) config.sendAdminAlertWhatsApp = Boolean(sendAdminAlertWhatsApp);
      if (createFollowUpTask !== undefined) config.createFollowUpTask = Boolean(createFollowUpTask);
      if (pullApiUrl !== undefined) config.pullApiUrl = pullApiUrl;
      if (pullApiClientId !== undefined) config.pullApiClientId = pullApiClientId;
      if (pullApiKey !== undefined) config.pullApiKey = pullApiKey;
      if (pullApiMobile !== undefined) config.pullApiMobile = pullApiMobile;
      if (courseMappings !== undefined) config.courseMappings = courseMappings;
      config.apiLastUpdatedTime = new Date();
    }

    await config.save();

    return NextResponse.json({
      success: true,
      message: "Justdial Integration configuration saved successfully!",
      data: config,
    });
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
    return NextResponse.json({
      success: true,
      message: "Justdial integration configuration reset successfully.",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
