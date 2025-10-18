export * from './DownloadService.js';
export * from './ports.js';
export * from './capability.js';
export * from './cas/ContentAddressableStore.js';
export * from './adapters/CacheAPICachePort.js';
export * from './adapters/NobleSha3HashPort.js';
export * from './adapters/DexieContentIndexPort.js';
export * from './adapters/DexieChunkStoragePort.js';
export * from './adapters/FetchNetworkPort.js';
export * from './helpers/auth.js';
export * from './createDownloadService.js';
export class FeatureDefinition {
  static readonly manifest = { name: '@hierarchidb/download', provides: ['download', 'cas', 'net.port'] };

  static init(ctx?: { provide?: (cap: string, value: any) => void }): void {
    // Provide a default network port capability for consumers (worker/UI)
    try {
      const port = new (require('./adapters/FetchNetworkPort').FetchNetworkPort)();
      ctx?.provide?.('net.port', port);
    } catch {
      // ignore if require not available in this bundling mode
    }
  }
}
