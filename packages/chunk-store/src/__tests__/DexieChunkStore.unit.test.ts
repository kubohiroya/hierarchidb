import type { NodeId } from '@hierarchidb/core-types';
import type { NetworkPort, ResponseLike } from '@hierarchidb/download';
import { Dexie } from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DexieChunkStore } from '../index';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const serialize = (value: string): ArrayBuffer => encoder.encode(value).buffer;
const deserialize = (buffer: ArrayBuffer): string => decoder.decode(new Uint8Array(buffer));

const createStore = (dbName: string, networkPort?: NetworkPort) =>
  new DexieChunkStore<string>({
    serializer: serialize,
    deserializer: deserialize,
    dbName,
    networkPort,
    networkOptions: { auth: { enabled: false } },
  });

const makeResponse = (
  status: number,
  body = '',
  headers?: Record<string, string>
): ResponseLike => ({
  ok: status >= 200 && status < 300,
  status,
  headers: headers ? new Headers(headers) : new Headers(),
  arrayBuffer: async () => encoder.encode(body).buffer,
});

describe('DexieChunkStore', () => {
  const dbNames: string[] = [];

  afterEach(async () => {
    while (dbNames.length > 0) {
      const name = dbNames.pop();
      if (name) {
        await Dexie.delete(name);
      }
    }
  });

  it('rejects a missing database name before IndexedDB open', () => {
    const openSpy = vi.spyOn(indexedDB, 'open');

    expect(
      () =>
        new DexieChunkStore<string>({
          serializer: serialize,
          deserializer: deserialize,
        })
    ).toThrow('chunk-store-database-name-required');
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('rejects conflicting database authorities', () => {
    const db = new Dexie('chunk-store-explicit');

    expect(
      () =>
        new DexieChunkStore<string>({
          db,
          dbName: 'chunk-store-conflicting',
          serializer: serialize,
          deserializer: deserialize,
        })
    ).toThrow('chunk-store-database-name-mismatch');
    db.close();
  });

  it('stores, reads, and deletes per node', async () => {
    const dbName = `chunk-store-test-${Date.now()}-${Math.random()}`;
    dbNames.push(dbName);
    const store = createStore(dbName);
    const nodeId = 'node-1' as NodeId;
    const cacheKey = 'https://example.com/data';

    await store.setForNode(nodeId, cacheKey, 'payload');
    const entry = await store.get(cacheKey);

    expect(entry?.value).toBe('payload');
    expect(entry?.metadata.cacheKey).toBe(cacheKey);

    await store.deleteForNode(nodeId, cacheKey);
    const removed = await store.get(cacheKey);
    expect(removed).toBeUndefined();
  });

  it('keeps shared entries when another node still references them', async () => {
    const dbName = `chunk-store-test-${Date.now()}-${Math.random()}`;
    dbNames.push(dbName);
    const store = createStore(dbName);
    const cacheKey = 'https://example.com/shared';

    await store.setForNode('node-a' as NodeId, cacheKey, 'value');
    await store.setForNode('node-b' as NodeId, cacheKey, 'value');
    await store.deleteForNode('node-a' as NodeId, cacheKey);

    const stillThere = await store.get(cacheKey);
    expect(stillThere?.value).toBe('value');

    await store.deleteForNode('node-b' as NodeId, cacheKey);
    const removed = await store.get(cacheKey);
    expect(removed).toBeUndefined();
  });

  it('reuses cached data on 304 responses', async () => {
    const dbName = `chunk-store-test-${Date.now()}-${Math.random()}`;
    dbNames.push(dbName);
    const responses = [
      makeResponse(200, 'cached', { etag: 'v1', 'content-type': 'text/plain' }),
      makeResponse(304),
    ];
    const networkPort: NetworkPort = {
      head: async () => makeResponse(405),
      get: async () => responses.shift() ?? makeResponse(500),
      post: async () => makeResponse(405),
      getRange: async () => makeResponse(405),
    };
    const store = createStore(dbName, networkPort);
    const nodeId = 'node-1' as NodeId;
    const url = 'https://example.com/cached';

    const first = await store.getOrFetchForNode(nodeId, url);
    const second = await store.getOrFetchForNode(nodeId, url);

    expect(first.value).toBe('cached');
    expect(second.value).toBe('cached');
  });

  it('removes node-specific relation without deleting shared cache file', async () => {
    const dbName = `chunk-store-test-${Date.now()}-${Math.random()}`;
    dbNames.push(dbName);
    const store = createStore(dbName);
    const sharedCacheKey = 'https://example.com/shared';

    await store.setForNode('node-a' as NodeId, sharedCacheKey, 'shared');
    await store.setForNode('node-b' as NodeId, sharedCacheKey, 'shared');
    const beforeMeta = await store.listMetadataForNode('node-a' as NodeId);
    expect(beforeMeta).toHaveLength(1);

    const metadataId = beforeMeta[0]?.metadataId;
    expect(metadataId).toBeTypeOf('string');

    await (
      store as { deleteForNodeByMetadataId: (nodeId: NodeId, metadataId: string) => Promise<void> }
    ).deleteForNodeByMetadataId('node-a' as NodeId, metadataId ?? '');

    const afterNodeAMetadata = await store.listMetadataForNode('node-a' as NodeId);
    const afterNodeBMetadata = await store.listMetadataForNode('node-b' as NodeId);
    expect(afterNodeAMetadata).toHaveLength(0);
    expect(afterNodeBMetadata).toHaveLength(1);
    expect(afterNodeBMetadata[0]?.metadataId).toBe(metadataId);
    expect(await store.get(sharedCacheKey)).toBeTruthy();
  });

  it('deletes metadata only when no remaining relations remain', async () => {
    const dbName = `chunk-store-test-${Date.now()}-${Math.random()}`;
    dbNames.push(dbName);
    const store = createStore(dbName);
    const sharedCacheKey = 'https://example.com/shared';
    const soloCacheKey = 'https://example.com/solo';

    await store.setForNode('node-a' as NodeId, sharedCacheKey, 'shared');
    await store.setForNode('node-b' as NodeId, sharedCacheKey, 'shared');
    await store.setForNode('node-a' as NodeId, soloCacheKey, 'solo');

    const metaForA = await store.listMetadataForNode('node-a' as NodeId);
    const sharedMetadataId = metaForA.find(
      (entry) => entry.cacheKey === sharedCacheKey
    )?.metadataId;
    const soloMetadataId = metaForA.find((entry) => entry.cacheKey === soloCacheKey)?.metadataId;
    expect(sharedMetadataId).toBeTypeOf('string');
    expect(soloMetadataId).toBeTypeOf('string');

    await (
      store as { deleteForNodeByMetadataId: (nodeId: NodeId, metadataId: string) => Promise<void> }
    ).deleteForNodeByMetadataId('node-a' as NodeId, sharedMetadataId ?? '');
    await (
      store as { deleteForNodeByMetadataId: (nodeId: NodeId, metadataId: string) => Promise<void> }
    ).deleteForNodeByMetadataId('node-a' as NodeId, soloMetadataId ?? '');

    const nodeAMetadata = await store.listMetadataForNode('node-a' as NodeId);
    const nodeBMetadata = await store.listMetadataForNode('node-b' as NodeId);
    expect(nodeAMetadata).toHaveLength(0);
    expect(nodeBMetadata).toHaveLength(1);
    expect(await store.get(sharedCacheKey)).toBeTruthy();
    expect(await store.get(soloCacheKey)).toBeUndefined();
    expect(nodeBMetadata[0]?.cacheKey).toBe(sharedCacheKey);
  });
});
