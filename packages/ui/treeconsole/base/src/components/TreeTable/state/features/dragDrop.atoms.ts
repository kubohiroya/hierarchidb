import type { NodeId } from '@hierarchidb/core-types';
import { atom } from 'jotai';

export const draggingNodeIdAtom = atom<NodeId | null>(null);
export const dropTargetNodeIdAtom = atom<NodeId | null>(null);
export const forbiddenDropTargetsAtom = atom<Set<NodeId>>(new Set<NodeId>());
