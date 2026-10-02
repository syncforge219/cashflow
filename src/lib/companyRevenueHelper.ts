import mongoose from "mongoose";
import Payment from "@/models/Payment";
import Company from "@/models/Company";
import { getFinancialYearRange, type FinancialYearRange } from "@/lib/financialYearHelper";
import { fromPaise } from "@/lib/money";

export interface CompanyRevenueReport {
  companyId: string;
  companyName: string;
  legalName?: string;
  storedRevenue: number;
  computedFyRevenue: number;
  computedAllTimeRevenue: number;
  drift: number;
  financialYear: string;
}

/**
 * Aggregates payments grouped by companyId for a given Financial Year (1 Apr - 31 Mar).
 * Uses paymentDate (with createdAt fallback) within the fiscal boundaries.
 * Computes totals in integer paise to avoid floating point drift.
 */
export async function getCompanyPaymentRevenueMap(
  fyRange?: FinancialYearRange
): Promise<Map<string, number>> {
  const range = fyRange || getFinancialYearRange();

  const matchStage: any = {
    $or: [
      { paymentDate: { $gte: range.startDate, $lte: range.endDate } },
      { $and: [{ paymentDate: { $exists: false } }, { createdAt: { $gte: range.startDate, $lte: range.endDate } }] },
      { $and: [{ paymentDate: null }, { createdAt: { $gte: range.startDate, $lte: range.endDate } }] },
    ],
  };

  const results = await Payment.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$companyId",
        totalCollectedPaise: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ["$amountReceivedPaise", null] }, { $gt: ["$amountReceivedPaise", 0] }] },
              "$amountReceivedPaise",
              { $round: [{ $multiply: [{ $ifNull: ["$amountReceived", 0] }, 100] }] },
            ],
          },
        },
      },
    },
  ]);

  const map = new Map<string, number>();
  for (const r of results) {
    if (r._id) {
      map.set(String(r._id), fromPaise(r.totalCollectedPaise));
    }
  }

  return map;
}

/**
 * Computes actual payment revenue collected for a specific company in a Financial Year.
 */
export async function getCompanyFyRevenue(
  companyId: string | mongoose.Types.ObjectId,
  fyRange?: FinancialYearRange
): Promise<number> {
  const cleanId = String(companyId).trim();
  if (!cleanId || !mongoose.Types.ObjectId.isValid(cleanId)) return 0;

  const range = fyRange || getFinancialYearRange();
  const objId = new mongoose.Types.ObjectId(cleanId);

  const results = await Payment.aggregate([
    {
      $match: {
        companyId: objId,
        $or: [
          { paymentDate: { $gte: range.startDate, $lte: range.endDate } },
          { $and: [{ paymentDate: { $exists: false } }, { createdAt: { $gte: range.startDate, $lte: range.endDate } }] },
          { $and: [{ paymentDate: null }, { createdAt: { $gte: range.startDate, $lte: range.endDate } }] },
        ],
      },
    },
    {
      $group: {
        _id: "$companyId",
        totalCollectedPaise: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ["$amountReceivedPaise", null] }, { $gt: ["$amountReceivedPaise", 0] }] },
              "$amountReceivedPaise",
              { $round: [{ $multiply: [{ $ifNull: ["$amountReceived", 0] }, 100] }] },
            ],
          },
        },
      },
    },
  ]);

  return results.length > 0 ? fromPaise(results[0].totalCollectedPaise) : 0;
}

/**
 * Compares stored Company.collectedRevenue against computed Payment aggregation
 * for all companies to detect and report drift.
 */
export async function compareCompanyRevenue(
  fyRange?: FinancialYearRange
): Promise<CompanyRevenueReport[]> {
  const range = fyRange || getFinancialYearRange();
  const fyMap = await getCompanyPaymentRevenueMap(range);

  // Also aggregate all-time payments
  const allTimeAgg = await Payment.aggregate([
    {
      $group: {
        _id: "$companyId",
        totalCollectedPaise: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ["$amountReceivedPaise", null] }, { $gt: ["$amountReceivedPaise", 0] }] },
              "$amountReceivedPaise",
              { $round: [{ $multiply: [{ $ifNull: ["$amountReceived", 0] }, 100] }] },
            ],
          },
        },
      },
    },
  ]);
  const allTimeMap = new Map<string, number>();
  for (const r of allTimeAgg) {
    if (r._id) {
      allTimeMap.set(String(r._id), fromPaise(r.totalCollectedPaise));
    }
  }

  const companies = await Company.find({}).sort({ name: 1 }).lean();

  return companies.map((c: any) => {
    const idStr = String(c._id);
    const stored = Number(c.collectedRevenue || 0);
    const computedFy = fyMap.get(idStr) || 0;
    const computedAllTime = allTimeMap.get(idStr) || 0;
    const drift = stored - computedFy;

    return {
      companyId: idStr,
      companyName: c.name,
      legalName: c.legalName,
      storedRevenue: stored,
      computedFyRevenue: computedFy,
      computedAllTimeRevenue: computedAllTime,
      drift,
      financialYear: range.label,
    };
  });
}
