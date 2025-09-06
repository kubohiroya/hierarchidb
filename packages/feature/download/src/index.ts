export * from './DownloadService';
export * from './ports';
export * from './capability';
export * from './cas/ContentAddressableStore';
export * from './adapters/CacheAPICachePort';
export * from './adapters/NobleSha3HashPort';
export * from './adapters/DexieContentIndexPort';
export * from './adapters/DexieChunkStoragePort';
export * from './adapters/FetchNetworkPort';
export * from './helpers/auth';
export const featureDefinition = {
  manifest: { name: '@hierarchidb/download', provides: ['download', 'cas', 'net.port'] },
  init(ctx?: { provide?: (cap: string, value: any) => void }) {
    // Provide a default network port capability for consumers (worker/UI)
    try {
      const port = new (require('./adapters/FetchNetworkPort').FetchNetworkPort)();
      ctx?.provide?.('net.port', port);
    } catch {
      // ignore if require not available in this bundling mode
    }
  },
};
