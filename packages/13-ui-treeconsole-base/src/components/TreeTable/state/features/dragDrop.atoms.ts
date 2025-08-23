/**
 * Drag & Drop Feature Atoms
 *
 * ドラッグ&ドロップ機能に関するatom群
 * - ドラッグ状態
 * - ドロップターゲット
 * - 禁止リスト
 */

import { atom } from 'jotai';

/**
 * ドラッグ中のノードID
 */
export const draggingNodeIdAtom = atom<string | null>(null);

/**
 * ドラッグ可能ターゲットのID
 */
export const dropTargetNodeIdAtom = atom<string | null>(null);

/**
 * ドラッグ禁止ノードのセット
 */
export const forbiddenDropTargetsAtom = atom<Set<string>>(new Set<string>());
