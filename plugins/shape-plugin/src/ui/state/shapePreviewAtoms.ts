import { atom } from 'jotai';

export const shapePreviewSearchAtom = atom<string>('');
export const shapePreviewMatchedIdsAtom = atom<string[]>([]);
export const shapePreviewSelectedIdsAtom = atom<string[]>([]);
export const shapePreviewHoveredIdAtom = atom<string | null>(null);
export const shapePreviewSelectionContextAtom = atom<{
  countryCode: string;
  adminLevel: number;
} | null>(null);
