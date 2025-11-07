import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { TreeNodeData } from '@hierarchidb/ui-shell/ui-treeconsole-base';

type TrashLikeNode = Pick<TreeNode, 'name'> & {
  id?: NodeId | string;
  originalName?: string | null;
};

/**
 * Resolve the user-facing label for a trashed node, preferring the
 * preserved original name when available.
 */
export function getTrashDisplayName(node: TrashLikeNode | TreeNodeData | undefined | null): string {
  if (!node) return '';
  const value = (node as { originalName?: string | null }).originalName;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  const canonical = typeof node.name === 'string' ? node.name : '';
  if (canonical.trim().length > 0) {
    return canonical;
  }
  const idRaw = 'id' in (node ?? {}) ? (node as { id?: NodeId | string }).id : undefined;
  return typeof idRaw === 'string' ? idRaw : '';
}
