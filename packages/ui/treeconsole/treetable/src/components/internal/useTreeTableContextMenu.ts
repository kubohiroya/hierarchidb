import {
  isNodeBuildRequired,
  resolveBuildAvailability,
  resolveSubtreeBuildAvailability,
} from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import {
  formatBuildAvailabilityView,
  isFolderNodeType,
  type OpenStepOption,
} from '@hierarchidb/ui-treeconsole-breadcrumb';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BuildSessionIndicator, TreeNodeInUI, TreeTableController } from '~/types';

const buildActionNodeTypes = new Set(['shape', 'route', 'styler']);

export interface TreeTableContextMenuState {
  anchorEl: HTMLElement | null;
  anchorPosition: { left: number; top: number } | null;
  node: TreeNode | null;
}

interface UseTreeTableContextMenuParams {
  contextMenuState: TreeTableContextMenuState;
  onClose: () => void;
  controller?: TreeTableController;
  buildSessionIndicator?: BuildSessionIndicator;
  collectDescendantIds?: (nodeId: NodeId) => string[];
}

interface ContextActionOptions {
  navigateToParent?: boolean;
  expandTarget?: boolean;
  source?: 'treetable';
  nextVisible?: boolean;
  openInNewTab?: boolean;
}

export interface UseTreeTableContextMenuResult {
  node: TreeNode | null;
  open: boolean;
  isRoot: boolean;
  isBuildRequiredForNode: boolean;
  canArchive: boolean;
  canBuild: boolean;
  buildAvailabilitySummary?: string;
  buildAvailabilityTooltip?: string;
  buildDiagnosticsLabel?: string;
  canCreate: boolean;
  canImportExport: boolean;
  canPreview: boolean;
  openSteps: OpenStepOption[];
  openStepsLoading: boolean;
  handleClose: () => void;
  onToggleVisible: (nextVisible: boolean) => void;
  onCreate: (type: string, options?: { openInNewTab?: boolean }) => void;
  onEdit: (options?: { openInNewTab?: boolean }) => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRemove: () => void;
  onCopy: () => void;
  onCut: () => void;
  onImport: () => void;
  onExport: () => void;
  onOpen: (options?: { openInNewTab?: boolean }) => void;
  onOpenFolder: (options?: { openInNewTab?: boolean }) => void;
  onOpenStep: (step: number, options?: { openInNewTab?: boolean }) => void;
  onPreview: () => void;
  onBuild: () => void;
  onBuildDiagnostics: () => void;
}

