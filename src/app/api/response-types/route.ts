import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ResponseType from "@/models/ResponseType";

const DEFAULT_RESPONSE_TYPES = [
  "incoming call",
  "INCOMING NOT AVAIALABLE",
  "Not interested",
  "ntr",
  "remark",
  "RNR",
  "sw/off",
  "Wrong no.",
  "Telephonic",
  "WhatsApp",
  "Email",
  "Walkin",
  "Campus Visit",
];

export async function GET() {
  try {
    await dbConnect();

    let types = await ResponseType.find({}).sort({ createdAt: 1 }).lean();

    // Auto-seed default options if empty
    if (!types || types.length === 0) {
      const seedData = DEFAULT_RESPONSE_TYPES.map((name) => ({
        name,
        remarks: "System default response type",
        isSystem: true,
      }));
      await ResponseType.insertMany(seedData).catch(() => {});
      types = await ResponseType.find({}).sort({ createdAt: 1 }).lean();
    }

    return NextResponse.json({
      success: true,
      data: types.map((t: any) => ({
        _id: t._id,
        name: t.name,
        remarks: t.remarks || "",
        isSystem: !!t.isSystem,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching response types:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch response types" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const { name, remarks } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, message: "Response Type Name is required" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();

    // Check duplicate
    const existing = await ResponseType.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        data: existing,
        message: "Response type already exists!",
      });
    }

    const newType = await ResponseType.create({
      name: trimmedName,
      remarks: remarks || "",
      isSystem: false,
    });

    return NextResponse.json({
      success: true,
      data: newType,
      message: "Response type added successfully!",
    });
  } catch (error: any) {
    console.error("Error creating response type:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create response type" },
      { status: 500 }
    );
  }
}
