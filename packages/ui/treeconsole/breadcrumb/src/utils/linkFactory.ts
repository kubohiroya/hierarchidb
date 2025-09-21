import type { NodeId } from '@hierarchidb/common-type';

type HolderType = 'workingCopy' | 'trash';

export interface BuildTreeConsoleLinkOptions {
  treeId?: string | null;
  nodeId: NodeId | string | number | null | undefined;
  pageNodeId?: NodeId | string | null;
  holderType?: HolderType | null;
  holderTargetId?: NodeId | string | null;
  holderMetaParentId?: NodeId | string | null;
  useTrashColumns?: boolean;
  trashAction?: 'restore' | 'empty';
  isRootLike?: boolean;
}

export function buildTreeConsoleLinkHref({
  treeId,
  nodeId,
  pageNodeId,
  holderType: _holderType,
  holderTargetId: _holderTargetId,
  holderMetaParentId,
  useTrashColumns,
  trashAction,
  isRootLike,
}: BuildTreeConsoleLinkOptions): string {
  const normalizedNodeId = nodeId == null ? '' : String(nodeId);
  const normalizedTreeId = treeId == null ? '' : String(treeId);

  if (isRootLike && normalizedTreeId) {
    return `/t/${normalizedTreeId}`;
  }

  if (!normalizedTreeId) {
    return `/t/${normalizedNodeId}`;
  }

  if (!normalizedNodeId) {
    return `/t/${normalizedTreeId}`;
  }

  const isTrashContext = Boolean(useTrashColumns);
  if (!isTrashContext) {
    return `/t/${[normalizedTreeId, normalizedNodeId].join('/')}`;
  }

  const rootSegment = `${normalizedTreeId}:root`;
  const fallbackPageNodeId = pageNodeId == null ? rootSegment : String(pageNodeId);
  const pageSegment = holderMetaParentId == null ? fallbackPageNodeId : String(holderMetaParentId);
  const targetSegment = normalizedNodeId;
  const actionValue = trashAction === 'empty' ? 'empty' : 'restore';

  return `/t/${[rootSegment, pageSegment, targetSegment, 'trash', actionValue].join('/')}`;
}
