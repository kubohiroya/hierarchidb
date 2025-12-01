import type { NodeId } from '@hierarchidb/common-types';
import { createEntityDraftAdapter } from '@hierarchidb/plugin-service-sdk';
import type { RouteDraftPayload, RouteEntity, RouteDraft } from '../types/index.js';
import { RouteType } from '../types/index.js';

const DEFAULT_PROCESSING_CONFIG = {
  concurrentRequests: 4,
  enableRouteOptimization: true,
  enableElevationData: false,
  enableTrafficData: false,
} as RouteEntity['processingConfig'];

const adapter = createEntityDraftAdapter<RouteEntity, RouteDraft>({
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
  finalize(draft: RouteDraft, source: RouteEntity) {
    return {
      ...draft,
      id: draft.treeNodeId,
      nodeId: (draft as RouteDraft & { nodeId?: NodeId }).nodeId ?? source.nodeId ?? draft.treeNodeId,
      parentId: (draft as RouteDraft & { parentId?: NodeId }).parentId ?? draft.treeNodeId,
      isDraft: false,
    } as RouteDraft;
  },
  finalizeDraft(draft: RouteDraft, treeNodeId: NodeId) {
    return {
      ...draft,
      id: draft.treeNodeId,
      nodeId: draft.treeNodeId,
      parentId: (draft as RouteDraft & { parentId?: NodeId }).parentId ?? treeNodeId,
      isDraft: true,
      resumeStep: 0,
    } as RouteDraft;
  },
});

export function createRouteDraftBase(
  nodeId: NodeId,
  overrides: Partial<RouteDraftPayload> = {},
  parentId?: NodeId,
): RouteDraft {
  const draft = adapter.createDraft(nodeId, overrides);
  return {
    ...draft,
    parentId: parentId ?? nodeId,
  } as RouteDraft;
}

export function mergeRouteDraft(
  draft: RouteDraft,
  updates: Partial<RouteEntity>,
): RouteDraft {
  return adapter.merge(draft, updates);
}

export function getRouteDraft(draft: RouteDraft): Partial<RouteEntity> {
  if (draft && typeof draft === 'object' && draft.draft && typeof draft.draft === 'object') {
    return draft.draft as Partial<RouteEntity>;
  }

  // Fallback to legacy structure where domain fields lived at the top level.
  return draft as unknown as Partial<RouteEntity>;
}
