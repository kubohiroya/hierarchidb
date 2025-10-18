import { createRouteDownloadService, type RouteDownloadFactoryOptions, type RouteDownloadService } from './factory.js';
import { readRuntimeEnvNumber } from '@hierarchidb/util';

type Factory = (opts?: RouteDownloadFactoryOptions) => Promise<RouteDownloadService>;

let factory: Factory | null = null;
let authNotifier: RouteAuthNotifier | null = null;

/**
 * Allow host app to inject a shared download service (auth headers, CAS, concurrency),
 * mirroring shape/location plugin behavior.
 */
export function registerRouteDownloadServiceFactory(f: Factory): void {
  factory = f;
}

/**
 * Resolve the route download service. Falls back to the built-in factory.
 */
export async function getRouteDownloadService(opts?: RouteDownloadFactoryOptions): Promise<RouteDownloadService> {
  const effectiveFactory = factory ?? createRouteDownloadService;
  return effectiveFactory(mergeOptions(opts));
}

/**
 * Register an auth-notification callback consumed by the orchestrator.
 */
export type RouteAuthNotification = {
  resource: string;
  provider?: string;
  hint?: string;
  status?: number;
};

export type RouteAuthNotifier = (info: RouteAuthNotification) => void;

export function registerRouteAuthNotifier(fn: RouteAuthNotifier): void {
  authNotifier = fn;
}

/**
 * Notify registered callbacks (with a global fallback used in older UIs).
 */
export function notifyAuthRequired(info: RouteAuthNotification): void {
  if (authNotifier) {
    authNotifier(info); return;
  }
  const registry = resolveAuthRegistry();
  registry?.onAuthRequired?.(info);
}

export interface AuthNotificationRegistry {
  onAuthRequired?(payload: AuthNotificationPayload): void;
  getInstance?(): unknown;
}

export interface AuthNotificationPayload {
  resource: string;
  provider?: string;
  hint?: string;
  status?: number;
}

export function resolveAuthRegistry(): AuthNotificationRegistry | undefined {
  const globalRecord = globalThis as Record<string, unknown>;
  const candidates: unknown[] = [
    globalRecord.AuthNotificationRegistry,
    globalRecord.authNotificationRegistry,
    globalRecord.authRegistry,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (isAuthRegistry(candidate)) return candidate;
    if (typeof candidate === 'object' && candidate !== null) {
      const factoryCandidate = candidate as { getInstance?: () => unknown };
      if (typeof factoryCandidate.getInstance === 'function') {
        const instance = factoryCandidate.getInstance();
        if (isAuthRegistry(instance)) return instance;
      }
    }
  }
  return undefined;
}

function isAuthRegistry(value: unknown): value is AuthNotificationRegistry {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.onAuthRequired === 'function';
}

function mergeOptions(opts?: RouteDownloadFactoryOptions): RouteDownloadFactoryOptions | undefined {
  const merged: RouteDownloadFactoryOptions = { ...(opts || {}) };
  if (merged.perHostConcurrency == null) {
    const override = readNumericOverride('ROUTE_PER_HOST_CONCURRENCY');
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
