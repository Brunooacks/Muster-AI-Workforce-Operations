export type JourneyBottleneckInput = {
  totalRuns: number;
  p95DurationMs: number;
  bottleneckStepId: string | null;
  slaMinutes: number;
};

export function isActionableJourneyBottleneck({
  totalRuns,
  p95DurationMs,
  bottleneckStepId,
  slaMinutes,
}: JourneyBottleneckInput): boolean {
  if (totalRuns === 0 || !bottleneckStepId) return false;
  if (!Number.isFinite(p95DurationMs) || !Number.isFinite(slaMinutes)) return false;
  return p95DurationMs > Math.max(0, slaMinutes) * 60_000;
}
