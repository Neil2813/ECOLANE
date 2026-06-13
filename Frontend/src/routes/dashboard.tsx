import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, AlertTriangle, ChevronRight, Bike, Shield, Trees, History, Award } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { todayExposure, ecoscoreTrend, weeklyPollution, forecast, badges } from "@/lib/mock-data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · EcoLens" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <MobileShell>
      <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Environmental Stewardship
            </div>
            <h1 className="mt-1 text-2xl font-bold">Exposure Dashboard</h1>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-eco-green/40 bg-eco-green/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-eco-green">
            <span className="h-2 w-2 rounded-full bg-eco-green" />
            AQI Safe
          </span>
        </div>

        {/* Today's exposure */}
        <Link
          to="/dashboard/exposure"
          className="mt-5 block rounded-3xl border border-border bg-card p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold">Today&apos;s Exposure</h2>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Cumulative PM2.5 Intake
              </p>

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-eco-green/10 px-3 py-2 text-xs text-eco-green">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Avoided <b>{todayExposure.avoided} µg</b> via EcoLens route
                </span>
              </div>
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                CO₂ {todayExposure.co2}g · 40% below city avg
              </div>
            </div>

            {/* Ring */}
            <CircularProgress value={68} label={`${todayExposure.pm25}`} sublabel="µg PM2.5" />
          </div>
        </Link>

        {/* Tomorrow's risk */}
        <Link
          to="/dashboard/forecast"
          className="mt-4 block rounded-3xl border border-eco-orange/40 bg-eco-orange/5 p-5"
        >
          <div className="flex items-center gap-2 text-eco-orange">
            <TrendingUp className="h-4 w-4" />
            <h3 className="font-semibold">Tomorrow&apos;s Risk</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed">
            Your usual route has <b className="text-eco-orange">{forecast.pctHigher}% higher PM2.5</b>{" "}
            due to forecasted wind shift.
          </p>
          <div className="mt-4 rounded-2xl border border-border bg-background/60 p-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Recommended Departure
            </div>
            <div className="mt-0.5 text-sm">
              {forecast.departure} via {forecast.route}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-eco-orange">
            See forecast detail <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </Link>

        {/* This week + EcoScore */}
        <div className="mt-4 grid gap-4">
          <Card>
            <h3 className="font-semibold">This Week&apos;s Pollution</h3>
            <div className="mt-5 flex items-end justify-between gap-2">
              {weeklyPollution.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-24 w-full items-end">
                    <div
                      className={
                        "w-full rounded-t-md " +
                        (d.status === "safe"
                          ? "bg-eco-green"
                          : d.status === "moderate"
                            ? "bg-eco-orange"
                            : "bg-eco-red")
                      }
                      style={{ height: `${(d.level / 120) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">EcoScore Progress</h3>
                <p className="mt-1 text-xs text-eco-green">
                  Improved 12 points this week
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-eco-green">84</div>
                <div className="font-mono text-[10px] text-muted-foreground">/ 100</div>
              </div>
            </div>
            <Sparkline values={ecoscoreTrend} />
          </Card>
        </div>

        {/* Recent badges */}
        <Card className="mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Recent Badges</h3>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Keep up the good habits
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            {badges.map((b) => {
              const Icon = b.icon === "bike" ? Bike : b.icon === "shield" ? Shield : Trees;
              const color =
                b.color === "green" ? "text-eco-green bg-eco-green/10" :
                b.color === "orange" ? "text-eco-orange bg-eco-orange/10" :
                "text-eco-blue bg-eco-blue/10";
              return (
                <div key={b.id} className="flex flex-1 flex-col items-center gap-2 text-center">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full ${color}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-[10px] leading-tight">{b.label}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Quick links */}
        <div className="mt-4 grid grid-cols-2 gap-3 pb-4">
          <Link to="/dashboard/history" className="rounded-2xl border border-border bg-card p-4 hover:border-eco-orange/40">
            <History className="h-5 w-5 text-eco-orange" />
            <div className="mt-3 font-semibold">Trip History</div>
            <div className="text-xs text-muted-foreground">View all trips</div>
          </Link>
          <Link to="/dashboard/exposure" className="rounded-2xl border border-border bg-card p-4 hover:border-eco-green/40">
            <Award className="h-5 w-5 text-eco-green" />
            <div className="mt-3 font-semibold">Breakdown</div>
            <div className="text-xs text-muted-foreground">By pollutant</div>
          </Link>
        </div>
      </div>
    </MobileShell>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-border bg-card p-5 ${className}`}>{children}</div>;
}

function CircularProgress({ value, label, sublabel }: { value: number; label: string; sublabel: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} stroke="oklch(0.26 0.02 50)" strokeWidth="7" fill="none" />
        <circle
          cx="50" cy="50" r={r}
          stroke="var(--eco-green)"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold">{label}</div>
        <div className="font-mono text-[10px] text-muted-foreground">{sublabel}</div>
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const w = 280, h = 60;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const y = h - ((v - min) / Math.max(1, max - min)) * (h - 8) - 4;
    return `${i * step},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 h-16 w-full">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--eco-green)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p, i) => {
        const [x, y] = p.split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r="3" fill="var(--background)" stroke="var(--eco-green)" strokeWidth="2" />;
      })}
    </svg>
  );
}
