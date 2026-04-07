/**
 * console Page Route for TanStack Router
 *
 * This route handles the `/t/:treeId/:pageNodeId` path and loads the page node data.
 * It displays the TreeConsoleIntegration component with AppBar.
 * Corresponds to React Router route `t.($treeId).($pageNodeId).tsx`
 */

import { createRoute } from '@tanstack/react-router';
import { loadPageNode } from '~/router/loaders/treeLoaders';
// Import the existing React Router component to reuse
import TreePageLayout from '~/router/routes/t.($treeId).($pageNodeId)';
import { treeLayoutRoute } from './layoutRoute.js';

import type { ViewMode, SortMode } from '@hierarchidb/tree-api';

/** Parsed search params for the tree page route. */
export interface TreePageSearch {
  view?: ViewMode;
  sort?: SortMode;
  zoom?: number;
}

const VALID_VIEW_MODES: readonly string[] = ['icon', 'list', 'column'];
const VALID_SORT_MODES: readonly string[] = [
  'none', 'name', 'type', 'lastOpened', 'created', 'modified', 'size', 'tag',
];

export const treePageRoute = createRoute({
  getParentRoute: () => treeLayoutRoute,
  path: '$pageNodeId',
  shouldReload: false,
  staleTime: Infinity,
  validateSearch: (search: Record<string, unknown>): TreePageSearch => {
    const view = VALID_VIEW_MODES.includes(search.view as string)
      ? (search.view as ViewMode)
      : undefined;
    const sort = VALID_SORT_MODES.includes(search.sort as string)
      ? (search.sort as SortMode)
      : undefined;
    const zoomRaw = Number(search.zoom);
    const zoom =
      Number.isInteger(zoomRaw) && zoomRaw >= 0 && zoomRaw <= 100
        ? zoomRaw
        : undefined;
    return { view, sort, zoom };
  },
  loader: async ({ params }) => {
    const { treeId, pageNodeId } = params;
    if (!treeId) {
      throw new Error('Missing treeId parameter');
    }
    const resolvedPageNodeId = pageNodeId ?? `${treeId}:root`;
    return await loadPageNode({ treeId, pageNodeId: resolvedPageNodeId });
  },
  component: TreePageLayout,
});
