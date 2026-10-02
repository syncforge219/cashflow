import mongoose, { Schema, Document } from "mongoose";
import { softDeletePlugin } from "@/lib/softDeletePlugin";
import { auditContextPlugin } from "@/lib/auditContextPlugin";

export interface IExpense extends Document {
  title: string;
  category: string;
  amount: number;
  expenseDate: Date;
  paymentMode: string;
  brand?: string;
  brandId?: mongoose.Types.ObjectId | string;
  company?: string;
  companyId?: mongoose.Types.ObjectId | string;
  recordedBy?: string;
  isRecurring: boolean;
  recurringFrequency: "Weekly" | "Monthly" | "Quarterly" | "Yearly";
  nextRecurringDate?: Date;
  bank?: string;
  expenseType?: "variable" | "fixed";
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      default: "Misc",
    },
    amount: { type: Number, required: true, min: 0 },
    expenseDate: { type: Date, default: Date.now },
    paymentMode: { type: String, default: "UPI" },
    brand: { type: String, default: "All Brands" },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
    },
    company: { type: String, default: "All Companies" },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
    },
    bank: { type: String, default: "" },
    expenseType: { type: String, enum: ["variable", "fixed"], default: "variable" },
    recordedBy: { type: String, default: "Admin" },
    isRecurring: { type: Boolean, default: false },
    recurringFrequency: { type: String, enum: ["Weekly", "Monthly", "Quarterly", "Yearly"], default: "Monthly" },
    nextRecurringDate: { type: Date },
    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

import { syncExpenseRefs } from "@/lib/referenceHelper";

// Performance & Compound Indexes
ExpenseSchema.index({ brandId: 1, expenseDate: -1, createdAt: -1 });
ExpenseSchema.index({ companyId: 1, expenseDate: -1 });
ExpenseSchema.index({ brand: 1, expenseDate: -1, createdAt: -1 });
ExpenseSchema.index({ company: 1, expenseDate: -1 });
ExpenseSchema.index({ category: 1, expenseDate: -1 });
ExpenseSchema.index({ expenseDate: -1 });
ExpenseSchema.index({ brandId: 1, expenseDate: -1 });

// Dual-write sync hooks
ExpenseSchema.pre("save", async function () {
  const session = this.$session?.();
  await syncExpenseRefs(this, session);
});

ExpenseSchema.pre(["findOneAndUpdate", "updateOne"], async function () {
  const update = this.getUpdate() as any;
  if (update) {
    const session = this.getOptions()?.session;
    const target = update.$set || update;
    await syncExpenseRefs(target, session);
  }
});

ExpenseSchema.plugin(auditContextPlugin);
ExpenseSchema.plugin(softDeletePlugin);

if (mongoose.models.Expense) {
  delete mongoose.models.Expense;
}

export default mongoose.model<IExpense>("Expense", ExpenseSchema);

