import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNodeMetadata } from '@hierarchidb/tree-api';
import { RouteEntity, RouteUpdaterPayload } from '@hierarchidb/route-store';
import {
  DEFAULT_ROUTE_BUILD_CONFIG,
  mergeRouteBuildConfig,
} from '../config/buildConfig.js';
import {
  DEFAULT_ROUTE_PROCESSING_CONFIG,
  mergeRouteProcessingConfig,
} from '../config/processingConfig.js';

export function toRouteUpdaterPayload(
  routeDraft: RouteUpdaterPayload | null,
  effectiveNodeId: NodeId,
): RouteUpdaterPayload {
  if (!routeDraft) {
    return {
      treeNodeId: effectiveNodeId,
      draftMetadata: { name: '', description: '', tags: [] },
      draftData: {},
    } as RouteUpdaterPayload;
  }

  const baseMeta = (routeDraft.draftMetadata ?? {}) as Partial<TreeNodeMetadata>;
  const nextDraftMetadata: TreeNodeMetadata = {
    name: typeof baseMeta.name === 'string' ? baseMeta.name : '',
    description: typeof baseMeta.description === 'string' ? baseMeta.description : '',
    tags: Array.isArray(baseMeta.tags) ? baseMeta.tags.map(String) : [],
  };

  const nextDraftData = (routeDraft.draftData ?? {}) as Partial<RouteEntity>;

  return {
    ...routeDraft,
    treeNodeId: routeDraft.treeNodeId ?? effectiveNodeId,
    draftMetadata: nextDraftMetadata,
    draftData: nextDraftData,
  } as RouteUpdaterPayload;
}

export function getRouteUpdaterPayload(draft: RouteUpdaterPayload): Partial<RouteEntity> {
  if (
    draft &&
    typeof draft === 'object' &&
    'draftData' in draft &&
    draft.draftData &&
    typeof draft.draftData === 'object'
  ) {
    return draft.draftData as Partial<RouteEntity>;
  }
  return {};
}

type RouteDraftLike = RouteUpdaterPayload | null | undefined;

export function extractRouteEntity(data: RouteDraftLike | null | undefined): Partial<RouteEntity> {
  if (!data || typeof data !== 'object') return {};
  if ('draftData' in data && data.draftData && typeof data.draftData === 'object') {
    return data.draftData as Partial<RouteEntity>;
  }
  return {};
}

export function resolveRouteBuildConfig(data: RouteDraftLike | null | undefined) {
  const entity = extractRouteEntity(data);
  return mergeRouteBuildConfig(DEFAULT_ROUTE_BUILD_CONFIG, entity.buildConfig);
}

export function resolveRouteProcessingConfig(data: RouteDraftLike | null | undefined) {
  const entity = extractRouteEntity(data);
  return mergeRouteProcessingConfig(DEFAULT_ROUTE_PROCESSING_CONFIG, entity.processingConfig);
}

export function resolveRouteDataSourceName(data: RouteDraftLike | null | undefined): string | undefined {
  return resolveRouteBuildConfig(data).dataSourceName;
}

export function hasAnyRouteSelection(selection?: Record<string, boolean[]>): boolean {
  return Boolean(selection && Object.values(selection).some((row) => row?.some(Boolean)));
}
