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
      onCreate={(type: string) => {
        if (node) {
          controller?.onCreate?.(node.id, type);
        }
        handleClose();
      }}
      onEdit={() => {
        if (node) {
          if (node.depth === 0) {
            handleClose();
            return;
          }
          if (controller?.onEdit) {
            controller.onEdit(node.id, node);
          } else {
            controller?.onNodeClick?.(node.id, node);
          }
        }
        handleClose();
      }}
      onDuplicate={() => {
        if (node && node.depth !== 0) {
          controller?.onDuplicate?.(node.id);
        }
        handleClose();
      }}
      onRemove={() => {
        if (node && node.depth !== 0) {
          controller?.onRemove?.([node.id]);
        }
        handleClose();
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
