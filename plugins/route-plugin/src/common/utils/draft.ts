import type { NodeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import type { RouteUpdaterPayload, RouteEntity } from '../entities/RouteEntity.js';

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
  if (draft && typeof draft === 'object' && 'draftData' in draft && draft.draftData) {
    return draft.draftData as Partial<RouteEntity>;
  }
  return draft as unknown as Partial<RouteEntity>;
}
