import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-types';
import {
  getPluginIconColor,
  isFolderNodeType,
} from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { rainbowColors } from '@hierarchidb/ui-theme';
import type { HierarchicalTreeNode, TreeConsolePanelProps } from '@hierarchidb/ui-treeconsole-base';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { proxy as comlinkProxy } from 'comlink';
import type { MouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorker } from '~/contexts/WorkerProvider.tsx';
import { Subscriptions } from '~/hooks/SubscriptionServices.ts';
import { useTreeConsoleSSOT } from '~/state/treeconsole.atoms.ts';
import { convertTreeNodeToTreeNodeData } from '~/utils/treeNodeConverter.js';
import { resolveBuildTargetForNode, startBuildFlow } from './buildFlow.ts';
import { resolvePreviewGuardState } from '~/hooks/treeconsole/actions/dialog.ts';

type ContextMenuHandler = NonNullable<TreeConsolePanelProps['onContextMenuAction']>;

type BuildStepTarget = import('./buildFlow.ts').BuildStepTarget;

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
  const navigate = useNavigate();
  const location = useLocation();
  const workerCtx = useWorker();
  const workerClient = workerCtx?.client ?? null;
  const { state: ssot } = useTreeConsoleSSOT(node?.id ? String(node.id) : undefined);
  const indexedNode = useMemo(
    () => (node?.id && ssot.nodeIndex ? ssot.nodeIndex.get(node.id as NodeId) : undefined),
    [node?.id, ssot.nodeIndex]
  );
  const [currentNode, setCurrentNode] = useState<TreeNode | undefined>(node);
  const [buildTarget, setBuildTarget] = useState<BuildStepTarget | null>(null);
  const [buildTargetLoading, setBuildTargetLoading] = useState(false);
  const [previewGuardState, setPreviewGuardState] = useState<{ canOpen: boolean } | null>(null);
  const [previewGuardLoading, setPreviewGuardLoading] = useState(false);
  const nodeData = useMemo(
    () => (currentNode ? convertTreeNodeToTreeNodeData(currentNode) : undefined),
    [currentNode]
  );
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuNode, setMenuNode] = useState<HierarchicalTreeNode | null>(nodeData ?? null);
  const [confirmTrashOpen, setConfirmTrashOpen] = useState(false);
  const [pendingTrashNode, setPendingTrashNode] = useState<HierarchicalTreeNode | null>(null);

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
    const candidate = currentNode ?? node;
    const nodeId = candidate?.id;
    const nodeType = String(candidate?.nodeType ?? '');
    if (!nodeId || !nodeType || isFolderNodeType(nodeType)) {
      setPreviewGuardState({ canOpen: true });
      setPreviewGuardLoading(false);
      return;
    }
    if (!workerClient) {
      setPreviewGuardState({ canOpen: true });
      setPreviewGuardLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewGuardLoading(true);
    void (async () => {
      const guard = await resolvePreviewGuardState({
        client: workerClient,
        nodeType,
        nodeId: nodeId as NodeId,
      });
      if (cancelled) return;
      setPreviewGuardState(guard);
      setPreviewGuardLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentNode, node, workerClient]);

  useEffect(() => {
    let cancelled = false;
    const resolveTarget = async () => {
      const candidate = currentNode ?? node;
      const nodeType = String(candidate?.nodeType ?? '');
      if (!candidate?.id || !nodeType) {
        setBuildTarget(null);
        setBuildTargetLoading(false);
        return;
      }
      if (isFolderNodeType(nodeType)) {
        setBuildTarget(null);
        setBuildTargetLoading(false);
        return;
      }
      setBuildTargetLoading(true);
      const target = await resolveBuildTargetForNode({
        node: candidate,
        workerClient,
      });
      if (!cancelled) {
        setBuildTarget(target);
        setBuildTargetLoading(false);
      }
    };
    void resolveTarget();
    return () => {
      cancelled = true;
    };
  }, [currentNode, node, workerClient]);

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
      if (action === 'trash') {
        setPendingTrashNode(nodeData);
        setConfirmTrashOpen(true);
        return;
      }
      const navigateToParent = options?.navigateToParent ?? action === 'trash';
      if (action === 'toggle-visibility') {
        const nextVisible =
          typeof options?.nextVisible === 'boolean'
            ? options.nextVisible
            : !(currentNode?.visible ?? true);
        setCurrentNode((prev) => (prev ? { ...prev, visible: nextVisible } : prev));
      }
      onContextMenuAction(action, nodeData, {
        navigateToParent,
        nextVisible: options?.nextVisible,
      });
    },
    [nodeData, onContextMenuAction, currentNode]
  );

  const returnTo = useMemo(() => {
    const search = location.searchStr ?? '';
    return `${location.pathname}${search}`;
  }, [location.pathname, location.searchStr]);

  const handleBuild = useCallback(async () => {
    if (!treeId) return;
    const candidate = currentNode ?? node;
    if (!candidate?.id) return;
    await startBuildFlow({
      treeId,
      pageNodeId: candidate.id as NodeId,
      node: candidate,
      returnTo,
      workerClient,
      navigate: (to) => navigate({ to }),
    });
  }, [treeId, currentNode, node, workerClient, returnTo, navigate]);

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

  const handleTrashConfirm = useCallback(() => {
    if (pendingTrashNode) {
      onContextMenuAction('trash', pendingTrashNode, { navigateToParent: true });
    }
    setConfirmTrashOpen(false);
    setPendingTrashNode(null);
  }, [onContextMenuAction, pendingTrashNode]);

  const handleTrashCancel = useCallback(() => {
    setConfirmTrashOpen(false);
    setPendingTrashNode(null);
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
    : (manifestIconColor ?? baseIconColor);
  const isRootLike =
    !currentNode?.parentId ||
    !nodeData ||
    nodeData.depth === 0 ||
    /root/i.test(currentNode?.nodeType ?? '') ||
    /trash/i.test(currentNode?.nodeType ?? '');
  const canMutate = !isRootLike;
  const isDraft = Boolean(currentNode?.draftData);

  const labels = {
    createdLabel: getString('treeConsole.infoPanel.createdLabel', 'Created'),
    createdAtLabel: formatTimestamp(currentNode?.createdAt),
    updatedLabel: getString('treeConsole.infoPanel.updatedLabel', 'Updated'),
    updatedAtLabel: formatTimestamp(currentNode?.updatedAt),
    description,
    confirmTrashTitle: getString('treeConsole.infoPanel.confirmTrashTitle', 'Move to Trash'),
    confirmTrashDescription: getString(
      'treeConsole.infoPanel.confirmTrashDescription',
      'Move this item and all its children to trash?'
    ),
    confirmTrashCancel: getString('treeConsole.infoPanel.confirmTrashCancel', 'Cancel'),
    confirmTrashConfirm: getString('treeConsole.infoPanel.confirmTrashConfirm', 'Move to Trash'),
    nodeTypeLabel,
    iconTooltip: getString('treeConsole.infoPanel.openContextMenu', 'Node actions'),
    nodeTypeCaption: getString('treeConsole.infoPanel.nodeTypeLabel', '{{type}}', {
      type: nodeTypeLabel,
    }),
    draftLabel: getString('treeConsole.infoPanel.draftLabel', 'Draft'),
    editLabel: getString('treeConsole.infoPanel.editLabel', 'Edit'),
    editAria: getString('treeConsole.infoPanel.editButton', 'Edit node'),
    buildLabel: getString('treeConsole.infoPanel.buildLabel', 'Build'),
    buildAria: getString('treeConsole.infoPanel.buildButton', 'Start build'),
    previewLabel: getString('treeConsole.infoPanel.previewLabel', 'Preview'),
    previewAria: getString('treeConsole.infoPanel.previewButton', 'Preview node'),
    unnamedNodeLabel: getString('treeConsole.infoPanel.unnamedNode', 'Untitled node'),
    closeAria: getString('treeConsole.infoPanel.closeButton', 'Close and navigate to parent'),
    noNode: getString(
      'treeConsole.infoPanel.noNode',
      'Node information is not available for this page.'
    ),
  };

  const isBuildable =
    Boolean(nodeTypeLabel && isFolderNodeType(nodeTypeLabel)) || Boolean(buildTarget?.stepNumber);
  const canPreview = previewGuardState?.canOpen ?? true;

  return {
    currentNode,
    nodeData,
    menuAnchorEl,
    menuNode,
    handleContextMenuTrigger,
    handleIconClick,
    handleMenuClose,
    handleBuild,
    handleTrashConfirm,
    handleTrashCancel,
    confirmTrashOpen,
    labels,
    nodeIconColor,
    canMutate,
    isDraft,
    isBuildable,
    buildTargetLoading,
    canPreview,
    previewGuardLoading,
    treeId,
  };
}
