import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowRight, Eye, Route as RouteIcon, Activity } from "lucide-react";
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
];

function OnboardingPage() {
  const { step } = useParams({ from: "/onboarding/$step" });
  const navigate = useNavigate();
  const idx = Math.max(1, Math.min(3, parseInt(step) || 1)) - 1;
  const slide = slides[idx];
  const Icon = slide.icon;

  const next = () => {
    if (idx < 2) navigate({ to: "/onboarding/$step", params: { step: String(idx + 2) } });
    else {
      localStorage.setItem("ecolens:onboarded", "1");
      navigate({ to: "/auth/signup" });
    }
  };
  const skip = () => {
    localStorage.setItem("ecolens:onboarded", "1");
    navigate({ to: "/auth/signup" });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      {/* Visual */}
      <div className="relative flex-1 grid-bg overflow-hidden">
        <button
          onClick={skip}
          className="absolute right-6 top-6 z-10 font-mono text-xs tracking-widest text-muted-foreground hover:text-foreground"
        >
          SKIP
        </button>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-72 w-72">
            {/* Atmospheric gradient */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-eco-orange/30 via-eco-orange/10 to-transparent blur-2xl" />
            <div className="absolute inset-8 rounded-3xl border border-eco-orange/30 bg-card/40 backdrop-blur-sm flex items-center justify-center">
              <Icon className="h-24 w-24 text-eco-orange/80" strokeWidth={1.2} />
            </div>
          </div>
        </div>

        {/* Floating chip */}
        <div className="absolute right-8 top-1/3 flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-eco-red animate-pulse" />
          <span className="font-mono text-[11px] tracking-widest">{slide.tag}</span>
        </div>
      </div>

      {/* Sheet */}
      <div className="rounded-t-3xl border-t border-border bg-card px-7 pb-10 pt-8">
        <h1 className="text-3xl font-bold leading-tight">{slide.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">{slide.body}</p>

        <div className="mt-8 flex items-center justify-between">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
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
            className="flex items-center gap-2 rounded-full bg-eco-orange px-7 py-3.5 font-mono text-sm font-semibold uppercase tracking-wider text-background transition-transform active:scale-95"
          >
            {idx === 2 ? "Get Started" : "Next"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {idx < 2 && (
          <Link
            to="/auth/signin"
            className="mt-4 block text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Already have an account? Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
