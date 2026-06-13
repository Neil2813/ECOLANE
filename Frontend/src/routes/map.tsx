import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, User, AlertTriangle, X, Layers, Crosshair, ScanLine, Leaf } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { MobileShell } from "@/components/mobile-shell";
import { Map, type MapRef } from "@/components/ui/map";

const styles = {
  default: undefined,
  openstreetmap: "https://tiles.openfreemap.org/styles/bright",
  openstreetmap3d: "https://tiles.openfreemap.org/styles/liberty",
};

type StyleKey = keyof typeof styles;

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "Live Map · EcoLens" }] }),
  component: MapPage,
});

function MapPage() {
  const [alertOpen, setAlertOpen] = useState(true);
  const mapRef = useRef<MapRef>(null);
  const [style, setStyle] = useState<StyleKey>("default");
  const selectedStyle = styles[style];
  const is3D = style === "openstreetmap3d";

  useEffect(() => {
    mapRef.current?.easeTo({ pitch: is3D ? 60 : 0, duration: 500 });
  }, [is3D]);

  return (
    <MobileShell>
      <div className="relative h-[calc(100vh-6rem)] overflow-hidden">
        {/* Map Component */}
        <Map
          ref={mapRef}
          center={[-0.1276, 51.5074]}
          zoom={15}
          className="h-full w-full"
          styles={
            selectedStyle
              ? { light: selectedStyle, dark: selectedStyle }
              : undefined
          }
        />

        {/* Style Selector Overlay */}
        <div className="absolute top-20 right-4 z-20">
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as StyleKey)}
            className="bg-background text-foreground rounded-md border px-2 py-1 text-sm shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-eco-orange"
          >
            <option value="default">Default (Carto)</option>
            <option value="openstreetmap">OpenStreetMap</option>
            <option value="openstreetmap3d">OpenStreetMap 3D</option>
          </select>
        </div>

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

