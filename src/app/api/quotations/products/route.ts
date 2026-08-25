import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import QuotationProduct from "@/models/QuotationProduct";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || "DEFAULT_COMPANY";
    const q = searchParams.get("q") || "";
    const category = searchParams.get("category") || "ALL";

    const query: any = { companyId };
    if (category !== "ALL") {
      query.category = category;
    }
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { sku: { $regex: q, $options: "i" } },
        { hsnCode: { $regex: q, $options: "i" } },
      ];
    }

    const products = await QuotationProduct.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, count: products.length, data: products });
  } catch (error: any) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const {
      companyId = "DEFAULT_COMPANY",
      name,
      description,
      sku,
      hsnCode,
      unit,
      defaultRate,
      gstRate,
      category = "PRODUCT",
      billingCycle = "ONE_TIME",
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Product Name is required" }, { status: 400 });
    }

    const newProduct = await QuotationProduct.create({
      companyId,
      category,
      billingCycle,
      name: name.trim(),
      description: description?.trim() || "",
      sku: sku?.trim() || "",
      hsnCode: hsnCode?.trim() || "",
      unit: unit?.trim() || "mtr",
      defaultRate: Number(defaultRate) || 0,
      gstRate: Number(gstRate) !== undefined ? Number(gstRate) : 18,
      defaultTerms: Array.isArray(body.defaultTerms) ? body.defaultTerms : [],
    });

    return NextResponse.json({ success: true, message: "Product created successfully", data: newProduct }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating product:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { id, _id, name, description, sku, hsnCode, unit, defaultRate, gstRate, category, billingCycle } = body;
    const targetId = id || _id;

    if (!targetId) {
      return NextResponse.json({ success: false, error: "Product ID is required" }, { status: 400 });
    }

    const updated = await QuotationProduct.findByIdAndUpdate(
      targetId,
      {
        $set: {
          ...(category && { category }),
          ...(billingCycle && { billingCycle }),
          name: name?.trim(),
          description: description?.trim(),
          sku: sku?.trim(),
          hsnCode: hsnCode?.trim(),
          unit: unit?.trim(),
          defaultRate: Number(defaultRate) || 0,
          gstRate: Number(gstRate),
          ...(Array.isArray(body.defaultTerms) && { defaultTerms: body.defaultTerms }),
        },
      },
      { new: true }
    );

    return NextResponse.json({ success: true, message: "Product updated successfully", data: updated });
  } catch (error: any) {
    console.error("Error updating product:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Product ID is required" }, { status: 400 });
    }

    await QuotationProduct.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: "Product deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting product:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
