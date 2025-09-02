export * from './DownloadService';
export * from './ports';
export * from './capability';
export * from './cas/ContentAddressableStore';
export * from './adapters/CacheAPICachePort';
export * from './adapters/NobleSha3HashPort';
export * from './adapters/DexieContentIndexPort';
export * from './adapters/DexieChunkStoragePort';
export * from './adapters/FetchNetworkPort';
export const featureDefinition = {
  manifest: { name: '@hierarchidb/download', provides: ['download', 'cas'] },
  init() {},
};
