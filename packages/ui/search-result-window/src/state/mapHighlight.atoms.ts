/**
  * Map Highlight State Atoms
  * atoms
 * -
 * -
 * -
  */

import { atom } from 'jotai';
import type { NodeId } from '@hierarchidb/common-types';
import type { MapHighlightStyles } from '../types/index.js';

/**
    */
const defaultStyles: MapHighlightStyles = {
  searchMatch: {
    fillColor: '#FFA500',
    fillOpacity: 0.6,
  },
  selection: {
    strokeColor: '#FF0000',
    strokeWidth: 3,
    strokeOpacity: 0.8,
  },
};

/**
  * ID
  */
export const searchMatchedNodeIdsAtom = atom<Set<NodeId>>(new Set<NodeId>());

/**
  * ID
  */
export const highlightedNodeIdsAtom = atom<Set<NodeId>>(new Set<NodeId>());

/**
  * ID
  */
export const focusedNodeIdAtom = atom<NodeId | null>(null);

/**
    */
export const highlightStylesAtom = atom<MapHighlightStyles>(defaultStyles);

/**
    */
export const mapInstanceAtom = atom<any>(null);

/**
    */
export const mapHighlightStateAtom = atom((get: any) => ({
  searchMatched: get(searchMatchedNodeIdsAtom),
  selected: get(highlightedNodeIdsAtom),
  focused: get(focusedNodeIdAtom),
  styles: get(highlightStylesAtom),
}));

/**
    */
export const setSearchMatchedNodesAtom = atom(
  null,
  (_get: any, set: any, nodeIds: NodeId[]) => {
    set(searchMatchedNodeIdsAtom, new Set(nodeIds));
  },
);

/**
    */
export const setHighlightedNodesAtom = atom(
  null,
  (_get: any, set: any, nodeIds: NodeId[]) => {
    set(highlightedNodeIdsAtom, new Set(nodeIds));
  },
);

/**
    */
export const addSearchMatchedNodeAtom = atom(
  null,
  (get: any, set: any, nodeId: NodeId) => {
    const current = get(searchMatchedNodeIdsAtom);
    const updated = new Set(current);
    updated.add(nodeId);
    set(searchMatchedNodeIdsAtom, updated);
  },
);

/**
    */
export const addHighlightedNodeAtom = atom(
  null,
  (get: any, set: any, nodeId: NodeId) => {
    const current = get(highlightedNodeIdsAtom);
    const updated = new Set(current);
    updated.add(nodeId);
    set(highlightedNodeIdsAtom, updated);
  },
);

/**
    */
export const removeSearchMatchedNodeAtom = atom(
  null,
  (get: any, set: any, nodeId: NodeId) => {
    const current = get(searchMatchedNodeIdsAtom);
    const updated = new Set(current);
    updated.delete(nodeId);
    set(searchMatchedNodeIdsAtom, updated);
  },
);

/**
    */
export const removeHighlightedNodeAtom = atom(
  null,
  (get: any, set: any, nodeId: NodeId) => {
    const current = get(highlightedNodeIdsAtom);
    const updated = new Set(current);
    updated.delete(nodeId);
    set(highlightedNodeIdsAtom, updated);
  },
);

/**
    */
export const setFocusedNodeAtom = atom(
  null,
  (_get: any, set: any, nodeId: NodeId | null) => {
    set(focusedNodeIdAtom, nodeId);
  },
);

/**
    */
export const updateHighlightStylesAtom = atom(
  null,
  (get: any, set: any, styles: Partial<MapHighlightStyles>) => {
    const current = get(highlightStylesAtom);
    set(highlightStylesAtom, { ...current, ...styles });
  },
);

/**
    */
export const clearAllHighlightsAtom = atom(
  null,
  (_get: any, set: any) => {
    set(searchMatchedNodeIdsAtom, new Set());
    set(highlightedNodeIdsAtom, new Set());
    set(focusedNodeIdAtom, null);
  },
);

/**
    */
export const clearSearchMatchedAtom = atom(
  null,
  (_get: any, set: any) => {
    set(searchMatchedNodeIdsAtom, new Set());
  },
);

/**
    */
export const clearHighlightedAtom = atom(
  null,
  (_get: any, set: any) => {
    set(highlightedNodeIdsAtom, new Set());
    set(focusedNodeIdAtom, null);
  },
);