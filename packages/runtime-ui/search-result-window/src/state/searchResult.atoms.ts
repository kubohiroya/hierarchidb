/**
 * Search Result State Atoms
 * 
 * 検索結果ウィンドウの状態管理用atoms
 * - 選択状態
 * - ハイライト状態
 * - 検索結果データ
 */

import { atom } from 'jotai';
import type { NodeId } from '@hierarchidb/common-type';
import type { SearchResult } from '../types/index.js';

/**
 * 検索結果データ
 */
export const searchResultsAtom = atom<SearchResult[]>([]);

/**
 * 選択されているノードのIDセット
 */
export const selectedNodeIdsAtom = atom<Set<NodeId>>(new Set<NodeId>());

/**
 * 最後に選択されたインデックス（範囲選択用）
 */
export const lastSelectedIndexAtom = atom<number>(-1);

/**
 * 現在ホバー中のインデックス（範囲選択プレビュー用）
 */
export const currentHoverIndexAtom = atom<number | null>(null);

/**
 * 選択された検索結果アイテムの配列（派生）
 */
export const selectedResultItemsAtom = atom<SearchResult[]>((get: any) => {
  const results = get(searchResultsAtom);
  const selectedIds = get(selectedNodeIdsAtom);
  return results.filter((result: any) => selectedIds.has(result.nodeId));
});

/**
 * 全選択状態（派生）
 */
export const isAllSelectedAtom = atom<boolean>((get: any) => {
  const results = get(searchResultsAtom);
  const selectedIds = get(selectedNodeIdsAtom);
  return results.length > 0 && results.every((result: any) => selectedIds.has(result.nodeId));
});

/**
 * 部分選択状態（派生）
 */
export const isSomeSelectedAtom = atom<boolean>((get: any) => {
  const results = get(searchResultsAtom);
  const selectedIds = get(selectedNodeIdsAtom);
  return results.some((result: any) => selectedIds.has(result.nodeId));
});

/**
 * 範囲選択の計算（派生）
 */
export const selectionRangeAtom = atom<Set<NodeId>>((get: any) => {
  const results = get(searchResultsAtom);
  const lastIndex = get(lastSelectedIndexAtom);
  const hoverIndex = get(currentHoverIndexAtom);
  
  if (lastIndex === -1 || hoverIndex === null) {
    return new Set();
  }
  
  const startIndex = Math.min(lastIndex, hoverIndex);
  const endIndex = Math.max(lastIndex, hoverIndex);
  
  const rangeIds = new Set<NodeId>();
  for (let i = startIndex; i <= endIndex; i++) {
    const result = results[i];
    if (result?.nodeId) {
      rangeIds.add(result.nodeId);
    }
  }
  
  return rangeIds;
});

/**
 * 単一ノード選択アクション
 */
export const selectNodeAtom = atom(
  null,
  (get: any, set: any, nodeId: NodeId) => {
    const results = get(searchResultsAtom);
    const resultIndex = results.findIndex((r: any) => r.nodeId === nodeId);
    
    set(selectedNodeIdsAtom, new Set([nodeId]));
    set(lastSelectedIndexAtom, resultIndex);
    set(currentHoverIndexAtom, null);
  }
);

/**
 * 複数ノード選択トグルアクション
 */
export const toggleNodeSelectionAtom = atom(
  null,
  (get: any, set: any, nodeId: NodeId) => {
    const currentSelection = get(selectedNodeIdsAtom);
    const results = get(searchResultsAtom);
    const resultIndex = results.findIndex((r: any) => r.nodeId === nodeId);
    
    const newSelection = new Set(currentSelection);
    if (newSelection.has(nodeId)) {
      newSelection.delete(nodeId);
    } else {
      newSelection.add(nodeId);
    }
    
    set(selectedNodeIdsAtom, newSelection);
    set(lastSelectedIndexAtom, resultIndex);
    set(currentHoverIndexAtom, null);
  }
);

/**
 * 範囲選択アクション
 */
export const selectRangeAtom = atom(
  null,
  (get: any, set: any, endNodeId: NodeId) => {
    const results = get(searchResultsAtom);
    const lastIndex = get(lastSelectedIndexAtom);
    const endIndex = results.findIndex((r: any) => r.nodeId === endNodeId);
    
    if (lastIndex === -1) {
      // 範囲選択の開始点がない場合は単一選択
      set(selectNodeAtom, endNodeId);
      return;
    }
    
    const startIndex = Math.min(lastIndex, endIndex);
    const endIndexInclusive = Math.max(lastIndex, endIndex);
    
    const rangeSelection = new Set<NodeId>();
    for (let i = startIndex; i <= endIndexInclusive; i++) {
      const result = results[i];
      if (result?.nodeId) {
        rangeSelection.add(result.nodeId);
      }
    }
    
    set(selectedNodeIdsAtom, rangeSelection);
    // lastSelectedIndexは変更しない（範囲選択の開始点を保持）
  }
);

/**
 * 全選択アクション
 */
export const selectAllAtom = atom(
  null,
  (get: any, set: any) => {
    const results = get(searchResultsAtom);
    const allIds = new Set(results.map((r: any) => r.nodeId));
    set(selectedNodeIdsAtom, allIds);
    set(lastSelectedIndexAtom, results.length - 1);
  }
);

/**
 * 選択クリアアクション
 */
export const clearSelectionAtom = atom(
  null,
  (_get: any, set: any) => {
    set(selectedNodeIdsAtom, new Set());
    set(lastSelectedIndexAtom, -1);
    set(currentHoverIndexAtom, null);
  }
);