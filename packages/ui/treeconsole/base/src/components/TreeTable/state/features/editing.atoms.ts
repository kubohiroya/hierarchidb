/**
 * Editing Feature Atoms
 *
 * インライン編集機能に関するatom群
 * - 編集状態
 * - 編集値
 */

import { atom } from 'jotai';

/**
 * 編集中のノードID
 */
export const editingNodeIdAtom = atom<string | null>(null);

/**
 * 編集中の値
 */
export const editingValueAtom = atom<string>('');
