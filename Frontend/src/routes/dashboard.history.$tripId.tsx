import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { ArrowLeft, Share2, PartyPopper } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { trips } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard/history/$tripId")({
  head: () => ({ meta: [{ title: "Trip Detail · EcoLens" }] }),
  component: TripDetailPage,
  notFoundComponent: () => (
    <MobileShell>
      <div className="p-8 text-center text-muted-foreground">Trip not found.</div>
    </MobileShell>
  ),
});

function TripDetailPage() {
  const { tripId } = useParams({ from: "/dashboard/history/$tripId" });
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) throw notFound();

  return (
    <MobileShell>
      <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard/history" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="text-base font-bold">{trip.date}, 2026 — {trip.name.split(" (")[0]}</div>
              <div className="font-mono text-[11px] text-muted-foreground">Downtown to Office</div>
            </div>
          </div>
          <button className="flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs">
            <Share2 className="h-4 w-4" /> Share
          </button>
        </div>

        {/* Map preview */}
        <div className="mt-4 aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-card map-bg relative">
          <svg viewBox="0 0 300 220" className="h-full w-full">
            <path d="M 20 200 L 60 160 L 140 130 L 200 90 L 260 50" stroke="var(--eco-orange)" strokeWidth="4" fill="none" strokeLinecap="round" filter="drop-shadow(0 0 6px var(--eco-orange))" />
            <circle cx="20" cy="200" r="6" fill="var(--eco-orange)" />
            <circle cx="260" cy="50" r="6" fill="var(--eco-orange)" />
          </svg>
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-eco-green animate-pulse" />
            Trip complete
          </div>
        </div>

        {/* Stats grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat label="Duration" value={trip.duration} />
          <Stat label="Distance" value="12.4 km" />
          <Stat label="PM2.5 Inhaled" value="15 µg" tone="eco-cream" />
          <Stat label="CO₂ Emitted" value={`${trip.co2} g`} tone="eco-green" />
          <Stat label="EcoScore" value={`${trip.ecoscore}/100`} tone="eco-green" big />
          <Stat label="Avoided" value="45%" tone="eco-blue" />
        </div>

        {/* Comparison bar */}
        <div className="mt-4 rounded-2xl border border-border bg-card p-4">
          <div className="text-sm">
            This route vs Fastest Route — you avoided{" "}
            <span className="font-bold text-eco-blue">67% more PM2.5</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 bg-eco-blue" />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>This Route (33%)</span>
            <span>Fastest (100%)</span>
          </div>
        </div>

        {/* Celebration */}
        <div className="mt-4 rounded-3xl border border-eco-green/40 bg-eco-green/5 p-5">
          <div className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-eco-green" />
            <h3 className="font-semibold">Trip Complete</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Excellent navigation! You maintained a high EcoScore by taking the green corridor,
            significantly reducing your exposure to urban pollutants.
          </p>
          <button className="mt-4 w-full rounded-2xl bg-eco-orange py-3 text-sm font-semibold text-background">
            View Badge Progress
          </button>
        </div>
      </div>
    </MobileShell>
  );
}

function Stat({ label, value, tone, big = false }: { label: string; value: string; tone?: string; big?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-2 font-bold ${big ? "text-3xl" : "text-xl"} ${tone === "eco-green" ? "text-eco-green" : tone === "eco-blue" ? "text-eco-blue" : tone === "eco-cream" ? "text-eco-cream" : ""}`}>
        {value}
      </div>
    </div>
  );
}
