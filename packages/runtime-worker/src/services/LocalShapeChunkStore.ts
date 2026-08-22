import {
  type ChunkStoreDeserializer,
  type ChunkStoreEntry,
  type ChunkStoreFetchOptions,
  type ChunkStoreSerializer,
  DexieChunkStore,
} from '@hierarchidb/chunk-store';
import type { NodeId } from '@hierarchidb/core-types';
import type { NetworkPort } from '@hierarchidb/download';

export const LOCAL_SHAPE_CHUNK_STORE_NETWORK_ACCESS_FORBIDDEN =
  'LOCAL_SHAPE_CHUNK_STORE_NETWORK_ACCESS_FORBIDDEN';

export class LocalShapeChunkStoreNetworkAccessError extends Error {
  readonly code = LOCAL_SHAPE_CHUNK_STORE_NETWORK_ACCESS_FORBIDDEN;

  constructor(operation: string) {
    super(
      `[runtime-worker][shape-chunk-store] network access is forbidden for local-only store: ${operation}`
    );
    this.name = 'LocalShapeChunkStoreNetworkAccessError';
  }
}

const rejectNetworkAccess = (operation: string): Promise<never> =>
  Promise.reject(new LocalShapeChunkStoreNetworkAccessError(operation));

const localOnlyNetworkPort: NetworkPort = {
  head: () => rejectNetworkAccess('head'),
  get: () => rejectNetworkAccess('get'),
  getRange: () => rejectNetworkAccess('getRange'),
};

export class LocalShapeChunkStore extends DexieChunkStore<ArrayBuffer> {
  constructor(options: {
    databaseName: string;
    serializer: ChunkStoreSerializer<ArrayBuffer>;
    deserializer: ChunkStoreDeserializer<ArrayBuffer>;
  }) {
    super({
      dbName: options.databaseName,
      serializer: options.serializer,
      deserializer: options.deserializer,
      networkPort: localOnlyNetworkPort,
    });
  }

  override getOrFetchForNode(
    _nodeId: NodeId,
    _url: string,
    _options: ChunkStoreFetchOptions = {}
  ): Promise<ChunkStoreEntry<ArrayBuffer>> {
    return rejectNetworkAccess('getOrFetchForNode');
  }
}
