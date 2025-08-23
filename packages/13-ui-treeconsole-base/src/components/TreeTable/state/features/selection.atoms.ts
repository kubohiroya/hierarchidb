/**
 * Selection Feature Atoms
 *
 * 選択機能に関するatom群
 * - 行選択状態
 * - 選択モード
 * - 選択アクション
 */

import { atom } from 'jotai';
import type { RowSelectionState } from '@tanstack/react-table';
import { filteredDataAtom } from '../core/data.atoms';

/**
 * 行選択状態
 */
export const rowSelectionAtom = atom<RowSelectionState>({});

/**
 * 選択モード
 */
export type SelectionMode = 'none' | 'single' | 'multiple';
export const selectionModeAtom = atom<SelectionMode>('single');

/**
 * 行クリックアクション
 */
export type RowClickAction = 'select' | 'edit' | 'navigate';
export const rowClickActionAtom = atom<RowClickAction>('select');

/**
 * 選択されたノードのID配列
 */
export const selectedNodeIdsAtom = atom<string[]>((get) => {
  const selection = get(rowSelectionAtom);
  return Object.keys(selection).filter((id) => selection[id]);
});

/**
 * 選択されたノード数
 */
export const selectedCountAtom = atom<number>((get) => {
  return get(selectedNodeIdsAtom).length;
});

/**
 * 選択状態をクリア
 */
export const clearSelectionAtom = atom(null, (_get, set) => {
  set(rowSelectionAtom, {});
});

/**
 * すべて選択
 */
export const selectAllAtom = atom(null, (get, set) => {
  const data = get(filteredDataAtom);
  const newSelection: RowSelectionState = {};
  data.forEach((item) => {
    if (item.id) {
      newSelection[item.id] = true;
    }
  });
  set(rowSelectionAtom, newSelection);
});
