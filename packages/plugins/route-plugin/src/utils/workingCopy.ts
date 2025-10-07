import type { NodeId } from '@hierarchidb/common-types';
import { createEntityWorkingCopyAdapter } from '@hierarchidb/plugin-sdk';
import type { RouteDraftPayload, RouteEntity, RouteWorkingCopy } from '../types/index.js';
import { RouteType, TransportMode } from '../types/index.js';

const DEFAULT_TRANSPORT_MODES: TransportMode[] = [TransportMode.CAR];
const DEFAULT_PROCESSING_CONFIG = {
  concurrentRequests: 4,
  enableRouteOptimization: true,
  enableElevationData: false,
  enableTrafficData: false,
} as RouteEntity['processingConfig'];

const adapter = createEntityWorkingCopyAdapter<RouteEntity, RouteWorkingCopy>({
  draftFromEntity(entity: RouteEntity) {
    return {
      name: entity.name,
      description: entity.description,
      category: entity.category,
      routeType: entity.routeType,
      transportModes: entity.transportModes,
      startPoint: entity.startPoint,
      endPoint: entity.endPoint,
      waypoints: entity.waypoints,
      boundingBox: entity.boundingBox,
      distance: entity.distance,
      duration: entity.duration,
      elevation: entity.elevation,
      dataSourceName: entity.dataSourceName,
      licenseAgreement: entity.licenseAgreement,
      licenseAgreedAt: entity.licenseAgreedAt,
      processingConfig: entity.processingConfig,
      batchSessionId: entity.batchSessionId,
      processingStatus: entity.processingStatus,
      metadata: entity.metadata,
      customFields: entity.customFields,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      version: entity.version,
    } satisfies Partial<RouteEntity>;
  },
  draftDefaults(treeNodeId: NodeId, overrides: Partial<RouteDraftPayload> = {}) {
    const now = Date.now();
    return {
      name: overrides?.name ?? '',
      description: overrides?.description ?? '',
      category: overrides?.category,
      routeType: overrides?.routeType ?? RouteType.ROAD,
      transportModes: overrides?.transportModes ?? DEFAULT_TRANSPORT_MODES,
      startPoint: overrides?.startPoint,
      endPoint: overrides?.endPoint,
      waypoints: overrides?.waypoints ?? [],
      boundingBox: overrides?.boundingBox,
      distance: overrides?.distance,
      duration: overrides?.duration,
      elevation: overrides?.elevation,
      dataSourceName: overrides?.dataSourceName ?? 'openstreetmap',
      licenseAgreement: overrides?.licenseAgreement ?? false,
      licenseAgreedAt: overrides?.licenseAgreedAt,
      processingConfig: overrides?.processingConfig ?? DEFAULT_PROCESSING_CONFIG,
      batchSessionId: overrides?.batchSessionId,
      processingStatus: overrides?.processingStatus ?? 'idle',
      metadata: overrides?.metadata ?? {},
      customFields: overrides?.customFields ?? {},
      createdAt: overrides?.createdAt ?? now,
      updatedAt: overrides?.updatedAt ?? now,
      version: overrides?.version ?? 1,
      nodeId: overrides?.nodeId ?? (treeNodeId as NodeId),
    } satisfies Partial<RouteEntity>;
  },
  finalize(workingCopy: RouteWorkingCopy, source: RouteEntity) {
    return {
      ...workingCopy,
      id: workingCopy.treeNodeId,
      nodeId: (workingCopy as RouteWorkingCopy & { nodeId?: NodeId }).nodeId ?? source.nodeId ?? workingCopy.treeNodeId,
      parentId: (workingCopy as RouteWorkingCopy & { parentId?: NodeId }).parentId ?? workingCopy.treeNodeId,
      isDraft: false,
    } as RouteWorkingCopy;
  },
  finalizeDraft(workingCopy: RouteWorkingCopy, treeNodeId: NodeId) {
    return {
      ...workingCopy,
      id: workingCopy.treeNodeId,
      nodeId: workingCopy.treeNodeId,
      parentId: (workingCopy as RouteWorkingCopy & { parentId?: NodeId }).parentId ?? treeNodeId,
      isDraft: true,
      resumeStep: 0,
    } as RouteWorkingCopy;
  },
});

export function createRouteWorkingCopyFromEntity(entity: RouteEntity): RouteWorkingCopy {
  return adapter.fromEntity(entity);
}

export function createRouteDraftWorkingCopy(
  nodeId: NodeId,
  overrides: Partial<RouteDraftPayload> = {},
  parentId?: NodeId,
): RouteWorkingCopy {
  const draft = adapter.createDraft(nodeId, overrides);
  return {
    ...draft,
    parentId: parentId ?? nodeId,
  } as RouteWorkingCopy;
}

export function mergeRouteWorkingCopy(
  workingCopy: RouteWorkingCopy,
  updates: Partial<RouteEntity>,
): RouteWorkingCopy {
  return adapter.merge(workingCopy, updates);
}

export function getRouteDraft(workingCopy: RouteWorkingCopy): Partial<RouteEntity> {
  if (workingCopy && typeof workingCopy === 'object' && workingCopy.draft && typeof workingCopy.draft === 'object') {
    return workingCopy.draft as Partial<RouteEntity>;
  }

  // Fallback to legacy structure where domain fields lived at the top level.
  return workingCopy as unknown as Partial<RouteEntity>;
}
