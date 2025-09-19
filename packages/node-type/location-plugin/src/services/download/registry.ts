import {
  createSharedDownloadService,
  type SharedDownloadService,
} from '@hierarchidb/runtime-shared-batch-processor';
import type { ILocationDownloadStrategy } from './types.js';
import type { LocationSearchConfig } from '../../entities/LocationEntity.js';

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
  if (factory) return factory({ ...defaults, ...opts });
  return createSharedDownloadService({ ...defaults, ...opts });
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
