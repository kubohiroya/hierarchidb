/**
 * Core Data Atoms
 *
 * テーブルの基本データを管理するatom群
 * - テーブルデータ
 * - フィルタリングされたデータ
 * - 派生データ
 */

import { atom } from 'jotai';
import type { TreeNode } from '@hierarchidb/00-core';

/**
 * テーブルデータ
 */
export const tableDataAtom = atom<TreeNode[]>([]);

/**
 * 検索テキスト
 */
export const searchTermAtom = atom<string>('');

/**
 * フィルタリングされたデータ
 */
export const filteredDataAtom = atom<TreeNode[]>((get) => {
  const data = get(tableDataAtom);
  const searchTerm = get(searchTermAtom);

  if (!searchTerm) return data;

  // 簡易フィルタリング実装
  return data.filter((item) => item.name?.toLowerCase().includes(searchTerm.toLowerCase()));
});

/**
 * 全ノード数
 */
export const totalCountAtom = atom<number>((get) => {
  return get(tableDataAtom).length;
});

/**
 * フィルタリングされたノード数
 */
export const filteredCountAtom = atom<number>((get) => {
  return get(filteredDataAtom).length;
});

/**
 * 空状態かどうか
 */
export const isEmptyAtom = atom<boolean>((get) => {
  return get(filteredDataAtom).length === 0;
});
