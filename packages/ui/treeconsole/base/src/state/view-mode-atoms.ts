/**
 * Jotai atom families for per-folder view mode state.
 *
 * Each atom family is keyed by NodeId so that every folder maintains
 * its own independent viewMode / sortMode / zoomLevel.
 * Initial values come from VIEW_MODE_DEFAULTS.
 */

import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';

import type { NodeId } from '@hierarchidb/core-types';
import type { SortMode, ViewMode } from '~/types/view-mode-types';
import { VIEW_MODE_DEFAULTS } from '~/types/view-mode-types';

/** Per-folder viewMode atom. Initialized from TreeNode.viewProperties on navigation. */
export const viewModeAtomFamily = atomFamily((_nodeId: NodeId) =>
    atom<ViewMode>(VIEW_MODE_DEFAULTS.viewMode),
);

/** Per-folder sortMode atom. */
export const sortModeAtomFamily = atomFamily((_nodeId: NodeId) =>
    atom<SortMode>(VIEW_MODE_DEFAULTS.sortMode),
);

/** Per-folder zoomLevel atom. */
export const zoomLevelAtomFamily = atomFamily((_nodeId: NodeId) =>
    atom<number>(VIEW_MODE_DEFAULTS.zoomLevel),
);
