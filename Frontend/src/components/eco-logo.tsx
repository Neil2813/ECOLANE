import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

export function EcoLogo({ className, size = 40 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full border border-eco-orange/60 bg-eco-orange/10",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Leaf className="text-eco-orange" style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
}
