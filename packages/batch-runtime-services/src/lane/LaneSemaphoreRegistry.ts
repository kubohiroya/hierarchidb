type LaneName = string;

export interface LaneLimits {
  [lane: string]: number;
}


interface ParsedLaneLimits {
  limits: LaneLimits;
  disabled: boolean;
}

function parseLaneLimits(defaults: LaneLimits): ParsedLaneLimits {
  const limits: LaneLimits = {};
  for (const [lane, value] of Object.entries(defaults ?? {})) {
    const normalizedLane = lane?.toLowerCase?.();
    const numeric = Number(value);
    if (!normalizedLane) continue;
    if (!Number.isFinite(numeric) || numeric <= 0) continue;
    limits[normalizedLane] = Math.floor(numeric);
  }

  return { limits, disabled: false };

}

export function createLaneSemaphoreRegistry(options: LaneRegistryOptions): LaneSemaphoreRegistry {
  const fallback = options.fallback && options.fallback > 0 ? Math.floor(options.fallback) : 4;
  const parsed = parseLaneLimits(options.defaults);
  return new LaneSemaphoreRegistry(parsed.limits, parsed.disabled, fallback);
}

export interface LaneRegistryOptions {
  /** Default capacities per lane. */
  defaults: LaneLimits;
  /** Environment variable used to override capacities / disable lanes. */
  envKey?: string;
  /** Capacity applied when an unknown lane is requested. */
  fallback?: number;
}

class Semaphore {
  private queue: Array<() => void> = [];
  private permits: number;

  constructor(private readonly capacity: number) {
    this.permits = capacity;
  }

  acquire(): Promise<void> {
    if (this.capacity <= 0) {
      return Promise.resolve();
    }
    if (this.permits > 0) {
      this.permits -= 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.capacity <= 0) {
      return;
    }
    const next = this.queue.shift();
    if (next) {
      next();
      return;
    }
    this.permits = Math.min(this.permits + 1, this.capacity);
  }
}

export class LaneSemaphoreRegistry {
  private readonly semaphores = new Map<LaneName, Semaphore>();
  private readonly limits: LaneLimits;
  private readonly disabled: boolean;
  private readonly fallback: number;

  constructor(limits: LaneLimits, disabled: boolean, fallback: number) {
    this.limits = limits;
    this.disabled = disabled;
    this.fallback = fallback;
  }

  async runWithLane<T>(lane: LaneName, task: () => Promise<T>): Promise<T> {
    if (this.disabled) {
      return task();
    }
    const normalizedLane = this.normalizeLane(lane);
    const semaphore = this.getSemaphore(normalizedLane);
    await semaphore.acquire();
    try {
      return await task();
    } finally {
      semaphore.release();
    }
  }

  isDisabled(): boolean {
    return this.disabled;
  }

  getLaneCapacity(lane: LaneName): number {
    return this.resolveCapacity(this.normalizeLane(lane));
  }

  recommendConcurrency(lanes?: Iterable<LaneName>, fallbackConcurrency?: number): number {
    if (this.disabled) {
      const base = fallbackConcurrency ?? this.fallback;
      return Math.max(1, Math.floor(base > 0 && Number.isFinite(base) ? base : 1));
    }
    const laneSet = lanes ? new Set(Array.from(lanes, (lane) => this.normalizeLane(lane))) : new Set(Object.keys(this.limits));
    if (laneSet.size === 0) {
      laneSet.add('default');
    }
    let total = 0;
    for (const lane of laneSet) {
      total += this.resolveCapacity(lane);
    }
    return Math.max(1, Math.floor(total));
  }

  private getSemaphore(lane: LaneName): Semaphore {
    let sem = this.semaphores.get(lane);
    if (!sem) {
      const capacity = this.resolveCapacity(lane);
      sem = new Semaphore(capacity);
      this.semaphores.set(lane, sem);
    }
    return sem;
  }

  private resolveCapacity(lane: LaneName): number {
    return this.limits[lane] ?? this.fallback;
  }

  private normalizeLane(lane: LaneName): LaneName {
    return lane.toLowerCase().trim();
  }

  static fromEnv(options: LaneRegistryOptions): LaneSemaphoreRegistry {
    const envKey = options.envKey ?? 'HIERARCHIDB_LANE_LIMITS';
    const { limits, disabled } = this.readEnv(envKey, options.defaults);
    const fallback = options.fallback ?? 1;
    return new LaneSemaphoreRegistry(limits, disabled, fallback);
  }

  /**
   * Read lane limits from environment (browser-friendly: import.meta.env + global).
   * Format: "download=4,geocode=2,overpass=1"; prefixing with 'disable' disables the registry.
   */
  static readEnv(envKey: string, defaults: LaneLimits): ParsedLaneLimits {
    let text: string | undefined;

    try {
      // Vite/webpack define import.meta.env
      const im = import.meta as unknown as { env?: Record<string, unknown> } & Record<
        string,
        unknown
      >;
      const fromImportMeta = im?.env?.[envKey] ?? im?.[envKey];
      if (typeof fromImportMeta === 'string') text = fromImportMeta;
    } catch {
      console.log('Failed to read lane limits from import.meta.env');
    }

    if (text === undefined) {
      try {
        const g = globalThis as Record<string, unknown> & {
          process?: { env?: Record<string, unknown> };
        };
        const fromGlobal = g?.[envKey] ?? g.process?.env?.[envKey];
        if (typeof fromGlobal === 'string') text = fromGlobal;
      } catch {
        console.log('Failed to read lane limits from global');
      }
    }

    if (!text || typeof text !== 'string') {
      return { limits: { ...defaults }, disabled: false };
    }

    const disabled = /^disable/i.test(text.trim());
    const trimmed = text.replace(/^disable[:,]?\s*/i, '');
    const limits: LaneLimits = { ...defaults };

    for (const part of trimmed.split(/[,;\s]+/)) {
      if (!part) continue;
      const [name, value] = part.split('=');
      const v = Number(value);
      if (!name || !Number.isFinite(v)) continue;
      limits[name.trim().toLowerCase()] = Math.max(0, Math.floor(v));
    }

    return { limits, disabled };
  }
}
