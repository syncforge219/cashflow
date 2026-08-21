import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import QuotationCustomer from "@/models/QuotationCustomer";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || "DEFAULT_COMPANY";
    const q = searchParams.get("q") || "";

    const query: any = { companyId };
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: "i" } },
        { contactPerson: { $regex: q, $options: "i" } },
        { gstin: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const customers = await QuotationCustomer.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, count: customers.length, data: customers });
  } catch (error: any) {
    console.error("Error fetching customers:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { companyId = "DEFAULT_COMPANY", name, contactPerson, address, city, state, pincode, gstin, phone, email } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: "Customer Name is required" }, { status: 400 });
    }

    const newCustomer = await QuotationCustomer.create({
      companyId,
      name: name.trim(),
      contactPerson: contactPerson?.trim() || "",
      address: address?.trim() || "",
      city: city?.trim() || "",
      state: state?.trim() || "",
      pincode: pincode?.trim() || "",
      gstin: gstin?.trim()?.toUpperCase() || "",
      phone: phone?.trim() || "",
      email: email?.trim()?.toLowerCase() || "",
    });

    return NextResponse.json({ success: true, message: "Customer created successfully", data: newCustomer }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating customer:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { id, _id, name, contactPerson, address, city, state, pincode, gstin, phone, email } = body;
    const targetId = id || _id;

    if (!targetId) {
      return NextResponse.json({ success: false, error: "Customer ID is required" }, { status: 400 });
    }

    const updated = await QuotationCustomer.findByIdAndUpdate(
      targetId,
      {
        $set: {
          name: name?.trim(),
          contactPerson: contactPerson?.trim(),
          address: address?.trim(),
          city: city?.trim(),
          state: state?.trim(),
          pincode: pincode?.trim(),
          gstin: gstin?.trim()?.toUpperCase(),
          phone: phone?.trim(),
          email: email?.trim()?.toLowerCase(),
        },
      },
      { new: true }
    );

    return NextResponse.json({ success: true, message: "Customer updated successfully", data: updated });
  } catch (error: any) {
    console.error("Error updating customer:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Customer ID is required" }, { status: 400 });
    }

    await QuotationCustomer.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: "Customer deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting customer:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
