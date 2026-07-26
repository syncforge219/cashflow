import mongoose, { Schema, Document } from "mongoose";

export interface IExpense extends Document {
  title: string;
  category: string;
  amount: number;
  expenseDate: Date;
  paymentMode: string;
  brand?: string;
  company?: string;
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
    company: { type: String, default: "All Companies" },
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

if (mongoose.models.Expense) {
  delete mongoose.models.Expense;
}

export default mongoose.model<IExpense>("Expense", ExpenseSchema);
