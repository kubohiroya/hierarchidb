import type { ILocationDownloadStrategy } from './types.js';
import type { LocationSearchConfig } from '../../common/entities/LocationEntity.js';
import {
  type DownloadServiceBundle,
  type DownloadServiceOptions,
  configurePluginDownloadDefaults,
  getPluginDownloadService,
  notifyPluginAuthRequired,
  registerPluginAuthNotifier,
  registerPluginDownloadServiceFactory,
} from '@hierarchidb/download';

export type LocationDownloadService = DownloadServiceBundle;

type LocationDownloadOptions = Pick<DownloadServiceOptions, 'dbPrefix' | 'perHostConcurrency' | 'corsProxyBaseURL'>;

type Factory = (opts?: LocationDownloadOptions) => Promise<LocationDownloadService>;

const LOCATION_PLUGIN_ID = 'location';
const DEFAULT_OPTIONS: LocationDownloadOptions = { perHostConcurrency: 4 };

configurePluginDownloadDefaults(LOCATION_PLUGIN_ID, DEFAULT_OPTIONS);

export function registerLocationDownloadServiceFactory(f: Factory): void {
  registerPluginDownloadServiceFactory(LOCATION_PLUGIN_ID, f);
}

export function configureLocationDownloadDefaults(opts: LocationDownloadOptions): void {
  configurePluginDownloadDefaults(LOCATION_PLUGIN_ID, { ...DEFAULT_OPTIONS, ...opts });
}

export async function getLocationDownloadService(opts?: LocationDownloadOptions): Promise<LocationDownloadService> {
  return getPluginDownloadService(LOCATION_PLUGIN_ID, opts);
}

export function registerLocationAuthNotifier(fn: (info: { resource: string; provider?: string; hint?: string; status?: number }) => void): void {
  registerPluginAuthNotifier(LOCATION_PLUGIN_ID, fn);
}

export function notifyLocationAuthRequired(info: { resource: string; provider?: string; hint?: string; status?: number }): void {
  notifyPluginAuthRequired(LOCATION_PLUGIN_ID, info);
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
