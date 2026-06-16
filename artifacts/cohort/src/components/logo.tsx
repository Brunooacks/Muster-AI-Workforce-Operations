import { cn } from "@/lib/utils";

/**
 * Cohort brand symbol — three ascending chevrons ("Camadas Ascendentes").
 * Theme-aware: strokes use CSS tokens so it adapts to light/dark automatically.
 */
export function CohortMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      <g
        fill="none"
        strokeWidth={4.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 47 L32 38 L49 47" stroke="hsl(var(--chart-1))" />
        <path d="M15 37 L32 28 L49 37" stroke="hsl(var(--primary) / 0.65)" />
        <path d="M15 27 L32 18 L49 27" stroke="hsl(var(--primary))" />
      </g>
    </svg>
  );
}
