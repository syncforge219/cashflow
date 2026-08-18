import { getDailyBiReportData, DailyBiReportData } from "./dailyBiService";
import { getMonthlyBiReportData, MonthlyBiReportData } from "./monthlyBiService";

export type DailyReportStats = DailyBiReportData;
export type MonthlyReportStats = MonthlyBiReportData;

export async function getDailyReportStats(): Promise<DailyBiReportData> {
  return await getDailyBiReportData();
}

export async function getMonthlyReportStats(): Promise<MonthlyBiReportData> {
  return await getMonthlyBiReportData();
}

