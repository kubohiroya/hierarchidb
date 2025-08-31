/**
 * Map Highlight State Atoms
 * 
 * 地図ハイライト機能の状態管理用atoms
 * - ハイライトされたノード
 * - ハイライトスタイル
 * - マップとの連携
 */

import { atom } from 'jotai';
import type { NodeId } from '@hierarchidb/common-type';
import type { MapHighlightStyles } from '../types/index.js';

/**
 * デフォルトスタイル
 */
const defaultStyles: MapHighlightStyles = {
  searchMatch: {
    fillColor: '#FFA500',
    fillOpacity: 0.6,
  },
  selection: {
    strokeColor: '#FF0000',
    strokeWidth: 3,
    strokeOpacity: 0.8,
  },
};

/**
 * 検索でマッチしたノードID
 */
export const searchMatchedNodeIdsAtom = atom<Set<NodeId>>(new Set<NodeId>());

/**
 * 選択されたノードID（マップ上でハイライト）
 */
export const highlightedNodeIdsAtom = atom<Set<NodeId>>(new Set<NodeId>());

/**
 * フォーカス中のノードID（マップ上でズーム）
 */
export const focusedNodeIdAtom = atom<NodeId | null>(null);

/**
 * ハイライトスタイル設定
 */
export const highlightStylesAtom = atom<MapHighlightStyles>(defaultStyles);

/**
 * マップインスタンス（地図コンポーネントとの連携用）
 */
export const mapInstanceAtom = atom<any>(null);

/**
 * ハイライト状態の統合ビュー（派生）
 */
export const mapHighlightStateAtom = atom((get: any) => ({
  searchMatched: get(searchMatchedNodeIdsAtom),
  selected: get(highlightedNodeIdsAtom),
  focused: get(focusedNodeIdAtom),
  styles: get(highlightStylesAtom),
}));

/**
 * 検索マッチノード設定アクション
 */
export const setSearchMatchedNodesAtom = atom(
  null,
  (_get: any, set: any, nodeIds: NodeId[]) => {
    set(searchMatchedNodeIdsAtom, new Set(nodeIds));
  }
);

/**
 * ハイライトノード設定アクション
 */
export const setHighlightedNodesAtom = atom(
  null,
  (_get: any, set: any, nodeIds: NodeId[]) => {
    set(highlightedNodeIdsAtom, new Set(nodeIds));
  }
);

/**
 * 検索マッチノード追加アクション
 */
export const addSearchMatchedNodeAtom = atom(
  null,
  (get: any, set: any, nodeId: NodeId) => {
    const current = get(searchMatchedNodeIdsAtom);
    const updated = new Set(current);
    updated.add(nodeId);
    set(searchMatchedNodeIdsAtom, updated);
  }
);

/**
 * ハイライトノード追加アクション
 */
export const addHighlightedNodeAtom = atom(
  null,
  (get: any, set: any, nodeId: NodeId) => {
    const current = get(highlightedNodeIdsAtom);
    const updated = new Set(current);
    updated.add(nodeId);
    set(highlightedNodeIdsAtom, updated);
  }
);

/**
 * 検索マッチノード削除アクション
 */
export const removeSearchMatchedNodeAtom = atom(
  null,
  (get: any, set: any, nodeId: NodeId) => {
    const current = get(searchMatchedNodeIdsAtom);
    const updated = new Set(current);
    updated.delete(nodeId);
    set(searchMatchedNodeIdsAtom, updated);
  }
);

/**
 * ハイライトノード削除アクション
 */
export const removeHighlightedNodeAtom = atom(
  null,
  (get: any, set: any, nodeId: NodeId) => {
    const current = get(highlightedNodeIdsAtom);
    const updated = new Set(current);
    updated.delete(nodeId);
    set(highlightedNodeIdsAtom, updated);
  }
);

/**
 * フォーカスノード設定アクション
 */
export const setFocusedNodeAtom = atom(
  null,
  (_get: any, set: any, nodeId: NodeId | null) => {
    set(focusedNodeIdAtom, nodeId);
  }
);

/**
 * ハイライトスタイル更新アクション
 */
export const updateHighlightStylesAtom = atom(
  null,
  (get: any, set: any, styles: Partial<MapHighlightStyles>) => {
    const current = get(highlightStylesAtom);
    set(highlightStylesAtom, { ...current, ...styles });
  }
);

/**
 * 全ハイライトクリアアクション
 */
export const clearAllHighlightsAtom = atom(
  null,
  (_get: any, set: any) => {
    set(searchMatchedNodeIdsAtom, new Set());
    set(highlightedNodeIdsAtom, new Set());
    set(focusedNodeIdAtom, null);
  }
);

/**
 * 検索マッチクリアアクション
 */
export const clearSearchMatchedAtom = atom(
  null,
  (_get: any, set: any) => {
    set(searchMatchedNodeIdsAtom, new Set());
  }
);

/**
 * 選択ハイライトクリアアクション
 */
export const clearHighlightedAtom = atom(
  null,
  (_get: any, set: any) => {
    set(highlightedNodeIdsAtom, new Set());
    set(focusedNodeIdAtom, null);
  }
);