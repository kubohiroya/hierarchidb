/**
  * Drag & Drop Feature Atoms
  * &atom
 * -
 * -
 * -
  */

import { atom } from 'jotai';

/**
  * ID
  */
export const draggingNodeIdAtom = atom<string | null>(null);

/**
  * ID
  */
export const dropTargetNodeIdAtom = atom<string | null>(null);

/**
    */
export const forbiddenDropTargetsAtom = atom<Set<string>>(new Set<string>());
