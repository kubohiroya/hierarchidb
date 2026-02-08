import { atom } from 'jotai';
import type { NodeId } from '@hierarchidb/core-types';

export const draggingNodeIdAtom = atom<NodeId | null>(null);
export const dropTargetNodeIdAtom = atom<NodeId | null>(null);
export const forbiddenDropTargetsAtom = atom<Set<NodeId>>(new Set<NodeId>());
