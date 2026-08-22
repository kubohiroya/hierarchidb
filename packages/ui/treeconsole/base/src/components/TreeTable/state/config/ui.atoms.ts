/**
 * UI State Atoms
 * UIatom
 * -
 * -
 */

import { atom } from 'jotai';

export const isLoadingAtom = atom<boolean>(false);

export const errorAtom = atom<string | null>(null);
