import type { ColumnSizingState, SortingState } from '@tanstack/react-table';
import { atom } from 'jotai';

export const sortingAtom = atom<SortingState>([]);
export const columnSizingAtom = atom<ColumnSizingState>({});
