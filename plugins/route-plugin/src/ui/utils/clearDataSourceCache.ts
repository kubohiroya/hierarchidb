import type { NodeId } from '@hierarchidb/common-types';
import { DexieChunkStore } from '@hierarchidb/chunk-store';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const createRouteChunkStore = (): DexieChunkStore<string> => (
  new DexieChunkStore<string>({
    dbName: 'hidb-chunks',
    serializer: (value) => textEncoder.encode(value).buffer,
    deserializer: (buffer) => textDecoder.decode(new Uint8Array(buffer)),
  })
);

const ROUTE_CACHE_PREFIXES: Record<string, string[]> = {
  'ide-gsm': ['route-ide-gsm:'],
  'searoute': ['route-waypoints:searoute:'],
  'searoute-js': ['route-waypoints:searoute-js:'],
  'openstreetmap': ['route-openstreetmap:'],
  'custom': ['route-custom:'],
};

const resolvePrefixes = (dataSource: string): string[] => {
  const normalized = (dataSource ?? '').toLowerCase();
  if (!normalized) return [];
  return ROUTE_CACHE_PREFIXES[normalized] ?? [`route-${normalized}:`];
};

export const clearRouteDataSourceCache = async (
  nodeId: NodeId,
  dataSource: string,
): Promise<number> => {
  const prefixes = resolvePrefixes(dataSource);
  if (prefixes.length === 0) return 0;
  const store = createRouteChunkStore();
  const metadata = await store.listMetadataForNode(nodeId);
  const keys = metadata
    .map((entry) => entry.cacheKey)
    .filter((key): key is string => Boolean(key && prefixes.some((prefix) => key.startsWith(prefix))));
  for (const key of keys) {
    await store.deleteForNode(nodeId, key);
  }
  return keys.length;
};
