import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeDB } from '@hierarchidb/shape-store';
import { Dexie } from 'dexie';
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LOCAL_SHAPE_CHUNK_STORE_NETWORK_ACCESS_FORBIDDEN,
  LocalShapeChunkStore,
  LocalShapeChunkStoreNetworkAccessError,
} from '../../LocalShapeChunkStore.js';
import { ShapeQueryService } from '../../ShapeQueryService.js';
import {
  isRawDataDataSourceCacheKey,
  storeRawDataDataSourceBufferForNode,
} from '../../shapeChunkStoreUtils.js';

const databaseNames: string[] = [];

const createDatabaseName = (): string => {
  const databaseName = `runtime-worker-shape-chunks-${Date.now()}-${Math.random()}`;
  databaseNames.push(databaseName);
  return databaseName;
};

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((databaseName) => Dexie.delete(databaseName)));
});

describe('local-only Shape ChunkStore', () => {
  it('classifies current and explicitly selected legacy raw cache keys', () => {
    expect(isRawDataDataSourceCacheKey('https://example.com/source.json')).toBe(true);
    expect(isRawDataDataSourceCacheKey('http://example.com/source.json')).toBe(true);
    expect(isRawDataDataSourceCacheKey('download:test:us:adm0:cache-key')).toBe(true);
    expect(isRawDataDataSourceCacheKey('geoboundaries:metadata:all:catalog')).toBe(false);
    expect(isRawDataDataSourceCacheKey(undefined)).toBe(false);
  });

  it('stores, lists, counts, and reads only raw cache data without auth or network setup', async () => {
    const databaseName = createDatabaseName();
    const nodeId = 'node-1' as NodeId;
    const cacheKey = 'https://example.com/source.json';
    const metadataCacheKey = 'geoboundaries:metadata:all:catalog';
    const buffer = new ArrayBuffer(3);
    new Uint8Array(buffer).set([1, 2, 3]);

    await storeRawDataDataSourceBufferForNode({
      databaseName,
      nodeId,
      cacheKey,
      buffer,
    });
    const localStore = new LocalShapeChunkStore({
      databaseName,
      serializer: (value) => value,
      deserializer: (value) => value,
    });
    await localStore.setForNode(nodeId, metadataCacheKey, new Uint8Array([9]).buffer);

    const queryService = new ShapeQueryService({} as ShapeDB, databaseName);
    const caches = await queryService.listSourceCaches(nodeId);
    expect(caches).toHaveLength(1);
    expect(caches[0]?.id).toBe(cacheKey);
    expect(Array.from(new Uint8Array(caches[0]?.data ?? new ArrayBuffer(0)))).toEqual([1, 2, 3]);
    await expect(queryService.countSourceCaches(nodeId)).resolves.toBe(1);

    const stored = await queryService.getSourceCache(nodeId, cacheKey);
    expect(stored).not.toBeNull();
    expect(Array.from(new Uint8Array(stored?.data ?? new ArrayBuffer(0)))).toEqual([1, 2, 3]);
    await expect(queryService.getSourceCache(nodeId, metadataCacheKey)).resolves.toBeNull();
    await expect(
      storeRawDataDataSourceBufferForNode({
        databaseName,
        nodeId,
        cacheKey: metadataCacheKey,
        buffer: new Uint8Array([9]).buffer,
      })
    ).rejects.toThrow('invalid raw source cache key');
  });

  it('rejects the network fetch API before stale-cache fallback can run', async () => {
    const store = new LocalShapeChunkStore({
      databaseName: createDatabaseName(),
      serializer: (value) => value,
      deserializer: (value) => value,
    });

    const result = store.getOrFetchForNode('node-1' as NodeId, 'https://example.com/forbidden');

    await expect(result).rejects.toMatchObject({
      name: 'LocalShapeChunkStoreNetworkAccessError',
      code: LOCAL_SHAPE_CHUNK_STORE_NETWORK_ACCESS_FORBIDDEN,
    });
    await expect(result).rejects.toBeInstanceOf(LocalShapeChunkStoreNetworkAccessError);
  });
});
