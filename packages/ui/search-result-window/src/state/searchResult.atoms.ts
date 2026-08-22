/**
 * Search Result State Atoms
 * atoms
 * -
 * -
 * -
 */

import type { NodeId } from '@hierarchidb/core-types';
import { atom } from 'jotai';
import type { SearchResult } from '~/types/index';

/**
 */
export const searchResultsAtom = atom<SearchResult[]>([]);

/**
 * ID
 */
export const selectedNodeIdsAtom = atom<Set<NodeId>>(new Set<NodeId>());

/**
 */
export const lastSelectedIndexAtom = atom<number>(-1);

/**
 */
export const currentHoverIndexAtom = atom<number | null>(null);

/**
 */
export const selectedResultItemsAtom = atom<SearchResult[]>((get: any) => {
  const results = get(searchResultsAtom);
  const selectedIds = get(selectedNodeIdsAtom);
  return results.filter((result: any) => selectedIds.has(result.nodeId));
});

/**
 */
export const isAllSelectedAtom = atom<boolean>((get: any) => {
  const results = get(searchResultsAtom);
  const selectedIds = get(selectedNodeIdsAtom);
  return results.length > 0 && results.every((result: any) => selectedIds.has(result.nodeId));
});

/**
 */
export const isSomeSelectedAtom = atom<boolean>((get: any) => {
  const results = get(searchResultsAtom);
  const selectedIds = get(selectedNodeIdsAtom);
  return results.some((result: any) => selectedIds.has(result.nodeId));
});

/**
 */
export const selectionRangeAtom = atom<Set<NodeId>>((get: any) => {
  const results = get(searchResultsAtom);
  const lastIndex = get(lastSelectedIndexAtom);
  const hoverIndex = get(currentHoverIndexAtom);

  if (lastIndex === -1 || hoverIndex === null) {
    return new Set();
  }

  const startIndex = Math.min(lastIndex, hoverIndex);
  const endIndex = Math.max(lastIndex, hoverIndex);

  const rangeIds = new Set<NodeId>();
  for (let i = startIndex; i <= endIndex; i++) {
    const result = results[i];
    if (result?.nodeId) {
      rangeIds.add(result.nodeId);
    }
  }

  return rangeIds;
});

/**
 */
export const selectNodeAtom = atom(null, (get: any, set: any, nodeId: NodeId) => {
  const results = get(searchResultsAtom);
  const resultIndex = results.findIndex((r: any) => r.nodeId === nodeId);

  set(selectedNodeIdsAtom, new Set([nodeId]));
  set(lastSelectedIndexAtom, resultIndex);
  set(currentHoverIndexAtom, null);
});

/**
 */
export const toggleNodeSelectionAtom = atom(null, (get: any, set: any, nodeId: NodeId) => {
  const currentSelection = get(selectedNodeIdsAtom);
  const results = get(searchResultsAtom);
  const resultIndex = results.findIndex((r: any) => r.nodeId === nodeId);

  const newSelection = new Set(currentSelection);
  if (newSelection.has(nodeId)) {
    newSelection.delete(nodeId);
  } else {
    newSelection.add(nodeId);
  }

  set(selectedNodeIdsAtom, newSelection);
  set(lastSelectedIndexAtom, resultIndex);
  set(currentHoverIndexAtom, null);
});

/**
 */
export const selectRangeAtom = atom(null, (get: any, set: any, endNodeId: NodeId) => {
  const results = get(searchResultsAtom);
  const lastIndex = get(lastSelectedIndexAtom);
  const endIndex = results.findIndex((r: any) => r.nodeId === endNodeId);

  if (lastIndex === -1) {
    set(selectNodeAtom, endNodeId);
    return;
  }

  const startIndex = Math.min(lastIndex, endIndex);
  const endIndexInclusive = Math.max(lastIndex, endIndex);

  const rangeSelection = new Set<NodeId>();
  for (let i = startIndex; i <= endIndexInclusive; i++) {
    const result = results[i];
    if (result?.nodeId) {
      rangeSelection.add(result.nodeId);
    }
  }

  set(selectedNodeIdsAtom, rangeSelection);
  //  lastSelectedIndex
});

/**
 */
export const selectAllAtom = atom(null, (get: any, set: any) => {
  const results = get(searchResultsAtom);
  const allIds = new Set(results.map((r: any) => r.nodeId));
  set(selectedNodeIdsAtom, allIds);
  set(lastSelectedIndexAtom, results.length - 1);
});

/**
 */
export const clearSelectionAtom = atom(null, (_get: any, set: any) => {
  set(selectedNodeIdsAtom, new Set());
  set(lastSelectedIndexAtom, -1);
  set(currentHoverIndexAtom, null);
});
