import { apiFetch } from "./client";

export interface TripRecord {
  id: string;
  route_type: "fastest" | "cleanest_air" | "lowest_carbon";
  started_at: string | null;
  duration_min: number | null;
  distance_km: number | null;
  pm25_inhaled: number | null;
  pm25_avoided: number | null;
  co2_grams: number | null;
  ecoscore: number | null;
}

export interface TripHistoryResponse {
  trips: TripRecord[];
  total: number;
  page: number;
  limit: number;
}

export async function getTripHistory(
  page = 1,
  filter = "all",
): Promise<TripHistoryResponse> {
  return apiFetch<TripHistoryResponse>(
    `/api/trips/history?page=${page}&filter=${filter}`,
  );
}
