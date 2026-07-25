import { getDailyBiReportData, DailyBiReportData } from "./dailyBiService";

export type DailyReportStats = DailyBiReportData;

export async function getDailyReportStats(): Promise<DailyBiReportData> {
  return await getDailyBiReportData();
}

export async function getMonthlyReportStats(): Promise<DailyBiReportData> {
  return await getDailyBiReportData();
}
