export interface LaneLimits {
  [lane: string]: number;
}

export interface LaneRegistryOptions {
  defaults: LaneLimits;
  envKey?: string;
  fallback?: number;
}

interface ParsedLaneLimits {
  limits: LaneLimits;
  disabled: boolean;
}

class Semaphore {
  private readonly queue: Array<() => void> = [];
  private permits: number;

  constructor(private readonly capacity: number) {
    this.permits = capacity;
  }

  async acquire(): Promise<void> {
    if (this.capacity <= 0) return;
    if (this.permits > 0) {
      this.permits -= 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.capacity <= 0) return;
    const next = this.queue.shift();
    if (next) {
      next();
      return;
    }
    this.permits = Math.min(this.permits + 1, this.capacity);
  }
}

export class LaneSemaphoreRegistry {
  private readonly semaphores = new Map<string, Semaphore>();
  private readonly limits: LaneLimits;
  private readonly disabled: boolean;
  private readonly fallback: number;

  constructor(limits: LaneLimits, disabled: boolean, fallback: number) {
    this.limits = limits;
    this.disabled = disabled;
    this.fallback = Math.max(1, Math.floor(fallback));
  }

  static create(options: LaneRegistryOptions): LaneSemaphoreRegistry {
    const fallback = options.fallback && options.fallback > 0 ? Math.floor(options.fallback) : 1;
    const parsed = parseLaneLimits(options.defaults);
    return new LaneSemaphoreRegistry(parsed.limits, parsed.disabled, fallback);
  }

  static fromEnv(options: LaneRegistryOptions): LaneSemaphoreRegistry {
    const key = options.envKey ?? 'HIERARCHIDB_LANE_LIMITS';
    const parsed = readLaneLimitsFromEnv(key, options.defaults);
    const fallback = options.fallback && options.fallback > 0 ? Math.floor(options.fallback) : 1;
    return new LaneSemaphoreRegistry(parsed.limits, parsed.disabled, fallback);
  }

  async runWithLane<T>(lane: string, task: () => Promise<T>): Promise<T> {
    if (this.disabled) return task();
    const semaphore = this.getSemaphore(lane);
    await semaphore.acquire();
    try {
      return await task();
    } finally {
      semaphore.release();
    }
  }

  recommendConcurrency(lanes?: Iterable<string>, fallbackConcurrency?: number): number {
    if (this.disabled) {
      const fallback = fallbackConcurrency ?? this.fallback;
      return Math.max(1, Math.floor(fallback > 0 ? fallback : 1));
    }
    const laneSet = lanes ? new Set(Array.from(lanes, normalizeLane)) : new Set(Object.keys(this.limits));
    if (laneSet.size === 0) laneSet.add('default');
    let total = 0;
    for (const lane of laneSet) {
      total += this.resolveCapacity(lane);
    }
    return Math.max(1, Math.floor(total));
  }

  getLaneCapacity(lane: string): number {
    return this.resolveCapacity(normalizeLane(lane));
  }

  isDisabled(): boolean {
    return this.disabled;
  }

  private getSemaphore(rawLane: string): Semaphore {
    const lane = normalizeLane(rawLane);
    let sem = this.semaphores.get(lane);
    if (!sem) {
      sem = new Semaphore(this.resolveCapacity(lane));
      this.semaphores.set(lane, sem);
    }
    return sem;
  }

  private resolveCapacity(lane: string): number {
    return this.limits[lane] ?? this.fallback;
  }
}

export function createLaneSemaphoreRegistry(options: LaneRegistryOptions): LaneSemaphoreRegistry {
  return LaneSemaphoreRegistry.create(options);
}

function readLaneLimitsFromEnv(key: string, defaults: LaneLimits): ParsedLaneLimits {
  let text: string | undefined;

  try {
    const meta = import.meta;
    const hasEnv = meta && typeof meta === 'object' && 'env' in meta;
    const envRecord = hasEnv ? (meta as { env?: Record<string, unknown> }).env : undefined;
    const candidate = envRecord?.[key];
    if (typeof candidate === 'string') text = candidate;
  } catch {
    // ignore
  }

  if (text === undefined) {
    try {
      const globalObj = globalThis as Record<string, unknown> & {
        process?: { env?: Record<string, unknown> };
      };
      const candidate = globalObj?.[key] ?? globalObj.process?.env?.[key];
      if (typeof candidate === 'string') text = candidate;
    } catch {
      // ignore
    }
  }

  if (!text) {
    return { limits: { ...defaults }, disabled: false };
  }

  const disabled = /^disable/i.test(text.trim());
  const trimmed = text.replace(/^disable[:,]?\s*/i, '');
  const limits: LaneLimits = { ...defaults };
  for (const chunk of trimmed.split(/[,;\s]+/)) {
    if (!chunk) continue;
    const [lane, value] = chunk.split('=');
    const numeric = Number(value);
    if (!lane || !Number.isFinite(numeric)) continue;
    limits[normalizeLane(lane)] = Math.max(0, Math.floor(numeric));
  }
  return { limits, disabled };
}

function parseLaneLimits(defaults: LaneLimits): ParsedLaneLimits {
  const limits: LaneLimits = {};
  for (const [lane, value] of Object.entries(defaults ?? {})) {
    const numeric = Number(value);
    if (!lane || !Number.isFinite(numeric) || numeric <= 0) continue;
    limits[normalizeLane(lane)] = Math.floor(numeric);
  }
  return { limits, disabled: false };
}

function normalizeLane(lane: string): string {
  return lane.trim().toLowerCase();
}
