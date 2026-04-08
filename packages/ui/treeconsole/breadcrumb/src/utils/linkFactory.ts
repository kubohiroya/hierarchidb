import type { NodeId } from '@hierarchidb/core-types';

type HolderType = 'draft' | 'archive';

export interface BuildTreeConsoleLinkOptions {
  treeId?: string | null;
  nodeId: NodeId | string | number | null | undefined;
  pageNodeId?: NodeId | string | null;
  holderType?: HolderType | null;
  holderTargetId?: NodeId | string | null;
  holderMetaParentId?: NodeId | string | null;
  useArchiveColumns?: boolean;
  archiveAction?: 'restore' | 'empty';
  isRootLike?: boolean;
  /** Current view mode to preserve in navigation. */
  viewMode?: string;
  /** Current sort mode to preserve in navigation. */
  sortMode?: string;
}

/** Build the /f/ path suffix for viewMode/sortMode. */
function buildViewSuffix(viewMode?: string, sortMode?: string): string {
  const vm = viewMode || 'list';
  const sm = sortMode || 'name';
  return sm !== 'name' ? `${vm}/${sm}` : vm;
}

export function buildTreeConsoleLinkHref({
  treeId,
  nodeId,
  pageNodeId,
  holderType: _holderType,
  holderTargetId: _holderTargetId,
  holderMetaParentId,
  useArchiveColumns,
  archiveAction,
  isRootLike,
  viewMode,
  sortMode,
}: BuildTreeConsoleLinkOptions): string {
  const normalizedNodeId = nodeId == null ? '' : String(nodeId);
  const rawTreeId = treeId == null ? '' : String(treeId);
  const treeSegment = rawTreeId.includes(':') ? rawTreeId.split(':')[0] : rawTreeId;
  const normalizedTreeId = treeSegment;
  const viewSuffix = buildViewSuffix(viewMode, sortMode);

  if (isRootLike && normalizedTreeId) {
    return `/f/${normalizedTreeId}`;
  }

  if (!normalizedTreeId) {
    return `/f/${normalizedNodeId}/-/folder/${viewSuffix}`;
  }

  if (!normalizedNodeId) {
    return `/f/${normalizedTreeId}`;
  }

  const isArchiveContext = Boolean(useArchiveColumns);
  if (!isArchiveContext) {
    return `/f/${normalizedTreeId}/${normalizedNodeId}/-/folder/${viewSuffix}`;
  }

  // Archive links stay under /d/
  const rootNodeId = `${treeSegment}:root`;
  const fallbackPageNodeId = pageNodeId == null ? rootNodeId : String(pageNodeId);
  const pageSegment = holderMetaParentId == null ? fallbackPageNodeId : String(holderMetaParentId);
  const targetSegment = normalizedNodeId;
  const actionValue = archiveAction === 'empty' ? 'empty' : 'restore';

  return `/d/${[normalizedTreeId, pageSegment, targetSegment, 'archive', actionValue].join('/')}`;
}
