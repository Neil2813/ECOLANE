import { createFileRoute, Link } from "@tanstack/react-router";
import {
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  Bike,
  Shield,
  Trees,
  History,
  Award,
  Loader2,
} from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { getDashboardSummary, type DashboardSummary } from "@/lib/api/dashboard";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · EcoLens" }] }),
  component: DashboardPage,
});

// ── Skeleton helpers ──────────────────────────────────────────────────────────
function SkeletonLine({ w = "w-24" }: { w?: string }) {
  return <span className={`inline-block h-4 animate-pulse rounded bg-muted ${w}`} />;
}
function SkeletonBlock({ h = "h-6", w = "w-full" }: { h?: string; w?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${h} ${w}`} />;
}

// ── Page ─────────────────────────────────────────────────────────────────────
function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardSummary()
      .then(setSummary)
      .catch((err) => {
        console.error("Dashboard API error:", err);
        setError("Could not load dashboard data. Please sign in.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Derived values — only from API (zeros when no data yet)
  const pm25 = summary?.pm25_inhaled ?? 0;
  const avoided = summary?.pm25_avoided ?? 0;
  const co2 = summary?.co2_grams ?? 0;
  const ecoscore = summary?.ecoscore ?? 0;
  const co2VsAvg = summary?.co2_vs_avg_percent;
  const ecoscoreDelta = summary?.ecoscore_delta;
  const ecoscoreTrend = summary?.ecoscore_trend ?? [];
  const weeklyPollution = summary?.weekly_pollution ?? [];
  const forecast = summary?.forecast ?? null;
  const badges = summary?.badges ?? [];

  // Ring fill: scale ecoscore (0-100) to ring fill percent
  const ringPercent = ecoscore;

  return (
    <MobileShell>
      <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Environmental Stewardship
            </div>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
              Exposure Dashboard
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </h1>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-eco-green/40 bg-eco-green/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-eco-green">
            <span className="h-2 w-2 rounded-full bg-eco-green" />
            AQI Safe
          </span>
        </div>

        {/* Error state */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-eco-red/40 bg-eco-red/10 p-4 text-sm text-eco-red">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

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
                {loading ? (
                  <SkeletonLine w="w-40" />
                ) : (
                  <span>
                    Avoided <b>{avoided.toFixed(1)} µg</b> via EcoLens route
                  </span>
                )}
              </div>

              <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                {loading ? (
                  <SkeletonLine w="w-32" />
                ) : (
                  <>
                    CO₂ {co2.toFixed(1)}g
                    {co2VsAvg != null && (
                      <>
                        {" · "}
                        {co2VsAvg < 0
                          ? `${Math.abs(co2VsAvg)}% below city avg`
                          : `${co2VsAvg}% above city avg`}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* EcoScore ring */}
            <CircularProgress
              value={ringPercent}
              label={loading ? "–" : `${pm25.toFixed(0)}`}
              sublabel="µg PM2.5"
            />
          </div>
        </Link>

        {/* Tomorrow's risk */}
        {(loading || forecast) && (
          <Link
            to="/dashboard/forecast"
            className="mt-4 block rounded-3xl border border-eco-orange/40 bg-eco-orange/5 p-5"
          >
            <div className="flex items-center gap-2 text-eco-orange">
              <TrendingUp className="h-4 w-4" />
              <h3 className="font-semibold">Tomorrow&apos;s Risk</h3>
            </div>
            {loading ? (
              <div className="mt-2 space-y-2">
                <SkeletonBlock h="h-4" w="w-3/4" />
                <SkeletonBlock h="h-12" />
              </div>
            ) : forecast ? (
              <>
                <p className="mt-2 text-sm leading-relaxed">
                  Your usual route has{" "}
                  <b className="text-eco-orange">
                    {forecast.pct_higher != null
                      ? `${forecast.pct_higher}% higher PM2.5`
                      : `${forecast.risk_level} pollution risk`}
                  </b>{" "}
                  {forecast.reason
                    ? `due to ${forecast.reason}`
                    : "tomorrow — plan your commute early."}
                </p>
                <div className="mt-4 rounded-2xl border border-border bg-background/60 p-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Recommended Departure
                  </div>
                  <div className="mt-0.5 text-sm">
                    {forecast.recommended_departure} via {forecast.recommended_route}
                  </div>
                </div>
              </>
            ) : null}
            <div className="mt-3 flex items-center justify-end gap-1.5 text-xs text-eco-orange">
              See forecast detail <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        )}

        {/* This week + EcoScore */}
        <div className="mt-4 grid gap-4">
          <Card>
            <h3 className="font-semibold">This Week&apos;s Pollution</h3>
            {loading ? (
              <div className="mt-5 flex items-end justify-between gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-24 w-full items-end">
                      <div
                        className="w-full rounded-t-md animate-pulse bg-muted"
                        style={{ height: `${30 + Math.random() * 50}%` }}
                      />
                    </div>
                    <SkeletonLine w="w-4" />
                  </div>
                ))}
              </div>
            ) : weeklyPollution.length > 0 ? (
              <div className="mt-5 flex items-end justify-between gap-2">
                {weeklyPollution.map((d, idx) => (
                  <div key={`${d.day}-${idx}`} className="flex flex-1 flex-col items-center gap-2">
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
                        style={{ height: `${Math.min(100, (d.level / 120) * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">{d.day}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No pollution data yet — complete a trip to see your weekly trend.
              </p>
            )}
          </Card>

          <Card>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">EcoScore Progress</h3>
                <p className="mt-1 text-xs text-eco-green">
                  {loading ? (
                    <SkeletonLine w="w-36" />
                  ) : ecoscoreDelta != null ? (
                    ecoscoreDelta > 0
                      ? `Improved ${ecoscoreDelta} points this week`
                      : ecoscoreDelta < 0
                        ? `Down ${Math.abs(ecoscoreDelta)} points this week`
                        : "Stable this week"
                  ) : (
                    "Complete trips to track progress"
                  )}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-eco-green">
                  {loading ? "–" : ecoscore}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">/ 100</div>
              </div>
            </div>
            {loading ? (
              <SkeletonBlock h="h-16" />
            ) : ecoscoreTrend.length >= 2 ? (
              <Sparkline values={ecoscoreTrend} />
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Not enough data for a trend yet.</p>
            )}
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
          {loading ? (
            <div className="mt-4 flex gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <SkeletonBlock h="h-12 w-12" />
                  <SkeletonLine w="w-14" />
                </div>
              ))}
            </div>
          ) : badges.length > 0 ? (
            <div className="mt-4 flex gap-4">
              {badges.map((b) => {
                const Icon = b.icon === "bike" ? Bike : b.icon === "shield" ? Shield : Trees;
                const color =
                  b.color === "green"
                    ? "text-eco-green bg-eco-green/10"
                    : b.color === "orange"
                      ? "text-eco-orange bg-eco-orange/10"
                      : "text-eco-blue bg-eco-blue/10";
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
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No badges yet — take eco-friendly trips to earn them!
            </p>
          )}
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
  const off = c - (Math.max(0, Math.min(100, value)) / 100) * c;
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
  const step = w / Math.max(1, values.length - 1);
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
