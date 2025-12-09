import type { ImportData, WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/common-types';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import type { TreeConsoleToolbarActionParams } from '@hierarchidb/ui-treeconsole-toolbar';
import { TreeConsoleToolbar } from '@hierarchidb/ui-treeconsole-toolbar';
import { TreeConsoleBreadcrumb } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { TreeNodeInfoPanel } from './TreeNodeInfoPanel.js';
import { TreeConsolePanelWithDynamicSpeedDial } from './TreeConsolePanelWithDynamicSpeedDial.js';
import { useLocation, useNavigate } from '@tanstack/react-router';
import type { Remote } from 'comlink';
import { proxy as comlinkProxy } from 'comlink';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notify } from '@hierarchidb/components';
import { useTranslation } from 'react-i18next';
import { convertTreeNodeToTreeNodeData } from '~/utils/treeNodeConverter.js';
import { SubscriptionCallback, Subscriptions } from '~/hooks/SubscriptionServices.ts';
import { useTreeConsoleIntegration } from '~/hooks/useTreeConsoleIntegration.ts';
import { clearAppIndexedDBsViaPlugins } from '~/plugin-host/clearIndexedDb.ts';
import { resolveDeveloperMode } from '~/utils/developerMode.ts';
import { canImportFromNode, isSubscriptionDebug, logIntegrationWarning } from './treeConsoleIntegrationUtils.js';

