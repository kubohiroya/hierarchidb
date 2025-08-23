/**
 * TreeTable State Management (Simplified)
 *
 * Jotai atomsを使用したTreeTableの状態管理
 * パッケージ分離のため、簡化されたversion
 */

import { atom } from 'jotai';
import type {
  TreeNode,
  SelectionState,
  ExpansionState,
  EditingState,
  DragDropState,
  SearchState,
} from '../types';

// === Core Data Atoms ===

export const tableDataAtom = atom<TreeNode[]>([]);

export const filteredDataAtom = atom<TreeNode[]>((get) => {
  const data = get(tableDataAtom);
  const searchText = get(searchTextAtom);

  if (!searchText.trim()) {
    return data;
  }

  // Simple name-based filtering
  return data.filter((node) => node.name.toLowerCase().includes(searchText.toLowerCase()));
});

// === Selection State ===

export const selectedRowIdsAtom = atom<Set<string>>(new Set<string>());

export const selectionStateAtom = atom<SelectionState>((get) => ({
  selectedRowIds: get(selectedRowIdsAtom),
  lastSelectedId: null, // TODO: Track last selected
  selectMode: 'multiple',
}));

// === Expansion State ===

export const expandedRowIdsAtom = atom<Set<string>>(new Set<string>());

export const expansionStateAtom = atom<ExpansionState>((get) => ({
  expandedRowIds: get(expandedRowIdsAtom),
  autoExpandDepth: 0,
}));

// === Editing State ===

export const editingNodeIdAtom = atom<string | null>(null);
export const editingValueAtom = atom<string>('');

export const editingStateAtom = atom<EditingState>((get) => ({
  editingNodeId: get(editingNodeIdAtom),
  editingValue: get(editingValueAtom),
}));

// === Search State ===

export const searchTextAtom = atom<string>('');
export const searchResultsAtom = atom<Set<string>>(new Set<string>());

export const searchStateAtom = atom<SearchState>((get) => ({
  searchText: get(searchTextAtom),
  searchResults: get(searchResultsAtom),
  highlightedIndex: -1,
}));

// === Drag & Drop State ===

export const draggingNodeIdAtom = atom<string | null>(null);
export const dropTargetIdAtom = atom<string | null>(null);
export const dropPositionAtom = atom<'before' | 'after' | 'into' | null>(null);

export const dragDropStateAtom = atom<DragDropState>((get) => ({
  draggingNodeId: get(draggingNodeIdAtom),
  dropTargetId: get(dropTargetIdAtom),
  dropPosition: get(dropPositionAtom),
  isDragOver: false, // TODO: Track drag over state
}));

// === Action Atoms ===

export const toggleSelectionAtom = atom(null, (get, set, nodeId: string) => {
  const currentSelected = get(selectedRowIdsAtom);
  const newSelected = new Set(currentSelected);

  if (newSelected.has(nodeId)) {
    newSelected.delete(nodeId);
  } else {
    newSelected.add(nodeId);
  }

  set(selectedRowIdsAtom, newSelected);
});

export const toggleExpansionAtom = atom(null, (get, set, nodeId: string) => {
  const currentExpanded = get(expandedRowIdsAtom);
  const newExpanded = new Set(currentExpanded);

  if (newExpanded.has(nodeId)) {
    newExpanded.delete(nodeId);
  } else {
    newExpanded.add(nodeId);
  }

  set(expandedRowIdsAtom, newExpanded);
});

export const startEditAtom = atom(null, (_get, set, nodeId: string, initialValue: string) => {
  set(editingNodeIdAtom, nodeId);
  set(editingValueAtom, initialValue);
});

export const finishEditAtom = atom(null, (_get, set) => {
  set(editingNodeIdAtom, null);
  set(editingValueAtom, '');
});

export const setSearchTextAtom = atom(null, (_get, set, text: string) => {
  set(searchTextAtom, text);
  // TODO: Update search results based on new text
});
