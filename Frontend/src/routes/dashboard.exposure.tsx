import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Wind, Factory, Cloud, Thermometer, Volume2 } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { todayExposure } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard/exposure")({
  head: () => ({ meta: [{ title: "Exposure Breakdown · EcoLens" }] }),
  component: ExposurePage,
});

function ExposurePage() {
  return (
    <MobileShell>
      <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold">Today&apos;s Exposure Breakdown</h1>
        </div>

        <div className="mt-6 rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind className="h-5 w-5 text-eco-orange" />
              <h3 className="font-semibold">PM2.5 Exposure</h3>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{todayExposure.pm25}<span className="ml-1 font-mono text-xs text-muted-foreground">µg inhaled</span></div>
            </div>
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">Particulate Matter &lt; 2.5 µm</p>
          <Bar value={(todayExposure.pm25 / 1000) * 100} color="bg-eco-orange" />
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>0</span><span>500</span><span>City Avg 890</span><span>1000+</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <MiniMetric icon={<Factory className="h-4 w-4" />} label="NO2" value="88 µg" status="safe" />
          <MiniMetric icon={<Cloud className="h-4 w-4" />} label="CO2 Emitted" value="210 g" status="safe" />
          <MiniMetric icon={<Thermometer className="h-4 w-4" />} label="Heat Stress" value="Moderate" status="moderate" />
          <MiniMetric icon={<Volume2 className="h-4 w-4" />} label="Noise" value="62 dB" status="safe" />
        </div>

        <div className="mt-4 rounded-3xl border border-eco-green/30 bg-eco-green/5 p-5">
          <h3 className="font-semibold text-eco-green">Health Context</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            WHO daily PM2.5 guideline: <span className="font-mono text-eco-cream">15 µg</span>.
          </p>
          <p className="mt-3 text-base font-semibold text-eco-orange">You inhaled 22× that.</p>
          <p className="mt-3 rounded-xl bg-background/50 p-3 text-sm leading-relaxed">
            EcoLens route saved you from an additional <b className="font-mono text-eco-green">430 µg</b>.
          </p>
        </div>
      </div>
    </MobileShell>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function MiniMetric({
  icon, label, value, status,
}: { icon: React.ReactNode; label: string; value: string; status: "safe" | "moderate" | "high" }) {
  const tone = status === "safe" ? "text-eco-green" : status === "moderate" ? "text-eco-orange" : "text-eco-red";
  const ring = status === "safe" ? "border-eco-green/30" : status === "moderate" ? "border-eco-orange/30" : "border-eco-red/30";
  return (
    <div className={`rounded-2xl border bg-card p-4 ${ring}`}>
      <div className={`flex items-center gap-2 ${tone}`}>{icon}<span className="text-xs font-medium">{label}</span></div>
      <div className="mt-2 text-lg font-bold">{value}</div>
    </div>
  );
}