export function useTreeTableContextMenu({
  contextMenuState,
  onClose,
  controller,
  buildSessionIndicator,
  collectDescendantIds,
}: UseTreeTableContextMenuParams): UseTreeTableContextMenuResult {
  const node = contextMenuState.node;
  const isRoot = !!node && node.depth === 0;
  const open = Boolean(contextMenuState.anchorEl) || Boolean(contextMenuState.anchorPosition);

  const isBuildRunning = Boolean(
    node?.id && buildSessionIndicator?.runningNodeIds.has(node.id as NodeId)
  );

  const isBuildRequiredForNode = node ? isNodeBuildRequired(node) : false;

  const nodeType = String(node?.nodeType ?? '');
  const canBuildNodeType = buildActionNodeTypes.has(nodeType.trim().toLowerCase());
  const activeNodeIds = buildSessionIndicator?.activeNodeIds;
  const buildAvailability =
    node && isFolderNodeType(node.nodeType)
      ? resolveSubtreeBuildAvailability({
          root: node,
          descendants:
            collectDescendantIds?.(node.id as NodeId)
              .filter((descendantId) => descendantId !== node.id)
              .map((descendantId) => controller?.nodeIndex?.get(descendantId as NodeId))
              .filter((descendant): descendant is TreeNode => Boolean(descendant)) ?? [],
          canBuildNodeType: (candidateNodeType) =>
            buildActionNodeTypes.has(String(candidateNodeType).trim().toLowerCase()),
          activeNodeIds,
        })
      : node && canBuildNodeType
        ? resolveBuildAvailability({
            candidates: [node],
            activeNodeIds,
          })
        : null;

  const canArchive = !isRoot && !isBuildRunning;
  const canCreate = isFolderNodeType(node?.nodeType);
  const canImportExport = isFolderNodeType(node?.nodeType);
  const hasBuildRequiredTarget =
    buildAvailability?.requiredTargets.length !== undefined
      ? buildAvailability.requiredTargets.length > 0
      : isBuildRequiredForNode;
  const canBuild = buildAvailability?.canStartBuild === true;
  const buildAvailabilityView = formatBuildAvailabilityView(buildAvailability);

  const [previewGuardState, setPreviewGuardState] = useState<{ canOpen: boolean } | null>(null);
  const [previewGuardLoading, setPreviewGuardLoading] = useState(false);
  const [openSteps, setOpenSteps] = useState<OpenStepOption[]>([]);
  const [openStepsLoading, setOpenStepsLoading] = useState(false);

  useEffect(() => {
    if (!open || !node) {
      setPreviewGuardState(null);
      setPreviewGuardLoading(false);
      return;
    }

    const resolver = controller?.resolvePreviewGuardState;
    if (!resolver) {
      setPreviewGuardState(null);
      setPreviewGuardLoading(false);
      return;
    }

    let cancelled = false;
    setPreviewGuardLoading(true);

    void (async () => {
      const guard = await resolver(node as TreeNodeInUI);
      if (cancelled) return;
      setPreviewGuardState(guard);
      setPreviewGuardLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [controller, node, open]);

  useEffect(() => {
    if (!open || !node) {
      setOpenSteps([]);
      setOpenStepsLoading(false);
      return;
    }

    const resolver = controller?.resolveOpenSteps;
    if (!resolver) {
      setOpenSteps([]);
      setOpenStepsLoading(false);
      return;
    }

    let cancelled = false;
    setOpenStepsLoading(true);

    void (async () => {
      const steps = await resolver(node as TreeNodeInUI);
      if (!cancelled) {
        setOpenSteps(Array.isArray(steps) ? steps : []);
        setOpenStepsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [controller, node, open]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const triggerContextAction = useCallback(
    (action: string, options?: ContextActionOptions) => {
      if (!node) return;
      controller?.onContextAction?.(action, node, options);
    },
    [controller, node]
  );

  const onToggleVisible = useCallback(
    (nextVisible: boolean) => {
      if (!node) return;
      triggerContextAction('toggle-visibility', { source: 'treetable', nextVisible });
    },
    [node, triggerContextAction]
  );

  const onCreate = useCallback(
    (type: string, options?: { openInNewTab?: boolean }) => {
      if (node) {
        triggerContextAction(`create:${type}`, {
          expandTarget: true,
          source: 'treetable',
          openInNewTab: options?.openInNewTab,
        });
      }
      handleClose();
    },
    [handleClose, node, triggerContextAction]
  );

  const onEdit = useCallback(
    (options?: { openInNewTab?: boolean }) => {
      if (!node || isRoot) {
        handleClose();
        return;
      }
      triggerContextAction('edit', { source: 'treetable', openInNewTab: options?.openInNewTab });
      handleClose();
    },
    [handleClose, isRoot, node, triggerContextAction]
  );

  const onDuplicate = useCallback(() => {
    if (!node || isRoot) {
      handleClose();
      return;
    }
    triggerContextAction('duplicate', { expandTarget: true, source: 'treetable' });
    handleClose();
  }, [handleClose, isRoot, node, triggerContextAction]);

  const onArchive = useCallback(() => {
    if (!node || isRoot) {
      handleClose();
      return;
    }
    triggerContextAction('archive', { navigateToParent: false, source: 'treetable' });
    handleClose();
  }, [handleClose, isRoot, node, triggerContextAction]);

  const onCopy = useCallback(() => {
    if (node) {
      triggerContextAction('copy', { source: 'treetable' });
    }
  }, [node, triggerContextAction]);

  const onCut = useCallback(() => {
    if (node) {
      triggerContextAction('cut', { navigateToParent: true, source: 'treetable' });
    }
  }, [node, triggerContextAction]);

  const onImport = useCallback(() => {
    if (node) {
      triggerContextAction('import', { source: 'treetable' });
    }
  }, [node, triggerContextAction]);

  const onExport = useCallback(() => {
    if (node) {
      triggerContextAction('export', { source: 'treetable' });
    }
  }, [node, triggerContextAction]);

  const onOpen = useCallback(
    (options?: { openInNewTab?: boolean }) => {
      if (node) {
        if (options?.openInNewTab) {
          triggerContextAction('navigate', { source: 'treetable', openInNewTab: true });
        } else {
          controller?.onNodeClick?.(node.id, node);
        }
      }
      handleClose();
    },
    [controller, handleClose, node, triggerContextAction]
  );

  const onOpenStep = useCallback(
    (step: number, options?: { openInNewTab?: boolean }) => {
      if (node) {
        triggerContextAction(`open-step:${step}`, {
          source: 'treetable',
          openInNewTab: options?.openInNewTab,
        });
      }
      handleClose();
    },
    [handleClose, node, triggerContextAction]
  );

  const onPreview = useCallback(() => {
    if (node) {
      triggerContextAction('preview', { source: 'treetable' });
    }
    handleClose();
  }, [handleClose, node, triggerContextAction]);

  const onBuild = useCallback(() => {
    if (node) {
      triggerContextAction('build', { source: 'treetable' });
    }
    handleClose();
  }, [handleClose, node, triggerContextAction]);

  const onBuildDiagnostics = useCallback(() => {
    if (node) {
      triggerContextAction('build-diagnostics', { source: 'treetable' });
    }
    handleClose();
  }, [handleClose, node, triggerContextAction]);

  const canPreview = useMemo(
    () => (previewGuardState?.canOpen ?? true) && !previewGuardLoading,
    [previewGuardLoading, previewGuardState?.canOpen]
  );

  return {
    node,
    open,
    isRoot,
    isBuildRequiredForNode: hasBuildRequiredTarget,
    canArchive,
    canBuild,
    buildAvailabilitySummary: buildAvailabilityView?.summary,
    buildAvailabilityTooltip: buildAvailabilityView?.tooltip,
    buildDiagnosticsLabel: buildAvailabilityView?.diagnosticsLabel,
    canCreate,
    canImportExport,
    canPreview,
    openSteps,
    openStepsLoading,
    handleClose,
    onToggleVisible,
    onCreate,
    onEdit,
    onDuplicate,
    onArchive,
    onRemove: onArchive,
    onCopy,
    onCut,
    onImport,
    onExport,
    onOpen,
    onOpenFolder: onOpen,
    onOpenStep,
    onPreview,
    onBuild,
    onBuildDiagnostics,
  };
}
