import { apiFetch } from "./client";

export interface RouteOption {
  type: "fastest" | "cleanest_air" | "lowest_carbon";
  label: string;
  duration_min: number;
  distance_km: number;
  pm25_exposure: number;
  co2_grams: number;
  ecoscore: number;
  /** Array of [lng, lat] coordinate pairs forming the route polyline */
  polyline: [number, number][];
  segment_ids: string[];
  recommended: boolean;
}

export interface GenerateRoutesResponse {
  routes: RouteOption[];
}

export async function generateRoutes(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<RouteOption[]> {
  const data = await apiFetch<GenerateRoutesResponse | RouteOption[]>(
    "/api/routes/generate",
    {
      method: "POST",
      body: JSON.stringify({ origin, destination }),
    },
  );
  // Backend may return { routes: [...] } or directly an array
  if (Array.isArray(data)) return data;
  return (data as GenerateRoutesResponse).routes ?? [];
}

export async function rerouteFromPosition(
  current_position: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  original_route_type: string,
  reason: "off_route" | "pollution_spike" | "user_requested",
): Promise<RouteOption> {
  return apiFetch<RouteOption>("/api/routes/reroute", {
    method: "POST",
    body: JSON.stringify({
      current_position,
      destination,
      original_route_type,
      reason,
    }),
  });
}
