import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { EcoLogo } from "@/components/eco-logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EcoLens — See the air you breathe" },
      { name: "description", content: "EcoLens reveals air quality, heat, and carbon for every street in real time." },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => {
      const seen = localStorage.getItem("ecolens:onboarded");
      const auth = localStorage.getItem("ecolens:auth");
      if (auth) navigate({ to: "/map" });
      else if (seen) navigate({ to: "/auth/signin" });
      else navigate({ to: "/onboarding/1" });
    }, 1600);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center overflow-hidden bg-background px-8">
      <div className="absolute inset-x-0 bottom-0 h-1 bg-eco-orange/40">
        <div className="h-full origin-left animate-[grow_1.5s_ease-out_forwards] bg-eco-orange" />
      </div>
      <div className="absolute bottom-6 right-6 font-mono text-xs text-muted-foreground/70">
        SYS.INIT v2.4.1
      </div>

      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-700">
        <div className="relative">
          <EcoLogo size={120} className="glow-orange" />
        </div>
        <h1 className="font-mono text-4xl font-bold tracking-tight text-eco-cream">EcoLens</h1>
        <p className="max-w-xs text-center text-sm leading-relaxed text-muted-foreground">
          The city has always been talking.
          <br />
          You just couldn&apos;t hear it.
        </p>
      </div>

      <style>{`@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
    </div>
  );
}
