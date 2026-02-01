import type { NodeId } from '@hierarchidb/core-types';
import type { FeatureItemBase } from '@hierarchidb/runtime-worker';
import type {
  LocationPeerData,
  LocationGroupItemData,
} from '../common/types/entities.js';
import { mortonKeyFromLonLat } from '@hierarchidb/location-store';
import type { LocationFeature } from './locationEntitiesDB.js';

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

const normalizeCentroidForShapeId = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const normalizeCentroidForShapeContainerNodeId = (value: unknown): NodeId | undefined => (
  typeof value === 'string' && value.trim().length > 0 ? (value as NodeId) : undefined
);

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
    lastProgress: sanitizeProgress(isRecord(data) ? data.lastProgress : undefined),
    lastError: sanitizeErrorInfo(isRecord(data) ? data.lastError : undefined),
    metadata: sanitizeMetadata(isRecord(data) ? data.metadata : undefined),
  };
};

const isGroupData = (value: unknown): value is LocationGroupItemData =>
  isObject(value)
  && (typeof (value as Record<string, unknown>).pointId === 'string'
    || typeof (value as Record<string, unknown>).pid === 'string')
  && (((value as Record<string, unknown>).schemaVersion === 1) || ((value as Record<string, unknown>).schemaVersion === 2));

