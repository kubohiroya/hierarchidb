/**
 * Sync hook that initializes view-mode atoms from TreeNode.viewProperties
 * on folder navigation and persists atom changes back to the TreeNode.
 *
 * Priority: URL params > TreeNode.viewProperties > VIEW_MODE_DEFAULTS
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { useAtom } from 'jotai';
import { useEffect, useRef } from 'react';
import type { WorkerAPIAdapter } from '~/adapters/WorkerAPIAdapter';
import {
  sortModeAtomFamily,
  viewModeAtomFamily,
  zoomLevelAtomFamily,
} from '~/state/view-mode-atoms';
import type { SortMode, ViewMode } from '~/types/view-mode-types';
import { VIEW_MODE_DEFAULTS } from '~/types/view-mode-types';

/** Debounce delay in ms for persisting atom changes to TreeNode. */
const SYNC_DEBOUNCE_MS = 300;

export interface UseViewModeSyncArgs {
  /** Current folder NodeId */
  pageNodeId: NodeId | undefined;
  /** Current folder TreeNode (for reading viewProperties) */
  pageTreeNode: TreeNode | undefined;
  /** Worker adapter for persisting changes */
  workerAdapter: WorkerAPIAdapter<unknown> | undefined;
  /** URL search params (from TanStack Router) */
  urlSearchParams?: {
    view?: string;
    sort?: string;
    zoom?: number;
  };
}

export function useViewModeSync({
  pageNodeId,
  pageTreeNode,
  workerAdapter,
  urlSearchParams,
}: UseViewModeSyncArgs): void {
  // Sentinel NodeId used when pageNodeId is undefined to avoid conditional hook calls.
  const effectiveNodeId: NodeId = pageNodeId ?? ('' as NodeId);

  const [viewMode, setViewMode] = useAtom(viewModeAtomFamily(effectiveNodeId));
  const [sortMode, setSortMode] = useAtom(sortModeAtomFamily(effectiveNodeId));
  const [zoomLevel, setZoomLevel] = useAtom(zoomLevelAtomFamily(effectiveNodeId));

  // Track whether we are currently initializing atoms to avoid writing back
  // the initial values as a "change" that triggers persistence.
  const initializingRef = useRef(false);

  // Track the debounce timer for persistence writes.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Initialization: populate atoms when pageNodeId changes ──
  useEffect(() => {
    if (!pageNodeId) return;

    initializingRef.current = true;

    const vp = pageTreeNode?.viewProperties;

    // Priority: URL params > TreeNode.viewProperties > VIEW_MODE_DEFAULTS
    const resolvedViewMode: ViewMode =
      (urlSearchParams?.view as ViewMode | undefined) ??
      vp?.viewMode ??
      VIEW_MODE_DEFAULTS.viewMode;

    const resolvedSortMode: SortMode =
      (urlSearchParams?.sort as SortMode | undefined) ??
      vp?.sortMode ??
      VIEW_MODE_DEFAULTS.sortMode;

    const resolvedZoomLevel: number =
      urlSearchParams?.zoom ?? vp?.zoomLevel ?? VIEW_MODE_DEFAULTS.zoomLevel;

    setViewMode(resolvedViewMode);
    setSortMode(resolvedSortMode);
    setZoomLevel(resolvedZoomLevel);

    // Allow a microtask for the atom setters to flush before we start
    // treating subsequent changes as user-driven.
    queueMicrotask(() => {
      initializingRef.current = false;
    });
  }, [pageNodeId, pageTreeNode, urlSearchParams, setViewMode, setSortMode, setZoomLevel]);

  // ── Persistence: write atom changes back to TreeNode ──
  useEffect(() => {
    if (!pageNodeId || !workerAdapter || initializingRef.current) return;

    // Clear any pending debounce timer.
    if (debounceTimerRef.current !== undefined) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      workerAdapter
        .updateViewProperties(pageNodeId, {
          viewMode,
          sortMode,
          zoomLevel,
        })
        .catch((error: unknown) => {
          // Per AGENTS.md: report error, retain in-memory atom state (no silent fallback).
          console.error('[useViewModeSync] Failed to persist viewProperties', error);
        });
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== undefined) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [pageNodeId, workerAdapter, viewMode, sortMode, zoomLevel]);
}
