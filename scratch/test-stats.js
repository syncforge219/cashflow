async function testStats() {
  try {
    const res = await fetch("http://localhost:3000/api/admin-dashboard/stats");
    const data = await res.json();
    console.log("Stats Success:", data.success);
    console.log("KPIS - Total Revenue:", data.data.kpis.revenue);
    console.log("KPIS - Total Payroll:", data.data.kpis.totalPayroll);
    console.log("KPIS - Total Expenses:", data.data.kpis.totalExpenses);
    console.log("KPIS - Net Profit:", data.data.kpis.netProfit);
    console.log("KPIS - Profit Margin:", data.data.kpis.profitMargin);
    console.log("KPIS - Is Profitable:", data.data.kpis.isProfitable);
    console.log("Financial Summary:", data.data.financialSummary);
  } catch (err) {
    console.error("Test stats failed:", err);
  }
}

testStats();
