/**
  * Drag & Drop Feature Atoms
  * &atom
 * -
 * -
 * -
  */

import { atom } from 'jotai';
import type { NodeId } from '@hierarchidb/common-types';

/**
  * ID
  */
export const draggingNodeIdAtom = atom<NodeId | null>(null);

/**
  * ID
  */
export const dropTargetNodeIdAtom = atom<NodeId | null>(null);

/**
    */
export const forbiddenDropTargetsAtom = atom<Set<NodeId>>(new Set<NodeId>());
