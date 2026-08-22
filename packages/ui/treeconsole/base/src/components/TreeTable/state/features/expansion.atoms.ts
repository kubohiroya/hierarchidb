import type { ExpandedState } from '@tanstack/react-table';
import { atom } from 'jotai';
import { tableDataAtom } from '~/components/TreeTable/state/core/data.atoms';

export const expandedAtom = atom<ExpandedState>({});
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

export const toggleAllExpandedAtom = atom(null, (get, set) => {
  const data = get(tableDataAtom);
  const expanded = get(expandedAtom);
  const hasExpanded = Object.keys(expanded).length > 0;

  if (hasExpanded) {
    set(expandedAtom, {});
  } else {
    const newExpanded: ExpandedState = {};
    data.forEach((item) => {
      if (item.id && item.hasChildren) {
        newExpanded[item.id] = true;
      }
    });
    set(expandedAtom, newExpanded);
  }
});
