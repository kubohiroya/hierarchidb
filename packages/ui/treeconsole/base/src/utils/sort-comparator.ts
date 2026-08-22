/**
 * Sort comparator factory for TreeNodeInUI arrays.
 *
 * Accepts a SortMode and returns a comparator function suitable for Array.sort().
 * For time-based sorts (lastOpened, created, modified), sorts descending (most recent first).
 * For string sorts (name, type, tag), uses localeCompare for proper i18n ordering.
 */

import type { TreeNodeInUI } from '@hierarchidb/ui-treeconsole-treetable';
import type { SortMode } from '~/types/view-mode-types';

/**
 * Resolves the "size" of a tree node for sorting purposes.
 * Each node type (plugin) can provide its own implementation that
 * sums the persisted data size relevant to that node.
 *
 * Default implementation returns 0 for all nodes (stub).
 */
export type NodeSizeResolver = (node: TreeNodeInUI) => number;

/** Default stub that returns 0 for all nodes. */
export const DEFAULT_NODE_SIZE_RESOLVER: NodeSizeResolver = () => 0;

/**
 * Creates a comparator function for sorting TreeNodeInUI arrays
 * based on the given SortMode.
 *
 * @param sortMode - The sort mode to apply
 * @param nodeSizeResolver - Optional resolver for node size (defaults to stub returning 0)
 * @returns A comparator function `(a, b) => number`
 */
export function createSortComparator(
  sortMode: SortMode,
  nodeSizeResolver: NodeSizeResolver = DEFAULT_NODE_SIZE_RESOLVER
): (a: TreeNodeInUI, b: TreeNodeInUI) => number {
  switch (sortMode) {
    case 'none':
      return () => 0;

    case 'name':
      return (a, b) => a.metadata.name.localeCompare(b.metadata.name);

    case 'type':
      return (a, b) => a.nodeType.localeCompare(b.nodeType);

    case 'lastOpened':
      // Descending: most recent first
      return (a, b) => (b.lastTouchedAt ?? 0) - (a.lastTouchedAt ?? 0);

    case 'created':
      // Descending: most recent first
      return (a, b) => b.createdAt - a.createdAt;

    case 'modified':
      // Descending: most recent first
      return (a, b) => b.updatedAt - a.updatedAt;

    case 'size':
      // Descending: largest first
      return (a, b) => nodeSizeResolver(b) - nodeSizeResolver(a);

    case 'tag':
      return (a, b) => a.metadata.tags.join(',').localeCompare(b.metadata.tags.join(','));
  }
}
