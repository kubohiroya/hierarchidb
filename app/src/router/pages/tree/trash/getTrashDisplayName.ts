import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';

type TrashLikeNode = Pick<TreeNode, 'metadata' | 'originalName'> & {
  id?: NodeId | string;
};

/**
 * Resolve the user-facing label for a trashed node, preferring the
 * preserved original name when available.
 */
export function getTrashDisplayName(
  node: TrashLikeNode | HierarchicalTreeNode | undefined | null
): string {
  if (!node) return '';
  const value = (node as { originalName?: string | null }).originalName;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  const canonical = (node as { metadata?: { name?: string } }).metadata?.name ?? '';
  if (canonical.trim().length > 0) {
    return canonical;
  }
  const idRaw = 'id' in (node ?? {}) ? (node as { id?: NodeId | string }).id : undefined;
  return typeof idRaw === 'string' ? idRaw : '';
}
