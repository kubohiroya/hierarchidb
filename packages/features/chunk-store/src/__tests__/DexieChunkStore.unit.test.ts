import { afterEach, describe, expect, it } from 'vitest';
import type { NodeId } from '@hierarchidb/core-types';
import { Dexie } from 'dexie';
import type { NetworkPort, ResponseLike } from '@hierarchidb/download';
import { DexieChunkStore } from '../index.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const serialize = (value: string): ArrayBuffer => encoder.encode(value).buffer;
const deserialize = (buffer: ArrayBuffer): string => decoder.decode(new Uint8Array(buffer));

const createStore = (dbName: string, networkPort?: NetworkPort) => new DexieChunkStore<string>({
  serializer: serialize,
  deserializer: deserialize,
  dbName,
  networkPort,
  networkOptions: { auth: { enabled: false } },
});

const makeResponse = (status: number, body = '', headers?: Record<string, string>): ResponseLike => ({
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
});
