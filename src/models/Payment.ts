import mongoose, { Schema } from "mongoose";
import { softDeletePlugin } from "@/lib/softDeletePlugin";

const PaymentSchema = new Schema(
  {
    receiptNo: {
      type: String,
      unique: true,
    },
    admissionId: {
      type: Schema.Types.ObjectId,
      ref: "Admission",
      required: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    amountReceived: {
      type: Number,
      required: true,
    },
    amountReceivedPaise: {
      type: Number,
      default: 0,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    paymentMode: {
      type: String,
      required: true,
    },
    referenceNo: {
      type: String,
    },
    remarks: {
      type: String,
    },
    company: {
      type: String,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
    },
    brand: {
      type: String,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
    },
    particulars: {
      courseFeeDue: { type: Number, default: 0 },
      courseFeeDuePaise: { type: Number, default: 0 },
      registrationFeeDue: { type: Number, default: 0 },
      registrationFeeDuePaise: { type: Number, default: 0 },
      materialFeeDue: { type: Number, default: 0 },
      materialFeeDuePaise: { type: Number, default: 0 },
      examFeeDue: { type: Number, default: 0 },
      examFeeDuePaise: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    autoIndex: process.env.NODE_ENV !== "production",
  }
);

import { getNextSequence } from "@/lib/sequenceHelper";

// Performance & Compound Indexes
PaymentSchema.index({ admissionId: 1, paymentDate: -1 });
PaymentSchema.index({ brand: 1, paymentDate: -1 });
PaymentSchema.index({ company: 1, paymentDate: -1 });
PaymentSchema.index({ paymentDate: -1 });
PaymentSchema.index({ admissionId: 1 });
PaymentSchema.index({ createdAt: -1 });
PaymentSchema.index({ brandId: 1, paymentDate: -1 });
PaymentSchema.index({ companyId: 1, paymentDate: -1 });

import { syncPaymentRefs } from "@/lib/referenceHelper";
import { syncPaymentMoney } from "@/lib/moneySyncHelper";

// Atomic Auto-generate receiptNo before saving using the document's transaction session
PaymentSchema.pre("save", async function () {
  const session = this.$session();

  // Dual-write synchronization between strings and ObjectIds
  await syncPaymentRefs(this, session);

  // Dual-write synchronization between rupees and integer paise
  syncPaymentMoney(this);

  if (!this.receiptNo) {
    const currentYear = new Date().getFullYear();
    const counterKey = `receiptNo_${currentYear}`;
    const prefix = `REC-${currentYear}-`;

    this.receiptNo = await getNextSequence(
      counterKey,
      prefix,
      5,
      async () => {
        const query = mongoose.models.Payment.findOne({
          receiptNo: new RegExp(`^REC-${currentYear}-`)
        }).sort({ receiptNo: -1 });
        if (session) query.session(session);
        const lastPayment = await query;

        if (lastPayment && lastPayment.receiptNo) {
          const match = lastPayment.receiptNo.match(/-(\d+)$/);
          if (match) {
            return parseInt(match[1], 10);
          }
        }
        return 0;
      },
      session
    );
  }
});

PaymentSchema.pre(["findOneAndUpdate", "updateOne"], async function () {
  const update = this.getUpdate() as any;
  if (update) {
    const session = this.getOptions()?.session;
    const target = update.$set || update;
    await syncPaymentRefs(target, session);
    syncPaymentMoney(target);
  }
});

PaymentSchema.plugin(softDeletePlugin);

// Clear the mongoose model if it already exists to fix Next.js HMR caching old hooks
if (mongoose.models.Payment) {
  delete mongoose.models.Payment;
}
const Payment = mongoose.model("Payment", PaymentSchema);

export default Payment;

