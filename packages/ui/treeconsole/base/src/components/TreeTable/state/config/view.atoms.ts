/**
 * View Configuration Atoms
 *
 * ビュー設定に関するatom群
 * - ビューサイズ
 * - カラム表示設定
 * - 深度設定
 */

import { atom } from 'jotai';

/**
 * ビューの高さ
 */
export const viewHeightAtom = atom<number>(400);

/**
 * ビューの幅
 */
export const viewWidthAtom = atom<number>(800);

/**
 * ゴミ箱カラム表示
 */
export const useTrashColumnsAtom = atom<boolean>(false);

/**
 * 深度オフセット
 */
export const depthOffsetAtom = atom<number>(0);
