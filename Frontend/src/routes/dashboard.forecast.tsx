import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Clock, Wind } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";

export const Route = createFileRoute("/dashboard/forecast")({
  head: () => ({ meta: [{ title: "Forecast · EcoLens" }] }),
  component: ForecastPage,
});

const hours = Array.from({ length: 24 }, (_, i) => {
  const v = Math.round(40 + 80 * Math.sin((i / 24) * Math.PI * 2) + (i > 14 && i < 19 ? 60 : 0));
  return { hour: i, pm25: Math.max(15, v) };
});

function ForecastPage() {
  return (
    <MobileShell>
      <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold">Tomorrow&apos;s Forecast</h1>
        </div>

        <div className="mt-5 rounded-3xl border border-border bg-card p-5">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            24-hour PM2.5 outlook
          </div>
          <div className="mt-4 flex h-44 items-end gap-1">
            {hours.map((h) => {
              const safe = h.pm25 < 60;
              const mod = h.pm25 < 120;
              const color = safe ? "bg-eco-green" : mod ? "bg-eco-orange" : "bg-eco-red";
              return (
                <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                  <div className={`w-full rounded-sm ${color}`} style={{ height: `${(h.pm25 / 180) * 100}%` }} />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-eco-green/40 bg-eco-green/5 p-5">
          <div className="flex items-center gap-2 text-eco-green">
            <Clock className="h-5 w-5" />
            <h3 className="font-semibold">Best Departure Window</h3>
          </div>
          <div className="mt-3 text-2xl font-bold">7:30 – 8:15 AM</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Wind shift pushes pollution away from your Residency Rd. corridor.
          </p>
          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-eco-orange py-3 text-sm font-semibold text-background">
            <Wind className="h-4 w-4" /> Set departure reminder
          </button>
        </div>
      </div>
    </MobileShell>
  );
}
