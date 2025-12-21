import type { TabularDataApi, TabularProcessingConfig } from '@hierarchidb/ui-tabular';
import { SpreadsheetTabularApiDriver } from '@hierarchidb/spreadsheet-plugin';
import { LocationTabularMetadataManager } from './LocationTabularMetadataManager.js';

const LOCATION_PLUGIN_ID = 'location';

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

class LocationTabularApiDriver extends SpreadsheetTabularApiDriver {
  override async downloadTabularFromUrl(url: string, config: TabularProcessingConfig = {}) {
    const proxied = withCorsProxy(url);
    return super.downloadTabularFromUrl(proxied, config);
  }
}

export function createLocationTabularApi(): TabularDataApi {
  const metadataManager = new LocationTabularMetadataManager();
  return new LocationTabularApiDriver(metadataManager, LOCATION_PLUGIN_ID);
}
