/**
  * Table State Atoms
  * TanStack Tableatom
 * -
 * -
  */

import { atom } from 'jotai';
import type { ColumnSizingState, SortingState } from '@tanstack/react-table';

/**
    */
export const sortingAtom = atom<SortingState>([]);

/**
    */
export const columnSizingAtom = atom<ColumnSizingState>({});
