import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countRawDataDataSourceBuffersForNode,
  createShapeChunkStore,
  deleteRawDataDataSourceBuffersForNode,
  deleteRawDataDataSourceBuffersForNodeMetadataIds,
  listRawDataDataSourceMetadataForNode,
  storeRawDataDataSourceBufferForNode,
} from '../../../services/utils/chunkStore';
import { createShapeNetworkPort } from '../../../services/utils/createShapeNetworkPort';
import { initializeShapeChunkStore } from '../../../services/utils/initializeShapeChunkStore';
import { setShapeCorsProxyBaseURL } from '../../../services/utils/setShapeCorsProxyBaseURL';

const textEncoder = new TextEncoder();

const encode = (value: string): ArrayBuffer => textEncoder.encode(value).buffer;

const dbName = 'test-shape-chunks';

describe('chunkStore raw data metadata-id based cache deletion', () => {
  beforeEach(async () => {
    await Dexie.delete(dbName);
  });

  afterEach(async () => {
    setShapeCorsProxyBaseURL('');
    await Dexie.delete(dbName);
  });

  it('uses the explicitly propagated CORS proxy for new Shape network ports', async () => {
    const authFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const sourceURL = 'https://source.example/boundaries.geojson';

    setShapeCorsProxyBaseURL('https://shape-proxy.example/');
    const network = createShapeNetworkPort({ authFetch });
    await network.get(sourceURL);

    expect(authFetch).toHaveBeenCalledWith(
      'https://shape-proxy.example/?url=https%3A%2F%2Fsource.example%2Fboundaries.geojson',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('rejects a conflicting database name before opening IndexedDB', () => {
    const openSpy = vi.spyOn(indexedDB, 'open');

    expect(() => initializeShapeChunkStore('other-shape-chunks')).toThrow(
      'shape-chunk-store-database-name-mismatch'
    );
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('removes raw data by metadataId and keeps shared chunks until last relation is removed', async () => {
    const nodeA = 'node-a';
    const nodeB = 'node-b';
    const sharedCacheKey = 'https://example.com/shared';
    const soloCacheKey = 'https://example.com/solo';

    await storeRawDataDataSourceBufferForNode({
      nodeId: nodeA,
      cacheKey: sharedCacheKey,
      buffer: encode('shared'),
    });
    await storeRawDataDataSourceBufferForNode({
      nodeId: nodeB,
      cacheKey: sharedCacheKey,
      buffer: encode('shared'),
    });
    await storeRawDataDataSourceBufferForNode({
      nodeId: nodeA,
      cacheKey: soloCacheKey,
      buffer: encode('solo'),
    });

    const nodeAMetadata = await listRawDataDataSourceMetadataForNode(nodeA);
    const sharedMetadataId = nodeAMetadata.find(
      (entry) => entry.cacheKey === sharedCacheKey
    )?.metadataId;
    const soloMetadataId = nodeAMetadata.find(
      (entry) => entry.cacheKey === soloCacheKey
    )?.metadataId;

    expect(sharedMetadataId).toBeTypeOf('string');
    expect(soloMetadataId).toBeTypeOf('string');

    const deleted = await deleteRawDataDataSourceBuffersForNodeMetadataIds(nodeA, [
      sharedMetadataId ?? '',
      soloMetadataId ?? '',
    ]);
    expect(deleted).toBe(2);

    expect(await listRawDataDataSourceMetadataForNode(nodeA)).toHaveLength(0);
    expect(await listRawDataDataSourceMetadataForNode(nodeB)).toHaveLength(1);
    expect(await countRawDataDataSourceBuffersForNode(nodeA)).toBe(0);
    expect(await countRawDataDataSourceBuffersForNode(nodeB)).toBe(1);

    const nodeBMetadata = await listRawDataDataSourceMetadataForNode(nodeB);
    expect(nodeBMetadata).toHaveLength(1);
    expect(nodeBMetadata[0]?.cacheKey).toBe(sharedCacheKey);
  });

  it('deletes cache entries when called with metadataIds that are not cache keys', async () => {
    const nodeId = 'node-only';
    const cacheKey = 'https://example.com/raw-only';

    await storeRawDataDataSourceBufferForNode({ nodeId, cacheKey, buffer: encode('payload') });

    const metadata = await listRawDataDataSourceMetadataForNode(nodeId);
    expect(metadata).toHaveLength(1);

    const deleted = await deleteRawDataDataSourceBuffersForNodeMetadataIds(
      nodeId,
      metadata.map((entry) => entry.metadataId)
    );

    expect(deleted).toBe(1);
    expect(await countRawDataDataSourceBuffersForNode(nodeId)).toBe(0);
    expect(await listRawDataDataSourceMetadataForNode(nodeId)).toHaveLength(0);
  });

  it('deletes only raw entries and ignores non-raw cache keys when deleting by node', async () => {
    const nodeId = 'node-mixed';
    const rawCacheKey = 'https://example.com/raw-data';
    const nonRawCacheKey = 'not-a-raw-cache-key';

    await storeRawDataDataSourceBufferForNode({
      nodeId,
      cacheKey: rawCacheKey,
      buffer: encode('raw'),
    });

    const store = createShapeChunkStore(
      (value: unknown) => value as ArrayBuffer,
      (buffer: ArrayBuffer) => buffer
    );
    await store.setForNode(nodeId, nonRawCacheKey, encode('non-raw'));

    const metadata = await listRawDataDataSourceMetadataForNode(nodeId);
    expect(metadata).toHaveLength(2);

    const deleted = await deleteRawDataDataSourceBuffersForNode(nodeId);

    expect(deleted).toBe(1);
    expect(await countRawDataDataSourceBuffersForNode(nodeId)).toBe(0);
    expect(await listRawDataDataSourceMetadataForNode(nodeId)).toHaveLength(1);

    const remainingMetadata = await listRawDataDataSourceMetadataForNode(nodeId);
    expect(remainingMetadata).toHaveLength(1);
    expect(remainingMetadata[0]?.cacheKey).toBe(nonRawCacheKey);
  });
});
