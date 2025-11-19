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

const sanitizeMetadata = (value: unknown): Record<string, unknown> | undefined =>
  (isRecord(value) ? { ...value } : undefined);

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
  isObject(value) && value.schemaVersion === 1 && typeof value.pid === 'string';

const sanitizeSource = (value: unknown): LocationGroupItemData['source'] => {
  if (!isObject(value)) return undefined;
  const provider = typeof value.provider === 'string' ? value.provider : undefined;
  const fetchedAt = typeof value.fetchedAt === 'number' ? value.fetchedAt : undefined;
  if (!provider || fetchedAt === undefined) return undefined;
  const originalId = typeof value.originalId === 'string' ? value.originalId : undefined;
  return { provider, fetchedAt, originalId };
};

const sanitizePayload = (value: unknown): Record<string, unknown> => (
  isRecord(value) ? { ...value } : {}
);

const normalizeGroupData = (value: unknown): LocationGroupItemData => {
  if (isGroupData(value)) {
    return {
      ...value,
      payload: sanitizePayload(value.payload),
      source: sanitizeSource(value.source),
    };
  }

  if (!isObject(value)) {
    return {
      schemaVersion: 1,
      pid: '',
      name: '',
      latitude: 0,
      longitude: 0,
      kind: 'unknown',
      gid0: '',
      gid1: undefined,
      gid2: undefined,
      payload: {},
      source: undefined,
    };
  }

  const pid = typeof value.pid === 'string' ? value.pid : '';
  const name = typeof value.name === 'string' ? value.name : '';
  const latitude = typeof value.latitude === 'number' ? value.latitude : 0;
  const longitude = typeof value.longitude === 'number' ? value.longitude : 0;
  const kind = typeof value.kind === 'string' ? value.kind : 'unknown';
  const gid0 = typeof value.gid0 === 'string' ? value.gid0 : '';
  const gid1 = typeof value.gid1 === 'string' ? value.gid1 : undefined;
  const gid2 = typeof value.gid2 === 'string' ? value.gid2 : undefined;

  return {
    schemaVersion: 1,
    pid,
    name,
    latitude,
    longitude,
    kind,
    gid0,
    gid1,
    gid2,
    payload: sanitizePayload((value as Record<string, unknown>).payload),
    source: sanitizeSource((value as Record<string, unknown>).source),
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
