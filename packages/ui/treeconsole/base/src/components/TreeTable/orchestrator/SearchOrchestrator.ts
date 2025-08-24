/**
 * SearchOrchestrator
 *
 * 検索に関するユーザーストーリーの管理
 * - リアルタイム検索
 * - デバウンス処理
 * - 検索結果のハイライト
 */

import { useAtom } from 'jotai';
import { useCallback, useRef, useEffect } from 'react';
import type { TreeViewController } from '../../../types/index';
import { searchTermAtom, filteredDataAtom, tableDataAtom } from '../state';

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
 * 検索操作のオーケストレーター
 */
export function useSearchOrchestrator(
  controller: TreeViewController | null
): SearchOrchestratorResult {
  // State atoms
  const [searchTerm, setSearchTerm] = useAtom(searchTermAtom);
  const [filteredData] = useAtom(filteredDataAtom);
  const [_tableData] = useAtom(tableDataAtom);

  // Refs for debouncing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSearchingRef = useRef(false);

  /**
   * 検索条件の即時更新
   */
  const updateSearchTerm = useCallback(
    (term: string) => {
      setSearchTerm(term);

      // 空文字の場合は即座にControllerに通知
      if (!term) {
        controller?.handleSearchTextChange?.('');
      }
    },
    [setSearchTerm, controller]
  );

  /**
   * 検索クリア
   */
  const clearSearch = useCallback(() => {
    // デバウンスタイマーをクリア
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setSearchTerm('');
    isSearchingRef.current = false;

    // Controllerに通知
    controller?.handleSearchTextChange?.('');
  }, [setSearchTerm, controller]);

  /**
   * デバウンス付き検索
   */
  const searchWithDebounce = useCallback(
    (term: string, delay: number = 300) => {
      // 即座にUIを更新
      setSearchTerm(term);
      isSearchingRef.current = true;

      // 既存のタイマーをクリア
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // 空文字の場合は即座に処理
      if (!term) {
        isSearchingRef.current = false;
        controller?.handleSearchTextChange?.('');
        return;
      }

      // デバウンス処理
      debounceTimerRef.current = setTimeout(() => {
        // Controllerに検索を通知
        controller?.handleSearchTextChange?.(term);
        isSearchingRef.current = false;
        debounceTimerRef.current = null;
      }, delay);
    },
    [setSearchTerm, controller]
  );

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // 結果カウント計算
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
