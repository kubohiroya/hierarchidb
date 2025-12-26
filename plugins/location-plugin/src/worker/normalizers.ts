import type { NodeId } from '@hierarchidb/common-types';
import type { GroupItemBase, RelationBase } from '@hierarchidb/runtime-worker';
import type {
  LocationPeerData,
  LocationGroupItemData,
  LocationRelationMeta,
} from '../common/types/entities.js';
import type { LocationGroupRow, LocationRelationRow } from './locationEntitiesDB.js';

type Progress = NonNullable<LocationPeerData['lastProgress']>;
type ErrorInfo = NonNullable<LocationPeerData['lastError']>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isRecord = (value: unknown): value is Record<string, unknown> => isObject(value);

const isProgress = (value: unknown): value is Progress =>
  isObject(value) && typeof value.stage === 'string';

const isErrorInfo = (value: unknown): value is ErrorInfo =>
  isObject(value) && typeof value.message === 'string';

const sanitizeProgress = (value: unknown): Progress | undefined => {
  if (!isProgress(value)) return undefined;
  const { stage } = value;
  const completed = typeof value.completed === 'number' ? value.completed : undefined;
  const total = typeof value.total === 'number' ? value.total : undefined;
  const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : undefined;
  return { stage, completed, total, updatedAt };
};

const sanitizeErrorInfo = (value: unknown): ErrorInfo | undefined => {
  if (!isErrorInfo(value)) return undefined;
  const { message } = value;
  const code = typeof value.code === 'string' ? value.code : undefined;
  return { message, code };
};

const normalizeMetadataValue = (value: unknown): string | number | null => {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value) || typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const sanitizeMetadata = (value: unknown): Record<string, string | number | null> | undefined => {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [key, normalizeMetadataValue(val)]),
  );
};

export const normalizePeerData = (data: unknown): LocationPeerData => {
  if (isObject(data) && data.schemaVersion === 1) {
    return {
      schemaVersion: 1,
      lastProgress: sanitizeProgress(data.lastProgress),
      lastError: sanitizeErrorInfo(data.lastError),
      metadata: sanitizeMetadata(data.metadata),
    };
  }

  if (!data) {
    return { schemaVersion: 1 };
  }

  return {
    schemaVersion: 1,
    lastProgress: sanitizeProgress((data as Record<string, unknown>).lastProgress),
    lastError: sanitizeErrorInfo((data as Record<string, unknown>).lastError),
    metadata: sanitizeMetadata((data as Record<string, unknown>).metadata),
  };
};

const isGroupData = (value: unknown): value is LocationGroupItemData =>
  isObject(value)
  && (typeof (value as LocationGroupItemData).pointId === 'string' || typeof (value as { pid?: string }).pid === 'string')
  && (value.schemaVersion === 1 || value.schemaVersion === 2);

const normalizeGroupData = (value: unknown): LocationGroupItemData => {
  if (isGroupData(value)) {
    const schemaVersion = value.schemaVersion === 2 ? 2 : 1;
    if (schemaVersion === 2) {
      return {
        ...value,
        schemaVersion: 2,
        metadata: sanitizeMetadata(value.metadata),
      };
    }
    return {
      schemaVersion: 2,
      pointId: (value as { pid?: string }).pid ?? '',
      name: typeof value.name === 'string' ? value.name : '',
      latitude: typeof value.latitude === 'number' ? value.latitude : 0,
      longitude: typeof value.longitude === 'number' ? value.longitude : 0,
      kind: typeof value.kind === 'string' ? value.kind : 'unknown',
      countryCode: typeof value.gid0 === 'string' ? value.gid0 : '',
      admin1: typeof value.gid1 === 'string' ? value.gid1 : undefined,
      admin2: typeof value.gid2 === 'string' ? value.gid2 : undefined,
      metadata: sanitizeMetadata(value.payload),
    };
  }

  if (!isObject(value)) {
    return {
      schemaVersion: 2,
      pointId: '' as LocationGroupItemData['pointId'],
      name: '',
      latitude: 0,
      longitude: 0,
      kind: 'unknown',
      countryCode: '',
      admin1: undefined,
      admin2: undefined,
      metadata: undefined,
    };
  }

  const pointId = typeof (value as Record<string, unknown>).pointId === 'string'
    ? (value as Record<string, unknown>).pointId as string
    : typeof value.pid === 'string'
      ? value.pid
      : '';
  const name = typeof value.name === 'string' ? value.name : '';
  const latitude = typeof value.latitude === 'number' ? value.latitude : 0;
  const longitude = typeof value.longitude === 'number' ? value.longitude : 0;
  const kind = typeof value.kind === 'string' ? value.kind : 'unknown';
  const countryCode = typeof value.countryCode === 'string'
    ? value.countryCode
    : typeof value.gid0 === 'string'
      ? value.gid0
      : '';
  const admin1 = typeof value.admin1 === 'string'
    ? value.admin1
    : typeof value.gid1 === 'string'
      ? value.gid1
      : undefined;
  const admin2 = typeof value.admin2 === 'string'
    ? value.admin2
    : typeof value.gid2 === 'string'
      ? value.gid2
      : undefined;
  const countryName = typeof value.countryName === 'string' ? value.countryName : undefined;

  return {
    schemaVersion: 2,
    pointId: pointId as LocationGroupItemData['pointId'],
    name,
    latitude,
    longitude,
    kind,
    countryCode,
    countryName,
    admin1,
    admin2,
    metadata: sanitizeMetadata((value as Record<string, unknown>).metadata ?? (value as Record<string, unknown>).payload),
  };
};

export const toGroupRow = (
  nodeId: NodeId,
  item: GroupItemBase<LocationGroupItemData>,
  timestamp = Date.now(),
): LocationGroupRow => ({
  nodeId,
  id: item.id,
  data: item.data ? normalizeGroupData(item.data) : undefined,
  updatedAt: timestamp,
});

export const fromGroupRow = (
  rows: LocationGroupRow[],
): GroupItemBase<LocationGroupItemData>[] =>
  rows.map(({ id, data, updatedAt }) => ({
    id,
    data: data ? normalizeGroupData(data) : undefined,
    updatedAt,
  }));

const isRelationMeta = (value: unknown): value is LocationRelationMeta =>
  isObject(value) && value.schemaVersion === 1;

const normalizeRelationMeta = (value: unknown): LocationRelationMeta | undefined => {
  if (!value) return undefined;
  if (isRelationMeta(value)) return value;
  if (!isObject(value)) return { schemaVersion: 1 };
  const relationKind = typeof value.relationKind === 'string' ? value.relationKind : undefined;
  const weight = typeof value.weight === 'number' ? value.weight : undefined;
  const metadata = sanitizeMetadata(value.metadata);
  return { schemaVersion: 1, relationKind, weight, metadata };
};

export const toRelationRow = (
  rel: RelationBase<LocationRelationMeta>,
  timestamp = Date.now(),
): LocationRelationRow => ({
  srcNodeId: rel.srcNodeId,
  dstNodeId: rel.dstNodeId,
  type: rel.type,
  meta: normalizeRelationMeta(rel.meta),
  updatedAt: timestamp,
});

export const fromRelationRows = (
  rows: LocationRelationRow[],
): RelationBase<LocationRelationMeta>[] =>
  rows.map(({ srcNodeId, dstNodeId, type, meta, updatedAt }) => ({
    srcNodeId,
    dstNodeId,
    type,
    meta: normalizeRelationMeta(meta),
    updatedAt,
  }));
