import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bike, Footprints, Car, SlidersHorizontal, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { trips as mockTrips } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { getTripHistory, type TripRecord } from "@/lib/api/trips";
import { isDemo } from "@/lib/api/client";

export const Route = createFileRoute("/dashboard/history")({
  head: () => ({ meta: [{ title: "Trip History · EcoLens" }] }),
  component: HistoryPage,
});

const filters = ["All", "This Week", "This Month"] as const;

/** Map a backend TripRecord to the shape the UI expects */
function mapTrip(t: TripRecord) {
  const at = t.started_at ? new Date(t.started_at) : null;
  const status: "safe" | "moderate" | "high" =
    (t.ecoscore ?? 0) >= 70 ? "safe" : (t.ecoscore ?? 0) >= 45 ? "moderate" : "high";
  return {
    id: t.id,
    date: at
      ? at.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "—",
    time: at
      ? at.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : "—",
    name: `${t.route_type === "cleanest_air" ? "Cleanest Air" : t.route_type === "lowest_carbon" ? "Lowest Carbon" : "Fastest"} Route`,
    mode: "bike" as "bike" | "walk" | "car",
    duration: t.duration_min != null ? `${t.duration_min} min` : "—",
    pm25Avoided: t.pm25_avoided ?? 0,
    co2: t.co2_grams ?? 0,
    ecoscore: t.ecoscore ?? 0,
    status,
  };
}

function HistoryPage() {
  const [active, setActive] = useState<(typeof filters)[number]>("All");
  const [loading, setLoading] = useState(!isDemo());
  const [trips, setTrips] = useState(mockTrips);

  useEffect(() => {
    if (isDemo()) return;
    getTripHistory(1, active === "All" ? "all" : active === "This Week" ? "week" : "month")
      .then((res) => {
        if (res.trips.length > 0) setTrips(res.trips.map(mapTrip));
      })
      .catch((err) => console.warn("Trips API error, using mock:", err))
      .finally(() => setLoading(false));
  }, [active]);


  return (
    <MobileShell>
      <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            Trip History
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setActive(f)}
                className={cn(
                  "rounded-full border px-4 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors",
                  active === f
                    ? "border-eco-orange bg-eco-orange/15 text-eco-orange"
                    : "border-border text-muted-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {trips.map((t) => {
            const Icon = t.mode === "bike" ? Bike : t.mode === "walk" ? Footprints : Car;
            const tone = t.status === "safe" ? "border-l-eco-green" : t.status === "moderate" ? "border-l-eco-orange" : "border-l-eco-red";
            const scoreColor = t.status === "safe" ? "text-eco-green" : t.status === "moderate" ? "text-eco-orange" : "text-eco-red";
            const iconBg = t.status === "safe" ? "bg-eco-green/10 text-eco-green" : t.status === "moderate" ? "bg-eco-orange/10 text-eco-orange" : "bg-eco-red/10 text-eco-red";
            return (
              <Link
                key={t.id}
                to="/dashboard/history/$tripId"
                params={{ tripId: t.id }}
                className={cn("block rounded-2xl border border-border border-l-4 bg-card p-4", tone)}
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {t.date} · {t.time}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", iconBg)}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="truncate text-sm font-semibold">{t.name}</div>
                    </div>
                  </div>
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-full border-2 font-mono text-sm font-bold", scoreColor, t.status === "safe" ? "border-eco-green" : t.status === "moderate" ? "border-eco-orange" : "border-eco-red")}>
                    {t.ecoscore}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">{t.duration}</span>
                  <span className={scoreColor}>
                    {t.pm25Avoided >= 0 ? `↓ ${t.pm25Avoided}` : `↑ ${Math.abs(t.pm25Avoided)}`} µg
                  </span>
                  <span className="text-muted-foreground">CO₂ {t.co2}g</span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          End of History
        </div>
      </div>
    </MobileShell>
  );
}
