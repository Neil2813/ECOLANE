import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bike, Footprints, Car, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { trips } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/history")({
  head: () => ({ meta: [{ title: "Trip History · EcoLens" }] }),
  component: HistoryPage,
});

const filters = ["All", "This Week", "This Month"] as const;

function HistoryPage() {
  const [active, setActive] = useState<(typeof filters)[number]>("All");

  return (
    <MobileShell>
      <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold">Trip History</h1>
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
