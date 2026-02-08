import { atom } from 'jotai';

export const viewHeightAtom = atom<number>(400);

export const viewWidthAtom = atom<number>(800);

export const useTrashColumnsAtom = atom<boolean>(false);

export const depthOffsetAtom = atom<number>(0);
