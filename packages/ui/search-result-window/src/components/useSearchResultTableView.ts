import type { NodeId } from '@hierarchidb/core-types';
import { useId, useMemo } from 'react';
import type { SearchResult } from '~/types/index';
import type { SearchResultChipData } from './useSearchResultTable.js';

export interface SearchResultTableRowView {
  key: string;
  result: SearchResult;
  isSelected: boolean;
  rowChips: SearchResultChipData[];
}

export interface UseSearchResultTableViewParams {
  results: SearchResult[];
  selectedResults: Set<NodeId>;
  getRowChips: (result: SearchResult) => SearchResultChipData[];
}

export interface UseSearchResultTableViewResult {
  controlId: string;
  hasResults: boolean;
  rows: SearchResultTableRowView[];
}

export function useSearchResultTableView({
  results,
  selectedResults,
  getRowChips,
}: UseSearchResultTableViewParams): UseSearchResultTableViewResult {
  const controlId = useId();

  const rows = useMemo<SearchResultTableRowView[]>(
    () =>
      results.map((result) => ({
        key: `${result.nodeId}-${result.rowIndex || 0}`,
        result,
        isSelected: selectedResults.has(result.nodeId),
        rowChips: getRowChips(result),
      })),
    [getRowChips, results, selectedResults]
  );

  return {
    controlId,
    hasResults: results.length > 0,
    rows,
  };
}
