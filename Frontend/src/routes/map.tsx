import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, User, AlertTriangle, X, Layers, Crosshair, ScanLine, Leaf } from "lucide-react";
import { useState } from "react";
import { MobileShell } from "@/components/mobile-shell";

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Live Map · EcoLens" }] }),
  component: MapPage,
});

function MapPage() {
  const [alertOpen, setAlertOpen] = useState(true);

  return (
    <MobileShell>
      <div className="relative h-[calc(100vh-6rem)] map-bg overflow-hidden">
        {/* Map grid SVG */}
        <MapGrid />

        {/* Top search */}
        <div className="absolute inset-x-0 top-0 z-20 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <Link
            to="/routes"
            className="flex items-center gap-3 rounded-full border border-border bg-card/70 px-5 py-3.5 backdrop-blur-md"
          >
            <Search className="h-4 w-4 text-eco-orange" />
            <span className="flex-1 text-sm text-muted-foreground">Where are you going?</span>
            <User className="h-5 w-5 text-muted-foreground" />
          </Link>

          {alertOpen && (
            <Link
              to="/alert/$id"
              params={{ id: "no2-spike" }}
              className="mt-3 flex items-center gap-3 rounded-2xl bg-eco-orange px-4 py-3 text-background shadow-lg"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("[data-dismiss]")) {
                  e.preventDefault();
                  setAlertOpen(false);
                }
              }}
            >
              <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={2.4} />
              <span className="flex-1 font-mono text-xs leading-snug">
                High NO2 detected near you — tap for safer route
              </span>
              <button data-dismiss className="opacity-80 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </Link>
          )}
        </div>

        {/* FABs */}
        <div className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-3">
          <Fab><Layers className="h-5 w-5" /></Fab>
          <Fab><Crosshair className="h-5 w-5" /></Fab>
          <Fab variant="orange"><ScanLine className="h-5 w-5" /></Fab>
        </div>

        {/* Legend */}
        <div className="absolute bottom-32 left-4 z-10 rounded-2xl border border-border bg-card/80 px-4 py-3 backdrop-blur">
          <LegendRow color="bg-eco-red/70" label="High" />
          <LegendRow color="bg-eco-green" label="Clean" />
          <LegendRow color="bg-eco-blue" label="Low Carbon" />
        </div>

        {/* Bottom info strip */}
        <div className="absolute inset-x-4 bottom-3 z-10 flex items-center gap-3 rounded-2xl border border-border bg-card/85 px-4 py-3 backdrop-blur-md">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-eco-green/15">
            <span className="absolute inset-0 rounded-full pulse-ring" />
            <Leaf className="h-5 w-5 text-eco-green" />
          </span>
          <div className="flex-1">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Current EcoScore
            </div>
            <div className="text-sm font-semibold">
              <span className="text-eco-green">84</span>
              <span className="text-muted-foreground"> · Air Quality: Moderate</span>
            </div>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}

function Fab({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "orange" }) {
  return (
    <button
      className={
        "flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-md transition-transform active:scale-95 " +
        (variant === "orange"
          ? "border-eco-orange bg-eco-orange text-background glow-orange"
          : "border-border bg-card/80 text-foreground")
      }
    >
      {children}
    </button>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="font-mono text-[11px] tracking-wider">{label}</span>
    </div>
  );
}

function MapGrid() {
  // SVG perspective grid evoking the uploaded map view
  return (
    <svg
      viewBox="0 0 400 700"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.72 0.18 150)" stopOpacity="0.05" />
          <stop offset="60%" stopColor="oklch(0.72 0.18 150)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="oklch(0.72 0.18 150)" stopOpacity="0.2" />
        </linearGradient>
      </defs>

      {/* Horizontal lines (perspective) */}
      {Array.from({ length: 14 }).map((_, i) => {
        const y = 180 + i * 38 + i * i * 0.6;
        return (
          <line
            key={"h" + i}
            x1="-50"
            y1={y}
            x2="450"
            y2={y}
            stroke="url(#fade)"
            strokeWidth="1.2"
          />
        );
      })}

      {/* Vertical converging lines */}
      {Array.from({ length: 15 }).map((_, i) => {
        const x = i * 30 - 30;
        return (
          <line
            key={"v" + i}
            x1={x}
            y1="700"
            x2={200 + (x - 200) * 0.15}
            y2="180"
            stroke="oklch(0.72 0.18 150 / 0.55)"
            strokeWidth="1"
          />
        );
      })}

      {/* Red high-pollution streaks */}
      <line x1="0" y1="280" x2="400" y2="290" stroke="oklch(0.65 0.22 25 / 0.55)" strokeWidth="1.4" />
      <line x1="0" y1="340" x2="400" y2="360" stroke="oklch(0.65 0.22 25 / 0.4)" strokeWidth="1" />
    </svg>
  );
}
