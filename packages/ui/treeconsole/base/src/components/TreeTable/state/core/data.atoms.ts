/**
  * Core Data Atoms
  * atom
 * -
 * -
 * -
  */

import { atom } from 'jotai';
import type { TreeNode } from '@hierarchidb/common-types';

/**
    */
export const tableDataAtom = atom<TreeNode[]>([]);

/**
    */
export const searchTermAtom = atom<string>('');

/**
    */
export const filteredDataAtom = atom<TreeNode[]>((get) => {
  const data = get(tableDataAtom);
  const searchTerm = get(searchTermAtom);

  if (!searchTerm) return data;

  return data.filter((item) => item.name?.toLowerCase().includes(searchTerm.toLowerCase()));
});

/**
    */
export const totalCountAtom = atom<number>((get) => {
  return get(tableDataAtom).length;
});

/**
    */
export const filteredCountAtom = atom<number>((get) => {
  return get(filteredDataAtom).length;
});

/**
    */
export const isEmptyAtom = atom<boolean>((get) => {
  return get(filteredDataAtom).length === 0;
});
