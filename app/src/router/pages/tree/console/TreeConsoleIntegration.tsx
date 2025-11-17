/**
 * TreeConsole Integration Component
 *
 * Integrates TreeConsolePanel with WorkerAPIClient for console data management.
 * Avoids Orchestrated APIs as requested and focuses on direct Worker API calls.
 */

import type { ImportData, WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/common-types';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import type { TreeConsoleToolbarActionParams } from '@hierarchidb/ui-treeconsole-toolbar';
import { TreeConsoleToolbar } from '@hierarchidb/ui-treeconsole-toolbar';
import { TreeConsoleBreadcrumb } from '@hierarchidb/ui-shell/ui-treeconsole-breadcrumb';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useLocation, useNavigate } from '@tanstack/react-router';
import type { Remote } from 'comlink';
import { proxy as comlinkProxy } from 'comlink';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { notify } from '@hierarchidb/components';
import { useTranslation } from 'react-i18next';
import { TreeConsolePanelWithDynamicSpeedDial } from './TreeConsolePanelWithDynamicSpeedDial.js';
import { TreeNodeInfoPanel } from './TreeNodeInfoPanel.js';
import { SubscriptionCallback, Subscriptions } from '~/services/SubscriptionServices.ts';
import { useTreeConsoleIntegration } from '~/hooks/useTreeConsoleIntegration.ts';
import { useWorker } from '~/contexts/WorkerProvider.tsx';
import { clearAppIndexedDBs } from '~/services/clearIndexedDb.ts';
import { resolveDeveloperMode } from '~/utils/developerMode.ts';


const logIntegrationWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[TreeConsoleIntegration]', message, error);
};

const isSubscriptionDebug = (): boolean => {
  try {
    return (
      (import.meta as ImportMeta & { env?: Record<string, string> }).env
        ?.VITE_SUBSCRIPTION_DEBUG === '1'
    );
  } catch (error) {
    logIntegrationWarning('Failed to read VITE_SUBSCRIPTION_DEBUG flag', error);
    return false;
  }
};

export function canImportFromNode(node?: TreeNode | null): boolean {
  if (!node?.nodeType) {
    return true;
  }
  return node.nodeType.toLowerCase() === 'folder';
}

export interface TreeConsoleIntegrationProps {
  readonly treeId?: string;
  readonly pageNodeId?: NodeId;
  readonly pageTreeNode?: TreeNode;
}

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

// Inner component that uses the hook (client is guaranteed to be non-null)
const TreeConsoleIntegrationInner: React.FC<
  TreeConsoleIntegrationProps & { client: Remote<WorkerAPI> }
