import { useState, useCallback, useMemo } from 'react';
import type { NodeId } from '@hierarchidb/common-type';
import type { SearchResult } from '~/types/index.js';

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
  const [selectedResults, setSelectedResults] = useState<Set<NodeId>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);

  // 選択された結果アイテムの配列
  const selectedResultItems = useMemo(
    () => results.filter((result) => selectedResults.has(result.nodeId)),
    [results, selectedResults]
  );

  // 選択状態変更の通知
  const notifySelectionChange = useCallback(
    (newSelectedResults: Set<NodeId>) => {
      if (onSelectionChange) {
        const selectedItems = results.filter((result) => newSelectedResults.has(result.nodeId));
        onSelectionChange(selectedItems);
      }
    },
    [results, onSelectionChange]
  );

  // 単一選択または複数選択の処理
  const handleResultSelect = useCallback(
    (result: SearchResult, isMultiSelect: boolean) => {
      const resultIndex = results.findIndex((r) => r.nodeId === result.nodeId);

      setSelectedResults((prev) => {
        const newSelected = new Set(prev);
        const isCurrentlySelected = newSelected.has(result.nodeId);

        if (!isMultiSelect) {
          // 通常のクリック：単一選択
          newSelected.clear();
          newSelected.add(result.nodeId);
          setLastSelectedIndex(resultIndex);
        } else {
          // Shift/Cmd+クリック：複数選択
          if (event && (event as any).shiftKey && lastSelectedIndex !== -1) {
            // Shift+クリック：範囲選択
            const startIndex = Math.min(lastSelectedIndex, resultIndex);
            const endIndex = Math.max(lastSelectedIndex, resultIndex);

            for (let i = startIndex; i <= endIndex; i++) {
              if (results[i] && results[i]?.nodeId) {
                newSelected.add(results[i]?.nodeId as NodeId);
              }
            }
          } else {
            // Cmd/Ctrl+クリック：トグル選択
            if (isCurrentlySelected) {
              newSelected.delete(result.nodeId);
            } else {
              newSelected.add(result.nodeId);
            }
            setLastSelectedIndex(resultIndex);
          }
        }

        notifySelectionChange(newSelected);
        return newSelected;
      });
    },
    [results, lastSelectedIndex, notifySelectionChange]
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
    const newSelected = new Set(results.map((result) => result.nodeId));
    setSelectedResults(newSelected);
    notifySelectionChange(newSelected);
  }, [results, notifySelectionChange]);

  // 選択解除
  const clearSelection = useCallback(() => {
    const newSelected = new Set<NodeId>();
    setSelectedResults(newSelected);
    setLastSelectedIndex(-1);
    notifySelectionChange(newSelected);
  }, [notifySelectionChange]);

  // 個別トグル
  const toggleSelection = useCallback(
    (result: SearchResult) => {
      setSelectedResults((prev) => {
        const newSelected = new Set(prev);
        if (newSelected.has(result.nodeId)) {
          newSelected.delete(result.nodeId);
        } else {
          newSelected.add(result.nodeId);
        }
        notifySelectionChange(newSelected);
        return newSelected;
      });
    },
    [notifySelectionChange]
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
