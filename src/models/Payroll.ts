import mongoose, { Schema, Document } from "mongoose";

export interface IPayroll extends Document {
  employeeName: string;
  employeeRole: string; // e.g., Counsellor, Teacher, Centre Head, Staff, Admin
  month: string; // e.g., "2026-07"
  baseSalary: number;
  bonus: number;
  deductions: number;
  netSalary: number;
  paymentStatus: "Pending" | "Paid";
  paymentDate: Date;
  paymentMode: string; // e.g., Bank Transfer, UPI, Cash, Cheque
  brand?: string;
  company?: string;
  isRecurring: boolean;
  recurringFrequency: "Weekly" | "Monthly" | "Quarterly" | "Yearly";
  nextRecurringDate?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PayrollSchema: Schema = new Schema(
  {
    employeeName: { type: String, required: true, trim: true },
    employeeRole: { type: String, required: true, trim: true, default: "Staff" },
    month: { type: String, required: true, trim: true },
    baseSalary: { type: Number, required: true, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
    deductions: { type: Number, default: 0, min: 0 },
    netSalary: { type: Number, required: true },
    paymentStatus: { type: String, enum: ["Pending", "Paid"], default: "Paid" },
    paymentDate: { type: Date, default: Date.now },
    paymentMode: { type: String, default: "Bank Transfer" },
    brand: { type: String, default: "All Brands" },
    company: { type: String, default: "All Companies" },
    isRecurring: { type: Boolean, default: false },
    recurringFrequency: { type: String, enum: ["Weekly", "Monthly", "Quarterly", "Yearly"], default: "Monthly" },
    nextRecurringDate: { type: Date },
    remarks: { type: String, default: "" },
  },
  { timestamps: true }
);

if (mongoose.models.Payroll) {
  delete mongoose.models.Payroll;
}

export default mongoose.model<IPayroll>("Payroll", PayrollSchema);
