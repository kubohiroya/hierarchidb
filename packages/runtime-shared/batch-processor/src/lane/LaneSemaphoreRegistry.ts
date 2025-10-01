type LaneName = string;

export interface LaneLimits {
  [lane: string]: number;
}

export interface LaneRegistryOptions {
  /** Default capacities per lane. */
  defaults: LaneLimits;
  /** Environment variable used to override capacities / disable lanes. */
  envKey?: string;
  /** Capacity applied when an unknown lane is requested. */
  fallback?: number;
}

interface ParsedLaneLimits {
  limits: LaneLimits;
  disabled: boolean;
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

  private normalizeLane(lane: LaneName): LaneName {
    return lane?.toLowerCase?.() ?? 'default';
  }

  private resolveCapacity(lane: LaneName): number {
    const capacity = this.limits[lane];
    if (typeof capacity === 'number' && capacity > 0 && Number.isFinite(capacity)) {
      return Math.floor(capacity);
    }
    return this.fallback;
  }
}

export function createLaneSemaphoreRegistry(options: LaneRegistryOptions): LaneSemaphoreRegistry {
  const fallback = options.fallback && options.fallback > 0 ? Math.floor(options.fallback) : 4;
  const parsed = parseLaneLimits(options.defaults, options.envKey);
  return new LaneSemaphoreRegistry(parsed.limits, parsed.disabled, fallback);
}

function parseLaneLimits(defaults: LaneLimits, envKey?: string): ParsedLaneLimits {
  const limits: LaneLimits = {};
  for (const [lane, value] of Object.entries(defaults ?? {})) {
    const normalizedLane = lane?.toLowerCase?.();
    const numeric = Number(value);
    if (!normalizedLane) continue;
    if (!Number.isFinite(numeric) || numeric <= 0) continue;
    limits[normalizedLane] = Math.floor(numeric);
  }
  if (!envKey) {
    return { limits, disabled: false };
  }

  const raw = readEnv(envKey);
  if (!raw) {
    return { limits, disabled: false };
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === '0' || normalized === 'off' || normalized === 'false' || normalized === 'disabled') {
    return { limits, disabled: true };
  }

  const pairs = raw.split(',');
  for (const pair of pairs) {
    const [lane, value] = pair.split('=').map((s) => s.trim());
    if (!lane || !value) continue;
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) continue;
    limits[lane.toLowerCase()] = Math.floor(parsedValue);
  }

  return { limits, disabled: false };
}

function readEnv(key: string): string | undefined {
  if (!key) {
    return undefined;
  }

  const meta = readFromImportMeta(key);
  if (meta !== undefined) {
    return meta;
  }

  const globalEnv = readFromGlobalEnvRecord(key);
  if (globalEnv !== undefined) {
    return globalEnv;
  }

  const direct = readFromGlobalProperty(key);
  if (direct !== undefined) {
    return direct;
  }

  return undefined;
}

function readFromImportMeta(key: string): string | undefined {
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, unknown> };
    const value = meta?.env?.[key];
    return value != null ? String(value) : undefined;
  } catch {
    return undefined;
  }
}

function readFromGlobalEnvRecord(key: string): string | undefined {
  const globalBag = globalThis as {
    __HIERARCHIDB_ENV__?: Record<string, unknown>;
    __HIERARCHI_ENV__?: Record<string, unknown>;
  };

  const candidates = [globalBag.__HIERARCHIDB_ENV__, globalBag.__HIERARCHI_ENV__];
  for (const record of candidates) {
    const value = record?.[key];
    if (value != null) {
      return String(value);
    }
  }

  return undefined;
}

function readFromGlobalProperty(key: string): string | undefined {
  if (!(key in globalThis)) {
    return undefined;
  }
  const value = (globalThis as Record<string, unknown>)[key];
  return value != null ? String(value) : undefined;
}
