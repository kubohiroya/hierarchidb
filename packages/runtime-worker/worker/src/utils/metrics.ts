import { FEATURE_FLAGS } from '../config/feature-flags';

type Stats = {
  count: number;
  totalMs: number;
  maxMs: number;
};

const byCommand: Map<string, Stats> = new Map();

export function recordCommandLatency(kind: string, ms: number): void {
  if (!FEATURE_FLAGS.WORKER_METRICS_ENABLED) return;
  const s = byCommand.get(kind) || { count: 0, totalMs: 0, maxMs: 0 };
  s.count += 1;
  s.totalMs += ms;
  if (ms > s.maxMs) s.maxMs = ms;
  byCommand.set(kind, s);
}

export function getCommandLatencySnapshot(): Record<string, { count: number; avgMs: number; maxMs: number }> {
  const out: Record<string, { count: number; avgMs: number; maxMs: number }> = {};
  for (const [k, v] of byCommand.entries()) {
    out[k] = { count: v.count, avgMs: v.count > 0 ? v.totalMs / v.count : 0, maxMs: v.maxMs };
  }
  return out;
}

