import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowRight, Eye, Route as RouteIcon, Activity, MapPin, X } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding/$step")({
  component: OnboardingPage,
});

const slides = [
  {
    tag: "AQI CRITICAL",
    title: "See What Others Can't",
    body: "EcoLens paints the air quality, heat, and carbon reality of every street around you — in real time.",
    icon: Eye,
    visual: "city",
  },
  {
    tag: "ROUTE COMPARE",
    title: "Navigate for Your Health",
    body: "Choose Fastest, Cleanest Air, or Lowest Carbon — with exact pollution and emission trade-offs upfront.",
    icon: RouteIcon,
    visual: "routes",
  },
  {
    tag: "ECOSCORE 84",
    title: "Your Environmental Report",
    body: "Track your daily pollution intake and carbon footprint — and predict tomorrow's risk before you leave.",
    icon: Activity,
    visual: "dash",
  },
  {
    tag: "DAILY COMMUTE",
    title: "Automatic Predictions",
    body: "Tell us if you commute everyday on the same route. We will automatically forecast the cleanest departure windows.",
    icon: RouteIcon,
    visual: "commute",
  },
];

function OnboardingPage() {
  const { step } = useParams({ from: "/onboarding/$step" });
  const navigate = useNavigate();
  const idx = Math.max(1, Math.min(4, parseInt(step) || 1)) - 1;
  const slide = slides[idx];
  const Icon = slide.icon;

  // Step 4 commute preference state
  const [useEveryday, setUseEveryday] = useState<boolean | null>(null);
  const [destination, setDestination] = useState("");
  const [suggestions, setSuggestions] = useState<{ name: string; coords: [number, number] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDest, setSelectedDest] = useState<{ name: string; coords: [number, number] } | null>(null);

  // Search destination debounced Nominatim API
  useEffect(() => {
    if (!destination || destination.trim().length < 2 || selectedDest) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            destination
          )}&limit=5&countrycodes=in`
        );
        const data = await res.json();
        const mapped = data.map((item: any) => ({
          name: item.display_name.split(",").slice(0, 3).join(","),
          coords: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
        }));
        setSuggestions(mapped);
      } catch (err) {
        console.error("Nominatim query failed in onboarding:", err);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [destination, selectedDest]);

  const next = () => {
    if (idx < 3) {
      navigate({ to: "/onboarding/$step", params: { step: String(idx + 2) } });
    } else {
      localStorage.setItem("ecolens:onboarded", "1");
      if (useEveryday === true && selectedDest) {
        localStorage.setItem("ecolens:use_everyday", "true");
        localStorage.setItem("ecolens:commute_destination", selectedDest.name);
        localStorage.setItem("ecolens:commute_destination_coords", `${selectedDest.coords[0]},${selectedDest.coords[1]}`);
      } else {
        localStorage.setItem("ecolens:use_everyday", "false");
        localStorage.removeItem("ecolens:commute_destination");
        localStorage.removeItem("ecolens:commute_destination_coords");
      }
      navigate({ to: "/auth/signup" });
    }
  };

  const skip = () => {
    localStorage.setItem("ecolens:onboarded", "1");
    localStorage.setItem("ecolens:use_everyday", "false");
    localStorage.removeItem("ecolens:commute_destination");
    localStorage.removeItem("ecolens:commute_destination_coords");
    navigate({ to: "/auth/signup" });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      {/* Visual */}
      <div className="relative flex-1 grid-bg overflow-hidden min-h-[30vh]">
        <button
          onClick={skip}
          className="absolute right-6 top-6 z-10 font-mono text-xs tracking-widest text-muted-foreground hover:text-foreground"
        >
          SKIP
        </button>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-64 w-64">
            {/* Atmospheric gradient */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-eco-orange/30 via-eco-orange/10 to-transparent blur-2xl" />
            <div className="absolute inset-8 rounded-3xl border border-eco-orange/30 bg-card/40 backdrop-blur-sm flex items-center justify-center">
              <Icon className="h-20 w-20 text-eco-orange/80" strokeWidth={1.2} />
            </div>
          </div>
        </div>

        {/* Floating chip */}
        <div className="absolute right-8 top-1/3 flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-eco-orange animate-pulse" />
          <span className="font-mono text-[11px] tracking-widest">{slide.tag}</span>
        </div>
      </div>

      {/* Sheet */}
      <div className="rounded-t-3xl border-t border-border bg-card px-7 pb-10 pt-8 flex flex-col justify-between min-h-[50vh]">
        <div className="flex-1">
          <h1 className="text-2xl font-bold leading-tight">{slide.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{slide.body}</p>

          {/* Question / Inputs for Step 4 */}
          {idx === 3 && (
            <div className="mt-5 space-y-4 animate-in fade-in duration-300">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                Will you use EcoLens everyday for the same route?
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setUseEveryday(false);
                    setSelectedDest(null);
                    setDestination("");
                  }}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-2xl border text-center font-semibold text-xs transition-all active:scale-[0.98]",
                    useEveryday === false
                      ? "border-eco-orange bg-eco-orange/10 text-eco-orange"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setUseEveryday(true)}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-2xl border text-center font-semibold text-xs transition-all active:scale-[0.98]",
                    useEveryday === true
                      ? "border-eco-orange bg-eco-orange/10 text-eco-orange"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  Yes
                </button>
              </div>

              {/* Destination Search Box */}
              {useEveryday === true && (
                <div className="space-y-2 pt-2 animate-in slide-in-from-top-3 duration-250">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Where is your commute destination?
                  </div>
                  <div className="relative flex items-center gap-3 rounded-2xl border border-border bg-input px-4 py-2.5">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => {
                        setDestination(e.target.value);
                        setSelectedDest(null);
                      }}
                      placeholder="Search and select place..."
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                    {destination && (
                      <button
                        type="button"
                        onClick={() => {
                          setDestination("");
                          setSelectedDest(null);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Nominatim Search Suggestions */}
                  {suggestions.length > 0 && (
                    <div className="absolute left-7 right-7 z-25 max-h-36 overflow-y-auto rounded-2xl border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur">
                      {suggestions.map((item, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setSelectedDest(item);
                            setDestination(item.name);
                            setSuggestions([]);
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs hover:bg-background text-foreground truncate"
                        >
                          <MapPin className="h-3 w-3 shrink-0 text-eco-orange" />
                          <span className="truncate">{item.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {loading && <div className="text-[10px] text-muted-foreground font-mono pl-1 animate-pulse">Searching OSM registry...</div>}
                  {selectedDest && (
                    <div className="text-[10px] text-eco-green font-mono pl-1">✓ Route locked: {selectedDest.name}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Indicator & Action Button */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === idx ? "w-8 bg-eco-orange" : "w-4 bg-muted",
                  )}
                />
              ))}
            </div>
            <button
              onClick={next}
              disabled={useEveryday === true && !selectedDest}
              className={cn(
                "flex items-center gap-2 rounded-full px-7 py-3.5 font-mono text-sm font-semibold uppercase tracking-wider text-background transition-transform active:scale-95",
                useEveryday === true && !selectedDest
                  ? "bg-muted-foreground/30 text-muted-foreground cursor-not-allowed"
                  : "bg-eco-orange text-background glow-orange"
              )}
            >
              {idx === 3 ? "Finish" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {idx < 3 && (
            <Link
              to="/auth/signin"
              className="mt-5 block text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Already have an account? Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
