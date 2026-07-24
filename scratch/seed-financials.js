const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach(line => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      process.env[parts[0].trim()] = parts.slice(1).join("=").trim();
    }
  });
}

const PayrollSchema = new mongoose.Schema({
  employeeName: String,
  employeeRole: String,
  month: String,
  baseSalary: Number,
  bonus: Number,
  deductions: Number,
  netSalary: Number,
  paymentStatus: String,
  paymentDate: Date,
  paymentMode: String,
  remarks: String
}, { timestamps: true });

const ExpenseSchema = new mongoose.Schema({
  title: String,
  category: String,
  amount: Number,
  expenseDate: Date,
  paymentMode: String,
  brand: String,
  recordedBy: String,
  remarks: String
}, { timestamps: true });

const Payroll = mongoose.models.Payroll || mongoose.model("Payroll", PayrollSchema);
const Expense = mongoose.models.Expense || mongoose.model("Expense", ExpenseSchema);

async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log("Connected!");

  // Insert sample payrolls
  await Payroll.deleteMany({});
  await Payroll.create([
    {
      employeeName: "Rahul Sharma",
      employeeRole: "Counsellor",
      month: "2026-07",
      baseSalary: 35000,
      bonus: 5000,
      deductions: 1000,
      netSalary: 39000,
      paymentStatus: "Paid",
      paymentDate: new Date(),
      paymentMode: "Bank Transfer",
      remarks: "July salary + conversion incentive"
    },
    {
      employeeName: "Anita Verma",
      employeeRole: "Teacher",
      month: "2026-07",
      baseSalary: 45000,
      bonus: 2500,
      deductions: 0,
      netSalary: 47500,
      paymentStatus: "Paid",
      paymentDate: new Date(),
      paymentMode: "Bank Transfer",
      remarks: "July full-time faculty payout"
    }
  ]);
  console.log("Seeded 2 Payroll records!");

  // Insert sample expenses
  await Expense.deleteMany({});
  await Expense.create([
    {
      title: "Meta & Instagram Ad Campaign July 2026",
      category: "Marketing / Ads",
      amount: 15000,
      expenseDate: new Date(),
      paymentMode: "Credit Card",
      brand: "TechPro",
      recordedBy: "Admin",
      remarks: "Lead gen campaign"
    },
    {
      title: "Office Space Monthly Rent",
      category: "Rent",
      amount: 25000,
      expenseDate: new Date(),
      paymentMode: "Bank Transfer",
      brand: "All Brands",
      recordedBy: "Admin",
      remarks: "Bangalore office branch"
    },
    {
      title: "High-speed Fiber Broadband & Utilities",
      category: "Utilities",
      amount: 4500,
      expenseDate: new Date(),
      paymentMode: "UPI",
      brand: "All Brands",
      recordedBy: "Admin",
      remarks: "Monthly internet bill"
    }
  ]);
  console.log("Seeded 3 Expense records!");

  await mongoose.disconnect();
  console.log("Seed script finished successfully!");
}

seed().catch(console.error);
