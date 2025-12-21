import type { TabularDataApi, TabularProcessingConfig } from '@hierarchidb/ui-tabular';
import { SpreadsheetTabularApiDriver } from '@hierarchidb/spreadsheet-plugin';
import { RouteTabularMetadataManager } from './RouteTabularMetadataManager.js';

const ROUTE_PLUGIN_ID = 'route';

const resolveCorsProxyBase = (): string | undefined => {
  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  const fromVite = viteEnv?.VITE_CORS_PROXY_BASE_URL;
  const fromGlobal = (globalThis as any)?.ENV?.VITE_CORS_PROXY_BASE_URL;
  return fromVite || fromGlobal || undefined;
};

const withCorsProxy = (url: string): string => {
  const base = resolveCorsProxyBase();
  if (!base) return url;
  return `${base}/?url=${encodeURIComponent(url)}`;
};

class RouteTabularApiDriver extends SpreadsheetTabularApiDriver {
  override async downloadTabularFromUrl(url: string, config: TabularProcessingConfig = {}) {
    const proxied = withCorsProxy(url);
    return super.downloadTabularFromUrl(proxied, config);
  }
}

export function createRouteTabularApi(): TabularDataApi {
  const metadataManager = new RouteTabularMetadataManager();
  return new RouteTabularApiDriver(metadataManager, ROUTE_PLUGIN_ID);
}
