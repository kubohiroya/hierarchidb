/**
 * Subscription Feature Atoms
 *
 * SubTree購読機能に関するatom群
 * - 購読状態
 * - 更新管理
 */

import { atom } from 'jotai';

/**
 * 現在購読中のSubTreeのルートノードID
 */
export const subscribedRootNodeIdAtom = atom<string | null>(null);

/**
 * 購読ID
 */
export const subscriptionIdAtom = atom<string | null>(null);

/**
 * 購読の深さ
 */
export const subscriptionDepthAtom = atom<number>(2);

/**
 * 最後に受信した更新のタイムスタンプ
 */
export const lastUpdateTimestampAtom = atom<number>(0);

/**
 * 保留中の更新（バッチング用）
 */
export const pendingUpdatesAtom = atom<any[]>([]);
