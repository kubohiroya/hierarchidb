/**
 * Map Highlight Hook with Jotai
 * jotai
 */

import type { NodeId } from '@hierarchidb/core-types';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import { addHighlightedNodeAtom, addSearchMatchedNodeAtom, clearAllHighlightsAtom, clearHighlightedAtom, clearSearchMatchedAtom, highlightStylesAtom, mapHighlightStateAtom, mapInstanceAtom, removeHighlightedNodeAtom, removeSearchMatchedNodeAtom, setFocusedNodeAtom, setHighlightedNodesAtom, setSearchMatchedNodesAtom, updateHighlightStylesAtom } from '~/state/mapHighlight.atoms';
import type { MapHighlightState, MapHighlightStyles } from '~/types/index';

interface UseMapHighlightProps {
  mapInstance?: any;
  initialStyles?: Partial<MapHighlightStyles>;
  onStateChange?: (state: MapHighlightState) => void;
}

interface UseMapHighlightReturn {
  highlightState: MapHighlightState;
  setSearchMatched: (nodeIds: NodeId[]) => void;
  setSelected: (nodeIds: NodeId[]) => void;
  addSearchMatched: (nodeId: NodeId) => void;
  addSelected: (nodeId: NodeId) => void;
  removeSearchMatched: (nodeId: NodeId) => void;
  removeSelected: (nodeId: NodeId) => void;
  clearAll: () => void;
  clearSearchMatched: () => void;
  clearSelected: () => void;
  updateStyles: (styles: Partial<MapHighlightStyles>) => void;
  setFocused: (nodeId: NodeId | null) => void;
}

export const useMapHighlight = ({
  mapInstance,
  initialStyles,
  onStateChange,
}: UseMapHighlightProps): UseMapHighlightReturn => {
  // Atoms
  const [, setMapInstance] = useAtom(mapInstanceAtom);
  const [, setStyles] = useAtom(highlightStylesAtom);
  const highlightState = useAtomValue(mapHighlightStateAtom);

  // Actions
  const setSearchMatchedNodes = useSetAtom(setSearchMatchedNodesAtom);
  const setHighlightedNodes = useSetAtom(setHighlightedNodesAtom);
  const addSearchMatchedNode = useSetAtom(addSearchMatchedNodeAtom);
  const addHighlightedNode = useSetAtom(addHighlightedNodeAtom);
  const removeSearchMatchedNode = useSetAtom(removeSearchMatchedNodeAtom);
  const removeHighlightedNode = useSetAtom(removeHighlightedNodeAtom);
  const setFocusedNode = useSetAtom(setFocusedNodeAtom);
  const updateStyles = useSetAtom(updateHighlightStylesAtom);
  const clearAllHighlights = useSetAtom(clearAllHighlightsAtom);
  const clearSearchMatched = useSetAtom(clearSearchMatchedAtom);
  const clearHighlighted = useSetAtom(clearHighlightedAtom);

  useEffect(() => {
    if (mapInstance) {
      setMapInstance(mapInstance);
    }
  }, [mapInstance, setMapInstance]);

  useEffect(() => {
    if (initialStyles) {
      setStyles((current: any) => ({ ...current, ...initialStyles }));
    }
  }, []);
  useEffect(() => {
    if (onStateChange) {
      onStateChange(highlightState);
    }
  }, [highlightState, onStateChange]);

  //  API
  const setSearchMatched = useCallback(
    (nodeIds: NodeId[]) => {
      setSearchMatchedNodes(nodeIds);
    },
    [setSearchMatchedNodes]
  );

  const setSelected = useCallback(
    (nodeIds: NodeId[]) => {
      setHighlightedNodes(nodeIds);
    },
    [setHighlightedNodes]
  );

  const addSearchMatched = useCallback(
    (nodeId: NodeId) => {
      addSearchMatchedNode(nodeId);
    },
    [addSearchMatchedNode]
  );

  const addSelected = useCallback(
    (nodeId: NodeId) => {
      addHighlightedNode(nodeId);
    },
    [addHighlightedNode]
  );

  const removeSearchMatched = useCallback(
    (nodeId: NodeId) => {
      removeSearchMatchedNode(nodeId);
    },
    [removeSearchMatchedNode]
  );

  const removeSelected = useCallback(
    (nodeId: NodeId) => {
      removeHighlightedNode(nodeId);
    },
    [removeHighlightedNode]
  );

  const clearAll = useCallback(() => {
    clearAllHighlights();
  }, [clearAllHighlights]);

  const clearSelected = useCallback(() => {
    clearHighlighted();
  }, [clearHighlighted]);

  const setFocused = useCallback(
    (nodeId: NodeId | null) => {
      setFocusedNode(nodeId);
    },
    [setFocusedNode]
  );

  return {
    highlightState,
    setSearchMatched,
    setSelected,
    addSearchMatched,
    addSelected,
    removeSearchMatched,
    removeSelected,
    clearAll,
    clearSearchMatched,
    clearSelected,
    updateStyles,
    setFocused,
  };
};
