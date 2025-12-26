import {
  configurePluginDownloadDefaults,
  getPluginDownloadService,
  notifyPluginAuthRequired,
  registerPluginAuthNotifier,
  registerPluginDownloadServiceFactory,
} from '@hierarchidb/download';
import { type RouteDownloadFactoryOptions, type RouteDownloadService } from './factory.js';

type Factory = (opts?: RouteDownloadFactoryOptions) => Promise<RouteDownloadService>;

const ROUTE_PLUGIN_ID = 'route';
const DEFAULT_OPTIONS: RouteDownloadFactoryOptions = { perHostConcurrency: 4 };

configurePluginDownloadDefaults(ROUTE_PLUGIN_ID, DEFAULT_OPTIONS);

/**
 * Allow host app to inject a shared download service (auth headers, CAS, concurrency).
 */
export function registerRouteDownloadServiceFactory(f: Factory): void {
  registerPluginDownloadServiceFactory(ROUTE_PLUGIN_ID, f);
}

export function configureRouteDownloadDefaults(opts: RouteDownloadFactoryOptions): void {
  configurePluginDownloadDefaults(ROUTE_PLUGIN_ID, { ...DEFAULT_OPTIONS, ...opts });
}

/**
 * Resolve the route download service.
 */
export async function getRouteDownloadService(opts?: RouteDownloadFactoryOptions): Promise<RouteDownloadService> {
  return getPluginDownloadService(ROUTE_PLUGIN_ID, opts);
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
  registerPluginAuthNotifier(ROUTE_PLUGIN_ID, fn);
}

/**
 * Notify registered callbacks (with a global fallback used in older UIs).
 */
export function notifyAuthRequired(info: RouteAuthNotification): void {
  notifyPluginAuthRequired(ROUTE_PLUGIN_ID, info);
}
