import type { ImportData, WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, NodeType, TreeId, TreeNode } from '@hierarchidb/common-types';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import type { TreeConsoleToolbarActionParams } from '@hierarchidb/ui-treeconsole-toolbar';
import { TreeConsoleToolbar } from '@hierarchidb/ui-treeconsole-toolbar';
import { useCallback, useState } from 'react';
import type { Remote } from 'comlink';
import { canImportFromNode, logIntegrationWarning } from './treeConsoleIntegrationUtils.js';

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

type IntegrationActions = {
  handleUndo?: () => void;
  handleRedo?: () => void;
  handleCut?: () => void;
  handleCopy?: () => void;
  handlePaste?: () => void;
  handleDuplicate?: () => void;
  handleTrash?: () => void;
  handleImport?: () => void;
  handleExport?: () => void;
  handleRefresh?: () => void;
  handleSearchChange?: (value: string) => void;
  handleSearchCommit?: () => void;
};

type IntegrationState = {
  canUndo: boolean;
  canRedo: boolean;
  canPaste?: boolean;
  canTrash: boolean;
};

export type ToolbarControllerResult = {
  toolbarProps: React.ComponentProps<typeof TreeConsoleToolbar>;
  rowClickAction: 'Select/Navigate' | 'Edit';
  setRowClickAction: React.Dispatch<React.SetStateAction<'Select/Navigate' | 'Edit'>>;
};

export function useTreeConsoleToolbarActions({
  client,
  treeId,
  pageNodeId,
  pageTreeNode,
  hasTrashItems,
  trashRootIdRef,
  navigate,
  actions,
  state,
  availableTemplateOptions,
  developerModeEnabled,
  handleIndexedDbReset,
  requestEdit,
  searchTerm,
  selectedCount,
}: {
  client?: Remote<WorkerAPI>;
  treeId?: string;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
  hasTrashItems: boolean;
  trashRootIdRef: React.MutableRefObject<NodeId | null>;
  navigate: (args: { to: string; replace?: boolean }) => void;
  actions: IntegrationActions;
  state: IntegrationState;
  availableTemplateOptions: { id: string; label: string }[];
  developerModeEnabled: boolean;
  handleIndexedDbReset: () => void;
  requestEdit: (targetNodeId?: NodeId, nodeHint?: TreeNodeData | TreeNode) => Promise<void>;
  searchTerm: string;
  selectedCount: number;
}): ToolbarControllerResult {
  const [rowClickAction, setRowClickAction] = useState<'Select/Navigate' | 'Edit'>(
    'Select/Navigate'
  );

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

          if(!client){
            throw new Error('WorkerClient not available');
          }

          const importExportAPI = await client.getImportExportAPI();
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
      client,
      treeId,
      actions,
      developerModeEnabled,
      navigate,
      requestEdit,
      handleIndexedDbReset,
      trashRootIdRef,
    ]
  );

  const toolbarProps: React.ComponentProps<typeof TreeConsoleToolbar> = {
    isProjectsPage: pageTreeNode?.metadata?.name?.toLowerCase().includes('project'),
    isResourcesPage: pageTreeNode?.metadata?.name?.toLowerCase().includes('resource'),
    controller: {
      searchText: searchTerm,
      handleSearchTextChange: actions.handleSearchChange ?? (() => {}),
      handleSearchCommit: actions.handleSearchCommit ?? (() => {}),
    },
    hasTrashItems,
    onAction: handleToolbarAction,
    rowClickAction,
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    canCopy: selectedCount > 0,
    canPaste: state.canPaste || false,
    canDuplicate: selectedCount > 0,
    canTrash: state.canTrash,
    canRemove: state.canTrash,
    availableTemplates: availableTemplateOptions,
    allowImport: canImportFromNode(pageTreeNode),
    developerModeEnabled,
  } as React.ComponentProps<typeof TreeConsoleToolbar>;

  return { toolbarProps, rowClickAction, setRowClickAction };
}
