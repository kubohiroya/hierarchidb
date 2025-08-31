import { useCallback, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import type { NodeId } from '@hierarchidb/common-type';
import type { SearchResult } from '~/types/index.js';
import {
  searchResultsAtom,
  selectedNodeIdsAtom,
  selectedResultItemsAtom,
  selectNodeAtom,
  toggleNodeSelectionAtom,
  selectRangeAtom,
  selectAllAtom,
  clearSelectionAtom,
} from '../state/index.js';

interface UseMultiSelectionProps {
  results: SearchResult[];
  onSelectionChange?: (selectedResults: SearchResult[]) => void;
  onMapFocus?: (result: SearchResult) => void;
}

interface UseMultiSelectionReturn {
  selectedResults: Set<NodeId>;
  selectedResultItems: SearchResult[];
  handleResultSelect: (result: SearchResult, isMultiSelect: boolean) => void;
  handleMapFocus: (result: SearchResult) => void;
  selectAll: () => void;
  clearSelection: () => void;
  toggleSelection: (result: SearchResult) => void;
}

export const useMultiSelection = ({
  results,
  onSelectionChange,
  onMapFocus,
}: UseMultiSelectionProps): UseMultiSelectionReturn => {
  // Atoms
  const [, setSearchResults] = useAtom(searchResultsAtom);
  const selectedResults = useAtomValue(selectedNodeIdsAtom);
  const selectedResultItems = useAtomValue(selectedResultItemsAtom);
  const selectNode = useSetAtom(selectNodeAtom);
  const toggleNodeSelection = useSetAtom(toggleNodeSelectionAtom);
  const selectRange = useSetAtom(selectRangeAtom);
  const selectAllAction = useSetAtom(selectAllAtom);
  const clearSelectionAction = useSetAtom(clearSelectionAtom);

  // 検索結果をatomに同期
  useEffect(() => {
    setSearchResults(results);
  }, [results, setSearchResults]);

  // 選択状態変更の通知
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedResultItems);
    }
  }, [selectedResultItems, onSelectionChange]);

  // 単一選択または複数選択の処理
  const handleResultSelect = useCallback(
    (result: SearchResult, isMultiSelect: boolean) => {
      if (!isMultiSelect) {
        // 通常のクリック：単一選択
        selectNode(result.nodeId);
      } else {
        // Shift/Cmd+クリック：複数選択
        if (event && (event as any).shiftKey) {
          // Shift+クリック：範囲選択
          selectRange(result.nodeId);
        } else {
          // Cmd/Ctrl+クリック：トグル選択
          toggleNodeSelection(result.nodeId);
        }
      }
    },
    [selectNode, selectRange, toggleNodeSelection]
  );

  // 地図フォーカス処理
  const handleMapFocus = useCallback(
    (result: SearchResult) => {
      if (onMapFocus) {
        onMapFocus(result);
      }
    },
    [onMapFocus]
  );

  // 全選択
  const selectAll = useCallback(() => {
    selectAllAction();
  }, [selectAllAction]);

  // 選択解除
  const clearSelection = useCallback(() => {
    clearSelectionAction();
  }, [clearSelectionAction]);

  // 個別トグル
  const toggleSelection = useCallback(
    (result: SearchResult) => {
      toggleNodeSelection(result.nodeId);
    },
    [toggleNodeSelection]
  );

  return {
    selectedResults,
    selectedResultItems,
    handleResultSelect,
    handleMapFocus,
    selectAll,
    clearSelection,
    toggleSelection,
  };
};