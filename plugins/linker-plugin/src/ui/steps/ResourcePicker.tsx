import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';
import type { TreeQueryAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-types';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import { DualKeyMap } from '@hierarchidb/util';
import { ArrowBack as BackIcon, ArrowForward as ForwardIcon, ExpandMore as ExpandIcon, ExpandLess as CollapseIcon, Search as SearchIcon } from '@mui/icons-material';
import { useTranslation } from '../../common/i18n/index.js';
// Use TreeConsolePanel in readonly + multi-select mode (same基盤 as TrashBin)
// Avoid static import to keep this plugin decoupled from host bundling; read from app global if provided
type Row = { id: string; name: string; nodeType?: string; hasChildren?: boolean; depth: number };
type BreadcrumbItem = { id: string; name: string };
type TreeConsolePanelProps = {
  title: string;
  treeId: string;
  data: Row[];
  pageNodeId?: string;
  nodeIndex: DualKeyMap<NodeId, NodeId, TreeNode>;
  columns: { id: string; label: string }[];
  breadcrumbItems: BreadcrumbItem[];
  loading: boolean;
  error?: string;
  selectedIds: string[];
  expandedIds: string[];
  searchTerm: string;
  availableFilters: unknown[];
  viewMode: 'list' | 'grid';
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  showNavigationButtons: boolean;
  onNodeSelect: (_ids: string[], _isSel: boolean) => void;
  onNodeExpand: (_id: string, _isExp: boolean) => void;
  onSearchChange: (_t: string) => void;
  onSearchClear: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onBreadcrumbNavigate: (_nodeId: string) => Promise<void> | void;
  onNavigateBack: () => Promise<void> | void;
  onNavigateForward: () => Promise<void> | void;
  onContextMenuAction: () => void;
  onCreate: () => void; onEdit: () => void; onDelete: () => void; onRefresh: () => void;
  onSort: () => void; onFilterChange: () => void; onViewModeChange: () => void;
  renderBuiltInSpeedDial: boolean;
  rowClickAction: 'Select/Navigate' | 'None';
};

const injected = (typeof window !== 'undefined' ? (window as { __HDB_TreeConsolePanel?: React.FC<TreeConsolePanelProps> }).__HDB_TreeConsolePanel : undefined);
const TreeConsolePanel: React.FC<TreeConsolePanelProps> = injected ?? (() => null);

export type ResourceSummary = { nodeId: string; nodeType?: string; name?: string };

export interface ResourcePickerProps {
  value?: Set<string>;
  onChange: (_setLike: Set<string>) => void;
  notice?: string;
}

export const ResourcePicker: React.FC<ResourcePickerProps> = ({ value, onChange, notice }) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(value || new Set<string>());
  const [expanded, setExpanded] = useState<Set<string>>(new Set<string>());
  const [searchTerm, setSearchTerm] = useState('');
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const backStack = useRef<{ id: string; path: BreadcrumbItem[] }[]>([]);
  const fwdStack = useRef<{ id: string; path: BreadcrumbItem[] }[]>([]);
  const [treeData, setTreeData] = useState<Row[]>([]);
  // currentParentId は現状未使用のため保持しない
  const cacheRef = useRef<Map<string, Row[]>>(new Map());
  const setsRef = useRef<{ ancestor:Set<string>; self:Set<string>; selfClosure:Set<string>; descendant:Set<string> }>({ ancestor:new Set(), self:new Set(), selfClosure:new Set(), descendant:new Set() });

  // selection handler は TreeConsolePanel の onNodeSelect を使用

  const handleExpandAll = useCallback(() => {
    const allIds = treeData.map((n) => String(n.id));
    setExpanded(new Set<string>(allIds));
  }, [treeData]);

  const handleCollapseAll = useCallback(() => { setExpanded(new Set<string>()); }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value), []);
  const handleSearchClear = useCallback(() => setSearchTerm(''), []);

  // Helpers declared before useMemo to avoid TS2454
  const toRows = (nodes: TreeNode[], depth: number): Row[] =>
    (nodes || []).map((node) => ({
      id: String(node.id),
      name: node.metadata?.name ?? '',
      nodeType: node.nodeType,
      hasChildren: Boolean(node.hasChildren),
      depth,
    }));

  const toNodeId = (value: string): NodeId => value as NodeId;
  const toTreeId = (value: string): TreeId => value as TreeId;

  const ensureChildren = useCallback(async (parentId: string) => {
    if (cacheRef.current.has(parentId)) return;
    try {
      const hook = getWorkerClientHook<WorkerClientRef>() ?? null;
      const ref = hook ? hook() : null;
      if (!ref) return;
      let query: TreeQueryAPI | null = null;
      try {
        const api = ref.getAPI();
        query = await api.getQueryAPI();
      } catch {
        return;
      }
      if (!query) return;
      const children = await query.listChildren(toNodeId(parentId));
      cacheRef.current.set(parentId, toRows(children, breadcrumb.length + 1));
    } catch { /* noop */ }
  }, [breadcrumb.length]);

  const computeSelectionSets = useCallback(async (query: TreeQueryAPI) => {
    try {
      const nodeApi = query;
      const selfSet = new Set<string>(Array.from(value || new Set<string>()));
      setsRef.current.self = selfSet;
      const closure = new Set<string>();
      for (const id of selfSet) {
        try {
          const descendants = await nodeApi.listDescendants(toNodeId(id));
          descendants?.forEach((d) => closure.add(String(d.id)));
        } catch { /* noop */ }
      }
      const ancestorLike = new Set<string>();
      const descendantLike = new Set<string>();
      setsRef.current.ancestor = ancestorLike;
      setsRef.current.descendant = descendantLike;
      setsRef.current.selfClosure = new Set<string>([...closure].filter(id => !selfSet.has(id)));
    } catch {
      setsRef.current = { ancestor:new Set(), self:new Set(value||[]), selfClosure:new Set(), descendant:new Set() };
    }
  }, [value]);

  const applySearchAndBadges = useCallback((rows: Row[]) => {
    const term = searchTerm.trim().toLowerCase();
    const { ancestor, self, selfClosure, descendant } = setsRef.current;
    const decorate = (r: Row) => {
      const id = String(r.id);
      let prefix = '';
      if (self.has(id)) prefix = '● ';
      else if (selfClosure.has(id)) prefix = '○ ';
      else if (ancestor.has(id)) prefix = '▲ ';
      else if (descendant.has(id)) prefix = '■ ';
      return { ...r, name: prefix + (r.name || '') };
    };
    const base = rows.map(decorate);
    if (!term) return base;
    return base.filter((r)=> String(r.name).toLowerCase().includes(term));
  }, [searchTerm]);

  const panelProps: TreeConsolePanelProps = useMemo(() => ({
    title: t('resourcePicker.title', 'Resources'),
    treeId: 'r',
    data: treeData,
    pageNodeId: breadcrumb.length ? String(breadcrumb[breadcrumb.length - 1]?.id) : undefined,
    nodeIndex: (() => {
      const index = new DualKeyMap<NodeId, NodeId, TreeNode>();
      const parentId = breadcrumb.length ? breadcrumb[breadcrumb.length - 1]?.id : 'root';
      treeData.forEach((row) => {
        const primary = row.id as NodeId;
        const parent = (parentId || 'root') as NodeId;
        index.set(
          primary,
          {
            id: primary,
            parentId: parent,
            nodeType: row.nodeType as TreeNode['nodeType'],
            metadata: { name: row.name },
            draftMetadata: null,
            data: null,
            draftData: null,
            depth: row.depth,
            hasChildren: row.hasChildren,
            createdAt: Date.now() as any,
            updatedAt: Date.now() as any,
            version: 1,
          } as TreeNode,
          parent
        );
      });
      return index;
    })(),
    columns: [{ id: 'name', label: t('resourcePicker.columns.name', 'Name') }],
    breadcrumbItems: breadcrumb,
    loading: false,
    error: undefined,
    selectedIds: Array.from(selected),
    expandedIds: Array.from(expanded),
    searchTerm,
    availableFilters: [],
    viewMode: 'list' as const,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    showNavigationButtons: true,
    onNodeSelect: (nodeIds: string[], isSel: boolean) => {
      const next = new Set<string>(selected);
      nodeIds.forEach((id) => {
        if (isSel) next.add(id); else next.delete(id);
      });
      setSelected(next);
      onChange(next);
    },
    onNodeExpand: (id: string, isExp: boolean) => {
      const next = new Set<string>(expanded);
      isExp ? next.add(id) : next.delete(id);
      setExpanded(next);
    },
    onSearchChange: (t: string) => setSearchTerm(t),
    onSearchClear: handleSearchClear,
    onExpandAll: handleExpandAll,
    onCollapseAll: handleCollapseAll,
    onBreadcrumbNavigate: async (nodeId: string) => {
      const idx = breadcrumb.findIndex((b)=> String(b.id)===String(nodeId));
      if (idx >= 0) setBreadcrumb(breadcrumb.slice(0, idx+1));
      await ensureChildren(String(nodeId));
      const rows = cacheRef.current.get(String(nodeId)) || [];
      setTreeData(applySearchAndBadges(rows));
    },
    onNavigateBack: async () => {
      const prev = backStack.current.pop();
      if (!prev) return;
      const last = breadcrumb[breadcrumb.length - 1];
      if (last) fwdStack.current.push({ id: String(last.id), path: [...breadcrumb] });
      setBreadcrumb(prev.path);
      await ensureChildren(String(prev.id));
      const rows = cacheRef.current.get(String(prev.id)) || [];
      setTreeData(applySearchAndBadges(rows));
    },
    onNavigateForward: async () => {
      const next = fwdStack.current.pop();
      if (!next) return;
      const last = breadcrumb[breadcrumb.length - 1];
      if (last) backStack.current.push({ id: String(last.id), path: [...breadcrumb] });
      setBreadcrumb(next.path);
      await ensureChildren(String(next.id));
      const rows = cacheRef.current.get(String(next.id)) || [];
      setTreeData(applySearchAndBadges(rows));
    },
    onContextMenuAction: () => {},
    onCreate: () => {}, onEdit: () => {}, onDelete: () => {}, onRefresh: () => {},
    onSort: () => {}, onFilterChange: () => {}, onViewModeChange: () => {},
    renderBuiltInSpeedDial: false,
    rowClickAction: 'Select/Navigate',
  }), [t, treeData, breadcrumb, selected, expanded, searchTerm, handleSearchClear, handleExpandAll, handleCollapseAll, onChange, ensureChildren, applySearchAndBadges]);

  // Load resources root and compute ancestor/self/descendant sets for badges
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const hook = getWorkerClientHook<WorkerClientRef>() ?? null;
        const ref = hook ? hook() : null;
        if (!ref) return;
        let query: TreeQueryAPI;
        try {
          const api = ref.getAPI();
          query = await api.getQueryAPI();
        } catch {
          return;
        }
        const resourcesTreeId = toTreeId('r');
        const tree = await query.getTree(resourcesTreeId);
        const rootId = tree?.rootId ? String(tree.rootId) : undefined;
        if (!rootId) return;
        // Preload ancestor/self/descendant sets for current Linker context if available
        await computeSelectionSets(query);
        // Load first level
        const children = await query.listChildren(toNodeId(rootId));
        const rows = toRows(children, 1);
        cacheRef.current.set(String(rootId), rows);
        if (!disposed) {
          setTreeData(applySearchAndBadges(rows));
          setBreadcrumb([{ id: String(rootId), name: 'Resources' }]);
        }
      } catch {
        // fallback: empty
      }
    })();
    return () => { disposed = true; };
  }, [applySearchAndBadges, computeSelectionSets]);

  

  return (
    <Box sx={{ p: 2 }}>
      {notice && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{notice}</Typography>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Legend: ● Self, ○ Self’s descendants, ▲ Ancestors’ liked, ■ Descendants’ liked
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <Tooltip title="Back"><span><IconButton size="small"><BackIcon fontSize="small"/></IconButton></span></Tooltip>
        <Tooltip title="Forward"><span><IconButton size="small"><ForwardIcon fontSize="small"/></IconButton></span></Tooltip>
        <Tooltip title="Expand all"><span><IconButton size="small" onClick={handleExpandAll}><ExpandIcon fontSize="small"/></IconButton></span></Tooltip>
        <Tooltip title="Collapse all"><span><IconButton size="small" onClick={handleCollapseAll}><CollapseIcon fontSize="small"/></IconButton></span></Tooltip>
        <TextField
          size="small"
          placeholder="Search"
          value={searchTerm}
          onChange={handleSearchChange}
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small"/></InputAdornment>) }}
        />
      </Stack>
      <TreeConsolePanel {...panelProps} />
    </Box>
  );
};
