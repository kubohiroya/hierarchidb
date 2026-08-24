import type { NodeId } from '@hierarchidb/core-types';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { type ChangeEvent, type MouseEvent, useCallback, useEffect } from 'react';
import { clearSelectionAtom, isAllSelectedAtom, isSomeSelectedAtom, searchResultsAtom, selectAllAtom, selectNodeAtom, selectRangeAtom, toggleNodeSelectionAtom } from '~/state/searchResult.atoms';
import type { SearchResult } from '~/types/index';

export interface SearchResultChipData {
  key: string;
  label: string;
}

export interface UseSearchResultTableParams {
  results: SearchResult[];
  selectedResults: Set<NodeId>;
  onResultSelect: (result: SearchResult, isMultiSelect: boolean) => void;
  onMapFocus: (result: SearchResult) => void;
}

export interface UseSearchResultTableResult {
  selectedResults: Set<NodeId>;
  allSelected: boolean;
  someSelected: boolean;
  handleRowClick: (result: SearchResult, event: MouseEvent) => void;
  handleRowDoubleClick: (result: SearchResult) => void;
  handleSelectAll: (event: ChangeEvent<HTMLInputElement>) => void;
  getRowChips: (result: SearchResult) => SearchResultChipData[];
  getConfidenceColor: (confidence: number) => 'success.main' | 'warning.main' | 'error.main';
}

export function useSearchResultTable({
  results,
  selectedResults,
  onResultSelect,
  onMapFocus,
}: UseSearchResultTableParams): UseSearchResultTableResult {
  const [, setSearchResults] = useAtom(searchResultsAtom);
  const allSelected = useAtomValue(isAllSelectedAtom);
  const someSelected = useAtomValue(isSomeSelectedAtom);
  const selectNode = useSetAtom(selectNodeAtom);
  const toggleNodeSelection = useSetAtom(toggleNodeSelectionAtom);
  const selectRange = useSetAtom(selectRangeAtom);
  const selectAll = useSetAtom(selectAllAtom);
  const clearSelection = useSetAtom(clearSelectionAtom);

  useEffect(() => {
    setSearchResults(results);
  }, [results, setSearchResults]);

  const handleRowClick = useCallback(
    (result: SearchResult, event: MouseEvent) => {
      const isMultiSelect = event.shiftKey || event.metaKey || event.ctrlKey;
      if (!isMultiSelect) {
        selectNode(result.nodeId);
      } else if (event.shiftKey) {
        selectRange(result.nodeId);
      } else {
        toggleNodeSelection(result.nodeId);
      }
      onResultSelect(result, isMultiSelect);
    },
    [onResultSelect, selectNode, selectRange, toggleNodeSelection]
  );

  const handleRowDoubleClick = useCallback(
    (result: SearchResult) => {
      onMapFocus(result);
    },
    [onMapFocus]
  );

  const handleSelectAll = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.checked) {
        selectAll();
        results.forEach((result) => onResultSelect(result, true));
        return;
      }
      clearSelection();
      results.forEach((result) => {
        if (selectedResults.has(result.nodeId)) {
          onResultSelect(result, false);
        }
      });
    },
    [clearSelection, onResultSelect, results, selectAll, selectedResults]
  );

  const getRowChips = useCallback((result: SearchResult): SearchResultChipData[] => {
    if (!result.rowData || !result.displayColumns) {
      return [];
    }
    return result.displayColumns.slice(0, 3).flatMap((column) => {
      const value = result.rowData?.[column];
      if (value === undefined || value === null || value === '') {
        return [];
      }
      const displayValue =
        typeof value === 'object'
          ? `${JSON.stringify(value).slice(0, 20)}...`
          : String(value).slice(0, 15);
      return [{ key: column, label: `${column}:${displayValue}` }];
    });
  }, []);

  const getConfidenceColor = useCallback((confidence: number) => {
    if (confidence > 0.8) return 'success.main';
    if (confidence > 0.6) return 'warning.main';
    return 'error.main';
  }, []);

  return {
    selectedResults,
    allSelected,
    someSelected,
    handleRowClick,
    handleRowDoubleClick,
    handleSelectAll,
    getRowChips,
    getConfidenceColor,
  };
}
