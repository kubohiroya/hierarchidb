import type { ILocationDownloadStrategy } from './types.js';
import type { LocationSearchConfig } from '../../common/entities/LocationEntity.js';
import { createDownloadService, type DownloadServiceBundle, type DownloadServiceOptions } from '@hierarchidb/download';

export type LocationDownloadService = DownloadServiceBundle;

type LocationDownloadOptions = Pick<DownloadServiceOptions, 'dbPrefix' | 'perHostConcurrency'>;

type Factory = (opts?: LocationDownloadOptions) => Promise<LocationDownloadService>;

let factory: Factory | null = null;
const DEFAULT_OPTIONS: LocationDownloadOptions = { perHostConcurrency: 4 };

let defaults: LocationDownloadOptions = { ...DEFAULT_OPTIONS };
let authNotifier: ((info: { resource: string; provider?: string; hint?: string; status?: number }) => void) | null = null;

export function registerLocationDownloadServiceFactory(f: Factory): void {
  factory = f;
}

export function configureLocationDownloadDefaults(opts: LocationDownloadOptions): void {
  defaults = { ...defaults, ...opts };
}

export async function getLocationDownloadService(opts?: LocationDownloadOptions): Promise<LocationDownloadService> {
  const effectiveOpts = mergeOptions(opts);
  if (factory) return factory(effectiveOpts);
  return createDownloadService(effectiveOpts);
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

function mergeOptions(opts?: LocationDownloadOptions): LocationDownloadOptions | undefined {
  const merged: LocationDownloadOptions = { ...defaults, ...(opts || {}) };
  if (merged.dbPrefix == null) delete merged.dbPrefix;
  if (merged.perHostConcurrency == null) delete merged.perHostConcurrency;
  return Object.keys(merged).length > 0 ? merged : undefined;
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
