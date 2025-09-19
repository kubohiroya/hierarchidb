import type { NodeId } from '@hierarchidb/common-type';
import type { GroupItemBase, PeerEntity, RelationBase } from '@hierarchidb/runtime-worker';
import type {
  LocationPeerData,
  LocationGroupItemData,
  LocationRelationMeta,
} from '../types/entities.js';
import type {
  LocationPeerRow,
  LocationGroupRow,
  LocationRelationRow,
} from './locationEntitiesDB.js';

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

const coerceDialogPosition = (
  value: PeerEntity<LocationPeerData>['dialogPosition'],
): LocationPeerRow['dialogPosition'] =>
  value ?? undefined;

const coerceDialogSize = (
  value: PeerEntity<LocationPeerData>['dialogSize'],
): LocationPeerRow['dialogSize'] =>
  value ?? undefined;

export const toPeerRow = (
  entity: PeerEntity<LocationPeerData>,
  timestamp = Date.now(),
): LocationPeerRow => ({
  nodeId: entity.nodeId,
  data: normalizePeerData(entity.data),
  updatedAt: timestamp,
  displayMode: entity.displayMode,
  dialogPosition: coerceDialogPosition(entity.dialogPosition),
  dialogSize: coerceDialogSize(entity.dialogSize),
});

export const fromPeerRow = (
  row: LocationPeerRow | undefined,
): PeerEntity<LocationPeerData> | undefined => {
  if (!row) return undefined;
  const { nodeId, updatedAt, displayMode, dialogPosition, dialogSize, data } = row;
  return {
    nodeId,
    updatedAt,
    displayMode,
    dialogPosition: dialogPosition ?? null,
    dialogSize: dialogSize ?? null,
    data: normalizePeerData(data),
  };
};

const isGroupData = (value: unknown): value is LocationGroupItemData =>
  isObject(value) && value.schemaVersion === 1;

const normalizeGroupData = (value: unknown): LocationGroupItemData => {
  if (isGroupData(value)) return value;
  if (!isObject(value)) return { schemaVersion: 1 };
  const metadata = sanitizeMetadata(value.metadata);
  const label = typeof value.label === 'string' ? value.label : undefined;
  const description = typeof value.description === 'string' ? value.description : undefined;
  return { schemaVersion: 1, label, description, metadata };
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

