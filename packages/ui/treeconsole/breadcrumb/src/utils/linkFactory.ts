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
  holderType,
  holderTargetId,
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

  const isTrashRow = Boolean(useTrashColumns && holderType === 'trash');
  if (!isTrashRow) {
    return `/t/${[normalizedTreeId, normalizedNodeId].join('/')}`;
  }

  const fallbackPageNodeId = pageNodeId == null ? `${normalizedTreeId}:root` : String(pageNodeId);
  const originalPageId = holderMetaParentId == null ? fallbackPageNodeId : String(holderMetaParentId);
  const trashPageNodeId = holderTargetId == null ? normalizedNodeId : String(holderTargetId);
  const actionValue = trashAction === 'empty' ? 'empty' : 'restore';

  return `/t/${[normalizedTreeId, originalPageId, trashPageNodeId, 'trash', actionValue].join('/')}`;
}
