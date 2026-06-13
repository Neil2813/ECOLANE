import { apiFetch } from "./client";

// ── Composite response (nested by domain) ────────────────────────────────────
export interface AirQualityData {
  pm25?: number;
  pm10?: number;
  no2?: number;
  o3?: number;
  so2?: number;
  co?: number;
  aqi?: number;
  source?: string;
  is_cached?: boolean;
}

export interface WeatherData {
  temperature?: number;
  humidity?: number;
  wind_speed?: number;
  uv_index?: number;
  weather_label?: string;
}

export interface EnvCompositeResponse {
  lat: number;
  lon: number;
  fetched_at: string;
  air_quality: AirQualityData | null;
  weather: WeatherData | null;
  soil: Record<string, number> | null;
  water: Record<string, number> | null;
  events: { events_found: number; events: unknown[] } | null;
}

// ── Flattened shape used by the UI ───────────────────────────────────────────
export interface EnvCompositeData {
  lat: number;
  lon: number;
  pm25: number;
  no2?: number;
  aqi?: number;
  temperature?: number;
  humidity?: number;
  ecoscore: number;
  source?: string;
  updated_at?: string;
}

/**
 * Compute a simple ecoscore (0-100) from PM2.5.
 * Mirrors the backend formula but applied client-side for the map HUD.
 */
function pm25ToEcoScore(pm25: number): number {
  // WHO daily guideline = 15 µg/m³ → score 100
  // 200+ µg/m³ → score ~0
  return Math.max(0, Math.min(100, Math.round(100 - (pm25 / 2))));
}

/**
 * Fetch composite environmental data for a location and flatten into a
 * simple UI-friendly shape.
 * Used by the map's live EcoScore bubble and HUD.
 */
export async function getEnvComposite(
  lat: number,
  lon: number,
): Promise<EnvCompositeData> {
  const raw = await apiFetch<EnvCompositeResponse>(
    `/api/env/composite?lat=${lat}&lon=${lon}`,
  );
  const aq = raw.air_quality ?? {};
  const weather = raw.weather ?? {};
  const pm25 = aq.pm25 ?? 0;
  return {
    lat: raw.lat,
    lon: raw.lon,
    pm25,
    no2: aq.no2,
    aqi: aq.aqi,
    temperature: weather.temperature,
    humidity: weather.humidity,
    ecoscore: pm25ToEcoScore(pm25),
    source: aq.source,
    updated_at: raw.fetched_at,
  };
}

/**
 * Fetch live air quality data for a specific coordinate.
 * Used during navigation to update the AQI display at each step.
 */
export async function getAirQuality(
  lat: number,
  lon: number,
): Promise<AirQualityData & { lat: number; lon: number }> {
  const data = await apiFetch<AirQualityData>(
    `/api/env/air-quality?lat=${lat}&lon=${lon}`,
  );
  return { ...data, lat, lon };
}
