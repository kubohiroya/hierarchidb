import type { NodeId } from '@hierarchidb/core-types';
import type { LocationSourceArtifactRecord } from '@hierarchidb/location-store';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';
import type { LocationPointProperties } from '~/common/entities/LocationPoint.js';
import { LocationDB } from '~/worker/locationEntitiesDB.js';
import type { LocationSourcePlan } from './LocationSourcePlan.js';

let dbPromise: Promise<LocationDB> | null = null;

const getDb = async (): Promise<LocationDB> => {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = new LocationDB(getDBName(getBuildDatabasePrefix(), 'location'));
      await db.open?.();
      return db;
    })();
  }
  return dbPromise;
};

export const persistLocationSourceArtifact = async (input: {
  nodeId: NodeId;
  sourcePlan: LocationSourcePlan;
  points: readonly LocationPointProperties[];
  completedAt: number;
}): Promise<void> => {
  const db = await getDb();
  await db.storeSourceArtifact(createLocationSourceArtifactRecord(input));
};

export const createLocationSourceArtifactRecord = (input: {
  nodeId: NodeId;
  sourcePlan: LocationSourcePlan;
  points: readonly LocationPointProperties[];
  completedAt: number;
}): LocationSourceArtifactRecord => ({
  nodeId: input.nodeId,
  inputHash: input.sourcePlan.identity.inputHash,
  contentHash: createLocationPointDatasetHash(input.points),
  pointCount: input.points.length,
  selectionSignature: input.sourcePlan.identity.selectionSignature,
  sourceKind: input.sourcePlan.identity.sourceKind,
  dataSource: input.sourcePlan.identity.dataSource,
  parserVersion: input.sourcePlan.identity.parserVersion,
  authScope: input.sourcePlan.identity.authScope,
  requestTargets: input.sourcePlan.identity.requestTargets,
  completedAt: input.completedAt,
});

export const createLocationPointDatasetHash = (
  points: readonly LocationPointProperties[]
): string => {
  const stablePayload = points
    .map((point) => stableStringify(point))
    .sort((left, right) => left.localeCompare(right));
  return `locpoints:${fnv1a64(`[${stablePayload.join(',')}]`)}`;
};

const stableStringify = (value: unknown): string => JSON.stringify(stableNormalize(value));

const stableNormalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (value === null || typeof value !== 'object') return value;
  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries.map(([key, entryValue]) => [key, stableNormalize(entryValue)]));
};

const fnv1a64 = (value: string): string => {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
};
