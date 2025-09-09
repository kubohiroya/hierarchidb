/**
  * Editing Feature Atoms
  * atom
 * -
 * -
  */

import { atom } from 'jotai';

/**
  * ID
  */
export const editingNodeIdAtom = atom<string | null>(null);

/**
    */
export const editingValueAtom = atom<string>('');
