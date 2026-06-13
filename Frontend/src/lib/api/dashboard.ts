import { apiFetch } from "./client";

export interface DashboardSummary {
  pm25_inhaled: number;
  pm25_avoided: number;
  co2_grams: number;
  ecoscore: number;
  no2?: number;
  noise?: number;
  heat_stress?: string;
  weekly_pollution?: Array<{
    day: string;
    level: number;
    status: "safe" | "moderate" | "high";
  }>;
  ecoscore_trend?: number[];
  forecast?: {
    risk: string;
    pct_higher: number;
    departure: string;
    route: string;
  };
  badges?: Array<{
    id: string;
    label: string;
    icon: string;
    color: string;
  }>;
}

export async function getDashboardSummary(
  date?: string,
): Promise<DashboardSummary> {
  const query = date ? `?date=${date}` : "";
  return apiFetch<DashboardSummary>(`/api/dashboard/summary${query}`);
}
