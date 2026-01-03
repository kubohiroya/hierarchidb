import type { TabularDataApi, TabularProcessingConfig } from '@hierarchidb/ui-tabular';
import type { SimpleTableMetadataManager } from '@hierarchidb/tabular-store';
import { SpreadsheetTabularApiDriver } from './SpreadsheetTabularApiDriver.js';
import { SPREADSHEET_PLUGIN_ID } from '../common/constants.js';

export function createSpreadsheetTabularApi(pluginId: string = SPREADSHEET_PLUGIN_ID): TabularDataApi {
  return new SpreadsheetTabularApiDriver(pluginId);
}

export type PluginTabularApiOptions = {
  pluginId: string;
  metadataManager: SimpleTableMetadataManager;
  corsProxyBaseURL?: string;
  resolveCorsProxyBaseURL?: () => string | undefined;
  enableCorsProxy?: boolean;
};

const resolveCorsProxyBaseDefault = (): string | undefined => {
  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env;
  const fromVite = viteEnv?.VITE_CORS_PROXY_BASE_URL;
  const fromGlobal = (globalThis as { ENV?: { VITE_CORS_PROXY_BASE_URL?: string } }).ENV?.VITE_CORS_PROXY_BASE_URL;
  return fromVite || fromGlobal || undefined;
};

const buildCorsProxyResolver = (options: PluginTabularApiOptions): (() => string | undefined) => {
  if (options.corsProxyBaseURL) {
    return () => options.corsProxyBaseURL;
  }
  if (options.enableCorsProxy || options.resolveCorsProxyBaseURL) {
    return options.resolveCorsProxyBaseURL ?? resolveCorsProxyBaseDefault;
  }
  return () => undefined;
};

const withCorsProxy = (url: string, base?: string): string => {
  if (!base) return url;
  return `${base}/?url=${encodeURIComponent(url)}`;
};

class PluginTabularApiDriver extends SpreadsheetTabularApiDriver {
  private readonly resolveCorsProxyBaseURL: () => string | undefined;

  constructor(options: PluginTabularApiOptions) {
    super(options.metadataManager, options.pluginId);
    this.resolveCorsProxyBaseURL = buildCorsProxyResolver(options);
  }

  override async downloadTabularFromUrl(url: string, config: TabularProcessingConfig = {}, nodeId?: string) {
    const proxied = withCorsProxy(url, this.resolveCorsProxyBaseURL());
    return super.downloadTabularFromUrl(proxied, config, nodeId);
  }
}

export function createPluginTabularApi(options: PluginTabularApiOptions): TabularDataApi {
  return new PluginTabularApiDriver(options);
}
