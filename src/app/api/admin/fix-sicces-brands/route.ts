import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";

export async function GET() {
  try {
    await dbConnect();
    const db = mongoose.connection.db;

    // Find all SICCES PRIVATE LIMITED documents
    const companies = await db.collection("companies").find({
      name: /^SICCES PRIVATE LIMITED$/i
    }).toArray();

    console.log(`Found ${companies.length} SICCES PRIVATE LIMITED docs:`, companies.map(c => ({ _id: c._id, brands: c.brands, companyId: c.companyId })));

    // Fix ALL of them — set brands to exactly the 3 correct ones
    const result = await db.collection("companies").updateMany(
      { name: /^SICCES PRIVATE LIMITED$/i },
      { $set: { brands: ["DESIGN GATEWAY", "DIGIFOOTPRINTS", "CADD MANTRA"], updatedAt: new Date() } }
    );

    return NextResponse.json({
      success: true,
      found: companies.length,
      fixed: result.modifiedCount,
      docs: companies.map(c => ({ _id: String(c._id), companyId: c.companyId, oldBrands: c.brands, createdAt: c.createdAt }))
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
