import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Brand from "@/models/Brand";
import { isBrandCategory } from "@/lib/brandCategory";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    if (body.name) {
      body.name = body.name.toUpperCase().trim();
    }
    if (body.code) {
      body.code = body.code.toUpperCase().trim();
    }
    if (body.businessCategory !== undefined && !isBrandCategory(body.businessCategory)) {
      return NextResponse.json({ error: "Business category must be Training or Service" }, { status: 400 });
    }
    if (body.isDefault !== undefined) body.isDefault = Boolean(body.isDefault);
    if (body.sendTeacherDemoAlert !== undefined) body.sendTeacherDemoAlert = Boolean(body.sendTeacherDemoAlert);
    if (Array.isArray(body.companies)) {
      body.companies = body.companies.map((c: string) => c.toUpperCase().trim());
    }
    
    const updatedBrand = await Brand.findByIdAndUpdate(id, body, { new: true });
    
    if (!updatedBrand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    // Only one default brand at a time
    if ((updatedBrand as any).isDefault) {
      await Brand.updateMany({ _id: { $ne: updatedBrand._id }, isDefault: true }, { $set: { isDefault: false } });
    }
    
    return NextResponse.json({ success: true, brand: updatedBrand });
  } catch (error: any) {
    console.error("Update Brand Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update brand" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const deletedBrand = await Brand.findByIdAndDelete(id);
    
    if (!deletedBrand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: "Brand deleted successfully" });
  } catch (error: any) {
    console.error("Delete Brand Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete brand" }, { status: 500 });
  }
}
