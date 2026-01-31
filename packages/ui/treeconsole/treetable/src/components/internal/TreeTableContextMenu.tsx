/**
 * TreeTableContextMenu
 * Wraps the TreeTable node context menu interactions with controller actions.
 */

import type { TreeNode } from '@hierarchidb/tree-api';
import type { NodeContextMenuProps } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { useEffect, useState, type ComponentType } from 'react';
import type { TreeNodeInUI, TreeTableController } from '../../types.js';

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
  ContextMenuComponent: ComponentType<NodeContextMenuProps>;
}

export function TreeTableContextMenu({
  contextMenuState,
  onClose,
  treeId,
  controller,
  ContextMenuComponent,
}: TreeTableContextMenuProps) {
  const node = contextMenuState.node;
  const isRoot = !!node && node.depth === 0;
  const open = Boolean(contextMenuState.anchorEl) || Boolean(contextMenuState.anchorPosition);
  const [previewGuardState, setPreviewGuardState] = useState<{ canOpen: boolean } | null>(null);
  const [previewGuardLoading, setPreviewGuardLoading] = useState(false);

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
      nodeName={node?.metadata.name}
      isVisible={node?.visible ?? true}
      canCreate
      canEdit={!isRoot}
      canRemove={!isRoot}
      canDuplicate={!isRoot}
      canCopy={!isRoot}
      canCut={!isRoot}
      canPreview={canPreview}
      onToggleVisible={(nextVisible) => {
        if (node) {
          triggerContextAction('toggle-visibility', { source: 'treetable', nextVisible });
        }
      }}
      onCreate={(type: string) => {
        if (node) {
          triggerContextAction(`create:${type}`, { expandTarget: true, source: 'treetable' });
        }
        handleClose();
      }}
      onEdit={() => {
        if (!node || isRoot) {
          handleClose();
          return;
        }
        triggerContextAction('edit', { source: 'treetable' });
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
      onTrash={() => {
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
      onOpen={() => {
        if (node) {
          controller?.onNodeClick?.(node.id, node);
        }
        handleClose();
      }}
      onOpenFolder={() => {
        if (node) {
          controller?.onNodeClick?.(node.id, node);
        }
        handleClose();
      }}
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
