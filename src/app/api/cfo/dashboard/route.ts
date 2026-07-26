import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Expense from "@/models/Expense";
import Payment from "@/models/Payment";
import Admission from "@/models/Admission";
import Company from "@/models/Company";
import Brand from "@/models/Brand";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const selectedBrand = searchParams.get("brand") || "All Brands";
    const selectedCompany = searchParams.get("company") || "All Companies";

    const [expenses, payments, admissions, companies, brands] = await Promise.all([
      Expense.find({}).sort({ expenseDate: -1 }).lean(),
      Payment.find({}).sort({ createdAt: -1 }).lean(),
      Admission.find({}).sort({ createdAt: -1 }).lean(),
      Company.find({}).sort({ name: 1 }).lean(),
      Brand.find({}).sort({ name: 1 }).lean(),
    ]);

    // Apply Brand & Company filters if specified
    const filteredExpenses = expenses.filter((e: any) => {
      const matchBrand = selectedBrand === "All Brands" || e.brand === selectedBrand;
      const matchCompany = selectedCompany === "All Companies" || e.company === selectedCompany;
      return matchBrand && matchCompany;
    });

    const filteredPayments = payments.filter((p: any) => {
      const matchBrand = selectedBrand === "All Brands" || p.brand === selectedBrand;
      const matchCompany = selectedCompany === "All Companies" || p.company === selectedCompany;
      return matchBrand && matchCompany;
    });

    const filteredAdmissions = admissions.filter((a: any) => {
      const matchBrand = selectedBrand === "All Brands" || a.brandName === selectedBrand;
      const matchCompany = selectedCompany === "All Companies" || a.companyTag === selectedCompany;
      return matchBrand && matchCompany;
    });

    // 1. Core Financial Aggregations
    const totalRevenue = filteredPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const netCashFlow = totalRevenue - totalExpenses;
    const operatingMarginPct = totalRevenue > 0 ? (netCashFlow / totalRevenue) * 100 : 0;

    // Outstanding Student Fees
    const outstandingFees = filteredAdmissions.reduce((sum: number, a: any) => {
      const totalFee = Number(a.totalFee) || Number(a.courseFee) || 0;
      const paidFee = Number(a.paidAmount) || 0;
      return sum + Math.max(0, totalFee - paidFee);
    }, 0);

    // Cash vs Digital Reserves
    const cashRevenue = filteredPayments
      .filter((p: any) => (p.paymentMode || "").toLowerCase() === "cash")
      .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    const cashExpenses = filteredExpenses
      .filter((e: any) => (e.paymentMode || "").toLowerCase() === "cash")
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const cashReserves = cashRevenue - cashExpenses;

    const digitalRevenue = totalRevenue - cashRevenue;
    const digitalExpenses = totalExpenses - cashExpenses;
    const bankReserves = digitalRevenue - digitalExpenses;

    // Variable vs Fixed Expenses
    const variableExpenses = filteredExpenses
      .filter((e: any) => (e.expenseType || "variable").toLowerCase() === "variable")
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const fixedExpenses = filteredExpenses
      .filter((e: any) => (e.expenseType || "").toLowerCase() === "fixed")
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

    // 2. Category Breakdown Chart Data
    const categoryMap: Record<string, { value: number; count: number }> = {};
    filteredExpenses.forEach((e: any) => {
      const cat = e.category || "Misc";
      if (!categoryMap[cat]) categoryMap[cat] = { value: 0, count: 0 };
      categoryMap[cat].value += Number(e.amount) || 0;
      categoryMap[cat].count += 1;
    });

    const categoryBreakdown = Object.entries(categoryMap)
      .map(([name, d]) => ({ name, value: d.value, count: d.count }))
      .sort((a, b) => b.value - a.value);

    // 3. Payment Mode Distribution
    const modeMap: Record<string, number> = {};
    filteredExpenses.forEach((e: any) => {
      const mode = e.paymentMode || "Cash";
      modeMap[mode] = (modeMap[mode] || 0) + (Number(e.amount) || 0);
    });

    const paymentModeDistribution = Object.entries(modeMap).map(([name, value]) => ({ name, value }));

    // 4. Monthly Trend Data (Last 6 Months)
    const monthMap: Record<string, { revenue: number; expense: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      monthMap[key] = { revenue: 0, expense: 0 };
    }

    filteredPayments.forEach((p: any) => {
      const dt = new Date(p.createdAt || p.date);
      const key = dt.toLocaleString("en-US", { month: "short", year: "2-digit" });
      if (monthMap[key]) {
        monthMap[key].revenue += Number(p.amount) || 0;
      }
    });

    filteredExpenses.forEach((e: any) => {
      const dt = new Date(e.expenseDate || e.createdAt);
      const key = dt.toLocaleString("en-US", { month: "short", year: "2-digit" });
      if (monthMap[key]) {
        monthMap[key].expense += Number(e.amount) || 0;
      }
    });

    const monthlyTrends = Object.entries(monthMap).map(([month, data]) => ({
      month,
      revenue: data.revenue,
      expense: data.expense,
      netProfit: data.revenue - data.expense,
    }));

    // 5. Company Financial Performance
    const compMap: Record<string, { revenue: number; expense: number }> = {};
    companies.forEach((c: any) => {
      if (c.name) compMap[c.name] = { revenue: 0, expense: 0 };
    });

    filteredPayments.forEach((p: any) => {
      if (p.company && compMap[p.company]) {
        compMap[p.company].revenue += Number(p.amount) || 0;
      }
    });

    filteredExpenses.forEach((e: any) => {
      if (e.company && compMap[e.company]) {
        compMap[e.company].expense += Number(e.amount) || 0;
      }
    });

    const companyFinancials = Object.entries(compMap)
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        expense: data.expense,
        net: data.revenue - data.expense,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          totalExpenses,
          netCashFlow,
          operatingMarginPct,
          outstandingFees,
          cashReserves,
          bankReserves,
          variableExpenses,
          fixedExpenses,
        },
        expenses: filteredExpenses.slice(0, 15),
        payments: filteredPayments.slice(0, 15),
        admissions: filteredAdmissions.slice(0, 15),
        companies,
        brands,
        monthlyTrends,
        categoryBreakdown,
        paymentModeDistribution,
        companyFinancials,
      },
    });
  } catch (error: any) {
    console.error("CFO Dashboard API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load CFO dashboard data" },
      { status: 500 }
    );
  }
}
