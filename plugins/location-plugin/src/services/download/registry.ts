import type { ILocationDownloadStrategy } from './types.js';
import type { LocationSearchConfig } from '../../common/entities/LocationEntity.js';
import { createSharedDownloadService, SharedDownloadService } from '@hierarchidb/runtime-worker';
import { readRuntimeEnvNumber } from '@hierarchidb/util';

export type LocationNetService = SharedDownloadService;

type Factory = (opts?: { dbPrefix?: string; perHostConcurrency?: number }) => Promise<LocationNetService>;

let factory: Factory | null = null;
let defaults: { dbPrefix?: string; perHostConcurrency?: number } = {};
let authNotifier: ((info: { resource: string; provider?: string; hint?: string; status?: number }) => void) | null = null;

export function registerLocationDownloadServiceFactory(f: Factory): void {
  factory = f;
}

export function configureLocationDownloadDefaults(opts: { dbPrefix?: string; perHostConcurrency?: number }): void {
  defaults = { ...defaults, ...opts };
}

export async function getLocationDownloadService(opts?: { dbPrefix?: string; perHostConcurrency?: number }): Promise<LocationNetService> {
  const effectiveOpts = mergeOptions(opts);
  if (factory) return factory(effectiveOpts);
  return createSharedDownloadService(effectiveOpts);
}

export function registerLocationAuthNotifier(fn: (info: { resource: string; provider?: string; hint?: string; status?: number }) => void): void {
  authNotifier = fn;
}

export function notifyLocationAuthRequired(info: { resource: string; provider?: string; hint?: string; status?: number }): void {
  if (authNotifier) {
    authNotifier(info);
    return;
  }
  const globalScope = globalThis as unknown as {
    AuthNotificationRegistry?: {
      getInstance?: () => { onAuthRequired?: (payload: typeof info) => void };
    };
    authNotificationRegistry?: { onAuthRequired?: (payload: typeof info) => void };
    authRegistry?: { onAuthRequired?: (payload: typeof info) => void };
  };
  const registry = globalScope.AuthNotificationRegistry?.getInstance?.()
    ?? globalScope.authNotificationRegistry
    ?? globalScope.authRegistry;
  registry?.onAuthRequired?.(info);
}

type LocationDownloadOptions = { dbPrefix?: string; perHostConcurrency?: number };

function mergeOptions(opts?: LocationDownloadOptions): LocationDownloadOptions | undefined {
  const merged: LocationDownloadOptions = { ...defaults, ...(opts || {}) };
  if (merged.perHostConcurrency == null) {
    const override = readNumericOverride('LOCATION_PER_HOST_CONCURRENCY');
    if (override != null) {
      merged.perHostConcurrency = override;
    }
  }
  if (merged.dbPrefix == null) delete merged.dbPrefix;
  if (merged.perHostConcurrency == null) delete merged.perHostConcurrency;
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function readNumericOverride(name: string): number | undefined {
  try {
    const storageValue = typeof localStorage !== 'undefined' ? localStorage.getItem(name) : null;
    const globalScope = globalThis as Record<string, unknown> | undefined;
    const globalValue = globalScope?.[name];
    const envValue = readRuntimeEnvNumber(name);
    const candidates: Array<unknown> = [storageValue, globalValue, envValue];
    for (const candidate of candidates) {
      if (candidate == null) continue;
      const numeric = typeof candidate === 'number' ? candidate : Number(candidate);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
  } catch {
    // ignore lookup failures (e.g., localStorage not available)
  }
  return undefined;
}

// Simple in-memory strategy registry
const _strategies: ILocationDownloadStrategy[] = [];

export function registerLocationStrategy(strategy: ILocationDownloadStrategy): void {
  if (!_strategies.find((s) => s.id === strategy.id)) {
    _strategies.push(strategy);
  }
}

export function getLocationStrategy(config: LocationSearchConfig): ILocationDownloadStrategy | null {
  for (const s of _strategies) {
    try { if (s.supports(config)) return s; } catch { /* ignore */ }
  }
  return null;
}
