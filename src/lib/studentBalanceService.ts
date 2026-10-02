import mongoose, { type ClientSession } from "mongoose";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import { toPaise, fromPaise } from "@/lib/money";

export interface StudentBalanceResult {
  admissionId: string;
  finalFee: number;
  totalPaid: number;
  remainingBalance: number;
  finalFeePaise: number;
  totalPaidPaise: number;
  remainingBalancePaise: number;
  isFullyPaid: boolean;
}

/**
 * Authoritative service function to calculate a student's balance.
 * Computes: finalFee - sum of payments from the Payment collection.
 * All arithmetic is performed strictly in integer paise.
 * Supports running within an active MongoDB ClientSession.
 */
export async function getStudentBalance(
  admissionId: string | mongoose.Types.ObjectId,
  session?: ClientSession | null
): Promise<StudentBalanceResult> {
  const cleanId = String(admissionId).trim();
  if (!cleanId || !mongoose.Types.ObjectId.isValid(cleanId)) {
    throw new Error(`Invalid admissionId provided: "${admissionId}"`);
  }

  const objId = new mongoose.Types.ObjectId(cleanId);

  // 1. Fetch admission for fee agreement, reading *Paise fields with fallback to rupees
  const admQuery = Admission.findById(objId)
    .select("finalFee finalFeePaise courseFee courseFeePaise totalFees registrationAmount registrationAmountPaise")
    .lean();
  if (session) admQuery.session(session);
  const admission = await admQuery;

  if (!admission) {
    throw new Error(`Admission not found for ID: ${cleanId}`);
  }

  let finalFeePaise = 0;
  if (admission.finalFeePaise && admission.finalFeePaise > 0) {
    finalFeePaise = admission.finalFeePaise;
  } else if (Number(admission.finalFee) > 0) {
    finalFeePaise = toPaise(admission.finalFee);
  } else if (admission.courseFeePaise && admission.courseFeePaise > 0) {
    finalFeePaise = admission.courseFeePaise;
  } else if (Number(admission.courseFee) > 0) {
    finalFeePaise = toPaise(admission.courseFee);
  } else if ((admission as any).totalFees) {
    finalFeePaise = toPaise((admission as any).totalFees);
  } else if (admission.registrationAmountPaise && admission.registrationAmountPaise > 0) {
    finalFeePaise = admission.registrationAmountPaise;
  } else {
    finalFeePaise = toPaise(admission.registrationAmount);
  }

  // 2. Sum all completed payments for this admission in integer paise
  const aggPipeline = [
    {
      $match: {
        admissionId: objId,
      },
    },
    {
      $group: {
        _id: "$admissionId",
        totalPaidPaise: {
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
  ];

  const payQuery = Payment.aggregate(aggPipeline);
  if (session) payQuery.session(session);
  const payAgg = await payQuery;

  const totalPaidPaise = payAgg.length > 0 ? Math.round(Number(payAgg[0].totalPaidPaise || 0)) : 0;
  const remainingBalancePaise = Math.max(0, finalFeePaise - totalPaidPaise);

  return {
    admissionId: cleanId,
    finalFee: fromPaise(finalFeePaise),
    totalPaid: fromPaise(totalPaidPaise),
    remainingBalance: fromPaise(remainingBalancePaise),
    finalFeePaise,
    totalPaidPaise,
    remainingBalancePaise,
    isFullyPaid: remainingBalancePaise === 0,
  };
}

/**
 * Recompute and synchronize the stored Admission.remainingBalance and remainingBalancePaise fields
 * strictly inside the payment transaction session to prevent value drift.
 */
export async function recomputeAndStoreAdmissionBalance(
  admissionId: string | mongoose.Types.ObjectId,
  session?: ClientSession | null
): Promise<StudentBalanceResult> {
  const result = await getStudentBalance(admissionId, session);

  const updateDoc: any = {
    remainingBalance: result.remainingBalance,
    remainingBalancePaise: result.remainingBalancePaise,
  };

  if (result.totalPaidPaise > 0) {
    updateDoc.amountReceivedToday = result.totalPaid;
    updateDoc.amountReceivedTodayPaise = result.totalPaidPaise;
  }

  const updateQuery = Admission.updateOne({ _id: admissionId }, { $set: updateDoc });
  if (session) updateQuery.session(session);
  await updateQuery;

  return result;
}

/**
 * Mongoose aggregation pipeline stages for list views.
 * Joins payments collection, computes actual sum of payments and true remaining balance in paise on the fly.
 */
export function studentBalanceLookupStages(): any[] {
  return [
    {
      $lookup: {
        from: "payments",
        localField: "_id",
        foreignField: "admissionId",
        as: "_payments",
      },
    },
    {
      $addFields: {
        computedTotalPaidPaise: {
          $sum: {
            $map: {
              input: "$_payments",
              as: "p",
              in: {
                $cond: [
                  { $and: [{ $ne: ["$$p.amountReceivedPaise", null] }, { $gt: ["$$p.amountReceivedPaise", 0] }] },
                  "$$p.amountReceivedPaise",
                  { $round: [{ $multiply: [{ $ifNull: ["$$p.amountReceived", 0] }, 100] }] },
                ],
              },
            },
          },
        },
        computedFinalFeePaise: {
          $cond: [
            { $and: [{ $ne: ["$finalFeePaise", null] }, { $gt: ["$finalFeePaise", 0] }] },
            "$finalFeePaise",
            {
              $cond: [
                { $gt: ["$finalFee", 0] },
                { $round: [{ $multiply: ["$finalFee", 100] }] },
                {
                  $cond: [
                    { $and: [{ $ne: ["$courseFeePaise", null] }, { $gt: ["$courseFeePaise", 0] }] },
                    "$courseFeePaise",
                    {
                      $cond: [
                        { $gt: ["$courseFee", 0] },
                        { $round: [{ $multiply: ["$courseFee", 100] }] },
                        { $round: [{ $multiply: [{ $ifNull: ["$registrationAmount", 0] }, 100] }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        remainingBalancePaise: {
          $max: [0, { $subtract: ["$computedFinalFeePaise", "$computedTotalPaidPaise"] }],
        },
        paidAmountPaise: "$computedTotalPaidPaise",
      },
    },
    {
      $addFields: {
        remainingBalance: { $divide: ["$remainingBalancePaise", 100] },
        paidAmount: { $divide: ["$paidAmountPaise", 100] },
      },
    },
    {
      $project: {
        _payments: 0,
      },
    },
  ];
}
