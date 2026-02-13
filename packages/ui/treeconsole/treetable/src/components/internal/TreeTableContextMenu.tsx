/**
 * TreeTableContextMenu
 * Wraps the TreeTable node context menu interactions with controller actions.
 */

import { getTreeNodeName, type TreeNode } from '@hierarchidb/tree-api';
import type { NodeId } from '@hierarchidb/core-types';
import { isFolderNodeType, type NodeContextMenuProps, OpenStepOption } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { useEffect, useState, type ComponentType } from 'react';
import type { BuildSessionIndicator, TreeNodeInUI, TreeTableController } from '../../types.js';

interface TreeTableContextMenuState {
  anchorEl: HTMLElement | null;
  anchorPosition: { left: number; top: number } | null;
  node: TreeNode | null;
}

interface TreeTableContextMenuProps {
  contextMenuState: TreeTableContextMenuState;
  onClose: () => void;
  treeId?: string;
  controller?: TreeTableController;
  buildSessionIndicator?: BuildSessionIndicator;
  ContextMenuComponent: ComponentType<NodeContextMenuProps>;
}

export function TreeTableContextMenu({
  contextMenuState,
  onClose,
  treeId,
  controller,
  buildSessionIndicator,
  ContextMenuComponent,
}: TreeTableContextMenuProps) {
  const node = contextMenuState.node;
  const isRoot = !!node && node.depth === 0;
  const isBuildRunning = Boolean(
    node?.id && buildSessionIndicator?.runningNodeIds.has(node.id as NodeId)
  );
  const canArchive = !isRoot && !isBuildRunning;
  const open = Boolean(contextMenuState.anchorEl) || Boolean(contextMenuState.anchorPosition);
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

  const handleClose = () => {
    onClose();
  };

  const triggerContextAction = (
    action: string,
    options?: {
      navigateToParent?: boolean;
      expandTarget?: boolean;
      source?: 'treetable';
      nextVisible?: boolean;
      openInNewTab?: boolean;
    }
  ) => {
    if (!node) return;
    controller?.onContextAction?.(action, node, options);
  };

  const canPreview = (previewGuardState?.canOpen ?? true) && !previewGuardLoading;

  return (
    <ContextMenuComponent
      anchorEl={contextMenuState.anchorEl}
      anchorPosition={contextMenuState.anchorPosition}
      open={open}
      onClose={handleClose}
      nodeId={node?.id || ''}
      nodeType={node?.nodeType || 'folder'}
      treeId={treeId}
      nodeName={node ? getTreeNodeName(node) : ''}
      isVisible={node?.visible ?? true}
      canCreate={isFolderNodeType(node?.nodeType)}
      canEdit={!isRoot}
      canRemove={canArchive}
      canArchive={canArchive}
      canDuplicate={!isRoot}
      canCopy={!isRoot}
      canCut={!isRoot}
      canImport={isFolderNodeType(node?.nodeType)}
      canExport={isFolderNodeType(node?.nodeType)}
      canPreview={canPreview}
      onToggleVisible={(nextVisible) => {
        if (node) {
          triggerContextAction('toggle-visibility', { source: 'treetable', nextVisible });
        }
      }}
      onCreate={(type: string, options) => {
        if (node) {
          triggerContextAction(`create:${type}`, {
            expandTarget: true,
            source: 'treetable',
            openInNewTab: options?.openInNewTab,
          });
        }
        handleClose();
      }}
      onEdit={(options) => {
        if (!node || isRoot) {
          handleClose();
          return;
        }
        triggerContextAction('edit', { source: 'treetable', openInNewTab: options?.openInNewTab });
        handleClose();
      }}
      onDuplicate={() => {
        if (!node || isRoot) {
          handleClose();
          return;
        }
        triggerContextAction('duplicate', { expandTarget: true, source: 'treetable' });
        handleClose();
      }}
      onArchive={() => {
        if (!node || isRoot) {
          handleClose();
          return;
        }
        triggerContextAction('trash', { navigateToParent: false, source: 'treetable' });
        handleClose();
      }}
      onRemove={() => {
        if (!node || isRoot) {
          handleClose();
          return;
        }
        triggerContextAction('trash', { navigateToParent: false, source: 'treetable' });
        handleClose();
      }}
      onCopy={() => {
        if (node) {
          triggerContextAction('copy', { source: 'treetable' });
        }
      }}
      onCut={() => {
        if (node) {
          triggerContextAction('cut', { navigateToParent: true, source: 'treetable' });
        }
      }}
      onImport={() => {
        if (node) {
          triggerContextAction('import', { source: 'treetable' });
        }
      }}
      onExport={() => {
        if (node) {
          triggerContextAction('export', { source: 'treetable' });
        }
      }}
      onOpen={(options) => {
        if (node) {
          if (options?.openInNewTab) {
            triggerContextAction('navigate', { source: 'treetable', openInNewTab: true });
          } else {
            controller?.onNodeClick?.(node.id, node);
          }
        }
        handleClose();
      }}
      onOpenFolder={(options) => {
        if (node) {
          if (options?.openInNewTab) {
            triggerContextAction('navigate', { source: 'treetable', openInNewTab: true });
          } else {
            controller?.onNodeClick?.(node.id, node);
          }
        }
        handleClose();
      }}
      onOpenStep={(step, options) => {
        if (node) {
          triggerContextAction(`open-step:${step}`, {
            source: 'treetable',
            openInNewTab: options?.openInNewTab,
          });
        }
        handleClose();
      }}
      openSteps={openSteps}
      openStepsLoading={openStepsLoading}
      onPreview={() => {
        if (node) {
          triggerContextAction('preview', { source: 'treetable' });
        }
        handleClose();
      }}
      onBuild={() => {
        if (node) {
          triggerContextAction('build', { source: 'treetable' });
        }
        handleClose();
      }}
    />
  );
}