const normalizeGroupData = (value: unknown): LocationGroupItemData => {
  if (isGroupData(value)) {
    const schemaVersion = value.schemaVersion === 2 ? 2 : 1;
    if (schemaVersion === 2) {
      const centroidForShapeId = normalizeCentroidForShapeId(value.centroidForShapeId);
      const centroidForShapeContainerNodeId = normalizeCentroidForShapeContainerNodeId(
        value.centroidForShapeContainerNodeId
      );
      return {
        ...value,
        schemaVersion: 2,
        ...(centroidForShapeId !== undefined && { centroidForShapeId }),
        ...(centroidForShapeContainerNodeId && { centroidForShapeContainerNodeId }),
        metadata: sanitizeMetadata(value.metadata),
      };
    }
    const legacy = value as {
      pid?: unknown;
      gid0?: unknown;
      gid1?: unknown;
      gid2?: unknown;
      payload?: unknown;
      centroidForShapeId?: unknown;
      centroidForShapeContainerNodeId?: unknown;
      name?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      type?: unknown;
    };
    const centroidForShapeId = normalizeCentroidForShapeId(legacy.centroidForShapeId);
    const centroidForShapeContainerNodeId = normalizeCentroidForShapeContainerNodeId(
      legacy.centroidForShapeContainerNodeId
    );
    return {
      schemaVersion: 2,
      pointId: (legacy.pid ?? '') as LocationGroupItemData['pointId'],
      name: typeof value.name === 'string' ? value.name : '',
      latitude: typeof value.latitude === 'number' ? value.latitude : 0,
      longitude: typeof value.longitude === 'number' ? value.longitude : 0,
      type: typeof value.type === 'string' ? value.type : 'unknown',
      admin0Code: typeof legacy.gid0 === 'string' ? legacy.gid0 : '',
      admin1: typeof legacy.gid1 === 'string' ? legacy.gid1 : undefined,
      admin2: typeof legacy.gid2 === 'string' ? legacy.gid2 : undefined,
      ...(centroidForShapeId !== undefined && { centroidForShapeId }),
      ...(centroidForShapeContainerNodeId && { centroidForShapeContainerNodeId }),
      metadata: sanitizeMetadata(legacy.payload),
    };
  }

  if (!isObject(value)) {
    return {
      schemaVersion: 2,
      pointId: '' as LocationGroupItemData['pointId'],
      name: '',
      latitude: 0,
      longitude: 0,
      type: 'unknown',
      admin0Code: '',
      admin1: undefined,
      admin2: undefined,
      metadata: undefined,
    };
  }

  const pointId = typeof (value as Record<string, unknown>).pointId === 'string'
    ? (value as Record<string, unknown>).pointId as string
    : typeof (value as Record<string, unknown>).pid === 'string'
      ? (value as Record<string, unknown>).pid as string
      : '';
  const valueRecord = value as Record<string, unknown>;
  const name = typeof valueRecord.name === 'string' ? valueRecord.name : '';
  const latitude = typeof valueRecord.latitude === 'number' ? valueRecord.latitude : 0;
  const longitude = typeof valueRecord.longitude === 'number' ? valueRecord.longitude : 0;
  const type = typeof valueRecord.type === 'string' ? valueRecord.type : 'unknown';
  const admin0Code = typeof (value as Record<string, unknown>).admin0Code === 'string'
    ? (value as Record<string, unknown>).admin0Code as string
    : typeof (value as Record<string, unknown>).gid0 === 'string'
      ? (value as Record<string, unknown>).gid0 as string
      : '';
  const admin1 = typeof (value as Record<string, unknown>).admin1 === 'string'
    ? (value as Record<string, unknown>).admin1 as string
    : typeof (value as Record<string, unknown>).gid1 === 'string'
      ? (value as Record<string, unknown>).gid1 as string
      : undefined;
  const admin2 = typeof (value as Record<string, unknown>).admin2 === 'string'
    ? (value as Record<string, unknown>).admin2 as string
    : typeof (value as Record<string, unknown>).gid2 === 'string'
      ? (value as Record<string, unknown>).gid2 as string
      : undefined;
  const admin0 = typeof (value as Record<string, unknown>).admin0 === 'string'
    ? (value as Record<string, unknown>).admin0 as string
    : typeof (value as Record<string, unknown>).admin0Name === 'string'
      ? (value as Record<string, unknown>).admin0Name as string
      : undefined;

  const centroidForShapeId = normalizeCentroidForShapeId(valueRecord.centroidForShapeId);
  const centroidForShapeContainerNodeId = normalizeCentroidForShapeContainerNodeId(
    valueRecord.centroidForShapeContainerNodeId
  );
  return {
    schemaVersion: 2,
    pointId: pointId as LocationGroupItemData['pointId'],
    name,
    latitude,
    longitude,
    type,
    admin0Code,
    admin0,
    admin1,
    admin2,
    ...(centroidForShapeId !== undefined && { centroidForShapeId }),
    ...(centroidForShapeContainerNodeId && { centroidForShapeContainerNodeId }),
    metadata: sanitizeMetadata((value as Record<string, unknown>).metadata ?? (value as Record<string, unknown>).payload),
  };
};

export const toGroupRow = (
  nodeId: NodeId,
  item: FeatureItemBase<LocationGroupItemData>,
  timestamp = Date.now(),
): LocationFeature => {
  const normalizedData = normalizeGroupData(item.data ?? {});
  const centroidForShapeId = normalizedData?.centroidForShapeId;
  const centroidForShapeContainerNodeId = normalizedData?.centroidForShapeContainerNodeId;
  return {
    nodeId,
    id: String(item.id) as LocationFeature['id'],
    type: normalizedData.type,
    mortonKey: item.data && Number.isFinite(item.data.longitude) && Number.isFinite(item.data.latitude)
      ? mortonKeyFromLonLat(item.data.longitude, item.data.latitude)
      : undefined,
    data: normalizedData,
    ...(centroidForShapeId !== undefined && { centroidForShapeId }),
    ...(centroidForShapeContainerNodeId && { centroidForShapeContainerNodeId }),
    updatedAt: timestamp,
  };
};

export const fromGroupRow = (
  rows: LocationFeature[],
): FeatureItemBase<LocationGroupItemData>[] =>
  rows.map(({ id, data, updatedAt }) => ({
    id,
    data: data ? normalizeGroupData(data) : undefined,
    updatedAt,
  }));
