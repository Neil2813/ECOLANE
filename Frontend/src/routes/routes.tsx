import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Wind, Cloud, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { routes as routeData } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/routes")({
  head: () => ({ meta: [{ title: "Route options · EcoLens" }] }),
  component: RoutesPage,
});

function RoutesPage() {
  const [selected, setSelected] = useState("cleanest_air");
  return (
    <MobileShell>
      <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <Link to="/map" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold">Choose your route</h1>
        </div>

        <div className="mt-4 aspect-[5/3] overflow-hidden rounded-3xl border border-border map-bg relative">
          <svg viewBox="0 0 300 180" className="h-full w-full">
            <path d="M 20 150 Q 80 140 140 110 T 280 30" stroke="oklch(0.55 0.02 60)" strokeWidth="3" fill="none" />
            <path d="M 20 150 Q 90 120 160 90 T 280 30" stroke="var(--eco-green)" strokeWidth="4" fill="none" filter="drop-shadow(0 0 6px var(--eco-green))" />
            <path d="M 20 150 Q 60 100 130 80 T 280 30" stroke="var(--eco-blue)" strokeWidth="3" fill="none" />
          </svg>
        </div>

        <div className="mt-4 space-y-3">
          {routeData.map((r) => {
            const active = selected === r.type;
            return (
              <button
                key={r.type}
                onClick={() => setSelected(r.type)}
                className={cn(
                  "w-full rounded-2xl border bg-card p-4 text-left transition-colors",
                  active ? "border-eco-green glow-green" : "border-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">{r.label}</span>
                    {r.recommended && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-eco-green/15 px-2 py-0.5 font-mono text-[10px] uppercase text-eco-green">
                        <CheckCircle2 className="h-3 w-3" /> Recommended
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "rounded-full px-2.5 py-1 font-mono text-xs font-bold",
                    r.ecoscore >= 70 ? "bg-eco-green/15 text-eco-green" : "bg-eco-orange/15 text-eco-orange"
                  )}>
                    {r.ecoscore}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> {r.duration} min</div>
                  <div className="flex items-center gap-1"><Wind className="h-3 w-3" /> {r.pm25} µg</div>
                  <div className="flex items-center gap-1"><Cloud className="h-3 w-3" /> {r.co2} g</div>
                </div>
              </button>
            );
          })}
        </div>

        <Link to="/summary" className="mt-5 block rounded-2xl bg-eco-orange py-3.5 text-center text-base font-semibold text-background">
          Start Navigation
        </Link>
      </div>
    </MobileShell>
  );
}