type TemplateNode = {
  treeNodeId: string;
  parentTreeNodeId?: string | null;
  name: string;
  treeNodeType?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

type TemplateData = {
  nodes?: Record<string, TemplateNode>;
  rootNodeIds?: string[];
};

type ImportNode = ImportData['nodes'][number];

type TreeConsolePanelProps = React.ComponentProps<typeof TreeConsolePanelWithDynamicSpeedDial>;
type TreeConsoleToolbarProps = React.ComponentProps<typeof TreeConsoleToolbar>;
type TreeConsoleBreadcrumbProps = React.ComponentProps<typeof TreeConsoleBreadcrumb>;
type TreeNodeInfoPanelProps = React.ComponentProps<typeof TreeNodeInfoPanel>;

export type UseTreeConsoleIntegrationInnerArgs = {
  client: Remote<WorkerAPI>;
  treeId?: string;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
  resetWorker: () => void;
  initializeWorker: () => Promise<void>;
};

export type UseTreeConsoleIntegrationInnerResult = {
  workerLoading: boolean;
  workerError: unknown;
  shouldRenderTreeTable: boolean;
  isDialogRoute: boolean;
  speedDialSuppressed: boolean;
  setSpeedDialSuppressed: React.Dispatch<React.SetStateAction<boolean>>;
  toolbarProps: TreeConsoleToolbarProps;
  treeConsolePanelProps: TreeConsolePanelProps;
  breadcrumbProps: TreeConsoleBreadcrumbProps;
  infoPanelProps: TreeNodeInfoPanelProps;
  resumeDialogProps: {
    open: boolean;
    nodeName: string;
    onCancel: () => void;
    onStartFresh: () => void;
    onResumePrevious: () => void;
  };
};

export function useTreeConsoleIntegrationInner({
  client: workerClient,
  treeId,
  pageNodeId,
  pageTreeNode,
  resetWorker,
  initializeWorker,
}: UseTreeConsoleIntegrationInnerArgs): UseTreeConsoleIntegrationInnerResult {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [hasTrashItems, setHasTrashItems] = useState(false);
  const [trashRootId, setTrashRootId] = useState<NodeId | null>(null);
  const trashSubRef = useRef<string | null>(null);
  const trashCallbackRef = useRef<SubscriptionCallback | null>(null);
  const trashRefreshTimerRef = useRef<number | null>(null);
  const trashRootIdRef = useRef<NodeId | null>(null);

  const {
    loading: workerLoading,
    error: workerError,
    treeData,
    nodeIndex,
    columns,
    breadcrumbItems,
    selectedIds,
    expandedIds,
    searchTerm,
    viewMode,
    canCreate,
    canEdit,
    canTrash,
    actions,
    state,
  } = useTreeConsoleIntegration({
    client: workerClient,
    treeId,
    pageNodeId,
    pageTreeNode,
    pushPath: (to: string | number) => {
      if (typeof to === 'number') {
        window.history.go(to);
        return;
      }

      if (to.startsWith('?')) {
        const nextHref = `${location.pathname}${to}`;
        navigate({ to: nextHref, replace: false });
        return;
      }

      navigate({ to, replace: false });
    },
    locationSearch: location.searchStr,
  });

  const [speedDialSuppressed, setSpeedDialSuppressed] = useState(false);
  const isDialogRoute = useMemo(() => {
    const segments = location.pathname.replace(/^\/+|\/+$/g, '').split('/');
    return segments.length >= 6 && segments[0] === 't';
  }, [location.pathname]);
  const [rowClickAction, setRowClickAction] = useState<'Select/Navigate' | 'Edit'>(
    'Select/Navigate'
  );
  const developerModeEnabled = useMemo(
    () => resolveDeveloperMode(location.searchStr),
    [location.searchStr]
  );
  const [resumeDialog, setResumeDialog] = useState<{
    open: boolean;
    nodeId: NodeId | null;
    nodeName: string;
    node?: TreeNode;
  }>({ open: false, nodeId: null, nodeName: '' });
  const [pendingEditNav, setPendingEditNav] = useState<null | (() => void)>(null);

  const handleResumeDialogClose = useCallback(() => {
    setResumeDialog({ open: false, nodeId: null, nodeName: '' });
    setPendingEditNav(null);
  }, []);

  const triggerPendingEditNavigation = useCallback(() => {
    const fn = pendingEditNav;
    setPendingEditNav(null);
    setResumeDialog({ open: false, nodeId: null, nodeName: '' });
    fn?.();
  }, [pendingEditNav]);

  const handleStartFreshDraft = useCallback(async () => {
    if (resumeDialog.nodeId && workerClient) {
      try {
        const queryAPI = await workerClient.getQueryAPI();
        const updaterAPI = await workerClient.getTreeNodeUpdaterAPI();
        const node = resumeDialog.node ?? (await queryAPI.getNode(resumeDialog.nodeId));
        if (node) {
          const nextDraftMetadata = node.metadata ?? { name: '', description: '', tags: [] };
          const rawDraftData = (node as any).draftData ?? (node as any).data ?? {};
          const nextDraftData = (rawDraftData ?? {}) as Record<string, unknown>;
          await updaterAPI.updateTreeNodeDraftMetadata(resumeDialog.nodeId, nextDraftMetadata);
          await updaterAPI.updateTreeNodeDraftData(resumeDialog.nodeId, nextDraftData);
        }
      } catch (error) {
        logIntegrationWarning('Failed to seed fresh draft before edit', error);
      }
    }
    triggerPendingEditNavigation();
  }, [resumeDialog.node, resumeDialog.nodeId, triggerPendingEditNavigation, workerClient]);

  const handleResumePreviousDraft = useCallback(() => {
    triggerPendingEditNavigation();
  }, [triggerPendingEditNavigation]);

  const requestEdit = useCallback(
    async (targetNodeId?: NodeId, nodeHint?: TreeNodeData | TreeNode) => {
      if (!workerClient || !targetNodeId) {
        actions.handleEdit?.();
        return;
      }
      try {
        const queryAPI = await workerClient.getQueryAPI();
        const target = await queryAPI.getNode(targetNodeId);
        const sourceNode = (target as TreeNode | undefined) ?? (nodeHint as TreeNode | undefined);
        if (!sourceNode) {
          actions.handleEdit?.();
          return;
        }
        const nodeData = convertTreeNodeToTreeNodeData(sourceNode);
        const navigateToEdit = () =>
          actions.handleContextMenuAction('edit', nodeData, { navigateToParent: false });
        const hasDraft = Boolean((target as any)?.draftData) || Boolean((target as any)?.draftMetadata);
        if (hasDraft) {
          setResumeDialog({
            open: true,
            nodeId: targetNodeId,
            nodeName: target?.metadata?.name ?? '',
            node: target ?? (nodeHint as TreeNode | undefined),
          });
          setPendingEditNav(() => navigateToEdit);
          return;
        }
        navigateToEdit();
      } catch (error) {
        logIntegrationWarning('Failed to check draft state before edit', error);
        actions.handleEdit?.();
      }
    },
    [actions, workerClient]
  );

  useEffect(() => {
    const checkTrashItems = async () => {
      if (workerClient && treeId) {
        const queryAPI = await workerClient.getQueryAPI();
        const tree = await queryAPI.getTree(treeId as TreeId);
        if (tree?.trashRootId) {
          const trashNodeId = tree.trashRootId as NodeId;
          setTrashRootId(trashNodeId);
          const trashChildren = await queryAPI.listChildren(trashNodeId);
          setHasTrashItems(trashChildren.length > 0);
        } else {
          setTrashRootId(null);
          setHasTrashItems(false);
        }
      }
    };
    checkTrashItems();
  }, [workerClient, treeId]);

  useEffect(() => {
    trashRootIdRef.current = trashRootId;
  }, [trashRootId]);

  useEffect(() => {
    let disposed = false;
    const setup = async () => {
      if (!workerClient || !treeId) return;
      try {
        const queryAPI = await workerClient.getQueryAPI();
        await workerClient.getSubscriptionAPI();
        const tree = await queryAPI.getTree(treeId as TreeId);
        const nextTrashRootId = tree?.trashRootId;
        if (!nextTrashRootId) {
          setTrashRootId(null);
          return;
        }
        setTrashRootId(nextTrashRootId as NodeId);

        if (trashSubRef.current && typeof nextTrashRootId === 'string') {
          if (isSubscriptionDebug()) {
            console.log('[Subscription][trash] already active', {
              trashRootId: nextTrashRootId,
              subId: trashSubRef.current,
            });
          }
        }

        const requestRefresh = () => {
          if (disposed) return;
          if (trashRefreshTimerRef.current !== null) return;
          trashRefreshTimerRef.current = window.setTimeout(async () => {
            trashRefreshTimerRef.current = null;
            try {
              const children = await queryAPI.listChildren(nextTrashRootId);
              setHasTrashItems((children?.length || 0) > 0);
            } catch (error) {
              logIntegrationWarning('Failed to refresh trash children', error);
            }
          }, 80);
        };

        requestRefresh();

        const cb = comlinkProxy((ev: unknown) => {
          if (isSubscriptionDebug()) {
            console.log('[Subscription][trash] event', ev);
          }
          requestRefresh();
        });
        trashCallbackRef.current = cb;
        const existing = Subscriptions.getActive('trash', nextTrashRootId);
        if (existing) return;
        const { subId: sid, created } = await Subscriptions.subscribe(
          'trash',
          workerClient,
          nextTrashRootId,
          cb
        );
        if (created && isSubscriptionDebug()) {
          console.log('[Subscription][trash] subscribed', { trashRootId: nextTrashRootId, subId: sid });
        }
        if (disposed) {
          await Subscriptions.release('trash', workerClient, nextTrashRootId);
          return;
        }
        trashSubRef.current = sid ?? null;
      } catch (error) {
        logIntegrationWarning('Failed to initialize trash subscription workflow', error);
      }
    };

    void setup();
    return () => {
      disposed = true;
      if (trashRefreshTimerRef.current !== null) {
        window.clearTimeout(trashRefreshTimerRef.current);
        trashRefreshTimerRef.current = null;
      }
      const cleanup = async () => {
        try {
          const queryAPI = await workerClient?.getQueryAPI();
          const tree = await queryAPI?.getTree(treeId as TreeId);
          const nextTrashRootId = tree?.trashRootId;
          if (nextTrashRootId) {
            await Subscriptions.release('trash', workerClient, nextTrashRootId);
          }
        } catch (error) {
          logIntegrationWarning('Failed to release trash subscription', error);
        }
        trashSubRef.current = null;
        trashCallbackRef.current = null;
      };
      void cleanup();
    };
  }, [workerClient, treeId]);

  const refreshWorkerRuntime = useCallback(() => {
    try {
      resetWorker();
    } catch (error) {
      logIntegrationWarning('Failed to reset worker after IndexedDB clear', error);
    }
    void initializeWorker().catch((error) => {
      logIntegrationWarning('Failed to reinitialize worker after IndexedDB clear', error);
    });
  }, [initializeWorker, resetWorker]);

  const handleIndexedDbReset = useCallback(async () => {
    if (!developerModeEnabled) return;
    const confirmMessage =
      t('treeConsole.toolbar.developerMenu.clearIndexedDbConfirm', {
        defaultValue: 'Delete all IndexedDB data created by this app?',
      }) ?? '';
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) return;
    }
    try {
      try {
        resetWorker();
      } catch (error) {
        logIntegrationWarning('Failed to reset worker before IndexedDB clear', error);
      }
      const result = await clearAppIndexedDBsViaPlugins();
      const shouldRefreshWorker = result.invoked.length > 0;
      if (shouldRefreshWorker) {
        refreshWorkerRuntime();
      }
      if (result.errors.length > 0) {
        logIntegrationWarning('IndexedDB clear encountered errors', result.errors);
        notify.error(
          t('treeConsole.toolbar.developerMenu.clearIndexedDbFailure', {
            defaultValue: 'Failed to delete IndexedDB data. See console for details.',
          })
        );
        return;
      }
      if (result.invoked.length > 0) {
        notify.success(
          t('treeConsole.toolbar.developerMenu.clearIndexedDbSuccess', {
            defaultValue: 'Deleted IndexedDB data created by this app.',
          })
        );
      } else if (result.missing.length === 0) {
        notify.info(
          t('treeConsole.toolbar.developerMenu.clearIndexedDbEmpty', {
            defaultValue: 'No IndexedDB databases were found for this app.',
          })
        );
      }
      navigate({ to: '/', replace: true });
    } catch (error) {
      logIntegrationWarning('Failed to clear IndexedDB', error);
      notify.error(
        t('treeConsole.toolbar.developerMenu.clearIndexedDbFailure', {
          defaultValue: 'Failed to delete IndexedDB data. See console for details.',
        })
      );
    }
  }, [developerModeEnabled, navigate, refreshWorkerRuntime, resetWorker, t]);

  const handleToolbarAction = useCallback(
    (action: string, params?: TreeConsoleToolbarActionParams) => {
      const currentPageNodeId = pageNodeId || 'root';

      const importTemplate = async (templateId: string) => {
        try {
          const computeBase = (): string => {
            const envBase = import.meta.env.BASE_URL || '';
            if (envBase.length > 0) return envBase;
            if (typeof document !== 'undefined' && document.baseURI) {
              try {
                return new URL(document.baseURI).pathname || '/';
              } catch (error) {
                logIntegrationWarning('Failed to parse document.baseURI for import base', error);
                return '/';
              }
            }
            return '/';
          };
          const base = computeBase().replace(/\/+$/, '/');
          const candidateBases = Array.from(new Set([base, '/hierarchidb/', '/']));

          const tryFetch = async (u: string): Promise<TemplateData> => {
            const res = await fetch(u, { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const ct = res.headers.get('content-type') || '';
            if (!/json/i.test(ct)) {
              const text = await res.text();
              if (text.trim().startsWith('<')) {
                throw new Error('NOT_JSON');
              }
              try {
                return JSON.parse(text);
              } catch {
                throw new Error('INVALID_JSON');
              }
            }
            return (await res.json()) as TemplateData;
          };

          let templateData: TemplateData | undefined;
          let lastErr: unknown;
          const candidates = ['tree-nodes.json'];
          for (const b of candidateBases) {
            for (const fname of candidates) {
              const u = `${String(b).replace(/\/+$/, '/')}templates/${templateId}/${fname}`;
              try {
                templateData = await tryFetch(u);
                break;
              } catch (e) {
                lastErr = e;
              }
            }
            if (templateData) break;
          }
          if (!templateData) {
            throw new Error(`Failed to load template: ${templateId} (${String(lastErr)})`);
          }

          const toImportNode = (n: any): ImportNode => {
            if (!n || typeof n !== 'object') throw new Error('Invalid template node');
            if (!n.metadata || typeof n.metadata !== 'object') throw new Error('Template node missing metadata');
            if (typeof n.metadata.name !== 'string' || n.metadata.name.trim().length === 0) {
              throw new Error('Template node missing metadata.name');
            }
            const name = n.metadata.name as string;
            const description =
              typeof n.metadata.description === 'string' ? (n.metadata.description as string) : undefined;
            const children = Array.isArray(n.children)
              ? n.children.map((c: any) => toImportNode(c)).filter(Boolean)
              : undefined;
            return {
              name,
              nodeType: (n.nodeType ?? n.treeNodeType ?? 'folder') as NodeType,
              description,
              metadata: n.metadata,
              draftMetadata: n.draftMetadata,
              draftData: n.draftData,
              data: n.data,
              children: children && children.length ? children : undefined,
            };
          };

          if (!Array.isArray(templateData.nodes)) {
            throw new Error('Template nodes must be an array with nested children.');
          }

          const importNodes: ImportData['nodes'] = templateData.nodes.map((n) => toImportNode(n));

          if (!workerClient) throw new Error('Worker client not ready');
          const importExportAPI = await workerClient.getImportExportAPI();
          await importExportAPI.importNodes({
            treeId: (treeId as TreeId) || ('' as TreeId),
            targetParentId: currentPageNodeId as NodeId,
            data: { nodes: importNodes },
            format: 'json',
            conflictResolution: 'rename',
          });

          await actions.handleRefresh?.();
        } catch (error) {
          logIntegrationWarning('Import template handler failed', error);
          const hint =
            ' If this is a dev build under a sub-path, set VITE_APP_NAME=hierarchidb and restart dev server.';
          try {
            alert(`Import Template failed: ${String(error)}${hint}`);
          } catch (alertError) {
            logIntegrationWarning('Failed to alert template import failure', alertError);
          }
        }
      };

      const normalizedAction = action === 'remove' ? 'trash' : action;

      switch (normalizedAction) {
        case 'setRowClickAction':
          if (typeof params === 'string') {
            setRowClickAction(params === 'Edit' ? 'Edit' : 'Select/Navigate');
          }
          break;
        case 'import-template':
          if (
            params &&
            typeof params === 'object' &&
            'templateId' in params &&
            typeof params.templateId === 'string'
          ) {
            void importTemplate(params.templateId);
          }
          break;
        case 'restore': {
          if (!treeId) break;
          const resolvedTrashNodeId =
            params && typeof params === 'object' && 'trashNodeId' in params && params.trashNodeId
              ? params.trashNodeId
              : (trashRootIdRef.current ?? (treeId ? `${treeId}:trash` : 'trash'));
          navigate({
            to: `/t/${treeId}/${currentPageNodeId}/${resolvedTrashNodeId}/trash/restore`,
          });
          break;
        }
        case 'empty': {
          if (!treeId) break;
          const resolvedTrashNodeId =
            params && typeof params === 'object' && 'trashNodeId' in params && params.trashNodeId
              ? params.trashNodeId
              : (trashRootIdRef.current ?? (treeId ? `${treeId}:trash` : 'trash'));
          navigate({
            to: `/t/${treeId}/${currentPageNodeId}/${resolvedTrashNodeId}/trash/empty`,
          });
          break;
        }
        case 'edit': {
          const targetId =
            params && typeof params === 'object' && 'nodeId' in params
              ? (params.nodeId as NodeId)
              : currentPageNodeId;
          void requestEdit(targetId as NodeId, params as any);
          break;
        }
        case 'undo':
          actions.handleUndo?.();
          break;
        case 'redo':
          actions.handleRedo?.();
          break;
        case 'cut':
          actions.handleCut?.();
          break;
        case 'copy':
          actions.handleCopy?.();
          break;
        case 'paste':
          actions.handlePaste?.();
          break;
        case 'duplicate':
          actions.handleDuplicate?.();
          break;
        case 'trash':
          actions.handleTrash?.();
          break;
        case 'import':
          actions.handleImport?.();
          break;
        case 'export':
          actions.handleExport?.();
          break;
        case 'clear-indexeddb':
          if (developerModeEnabled) {
            void handleIndexedDbReset();
          }
          break;
        default:
          logIntegrationWarning(
            `Unhandled toolbar action: ${normalizedAction} (raw: ${action})`,
            new Error('Unhandled action')
          );
      }
    },
    [
      pageNodeId,
      workerClient,
      treeId,
      actions,
      developerModeEnabled,
      navigate,
      requestEdit,
      handleIndexedDbReset,
    ]
  );

  const handleContextMenuAction = useCallback(
    (action: string, node: TreeNodeData, options?: { navigateToParent?: boolean }) => {
      if (action === 'edit') {
        void (async () => {
          await requestEdit(node.id as NodeId, node);
        })();
        return;
      }
      actions.handleContextMenuAction(action, node, options);
    },
    [actions, requestEdit]
  );

  const handleBreadcrumbContextAction = useCallback(
    (
      action: string,
      breadcrumbNode: {
        id?: string;
        treeNodeId?: string;
        parentId?: string | null;
        nodeType?: string;
        type?: string;
        name?: string;
        metadata?: { name?: string; description?: string; tags?: string[] };
        depth?: number;
      },
      options?: { navigateToParent?: boolean }
    ) => {
      const rawId = breadcrumbNode.id ?? breadcrumbNode.treeNodeId;
      if (!rawId) return;
      const parentFallback =
        breadcrumbNode.parentId ??
        (pageNodeId ? String(pageNodeId) : treeId ? `${treeId}:root` : null);
      const nodeData: TreeNodeData = {
        id: rawId as NodeId,
        nodeType: (breadcrumbNode.nodeType ?? breadcrumbNode.type ?? 'folder') as NodeType,
        metadata: {
          name: breadcrumbNode.metadata?.name ?? breadcrumbNode.name ?? '',
          description: breadcrumbNode.metadata?.description,
          tags: breadcrumbNode.metadata?.tags ?? [],
        },
        draftMetadata: null,
        data: null,
        draftData: null,
        parentId: parentFallback ? (parentFallback as NodeId) : (pageNodeId as NodeId | undefined),
        depth: breadcrumbNode.depth ?? 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      } as TreeNodeData;

      actions.handleContextMenuAction(action, nodeData, options);
    },
    [actions, pageNodeId, treeId]
  );

  const availableTemplateOptions = useMemo(
    () =>
      treeId === 'r'
        ? [
            {
              id: 'population-2023',
              label: 'Total Population by Country',
            },
          ]
        : [],
    [treeId]
  );

  const lowerPageNodeId = pageNodeId ? String(pageNodeId).toLowerCase() : '';
  const isTrashPage =
    pageTreeNode?.nodeType === 'trash' ||
    lowerPageNodeId.endsWith(':trash') ||
    lowerPageNodeId === 'trash';
  const shouldRenderTreeTable =
    !pageTreeNode ||
    (pageTreeNode.nodeType ?? '').toLowerCase() === 'folder' ||
    (pageTreeNode.nodeType ?? '').toLowerCase() === 'trash_highlight_placeholder';

  const toolbarProps: TreeConsoleToolbarProps = {
    isProjectsPage: pageTreeNode?.metadata?.name?.toLowerCase().includes('project'),
    isResourcesPage: pageTreeNode?.metadata?.name?.toLowerCase().includes('resource'),
    controller: {
      searchText: searchTerm,
      handleSearchTextChange: actions.handleSearchChange,
      handleSearchCommit: actions.handleSearchCommit,
    },
    hasTrashItems,
    onAction: handleToolbarAction,
    rowClickAction,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    canCopy: selectedIds.length > 0,
    canPaste: state.canPaste || false,
    canDuplicate: selectedIds.length > 0,
    canTrash,
    canRemove: canTrash,
    availableTemplates: availableTemplateOptions,
    allowImport: canImportFromNode(pageTreeNode),
    developerModeEnabled,
  } as TreeConsoleToolbarProps;

  const treeConsolePanelProps: TreeConsolePanelProps = {
    treeId: treeId as TreeId,
    workerClient,
    title: `Tree: ${pageTreeNode?.metadata?.name || 'Root'}`,
    pageNodeId,
    pageTreeNode,
    data: [...treeData],
    nodeIndex,
    columnsDeprecated: columns,
    breadcrumbItems,
    loading: state.loading,
    error: state.error || undefined,
    selectedIds,
    expandedIds,
    searchTerm,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
    filterBy: state.filterBy,
    availableFilters: state.availableFilters,
    viewMode,
    rowClickAction,
    canCreate,
    canEdit,
    canTrash,
    showNavigationButtons: true,
    dense: false,
    onNodeClick: actions.handleNodeClick,
    onNodeSelect: actions.handleNodeSelect,
    onNodeExpand: actions.handleNodeExpand,
    onSearchChange: actions.handleSearchChange,
    onSearchClear: actions.handleSearchClear,
    onCreate: actions.handleCreate,
    onEdit: actions.handleEdit,
    onDelete: actions.handleTrash,
    onRefresh: actions.handleRefresh,
    onExpandAll: actions.handleExpandAll,
    onCollapseAll: actions.handleCollapseAll,
    onSort: actions.handleSort,
    onFilterChange: actions.handleFilterChange,
    onViewModeChange: actions.handleViewModeChange,
    onBreadcrumbNavigate: actions.handleBreadcrumbNavigate,
    onNavigateBack: actions.handleNavigateBack,
    onNavigateForward: actions.handleNavigateForward,
    canGoBack: state.canGoBack,
    canGoForward: state.canGoForward,
    onContextMenuAction: handleContextMenuAction,
    onBreadcrumbContextAction: handleBreadcrumbContextAction,
    onMoveNodes: actions.handleMoveNodes,
    useTrashColumns: isTrashPage,
    speedDialSuppressed,
    setSpeedDialSuppressed,
    isDialogRoute,
  } as TreeConsolePanelProps;

  const breadcrumbProps: TreeConsoleBreadcrumbProps = {
    nodePath: breadcrumbItems,
    onNodeClick: actions.handleBreadcrumbNavigate,
    treeId,
    pageNodeId,
    useTrashColumns: isTrashPage,
    iconInteractive: !isTrashPage,
    onContextAction: handleBreadcrumbContextAction,
  } as TreeConsoleBreadcrumbProps;

  const infoPanelProps: TreeNodeInfoPanelProps = {
    treeId: treeId as TreeId | undefined,
    node: pageTreeNode,
    onContextMenuAction: handleContextMenuAction,
  } as TreeNodeInfoPanelProps;

  const resumeDialogProps = {
    open: resumeDialog.open,
    nodeName: resumeDialog.nodeName,
    onCancel: handleResumeDialogClose,
    onStartFresh: handleStartFreshDraft,
    onResumePrevious: handleResumePreviousDraft,
  };

  return {
    workerLoading,
    workerError,
    shouldRenderTreeTable,
    isDialogRoute,
    speedDialSuppressed,
    setSpeedDialSuppressed,
    toolbarProps,
    treeConsolePanelProps,
    breadcrumbProps,
    infoPanelProps,
    resumeDialogProps,
  };
}
