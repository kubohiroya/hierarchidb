/**
 * TreeTableContextMenu
 * Wraps the TreeTable node context menu interactions with controller actions.
 */

import type { ComponentType } from 'react';
import type { TreeNode } from '@hierarchidb/common-type';
import type { TreeTableController } from '../../types.js';

interface TreeTableContextMenuState {
  anchorEl: HTMLElement | null;
  node: TreeNode | null;
}

interface TreeTableContextMenuProps {
  contextMenuState: TreeTableContextMenuState;
  onClose: () => void;
  treeId?: string;
  controller: TreeTableController | null;
  ContextMenuComponent: ComponentType<any>;
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

  const triggerContextAction = (action: string, options?: { navigateToParent?: boolean; expandTarget?: boolean; source?: 'treetable' }) => {
    if (!node) return;
    controller?.onContextAction?.(action, node, options);
  };

  return (
    <ContextMenuComponent
      anchorEl={contextMenuState.anchorEl}
      open={Boolean(contextMenuState.anchorEl)}
      onClose={handleClose}
      nodeId={node?.id || ''}
      nodeType={node?.nodeType || 'folder'}
      treeId={treeId}
      nodeName={node?.name}
      canCreate
      canEdit={!isRoot}
      canRemove={!isRoot}
      canDuplicate={!isRoot}
      canCopy={!isRoot}
      canCut={!isRoot}
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
        triggerContextAction('rename-dialog');
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
      onRemove={() => {
        if (!node || isRoot) {
          handleClose();
          return;
        }
        triggerContextAction('remove', { navigateToParent: false, source: 'treetable' });
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
      onCheckReference={() => {
        if (node) {
          console.log('Check reference:', node.id);
        }
        handleClose();
      }}
      onPreview={() => {
        if (node) {
          console.log('PreviewStep:', node.id);
        }
        handleClose();
      }}
    />
  );
}
