import type { PeerDataBase } from './types.js';
/**
 * Factory for creating peer-data normalizers that merge plugin specific defaults
 * with the incoming payload, ensuring schemaVersion and metadata are always present.
 */
export declare function createPeerStoreNormalizer<TData extends PeerDataBase>(defaults: () => TData): (input?: Partial<TData> | null) => TData;
//# sourceMappingURL=normalizer.d.ts.map