import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-types';
import { useTranslation } from 'react-i18next';
import { convertTreeNodeToTreeNodeData } from '~/utils/treeNodeConverter.js';
import { rainbowColors } from '@hierarchidb/ui-theme';
import {
  getPluginIconColor,
  isFolderNodeType,
} from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { useWorker } from '~/contexts/WorkerProvider.tsx';
import { Subscriptions } from '~/hooks/SubscriptionServices.ts';
import { proxy as comlinkProxy } from 'comlink';
import type {
  TreeConsolePanelProps,
  HierarchicalTreeNode,
} from '@hierarchidb/ui-treeconsole-base';
import { useTreeConsoleSSOT } from '~/state/treeconsole.atoms.ts';

type ContextMenuHandler = NonNullable<TreeConsolePanelProps['onContextMenuAction']>;

export interface UseTreeNodeInfoPanelParams {
  treeId?: TreeId;
  node?: TreeNode;
  onContextMenuAction: ContextMenuHandler;
}

export function useTreeNodeInfoPanel({
  treeId,
  node,
  onContextMenuAction,
}: UseTreeNodeInfoPanelParams) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.resolvedLanguage ?? i18n?.language ?? 'en';
  const workerCtx = useWorker();
  const workerClient = workerCtx?.client ?? null;
  const { state: ssot } = useTreeConsoleSSOT(node?.id ? String(node.id) : undefined);
  const indexedNode = useMemo(
    () => (node?.id && ssot.nodeIndex ? ssot.nodeIndex.get(node.id as NodeId) : undefined),
    [node?.id, ssot.nodeIndex]
  );
  const [currentNode, setCurrentNode] = useState<TreeNode | undefined>(node);
  const nodeData = useMemo(
    () => (currentNode ? convertTreeNodeToTreeNodeData(currentNode) : undefined),
    [currentNode]
  );
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuNode, setMenuNode] = useState<HierarchicalTreeNode | null>(nodeData ?? null);

  useEffect(() => {
    setMenuAnchorEl(null);
  }, [node?.id]);

  useEffect(() => {
    const nextNode = indexedNode ?? node;
    setCurrentNode((prev) => {
      if (!nextNode) return undefined;
      if (!prev || prev.id !== nextNode.id) return nextNode;
      if (prev === nextNode) return prev;
      if (
        prev.visible !== nextNode.visible ||
        prev.updatedAt !== nextNode.updatedAt ||
        prev.version !== nextNode.version ||
        prev.metadata?.name !== nextNode.metadata?.name ||
        prev.metadata?.description !== nextNode.metadata?.description
      ) {
        return nextNode;
      }
      return prev;
    });
  }, [indexedNode, node]);

  useEffect(() => {
    setMenuNode(nodeData ?? null);
  }, [nodeData]);

  useEffect(() => {
    if (!workerClient || !node?.id) return;
    let disposed = false;
    let subId: string | null = null;

    const cb = comlinkProxy((ev: unknown) => {
      if (disposed) return;
      const event = ev as { nodeId?: NodeId; node?: TreeNode } | null;
      if (event?.node) {
        if (event.node.id === node.id) {
          setCurrentNode(event.node);
        }
      } else if (event?.nodeId === node.id) {
        void (async () => {
          try {
            const queryAPI = await workerClient.getQueryAPI();
            const latest = await queryAPI.getNode(node.id as NodeId);
            if (!disposed && latest) setCurrentNode(latest);
          } catch (error) {
            console.warn('[TreeNodeInfoPanel] failed to refetch node on subscription event', error);
          }
        })();
      }
    });

    const setup = async () => {
      try {
        const existing = Subscriptions.getActive('page', node.id as NodeId);
        if (existing) {
          subId = existing.subId as string;
          return;
        }
        const result = await Subscriptions.subscribe('page', workerClient, node.id as NodeId, cb);
        subId = result.subId as string;
      } catch (error) {
        console.warn('[TreeNodeInfoPanel] subscription failed', error);
      }
    };

    void setup();

    return () => {
      disposed = true;
      if (subId) {
        void Subscriptions.release('page', workerClient, node.id as NodeId).catch(() => {});
      }
    };
  }, [workerClient, node]);

  const getString = useCallback(
    (key: string, defaultValue: string, options?: Record<string, unknown>) => {
      const result = t(key, { defaultValue, ...(options ?? {}) });
      if (typeof result === 'string') return result;
      if (result == null) return defaultValue;
      return String(result);
    },
    [t]
  );

  const formatTimestamp = useCallback(
    (value?: number) => {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return getString('treeConsole.infoPanel.noTimestamp', '—');
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return getString('treeConsole.infoPanel.noTimestamp', '—');
      }
      const formatter = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: locale?.startsWith('ja') ? 'numeric' : 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: locale?.startsWith('ja') ? false : undefined,
      });
      return formatter.format(date);
    },
    [getString, locale]
  );

  const handleContextMenuTrigger = useCallback(
    (action: string, options?: Parameters<ContextMenuHandler>[2]) => {
      if (!nodeData) return;
      const navigateToParent =
        options?.navigateToParent ??
        (action === 'trash' && !isFolderNodeType(nodeData.nodeType ?? ''));
      if (action === 'toggle-visibility') {
        const nextVisible =
          typeof options?.nextVisible === 'boolean'
            ? options.nextVisible
            : !((currentNode?.visible ?? true));
        setCurrentNode((prev) => (prev ? { ...prev, visible: nextVisible } : prev));
      }
      onContextMenuAction(action, nodeData, {
        navigateToParent,
        nextVisible: options?.nextVisible,
      });
    },
    [nodeData, onContextMenuAction, currentNode]
  );

  const handleIconClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!nodeData) return;
      setMenuNode(nodeData);
      setMenuAnchorEl(event.currentTarget);
    },
    [nodeData]
  );

  const handleMenuClose = useCallback(() => {
    setMenuAnchorEl(null);
  }, []);

  const description =
    (currentNode?.metadata?.description &&
      currentNode.metadata.description.trim().length > 0 &&
      currentNode.metadata.description) ||
    getString('treeConsole.infoPanel.emptyDescription', 'No description provided.') ||
    '';
  const nodeTypeLabel = currentNode?.nodeType ?? 'node';
  const nodeDataDepth = nodeData?.depth ?? node?.depth;
  const depthForColor =
    typeof nodeDataDepth === 'number' && Number.isFinite(nodeDataDepth)
      ? Math.max(0, Math.round(nodeDataDepth))
      : 0;
  const baseIconColor = rainbowColors[depthForColor % rainbowColors.length];
  const manifestIconColor = getPluginIconColor(nodeTypeLabel);
  const nodeIconColor = isFolderNodeType(nodeTypeLabel)
    ? baseIconColor
    : manifestIconColor ?? baseIconColor;
  const isRootLike =
    !currentNode?.parentId ||
    !nodeData ||
    nodeData.depth === 0 ||
    /root/i.test(currentNode?.nodeType ?? '') ||
    /trash/i.test(currentNode?.nodeType ?? '');
  const canMutate = !isRootLike;
  const isDraft = Boolean(currentNode?.draftData);

  const labels = {
    createdAtLabel: formatTimestamp(currentNode?.createdAt),
    updatedAtLabel: formatTimestamp(currentNode?.updatedAt),
    description,
    nodeTypeLabel,
    iconTooltip: getString('treeConsole.infoPanel.openContextMenu', 'Node actions'),
    nodeTypeCaption: getString('treeConsole.infoPanel.nodeTypeLabel', '{{type}}', {
      type: nodeTypeLabel,
    }),
    editLabel: getString('treeConsole.infoPanel.editLabel', 'Edit'),
    editAria: getString('treeConsole.infoPanel.editButton', 'Edit node'),
    previewLabel: getString('treeConsole.infoPanel.previewLabel', 'Preview'),
    previewAria: getString('treeConsole.infoPanel.previewButton', 'Preview node'),
    unnamedNodeLabel: getString('treeConsole.infoPanel.unnamedNode', 'Untitled node'),
    closeAria: getString('treeConsole.infoPanel.closeButton', 'Close and navigate to parent'),
    noNode: getString(
      'treeConsole.infoPanel.noNode',
      'Node information is not available for this page.'
    ),
  };

  return {
    currentNode,
    nodeData,
    menuAnchorEl,
    menuNode,
    handleContextMenuTrigger,
    handleIconClick,
    handleMenuClose,
    labels,
    nodeIconColor,
    canMutate,
    isDraft,
    treeId,
  };
}
