/**
 * UI State Atoms
 *
 * UI状態に関するatom群
 * - ローディング状態
 * - エラー状態
 */

import { atom } from 'jotai';

/**
 * ローディング状態
 */
export const isLoadingAtom = atom<boolean>(false);

/**
 * エラー状態
 */
export const errorAtom = atom<string | null>(null);
