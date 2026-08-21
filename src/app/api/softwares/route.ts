import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Software from "@/models/Software";

export async function GET() {
  try {
    await dbConnect();
    const softwares = await Software.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: softwares });
  } catch (error: any) {
    console.error("Error fetching softwares:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { name, domain, techUsed, developerNames, description, status } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Software name is required" },
        { status: 400 }
      );
    }

    // Process techUsed array
    let parsedTech: string[] = [];
    if (Array.isArray(techUsed)) {
      parsedTech = techUsed.map((t: any) => String(t).trim()).filter(Boolean);
    } else if (typeof techUsed === "string") {
      parsedTech = techUsed.split(",").map((t) => t.trim()).filter(Boolean);
    }

    // Process developerNames array
    let parsedDevs: string[] = [];
    if (Array.isArray(developerNames)) {
      parsedDevs = developerNames.map((d: any) => String(d).trim()).filter(Boolean);
    } else if (typeof developerNames === "string") {
      parsedDevs = developerNames.split(",").map((d) => d.trim()).filter(Boolean);
    }

    const newSoftware = new Software({
      name: name.trim(),
      domain: domain ? domain.trim() : "",
      techUsed: parsedTech,
      developerNames: parsedDevs,
      description: description ? description.trim() : "",
      status: status || "Active",
    });

    await newSoftware.save();

    return NextResponse.json(
      {
        success: true,
        message: "Software registered successfully",
        data: newSoftware,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating software:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to register software" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { id, _id, name, domain, techUsed, developerNames, description, status } = body;
    const targetId = id || _id;

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: "Software ID is required for update" },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Software name is required" },
        { status: 400 }
      );
    }

    let parsedTech: string[] = [];
    if (Array.isArray(techUsed)) {
      parsedTech = techUsed.map((t: any) => String(t).trim()).filter(Boolean);
    } else if (typeof techUsed === "string") {
      parsedTech = techUsed.split(",").map((t) => t.trim()).filter(Boolean);
    }

    let parsedDevs: string[] = [];
    if (Array.isArray(developerNames)) {
      parsedDevs = developerNames.map((d: any) => String(d).trim()).filter(Boolean);
    } else if (typeof developerNames === "string") {
      parsedDevs = developerNames.split(",").map((d) => d.trim()).filter(Boolean);
    }

    const updatedSoftware = await Software.findByIdAndUpdate(
      targetId,
      {
        name: name.trim(),
        domain: domain ? domain.trim() : "",
        techUsed: parsedTech,
        developerNames: parsedDevs,
        description: description ? description.trim() : "",
        status: status || "Active",
      },
      { new: true }
    );

    if (!updatedSoftware) {
      return NextResponse.json(
        { success: false, error: "Software entry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Software updated successfully",
      data: updatedSoftware,
    });
  } catch (error: any) {
    console.error("Error updating software:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update software" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Software ID is required" },
        { status: 400 }
      );
    }

    await Software.findByIdAndDelete(id);
    return NextResponse.json({
      success: true,
      message: "Software entry deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting software:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete software" },
      { status: 500 }
    );
  }
}
