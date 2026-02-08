import { atom } from 'jotai';

export const editingNodeIdAtom = atom<string | null>(null);
export const editingValueAtom = atom<string>('');
