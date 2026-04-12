import type { NodeId, TreeId } from '@hierarchidb/core-types';
import { getTreeNodeDescription, getTreeNodeName, type TreeNode } from '@hierarchidb/tree-api';
import {
  getPluginIconColor,
  isFolderNodeType,
  type OpenStepOption,
} from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { rainbowColors } from '@hierarchidb/ui-theme';
import type { HierarchicalTreeNode, TreeConsolePanelProps } from '@hierarchidb/ui-treeconsole-base';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { proxy as comlinkProxy } from 'comlink';
import type { MouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useWorker } from '~/contexts/WorkerProvider';
import { Subscriptions } from '~/hooks/SubscriptionServices';
import { useTreeConsoleSSOT } from '~/state/treeconsole.atoms';
import { convertTreeNodeToTreeNodeData } from '~/utils/treeNodeConverterUtils';
import { sanitizeForComlink } from '~/utils/comlinkSanitizerUtils';
import {
  collectBuildUrlsForFolder,
  resolveBuildTargetForNode,
  startBuildFlow,
} from '../buildFlow.ts';
import { resolvePreviewGuardState } from '~/hooks/treeconsole/actions/dialog';
import { resolveOpenStepsForNode } from '~/hooks/treeconsole/resolveOpenStepUtils';

type ContextMenuHandler = NonNullable<TreeConsolePanelProps['onContextMenuAction']>;

