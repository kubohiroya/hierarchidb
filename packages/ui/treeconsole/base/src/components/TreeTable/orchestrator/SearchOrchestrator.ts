/**
  * SearchOrchestrator
   * -
 * -
 * -
  */

import { useAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';
import type { TreeViewController } from '../../../types/index.js';
import { filteredDataAtom, searchTermAtom, tableDataAtom } from '../state/index.js';

export interface SearchOrchestratorResult {
  // State
  searchTerm: string;
  isSearching: boolean;
  resultCount: number;

  // Actions
  updateSearchTerm: (term: string) => void;
  clearSearch: () => void;
  searchWithDebounce: (term: string, delay?: number) => void;
}

/**
    */
export function useSearchOrchestrator(
  controller: TreeViewController | null,
): SearchOrchestratorResult {
  // State atoms
  const [searchTerm, setSearchTerm] = useAtom(searchTermAtom);
  const [filteredData] = useAtom(filteredDataAtom);
  const [_tableData] = useAtom(tableDataAtom);

  // Refs for debouncing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSearchingRef = useRef(false);

  /**
            */
  const updateSearchTerm = useCallback(
    (term: string) => {
      setSearchTerm(term);

      //  Controller
      if (!term) {
        controller?.handleSearchTextChange?.('');
      }
    },
    [setSearchTerm, controller],
  );

  /**
            */
  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setSearchTerm('');
    isSearchingRef.current = false;

    //  Controller
    controller?.handleSearchTextChange?.('');
  }, [setSearchTerm, controller]);

  /**
            */
  const searchWithDebounce = useCallback(
    (term: string, delay: number = 300) => {
      //  UI
      setSearchTerm(term);
      isSearchingRef.current = true;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (!term) {
        isSearchingRef.current = false;
        controller?.handleSearchTextChange?.('');
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        //  Controller
        controller?.handleSearchTextChange?.(term);
        isSearchingRef.current = false;
        debounceTimerRef.current = null;
      }, delay);
    },
    [setSearchTerm, controller],
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const resultCount = filteredData.length;

  return {
    // State
    searchTerm,
    isSearching: isSearchingRef.current,
    resultCount,

    // Actions
    updateSearchTerm,
    clearSearch,
    searchWithDebounce,
  };
}
