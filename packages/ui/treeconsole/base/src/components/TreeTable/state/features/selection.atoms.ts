/**
  * Selection Feature Atoms
  * atom
 * -
 * -
 * -
  */

import { atom } from 'jotai';
import type { RowSelectionState } from '@tanstack/react-table';
import { filteredDataAtom } from '../core/data.atoms';

/**
    */
export const rowSelectionAtom = atom<RowSelectionState>({});

/**
    */
export type SelectionMode = 'none' | 'single' | 'multiple';
export const selectionModeAtom = atom<SelectionMode>('single');

/**
    */
export type RowClickAction = 'select' | 'edit' | 'navigate';
export const rowClickActionAtom = atom<RowClickAction>('select');

/**
  * ID
  */
export const selectedNodeIdsAtom = atom<string[]>((get) => {
  const selection = get(rowSelectionAtom);
  return Object.keys(selection).filter((id) => selection[id]);
});

/**
    */
export const selectedCountAtom = atom<number>((get) => {
  return get(selectedNodeIdsAtom).length;
});

/**
    */
export const clearSelectionAtom = atom(null, (_get, set) => {
  set(rowSelectionAtom, {});
});

/**
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
