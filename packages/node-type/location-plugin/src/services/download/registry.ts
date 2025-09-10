import { createSharedDownloadService } from '@hierarchidb/runtime-shared-batch-processor';

export interface LocationNetService {
  net: { get: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }> };
  service: { download?: (url: string, fileId: string) => Promise<any> };
}

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
  const svc = await createSharedDownloadService({ ...defaults, ...opts });
  return svc as any;
}

export function registerLocationAuthNotifier(fn: (info: { resource: string; provider?: string; hint?: string; status?: number }) => void): void {
  authNotifier = fn;
}

export function notifyLocationAuthRequired(info: { resource: string; provider?: string; hint?: string; status?: number }): void {
  if (authNotifier) {
    try { authNotifier(info); return; } catch {}
  }
  try {
    const g: any = globalThis as any;
    const reg = g?.AuthNotificationRegistry?.getInstance?.() || g?.authNotificationRegistry || g?.authRegistry;
    reg?.onAuthRequired?.(info);
  } catch {}
}