> = ({ client: workerClient, treeId, pageNodeId, pageTreeNode }) => {
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
    searchMode,
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

      // Query-only navigation (e.g. '?foo=bar')
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
  // Row Click Action state (Select | Edit | Navigate)
  const [rowClickAction, setRowClickAction] = useState<'Select/Navigate' | 'Edit'>(
    'Select/Navigate'
  );
  const developerModeEnabled = useMemo(
    () => resolveDeveloperMode(location.searchStr),
    [location.searchStr]
  );

  // Check for trash items when worker client is available
  useEffect(() => {
    const checkTrashItems = async () => {
      if (workerClient && treeId) {
        // Use facade APIs instead of deprecated direct methods
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

  // Subscribe to trash root changes and update hasTrashItems reactively
  useEffect(() => {
    let disposed = false;
    const setup = async () => {
      if (!workerClient || !treeId) return;
      try {
        const queryAPI = await workerClient.getQueryAPI();
        await workerClient.getSubscriptionAPI();
        const tree = await queryAPI.getTree(treeId as TreeId);
        const trashRootId = tree?.trashRootId;
        if (!trashRootId) {
          setTrashRootId(null);
          return;
        }
        setTrashRootId(trashRootId as NodeId);

        // Avoid duplicate subscriptions to the same trash root
        if (trashSubRef.current && typeof trashRootId === 'string') {
          // Already subscribed for this root; skip
          if (isSubscriptionDebug()) {
            console.log('[Subscription][trash] already active', {
              trashRootId,
              subId: trashSubRef.current,
            });
          }
        }

        // Debounced refresh to avoid bursty listChildren calls
        const requestRefresh = () => {
          if (disposed) return;
          if (trashRefreshTimerRef.current !== null) return;
          trashRefreshTimerRef.current = window.setTimeout(async () => {
            trashRefreshTimerRef.current = null;
            try {
              const children = await queryAPI.listChildren(trashRootId);
              setHasTrashItems((children?.length || 0) > 0);
            } catch (error) {
              logIntegrationWarning('Failed to refresh trash children', error);
            }
          }, 80);
        };

        // Initial refresh
        requestRefresh();

        // Subscribe to trash subtree notifications (worker-driven)
        const cb = comlinkProxy((ev: unknown) => {
          if (isSubscriptionDebug()) {
            console.log('[Subscription][trash] event', ev);
          }
          requestRefresh();
        });
        trashCallbackRef.current = cb;
        // Skip if already subscribed
        const existing = Subscriptions.getActive('trash', trashRootId);
        if (existing) return;
        const { subId: sid, created } = await Subscriptions.subscribe(
          'trash',
          workerClient,
          trashRootId,
          cb
        );
        if (created && isSubscriptionDebug()) {
          console.log('[Subscription][trash] subscribed', { trashRootId, subId: sid });
        }
        if (disposed) {
          await Subscriptions.release('trash', workerClient, trashRootId);
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
          const trashRootId = tree?.trashRootId;
          if (trashRootId) {
            await Subscriptions.release('trash', workerClient, trashRootId);
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
      const result = await clearAppIndexedDBs();
      if (result.errors.length > 0) {
        notify.error(
          t('treeConsole.toolbar.developerMenu.clearIndexedDbFailure', {
            defaultValue: 'Failed to delete IndexedDB data. See console for details.',
          })
        );
        return;
      }
      if (result.deleted.length > 0) {
        notify.success(
          t('treeConsole.toolbar.developerMenu.clearIndexedDbSuccess', {
            defaultValue: 'Deleted IndexedDB data created by this app.',
          })
        );
      } else {
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
  }, [developerModeEnabled, navigate, t]);

  // Handle toolbar actions
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
            // Prefer JSON path, but guard against HTML fallbacks (index.html)
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
          for (const b of candidateBases) {
            const u = `${String(b).replace(/\/+$/, '/')}templates/${templateId}/tree-nodes.json`;
            try {
              templateData = await tryFetch(u);
              break;
            } catch (e) {
              lastErr = e;
            }
          }
          if (!templateData) {
            throw new Error(`Failed to load template: ${templateId} (${String(lastErr)})`);
          }

          // Convert template structure (flat map + parent refs) to ImportData format
          const nodesMap: Record<string, TemplateNode> = templateData.nodes ?? {};
          const rootIds: string[] = templateData.rootNodeIds ?? [];

          // Build nested nodes and set depth so that
          //  - top-level imported nodes (under current page node) start at depth 1
          //  - their children are depth 2, and so on
          const buildTree = (id: string, depth: number): ImportNode | null => {
            const n = nodesMap[id];
            if (!n) return null;
            const children = Object.values(nodesMap)
              .filter((child) => child?.parentTreeNodeId === id)
              .map((child) => buildTree(child.treeNodeId, depth + 1))
              .filter((child): child is ImportNode => Boolean(child));
            return {
              name: n.name,
              nodeType: (n.treeNodeType ?? 'folder') as NodeType,
              description: n.description,
              metadata: { ...(n.metadata ?? {}), depth },
              children: children.length > 0 ? children : undefined,
            };
          };

          const importNodes: ImportData['nodes'] = rootIds
            .map((rid) => buildTree(rid, 1))
            .filter((node): node is ImportNode => node !== null);

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
    [pageNodeId, workerClient, treeId, actions, navigate, handleIndexedDbReset, developerModeEnabled]
  );

  const handleContextMenuAction = useCallback(
    (action: string, node: TreeNodeData, options?: { navigateToParent?: boolean }) => {
      actions.handleContextMenuAction(action, node, options);
    },
    [actions]
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
        name: breadcrumbNode.name ?? '',
        parentId: parentFallback ? (parentFallback as NodeId) : (pageNodeId as NodeId | undefined),
        depth: breadcrumbNode.depth ?? 1,
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

  // Handle loading state
  if (workerLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          minHeight: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Handle error state
  if (workerError) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">Failed to initialize TreeConsole: {workerError}</Alert>
      </Box>
    );
  }

  // Handle no worker client
  if (!workerClient) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">Worker client not available</Alert>
      </Box>
    );
  }

  // Compute counts for footer display
  // Removed verbose footer counts (subscription/loaded/selected) per request

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <TreeConsoleToolbar
        isProjectsPage={pageTreeNode?.name?.toLowerCase().includes('project')}
        isResourcesPage={pageTreeNode?.name?.toLowerCase().includes('resource')}
        controller={{
          searchText: searchTerm,
          searchMode,
          handleSearchTextChange: actions.handleSearchChange,
          handleSearchCommit: actions.handleSearchCommit,
          onSearchModeChange: actions.handleSearchModeChange,
        }}
        hasTrashItems={hasTrashItems}
        onAction={handleToolbarAction}
        rowClickAction={rowClickAction}
        canUndo={state.canUndo}
        canRedo={state.canRedo}
        canCopy={selectedIds.length > 0}
        canPaste={state.canPaste || false}
        canDuplicate={selectedIds.length > 0}
        canTrash={canTrash}
        canRemove={canTrash}
        availableTemplates={availableTemplateOptions}
        allowImport={canImportFromNode(pageTreeNode)}
        developerModeEnabled={developerModeEnabled}
      />

      {/* TreeConsole Panel / Node Info */}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {shouldRenderTreeTable ? (
          <TreeConsolePanelWithDynamicSpeedDial
            treeId={treeId as TreeId}
            workerClient={workerClient}
            title={`Tree: ${pageTreeNode?.name || 'Root'}`}
            pageNodeId={pageNodeId}
            pageTreeNode={pageTreeNode}
            data={[...treeData]}
            nodeIndex={nodeIndex}
            columns={columns}
            breadcrumbItems={breadcrumbItems}
            loading={state.loading}
            error={state.error || undefined}
            selectedIds={selectedIds}
            expandedIds={expandedIds}
            searchTerm={searchTerm}
            sortBy={state.sortBy}
            sortDirection={state.sortDirection}
            filterBy={state.filterBy}
            availableFilters={state.availableFilters}
            viewMode={viewMode}
            rowClickAction={rowClickAction}
            canCreate={canCreate}
            canEdit={canEdit}
            canTrash={canTrash}
            showNavigationButtons={true}
            dense={false}
            onNodeClick={actions.handleNodeClick}
            onNodeSelect={actions.handleNodeSelect}
            onNodeExpand={actions.handleNodeExpand}
            onSearchChange={actions.handleSearchChange}
            onSearchClear={actions.handleSearchClear}
            onCreate={actions.handleCreate}
            onEdit={actions.handleEdit}
            onDelete={actions.handleTrash}
            onRefresh={actions.handleRefresh}
            onExpandAll={actions.handleExpandAll}
            onCollapseAll={actions.handleCollapseAll}
            onSort={actions.handleSort}
            onFilterChange={actions.handleFilterChange}
            onViewModeChange={actions.handleViewModeChange}
            onBreadcrumbNavigate={actions.handleBreadcrumbNavigate}
            onNavigateBack={actions.handleNavigateBack}
            onNavigateForward={actions.handleNavigateForward}
            canGoBack={state.canGoBack}
            canGoForward={state.canGoForward}
            onContextMenuAction={handleContextMenuAction}
            onBreadcrumbContextAction={handleBreadcrumbContextAction}
            onMoveNodes={actions.handleMoveNodes}
            useTrashColumns={isTrashPage}
            speedDialSuppressed={speedDialSuppressed}
            setSpeedDialSuppressed={setSpeedDialSuppressed}
            isDialogRoute={isDialogRoute}
          />
        ) : (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <TreeConsoleBreadcrumb
              nodePath={breadcrumbItems}
              onNodeClick={actions.handleBreadcrumbNavigate}
              treeId={treeId}
              pageNodeId={pageNodeId}
              useTrashColumns={isTrashPage}
              iconInteractive={!isTrashPage}
              onContextAction={handleBreadcrumbContextAction}
            />
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <TreeNodeInfoPanel
                treeId={treeId as TreeId | undefined}
                node={pageTreeNode}
                onContextMenuAction={handleContextMenuAction}
              />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// Outer component that handles client loading
export const TreeConsoleIntegration: React.FC<TreeConsoleIntegrationProps> = ({
  treeId,
  pageNodeId,
  pageTreeNode,
}) => {
  // Get the Worker API client from WorkerSingletonProvider
  const { client: workerClient, isConnected } = useWorker();

  // Check connection status
  if (!isConnected || !workerClient) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%">
        <CircularProgress />
      </Box>
    );
  }

  // Render the inner component with guaranteed non-null client
  return (
    <TreeConsoleIntegrationInner
      client={workerClient}
      treeId={treeId}
      pageNodeId={pageNodeId}
      pageTreeNode={pageTreeNode}
    />
  );
};
