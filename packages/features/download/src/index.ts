export * from './DownloadService.js';
export * from './adapters/FetchNetworkPort.js';
export * from './authNotifications.js';
export * from './helpers/auth.js';
export * from './helpers/authFetch.js';
export * from './postJson.js';
export { getCorsProxyBaseURL, setCorsProxyBaseURL } from './helpers/resolveNetworkUrl.js';

export type FeatureInitContext = {
  provide?: (cap: string, value: unknown) => void;
};
export class FeatureDefinition {
  static readonly manifest = { name: '@hierarchidb/download', provides: ['download', 'net.port'] };

  static init(ctx?: FeatureInitContext): void {
    // Provide a default network port capability for consumers (worker/UI)
    try {
      const port = new (require('./adapters/FetchNetworkPort').FetchNetworkPort)();
      ctx?.provide?.('net.port', port);
    } catch {
      // ignore if require not available in this bundling mode
    }
  }
}
