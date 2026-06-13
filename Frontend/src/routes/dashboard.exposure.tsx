import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Wind, Factory, Cloud, Thermometer, Volume2, Loader2 } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { getDashboardSummary } from "@/lib/api/dashboard";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/dashboard/exposure")({
  head: () => ({ meta: [{ title: "Exposure Breakdown · EcoLens" }] }),
  component: ExposurePage,
});

function ExposurePage() {
  const [loading, setLoading] = useState(true);
  const [pm25, setPm25] = useState(0);
  const [avoided, setAvoided] = useState(0);
  const [co2, setCo2] = useState(0);
  const [heat, setHeat] = useState<string>("–");
  const [noise, setNoise] = useState(0);
  const [no2, setNo2] = useState<number | null>(null);

  useEffect(() => {
    getDashboardSummary()
      .then((data) => {
        setPm25(data.pm25_inhaled ?? 0);
        setAvoided(data.pm25_avoided ?? 0);
        setCo2(data.co2_grams ?? 0);
        setNoise(data.noise_avg_db ?? 0);
        // Heat stress: classify from heat_exposure value
        const heatVal = data.heat_exposure ?? 0;
        setHeat(heatVal > 5 ? "High" : heatVal > 2 ? "Moderate" : heatVal > 0 ? "Low" : "–");
      })
      .catch((err) => console.error("Exposure API error:", err))
      .finally(() => setLoading(false));
  }, []);

  // WHO PM2.5 daily guideline: 15 µg/m³
  const whoMultiple = pm25 > 0 ? Math.round(pm25 / 15) : null;
  const heatStatus: "safe" | "moderate" | "high" =
    heat === "High" ? "high" : heat === "Moderate" ? "moderate" : "safe";
  const noiseStatus: "safe" | "moderate" | "high" =
    noise > 70 ? "high" : noise > 55 ? "moderate" : "safe";

  return (
    <MobileShell>
      <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold flex items-center gap-2">
            Today&apos;s Exposure Breakdown
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
        </div>

        {/* PM2.5 bar */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind className="h-5 w-5 text-eco-orange" />
              <h3 className="font-semibold">PM2.5 Exposure</h3>
            </div>
            <div className="text-right">
              {loading ? (
                <div className="h-8 w-24 animate-pulse rounded bg-muted" />
              ) : (
                <div className="text-2xl font-bold">
                  {pm25.toFixed(1)}
                  <span className="ml-1 font-mono text-xs text-muted-foreground">µg inhaled</span>
                </div>
              )}
            </div>
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">Particulate Matter &lt; 2.5 µm</p>
          <Bar value={(pm25 / 1000) * 100} color="bg-eco-orange" />
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>0</span><span>500</span><span>City Avg 890</span><span>1000+</span>
          </div>
        </div>

        {/* Mini metric grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {no2 != null ? (
            <MiniMetric
              icon={<Factory className="h-4 w-4" />}
              label="NO2"
              value={loading ? "–" : `${no2.toFixed(0)} µg`}
              status="safe"
            />
          ) : (
            <MiniMetric
              icon={<Factory className="h-4 w-4" />}
              label="NO2"
              value="–"
              status="safe"
            />
          )}
          <MiniMetric
            icon={<Cloud className="h-4 w-4" />}
            label="CO₂ Emitted"
            value={loading ? "–" : `${co2.toFixed(0)} g`}
            status="safe"
          />
          <MiniMetric
            icon={<Thermometer className="h-4 w-4" />}
            label="Heat Stress"
            value={loading ? "–" : heat}
            status={heatStatus}
          />
          <MiniMetric
            icon={<Volume2 className="h-4 w-4" />}
            label="Noise"
            value={loading ? "–" : noise > 0 ? `${noise.toFixed(0)} dB` : "–"}
            status={noiseStatus}
          />
        </div>

        {/* Health context */}
        <div className="mt-4 rounded-3xl border border-eco-green/30 bg-eco-green/5 p-5">
          <h3 className="font-semibold text-eco-green">Health Context</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            WHO daily PM2.5 guideline:{" "}
            <span className="font-mono text-eco-cream">15 µg</span>.
          </p>
          {loading ? (
            <div className="mt-3 h-6 w-48 animate-pulse rounded bg-muted" />
          ) : whoMultiple != null && whoMultiple > 0 ? (
            <p className="mt-3 text-base font-semibold text-eco-orange">
              You inhaled {whoMultiple}× that.
            </p>
          ) : pm25 === 0 ? (
            <p className="mt-3 text-base font-semibold text-eco-green">
              No PM2.5 exposure recorded today.
            </p>
          ) : (
            <p className="mt-3 text-base font-semibold text-eco-green">
              You inhaled less than 1× the WHO guideline. Great job!
            </p>
          )}
          {avoided > 0 && (
            <p className="mt-3 rounded-xl bg-background/50 p-3 text-sm leading-relaxed">
              EcoLens route saved you from an additional{" "}
              <b className="font-mono text-eco-green">{avoided.toFixed(0)} µg</b>.
            </p>
          )}
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
  icon,
  label,
  value,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: "safe" | "moderate" | "high";
}) {
  const tone =
    status === "safe"
      ? "text-eco-green"
      : status === "moderate"
        ? "text-eco-orange"
        : "text-eco-red";
  const ring =
    status === "safe"
      ? "border-eco-green/30"
      : status === "moderate"
        ? "border-eco-orange/30"
        : "border-eco-red/30";
  return (
    <div className={`rounded-2xl border bg-card p-4 ${ring}`}>
      <div className={`flex items-center gap-2 ${tone}`}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="mt-2 text-lg font-bold">{value}</div>
    </div>
  );
}
