import type { PeerDataBase } from '@hierarchidb/plugin-service-api';

/**
 * Factory for creating peer-data normalizers that merge plugin specific defaults
 * with the incoming payload, ensuring schemaVersion and metadata are always present.
 */
export function createPeerStoreNormalizer<TData extends PeerDataBase>(
  defaults: () => TData,
): (input?: Partial<TData> | null) => TData {
  return (input) => {
    const base = defaults();
    return {
      ...base,
      ...(input ?? {}),
      metadata: {
        ...(base.metadata ?? {}),
        ...(input?.metadata ?? {}),
      },
    };
  };
}