type BuildStepTarget = import('../buildFlow.ts').BuildStepTarget;

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
  const [folderBuildReady, setFolderBuildReady] = useState(false);
  const [buildTargetLoading, setBuildTargetLoading] = useState(false);
  const [previewGuardState, setPreviewGuardState] = useState<{ canOpen: boolean } | null>(null);
  const [previewGuardLoading, setPreviewGuardLoading] = useState(false);
  const nodeData = useMemo(
    () => (currentNode ? convertTreeNodeToTreeNodeData(currentNode) : undefined),
    [currentNode]
  );
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuNode, setMenuNode] = useState<HierarchicalTreeNode | null>(nodeData ?? null);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [pendingArchiveNode, setPendingArchiveNode] = useState<HierarchicalTreeNode | null>(null);
  const [openSteps, setOpenSteps] = useState<OpenStepOption[]>([]);
  const [openStepsLoading, setOpenStepsLoading] = useState(false);
  const returnTo = useMemo(() => {
    const search = location.searchStr ?? '';
    return `${location.pathname}${search}`;
  }, [location.pathname, location.searchStr]);

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
        getTreeNodeName(prev) !== getTreeNodeName(nextNode) ||
        getTreeNodeDescription(prev) !== getTreeNodeDescription(nextNode)
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
        setFolderBuildReady(false);
        setBuildTargetLoading(false);
        return;
      }
      if (isFolderNodeType(nodeType)) {
        setBuildTarget(null);
        if (!treeId) {
          setFolderBuildReady(false);
          setBuildTargetLoading(false);
          return;
        }
        if (!workerClient) {
          setFolderBuildReady(false);
          setBuildTargetLoading(false);
          return;
        }
        setBuildTargetLoading(true);
        try {
          const { urls } = await collectBuildUrlsForFolder({
            treeId,
            pageNodeId: candidate.id as NodeId,
            folderNode: candidate,
            returnTo,
            workerClient,
          });
          if (!cancelled) {
            setFolderBuildReady(urls.length > 0);
            setBuildTargetLoading(false);
          }
        } catch (error) {
          console.warn('[TreeNodeInfoPanel] failed to resolve folder build targets', error);
          if (!cancelled) {
            setFolderBuildReady(false);
            setBuildTargetLoading(false);
          }
        }
        return;
      }
      setBuildTargetLoading(true);
      const target = await resolveBuildTargetForNode({
        node: candidate,
        workerClient,
      });
      if (!cancelled) {
        setFolderBuildReady(false);
        setBuildTarget(target);
        setBuildTargetLoading(false);
      }
    };
    void resolveTarget();
    return () => {
      cancelled = true;
    };
  }, [currentNode, node, workerClient, treeId, returnTo]);

  useEffect(() => {
    setMenuNode(nodeData ?? null);
  }, [nodeData]);

  useEffect(() => {
    if (!menuAnchorEl || !menuNode) {
      setOpenSteps([]);
      setOpenStepsLoading(false);
      return;
    }
    let cancelled = false;
    setOpenStepsLoading(true);
    void (async () => {
      const steps = await resolveOpenStepsForNode({
        nodeId: menuNode.id as NodeId,
        nodeType: menuNode.nodeType,
        node: currentNode ?? node ?? null,
        client: workerClient,
      });
      if (!cancelled) {
        setOpenSteps(Array.isArray(steps) ? steps : []);
        setOpenStepsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [menuAnchorEl, menuNode, currentNode, node, workerClient]);

  useEffect(() => {
    if (!workerClient || !node?.id) return;
    let disposed = false;
    let subId: string | null = null;

    const cb = comlinkProxy((ev: unknown) => {
      const safeEvent = sanitizeForComlink(ev);
      if (disposed) return;
      const event = safeEvent as { nodeId?: NodeId; node?: TreeNode } | null;
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
      if (action === 'archive') {
        setPendingArchiveNode(nodeData);
        setConfirmArchiveOpen(true);
        return;
      }
      const navigateToParent = options?.navigateToParent ?? action === 'archive';
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

  const handleArchiveConfirm = useCallback(() => {
    if (pendingArchiveNode) {
      onContextMenuAction('archive', pendingArchiveNode, { navigateToParent: true });
    }
    setConfirmArchiveOpen(false);
    setPendingArchiveNode(null);
  }, [onContextMenuAction, pendingArchiveNode]);

  const handleArchiveCancel = useCallback(() => {
    setConfirmArchiveOpen(false);
    setPendingArchiveNode(null);
  }, []);

  const descriptionText = currentNode ? getTreeNodeDescription(currentNode).trim() : '';
  const emptyDescriptionLabel = getString('treeConsole.infoPanel.emptyDescription', 'No description provided.');
  const description = descriptionText || emptyDescriptionLabel || '';
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
    /archive/i.test(currentNode?.nodeType ?? '');
  const canMutate = !isRootLike;
  const statusSourceNode = currentNode ?? node;
  const readBuildRequired = (sourceNode?: TreeNode | null): boolean | undefined => {
    const draftValue = sourceNode?.draftMetadata?.buildMetadata?.buildRequired;
    if (typeof draftValue === 'boolean') {
      return draftValue;
    }
    const metadataValue = sourceNode?.metadata?.buildMetadata?.buildRequired;
    if (typeof metadataValue === 'boolean') {
      return metadataValue;
    }
    return undefined;
  };
  const resolvedBuildRequiredForCurrentNode = readBuildRequired(currentNode);
  const resolvedBuildRequiredForFallbackNode = resolvedBuildRequiredForCurrentNode ?? readBuildRequired(node);
  const isBuildRequired = isFolderNodeType(nodeTypeLabel)
    ? Boolean(resolvedBuildRequiredForCurrentNode || resolvedBuildRequiredForFallbackNode || folderBuildReady)
    : resolvedBuildRequiredForCurrentNode ?? resolvedBuildRequiredForFallbackNode;
  const isDraft = statusSourceNode?.version === 0 || node?.version === 0;

  const labels = {
    createdLabel: getString('treeConsole.infoPanel.createdLabel', 'Created'),
    createdAtLabel: formatTimestamp(currentNode?.createdAt),
    updatedLabel: getString('treeConsole.infoPanel.updatedLabel', 'Updated'),
    updatedAtLabel: formatTimestamp(currentNode?.updatedAt),
    description,
    emptyDescriptionLabel,
    confirmArchiveTitle: getString('treeConsole.infoPanel.confirmArchiveTitle', 'Move to Archive'),
    confirmArchiveDescription: getString(
      'treeConsole.infoPanel.confirmArchiveDescription',
      'Move this item and all its children to archive?'
    ),
    confirmArchiveCancel: getString('treeConsole.infoPanel.confirmArchiveCancel', 'Cancel'),
    confirmArchiveConfirm: getString('treeConsole.infoPanel.confirmArchiveConfirm', 'Move to Archive'),
    nodeTypeLabel,
    iconTooltip: getString('treeConsole.infoPanel.openContextMenu', 'Node actions'),
    nodeTypeCaption: getString('treeConsole.infoPanel.nodeTypeLabel', '{{type}}', {
      type: nodeTypeLabel,
    }),
    draftLabel: getString('treeConsole.infoPanel.draftLabel', 'Draft'),
    buildRequiredLabel: getString('treeConsole.infoPanel.buildRequiredLabel', 'Build Required'),
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

  const isFolderNode = Boolean(nodeTypeLabel && isFolderNodeType(nodeTypeLabel));
  const isBuildableByMetadata = isFolderNode
    ? folderBuildReady
    : Boolean(buildTarget?.stepNumber);
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
    handleArchiveConfirm,
    handleArchiveCancel,
    confirmArchiveOpen,
    labels,
    nodeIconColor,
    canMutate,
    isDraft,
    isBuildable: isBuildableByMetadata,
    isBuildRequired,
    folderBuildReady,
    buildTargetLoading,
    canPreview,
    previewGuardLoading,
    treeId,
    openSteps,
    openStepsLoading,
  };
}
