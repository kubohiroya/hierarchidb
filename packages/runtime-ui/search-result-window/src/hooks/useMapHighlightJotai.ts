/**
 * Map Highlight Hook with Jotai
 * 
 * jotaiベースの地図ハイライト機能フック
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import type { NodeId } from '@hierarchidb/common-type';
import type { MapHighlightState, MapHighlightStyles } from '../types/index.js';
import {
  searchMatchedNodeIdsAtom,
  highlightedNodeIdsAtom,
  focusedNodeIdAtom,
  highlightStylesAtom,
  mapInstanceAtom,
  mapHighlightStateAtom,
  setSearchMatchedNodesAtom,
  setHighlightedNodesAtom,
  addSearchMatchedNodeAtom,
  addHighlightedNodeAtom,
  removeSearchMatchedNodeAtom,
  removeHighlightedNodeAtom,
  setFocusedNodeAtom,
  updateHighlightStylesAtom,
  clearAllHighlightsAtom,
  clearSearchMatchedAtom,
  clearHighlightedAtom,
} from '../state/index.js';

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

  // マップインスタンスの設定
  useEffect(() => {
    if (mapInstance) {
      setMapInstance(mapInstance);
    }
  }, [mapInstance, setMapInstance]);

  // 初期スタイルの設定
  useEffect(() => {
    if (initialStyles) {
      setStyles((current: any) => ({ ...current, ...initialStyles }));
    }
  }, []); // 初回のみ実行

  // 状態変更の通知
  useEffect(() => {
    if (onStateChange) {
      onStateChange(highlightState);
    }
  }, [highlightState, onStateChange]);

  // APIメソッド
  const setSearchMatched = useCallback((nodeIds: NodeId[]) => {
    setSearchMatchedNodes(nodeIds);
  }, [setSearchMatchedNodes]);

  const setSelected = useCallback((nodeIds: NodeId[]) => {
    setHighlightedNodes(nodeIds);
  }, [setHighlightedNodes]);

  const addSearchMatched = useCallback((nodeId: NodeId) => {
    addSearchMatchedNode(nodeId);
  }, [addSearchMatchedNode]);

  const addSelected = useCallback((nodeId: NodeId) => {
    addHighlightedNode(nodeId);
  }, [addHighlightedNode]);

  const removeSearchMatched = useCallback((nodeId: NodeId) => {
    removeSearchMatchedNode(nodeId);
  }, [removeSearchMatchedNode]);

  const removeSelected = useCallback((nodeId: NodeId) => {
    removeHighlightedNode(nodeId);
  }, [removeHighlightedNode]);

  const clearAll = useCallback(() => {
    clearAllHighlights();
  }, [clearAllHighlights]);

  const clearSelected = useCallback(() => {
    clearHighlighted();
  }, [clearHighlighted]);

  const setFocused = useCallback((nodeId: NodeId | null) => {
    setFocusedNode(nodeId);
  }, [setFocusedNode]);

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