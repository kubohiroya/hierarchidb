import type { NetworkPortLike } from '../../orchestrator/RouteSourceOrchestrator';
import { createRouteDownloadService } from './factory';

export interface RouteDownloadService {
  service: { download: (url: string, fileId: string) => Promise<any> };
  readAll: (fileId: string) => Promise<ArrayBuffer>;
  net: NetworkPortLike;
}

type Factory = (opts?: { dbPrefix?: string; perHostConcurrency?: number }) => Promise<RouteDownloadService>;

let factory: Factory | null = null;
let authNotifier: ((info: { resource: string; provider?: string; hint?: string; status?: number }) => void) | null = null;

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
export async function getRouteDownloadService(opts?: { dbPrefix?: string; perHostConcurrency?: number }): Promise<RouteDownloadService> {
  const f = factory ?? (async (o?: { dbPrefix?: string; perHostConcurrency?: number }) => createRouteDownloadService(o) as any);
  return f(opts);
}

/**
 * Register an auth-notification callback consumed by the orchestrator.
 */
export function registerRouteAuthNotifier(fn: (info: { resource: string; provider?: string; hint?: string; status?: number }) => void): void {
  authNotifier = fn;
}

/**
 * Notify registered callbacks (with a global fallback used in older UIs).
 */
export function notifyAuthRequired(info: { resource: string; provider?: string; hint?: string; status?: number }): void {
  if (authNotifier) {
    authNotifier(info); return;
  }
  const g: any = globalThis as any;
  const reg = g?.AuthNotificationRegistry?.getInstance?.() || g?.authNotificationRegistry || g?.authRegistry;
  reg?.onAuthRequired?.(info);
}
