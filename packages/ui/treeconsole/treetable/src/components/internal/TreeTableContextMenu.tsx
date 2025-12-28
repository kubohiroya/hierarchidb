/**
 * TreeTableContextMenu
 * Wraps the TreeTable node context menu interactions with controller actions.
 */

import type { TreeNode } from '@hierarchidb/common-types';
import type { NodeContextMenuProps } from '@hierarchidb/ui-treeconsole-breadcrumb';
import type { ComponentType } from 'react';
import type { TreeTableController } from '../../types.js';

interface TreeTableContextMenuState {
  anchorEl: HTMLElement | null;
  anchorPosition: { left: number; top: number } | null;
  node: TreeNode | null;
}

interface TreeTableContextMenuProps {
  contextMenuState: TreeTableContextMenuState;
  onClose: () => void;
  treeId?: string;
  controller: TreeTableController | null;
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

  const handleClose = () => {
    onClose();
  };

  const triggerContextAction = (
    action: string,
    options?: { navigateToParent?: boolean; expandTarget?: boolean; source?: 'treetable' }
  ) => {
    if (!node) return;
    controller?.onContextAction?.(action, node, options);
  };

  return (
    <ContextMenuComponent
      anchorEl={contextMenuState.anchorEl}
      anchorPosition={contextMenuState.anchorPosition}
      open={Boolean(contextMenuState.anchorEl) || Boolean(contextMenuState.anchorPosition)}
      onClose={handleClose}
      nodeId={node?.id || ''}
      nodeType={node?.nodeType || 'folder'}
      treeId={treeId}
      nodeName={node?.metadata.name}
      isVisible={node?.visible ?? (node?.invisible ? false : true)}
      canCreate
      canEdit={!isRoot}
      canRemove={!isRoot}
      canDuplicate={!isRoot}
      canCopy={!isRoot}
      canCut={!isRoot}
      onToggleVisible={(_nextValue) => {
        if (node) {
          triggerContextAction('toggle-visibility', { source: 'treetable' });
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
    />
  );
}
