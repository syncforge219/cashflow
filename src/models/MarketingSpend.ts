import mongoose, { Schema } from "mongoose";
import { softDeletePlugin } from "@/lib/softDeletePlugin";

/**
 * Money a marketing user spent to get leads (ads, Justdial package, hoardings...).
 * Cost per lead = spend / leads from the same source (and brand) in the same period.
 */
const MarketingSpendSchema = new Schema(
  {
    // Calendar day of the spend (stored as UTC midnight of the IST date, see src/lib/dates.ts)
    spendDate: { type: Date, required: true, index: true },
    // Should match the lead source on the leads it produced, e.g. "Meta Ads", "Google Ads", "JustDial"
    source: { type: String, required: true, trim: true, index: true },
    campaign: { type: String, default: "", trim: true },
    brand: { type: String, default: "", trim: true },
    amount: { type: Number, required: true, min: 0 },
    amountPaise: { type: Number, default: 0 },
    notes: { type: String, default: "", trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

MarketingSpendSchema.pre("save", function () {
  this.amountPaise = Math.round(Number(this.amount || 0) * 100);
});

MarketingSpendSchema.index({ userId: 1, spendDate: -1 });
MarketingSpendSchema.plugin(softDeletePlugin);

if (mongoose.models.MarketingSpend) {
  delete mongoose.models.MarketingSpend;
}

const MarketingSpend = mongoose.model("MarketingSpend", MarketingSpendSchema);
export default MarketingSpend;
