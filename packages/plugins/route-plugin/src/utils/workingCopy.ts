import type { NodeId, Timestamp } from '@hierarchidb/common-type';
import { createDraftWorkingCopyBase, markWorkingCopyUpdated } from '@hierarchidb/plugins-base-plugin';
import type { RouteDraftPayload, RouteEntity, RouteWorkingCopy, RouteWorkingCopyEntity } from '../types/index.js';
import { RouteType, TransportMode } from '../types/index.js';

const DEFAULT_TRANSPORT_MODES: TransportMode[] = [TransportMode.CAR];
const DEFAULT_PROCESSING_CONFIG = {
  concurrentRequests: 4,
  enableRouteOptimization: true,
  enableElevationData: false,
  enableTrafficData: false,
} as RouteEntity['processingConfig'];

function ensureDraftPayload(
  entity: Partial<RouteEntity>,
  overrides: Partial<RouteDraftPayload> = {},
): RouteDraftPayload {
  const createdAt = (overrides.createdAt ?? entity.createdAt ?? Date.now()) as Timestamp;
  const updatedAt = (overrides.updatedAt ?? entity.updatedAt ?? createdAt) as Timestamp;

  return {
    name: overrides.name ?? entity.name ?? '',
    description: overrides.description ?? entity.description ?? '',
    category: overrides.category ?? entity.category,
    routeType: overrides.routeType ?? entity.routeType ?? RouteType.ROAD,
    transportModes: overrides.transportModes ?? entity.transportModes ?? DEFAULT_TRANSPORT_MODES,
    startPoint: overrides.startPoint ?? entity.startPoint,
    endPoint: overrides.endPoint ?? entity.endPoint,
    waypoints: overrides.waypoints ?? entity.waypoints,
    boundingBox: overrides.boundingBox ?? entity.boundingBox,
    distance: overrides.distance ?? entity.distance,
    duration: overrides.duration ?? entity.duration,
    elevation: overrides.elevation ?? entity.elevation,
    dataSourceName: overrides.dataSourceName ?? entity.dataSourceName ?? 'openstreetmap',
    licenseAgreement: overrides.licenseAgreement ?? entity.licenseAgreement ?? false,
    licenseAgreedAt: overrides.licenseAgreedAt ?? entity.licenseAgreedAt,
    processingConfig: overrides.processingConfig ?? entity.processingConfig ?? DEFAULT_PROCESSING_CONFIG,
    batchSessionId: overrides.batchSessionId ?? entity.batchSessionId,
    processingStatus: overrides.processingStatus ?? entity.processingStatus ?? 'idle',
    createdAt,
    updatedAt,
    version: overrides.version ?? entity.version ?? 1,
  };
}

export function createRouteWorkingCopyFromEntity(entity: RouteEntity): RouteWorkingCopy {
  const draft = ensureDraftPayload(entity);
  const base = createDraftWorkingCopyBase<RouteEntity>({
    draft,
    meta: {
      treeNodeId: entity.nodeId,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      originalVersion: entity.version,
    },
  });

  const workingCopy: RouteWorkingCopyEntity = {
    ...base,
    ...draft,
    id: entity.nodeId,
    nodeId: entity.nodeId,
    parentId: entity.nodeId,
    isDraft: false,
  };

  return workingCopy;
}

export function createRouteDraftWorkingCopy(
  nodeId: NodeId,
  overrides: Partial<RouteDraftPayload> = {},
  parentId?: NodeId,
): RouteWorkingCopy {
  const draft = ensureDraftPayload({}, overrides);
  const base = createDraftWorkingCopyBase<RouteEntity>({
    draft,
    meta: {
      treeNodeId: nodeId,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      originalVersion: draft.version,
    },
  });

  const workingCopy: RouteWorkingCopyEntity = {
    ...base,
    ...draft,
    id: nodeId,
    nodeId,
    parentId: parentId ?? nodeId,
    isDraft: true,
    resumeStep: 0,
  };

  return workingCopy;
}

export function mergeRouteWorkingCopy(
  workingCopy: RouteWorkingCopy,
  updates: Partial<RouteEntity>,
  timestamp: Timestamp = Date.now() as Timestamp,
): RouteWorkingCopy {
  const base = markWorkingCopyUpdated<RouteEntity>(workingCopy, updates, timestamp);
  const draft = ensureDraftPayload({ ...workingCopy, ...workingCopy.draft }, { ...updates, updatedAt: timestamp });

  const next: RouteWorkingCopyEntity = {
    ...workingCopy,
    ...base,
    ...draft,
    updatedAt: timestamp,
  };

  return next;
}
