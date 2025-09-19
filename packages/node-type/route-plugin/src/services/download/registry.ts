import { createRouteDownloadService, type RouteDownloadFactoryOptions, type RouteDownloadService } from './factory.js';

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
  return effectiveFactory(opts);
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
