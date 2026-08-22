import type { NodeId } from '@hierarchidb/core-types';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import {
  clearSelectionAtom,
  searchResultsAtom,
  selectAllAtom,
  selectedNodeIdsAtom,
  selectedResultItemsAtom,
  selectNodeAtom,
  selectRangeAtom,
  toggleNodeSelectionAtom,
} from '~/state/index';
import type { SearchResult } from '~/types/index';

interface UseMultiSelectionProps {
  results: SearchResult[];
  onSelectionChange?: (selectedResults: SearchResult[]) => void;
  onMapFocus?: (result: SearchResult) => void;
}

interface SelectionModifiers {
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

interface UseMultiSelectionReturn {
  selectedResults: Set<NodeId>;
  selectedResultItems: SearchResult[];
  handleResultSelect: (result: SearchResult, modifiers?: SelectionModifiers) => void;
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

  //  atom
  useEffect(() => {
    setSearchResults(results);
  }, [results, setSearchResults]);

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedResultItems);
    }
  }, [selectedResultItems, onSelectionChange]);

  const handleResultSelect = useCallback(
    (result: SearchResult, modifiers?: SelectionModifiers) => {
      const shiftKey = modifiers?.shiftKey ?? false;
      const metaKey = modifiers?.metaKey ?? false;
      const ctrlKey = modifiers?.ctrlKey ?? false;

      if (!shiftKey && !metaKey && !ctrlKey) {
        selectNode(result.nodeId);
        return;
      }

      if (shiftKey) {
        selectRange(result.nodeId);
        return;
      }

      toggleNodeSelection(result.nodeId);
    },
    [selectNode, selectRange, toggleNodeSelection]
  );

  const handleMapFocus = useCallback(
    (result: SearchResult) => {
      if (onMapFocus) {
        onMapFocus(result);
      }
    },
    [onMapFocus]
  );

  const selectAll = useCallback(() => {
    selectAllAction();
  }, [selectAllAction]);

  const clearSelection = useCallback(() => {
    clearSelectionAction();
  }, [clearSelectionAction]);

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
