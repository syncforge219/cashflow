import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import MarketingSpend from "@/models/MarketingSpend";
import { getMarketingScope, periodFromQuery } from "@/lib/marketingScope";
import { toDateKey, todayKey, isDateKey, dateKeyToDate } from "@/lib/dates";

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const toRow = (s: any) => ({
  _id: String(s._id),
  date: toDateKey(s.spendDate),
  source: s.source,
  campaign: s.campaign || "",
  brand: s.brand || "",
  amount: s.amount,
  notes: s.notes || "",
  userName: s.userName || "",
});

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { scope, error } = await getMarketingScope(req);
    if (error) return error;
    const { start, end } = periodFromQuery(req);

    const rows = await MarketingSpend.find({
      userId: { $in: scope!.userIds },
      spendDate: { $gte: start, $lte: end },
    })
      .sort({ spendDate: -1, createdAt: -1 })
      .lean();
    return NextResponse.json({ success: true, data: rows.map(toRow) });
  } catch (err: any) {
    console.error("[marketing/spend GET]", err);
    return NextResponse.json({ success: false, error: "Failed to load spend" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { scope, error } = await getMarketingScope(req);
    if (error) return error;
    if (scope!.isAdmin) {
      return NextResponse.json({ success: false, error: "Spend is logged by the marketing user." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const date = isDateKey(body.date) ? body.date : "";
    if (!date) return NextResponse.json({ success: false, error: "Pick the date of the spend." }, { status: 400 });
    if (date > todayKey()) return NextResponse.json({ success: false, error: "Spend date cannot be in the future." }, { status: 400 });
    const source = str(body.source, 80);
    if (!source) return NextResponse.json({ success: false, error: "Lead source is required." }, { status: 400 });
    const amount = Math.round(Number(body.amount) * 100) / 100;
    if (!(amount > 0) || amount > 1e9) return NextResponse.json({ success: false, error: "Enter an amount greater than zero." }, { status: 400 });

    const row = await MarketingSpend.create({
      spendDate: dateKeyToDate(date),
      source,
      campaign: str(body.campaign, 120),
      brand: str(body.brand, 80),
      amount,
      notes: str(body.notes, 500),
      userId: scope!.actor._id,
      userName: scope!.actor.name || "",
    });
    return NextResponse.json({ success: true, data: toRow(row), message: "Spend saved." }, { status: 201 });
  } catch (err: any) {
    console.error("[marketing/spend POST]", err);
    return NextResponse.json({ success: false, error: "Failed to save spend" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const { scope, error } = await getMarketingScope(req);
    if (error) return error;
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: "Invalid id" }, { status: 400 });
    }
    // Own entries only (an admin can remove any marketing user's entry)
    const row: any = await MarketingSpend.findOne({ _id: id, userId: { $in: scope!.userIds } });
    if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    await row.softDelete(scope!.actor._id);
    return NextResponse.json({ success: true, message: "Spend entry removed." });
  } catch (err: any) {
    console.error("[marketing/spend DELETE]", err);
    return NextResponse.json({ success: false, error: "Failed to remove spend" }, { status: 500 });
  }
}
