import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Map, AlertTriangle, Leaf } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";

export const Route = createFileRoute("/ar")({
  head: () => ({ meta: [{ title: "AR Mode · EcoLens" }] }),
  component: ARPage,
});

function ARPage() {
  return (
    <MobileShell>
      <div className="relative h-[calc(100vh-6rem)] overflow-hidden bg-gradient-to-b from-background via-black to-eco-green/10">
        {/* Top HUD */}
        <div className="absolute inset-x-0 top-0 z-10 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            <Link to="/map" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/70 backdrop-blur">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link to="/map" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/70 backdrop-blur">
              <Map className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-card/70 p-3 backdrop-blur">
            <HudStat label="AQI" value="142" tone="text-eco-orange" />
            <HudStat label="PM2.5" value="88 µg" />
            <HudStat label="CO₂" value="High" tone="text-eco-orange" />
          </div>
        </div>

        {/* Floating AR badges */}
        <div className="absolute left-10 top-1/3 rounded-xl border border-border bg-card/80 p-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-eco-orange" />
            <div>
              <div className="font-mono text-xs">Carbon: High</div>
              <div className="font-mono text-[10px] text-muted-foreground">Industrial Zone</div>
            </div>
          </div>
          <div className="absolute left-1/2 top-full h-20 w-px bg-eco-orange" />
          <div className="absolute left-1/2 top-[calc(100%+5rem)] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-eco-orange shadow-[0_0_12px_var(--eco-orange)]" />
        </div>

        <div className="absolute right-8 top-[45%] rounded-xl border border-border bg-card/80 p-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-eco-green" />
            <div>
              <div className="font-mono text-xs">AQI: Good</div>
              <div className="font-mono text-[10px] text-muted-foreground">Park Area</div>
            </div>
          </div>
          <div className="absolute left-1/2 top-full h-24 w-px bg-eco-green" />
          <div className="absolute left-1/2 top-[calc(100%+6rem)] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-eco-green shadow-[0_0_12px_var(--eco-green)]" />
        </div>

        {/* Glowing path */}
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2">
          <div className="h-32 w-1 bg-gradient-to-t from-eco-cream to-transparent" />
        </div>

        {/* Bottom destination input */}
        <div className="absolute inset-x-4 bottom-3 z-10">
          <div className="flex items-center gap-3 rounded-full bg-eco-cream px-5 py-3 text-background">
            <span className="text-sm text-background/60">Where are you going?</span>
            <button className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-eco-orange text-background">
              <ArrowLeft className="h-4 w-4 -rotate-45" />
            </button>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

function HudStat({ label, value, tone = "text-eco-cream" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-3 text-center">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}
