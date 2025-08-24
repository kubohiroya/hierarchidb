/**
 * Expansion Feature Atoms
 *
 * 展開/折りたたみ機能に関するatom群
 * - 展開状態
 * - 展開アクション
 */

import { atom } from 'jotai';
import type { ExpandedState } from '@tanstack/react-table';
import { tableDataAtom } from '../core/data.atoms';

/**
 * 展開状態
 */
export const expandedAtom = atom<ExpandedState>({});

/**
 * 展開状態をトグル
 */
export const toggleExpandedAtom = atom(null, (get, set, nodeId: string) => {
  const expanded = get(expandedAtom);
  const newExpanded = { ...(expanded as Record<string, boolean>) };

  if (newExpanded[nodeId]) {
    delete newExpanded[nodeId];
  } else {
    newExpanded[nodeId] = true;
  }

  set(expandedAtom, newExpanded);
});

/**
 * すべて展開/折りたたみ
 */
export const toggleAllExpandedAtom = atom(null, (get, set) => {
  const data = get(tableDataAtom);
  const expanded = get(expandedAtom);
  const hasExpanded = Object.keys(expanded).length > 0;

  if (hasExpanded) {
    // すべて折りたたむ
    set(expandedAtom, {});
  } else {
    // すべて展開
    const newExpanded: ExpandedState = {};
    data.forEach((item) => {
      if (item.id && item.hasChildren) {
        newExpanded[item.id] = true;
      }
    });
    set(expandedAtom, newExpanded);
  }
});
