import type { NodeId, TreeNodeMetadata } from '@hierarchidb/common-types';
import type { RouteDraft, RouteEntity } from '../entities/RouteEntity.js';

export function normalizeRouteDraft(
  routeDraft: RouteDraft | null,
  effectiveNodeId: NodeId,
): RouteDraft {
  if (!routeDraft) {
    return {
      treeNodeId: effectiveNodeId,
      draftMetadata: { name: '', description: '', tags: [] },
      draftData: {},
    } as RouteDraft;
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
  } as RouteDraft;
}

export function getRouteDraft(draft: RouteDraft): Partial<RouteEntity> {
  if (draft && typeof draft === 'object' && 'draftData' in draft && draft.draftData) {
    return draft.draftData as Partial<RouteEntity>;
  }
  return draft as unknown as Partial<RouteEntity>;
}
