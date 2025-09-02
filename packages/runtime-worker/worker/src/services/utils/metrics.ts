type Counter = {
  count: number;
  errorCount: number;
  totalMs: number;
};

export class CommandMetrics {
  private byKind = new Map<string, Counter>();

  record(kind: string, durationMs: number, success: boolean) {
    const c = this.byKind.get(kind) ?? { count: 0, errorCount: 0, totalMs: 0 };
    c.count += 1;
    if (!success) c.errorCount += 1;
    c.totalMs += durationMs;
    this.byKind.set(kind, c);
  }

  snapshot(): Record<string, Counter> {
    const out: Record<string, Counter> = {};
    for (const [k, v] of this.byKind.entries()) out[k] = { ...v };
    return out;
  }

  reset() {
    this.byKind.clear();
  }
}

export const commandMetrics = new CommandMetrics();

export function recordCommandLatency(kind: string, durationMs: number, success: boolean = true) {
  commandMetrics.record(kind, durationMs, success);
}
