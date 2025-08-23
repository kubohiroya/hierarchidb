/**
 * Table State Atoms
 *
 * TanStack Tableの状態管理atom群
 * - ソート状態
 * - カラムサイズ状態
 */

import { atom } from 'jotai';
import type { SortingState, ColumnSizingState } from '@tanstack/react-table';

/**
 * ソート状態
 */
export const sortingAtom = atom<SortingState>([]);

/**
 * カラムサイズ状態
 */
export const columnSizingAtom = atom<ColumnSizingState>({});
