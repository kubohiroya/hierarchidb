import {
  buildShapeCacheKey,
  createShapeChunkStore,
  jsonDeserializer,
  jsonSerializer,
} from './chunkStore.js';
import type { NodeId } from '@hierarchidb/common-types';

const parseAdminLevel = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.toUpperCase().match(/ADM\s*([0-5])/);
  const level = match?.[1];
  if (!level) return null;
  return Number.parseInt(level, 10);
};

const readFirstString = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return null;
};

export type GeoBoundariesAvailability = {
  entries: Map<string, number[]>;
  totalItems: number;
};

export async function fetchGeoBoundariesAvailability(
  nodeId: NodeId,
  url: string,
): Promise<GeoBoundariesAvailability> {
  const store = createShapeChunkStore(jsonSerializer, jsonDeserializer);
  const entry = await store.getOrFetchForNode(nodeId, url, {
    accept: 'application/json',
    cacheKey: buildShapeCacheKey('geoboundaries:availability', url),
  });
  const availabilityPayload = entry.value;
  const items = Array.isArray(availabilityPayload)
    ? availabilityPayload
    : Array.isArray((availabilityPayload as { data?: unknown }).data)
      ? (availabilityPayload as { data: unknown[] }).data
      : [];
  const entries = new Map<string, number[]>();
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const iso3 = readFirstString(record, [
      'boundaryISO',
      'iso3',
      'ISO3',
      'countryCode',
      'countryISO',
    ]);
    const boundaryType = readFirstString(record, [
      'boundaryType',
      'boundaryLevel',
      'adm',
      'ADM',
    ]);
    if (!iso3 || !boundaryType) continue;
    const parsed = parseAdminLevel(boundaryType);
    if (parsed === null) continue;
    const key = iso3.toUpperCase();
    const existing = entries.get(key) ?? [];
    if (!existing.includes(parsed)) {
      entries.set(key, [...existing, parsed].sort((a, b) => a - b));
    }
  }
  return { entries, totalItems: items.length };
}
