/**
  * Inline Edit Plugin
  * TreeTable
  */

import type { TreeTablePlugin } from '../plugin/types.js';
import type { TreeNodeInUI } from '../types.js';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import type { KeyboardEvent } from 'react';

/**
    */
export interface InlineEditPluginConfig {
  /**
      * : F2
      */
  editStartKey?: string;

  /**
      * : Enter
      */
  confirmKey?: string;

  /**
      * : Escape
      */
  cancelKey?: string;

  /**
      * : true
      */
  enableDoubleClickEdit?: boolean;

  /**
            */
  validateBeforeEdit?: (node: TreeNodeInUI) => boolean | Promise<boolean>;

  /**
            */
  validateBeforeSave?: (node: TreeNodeInUI, newValue: string) => boolean | Promise<boolean>;
}

/**
    */
export function createInlineEditPlugin(config?: InlineEditPluginConfig): TreeTablePlugin {
  const {
    editStartKey = 'F2',
    confirmKey = 'Enter',
    cancelKey = 'Escape',
    enableDoubleClickEdit = true,
    validateBeforeEdit,
    validateBeforeSave,
  } = config || {};

  return {
    name: 'inline-edit',
    version: '1.0.0',

    hooks: {
      onKeyDown: (event: KeyboardEvent, context) => {
        //  F2
        if (event.key === editStartKey) {
          const selectedNodes = context.selectedNodes;
          if (selectedNodes.length === 1) {
            event.preventDefault();
            console.log(`Starting inline edit for node: ${selectedNodes[0]}`);
            return true;
          }
        }

        //  Enter/Escape
        if (context.editingNodeId) {
          if (event.key === confirmKey) {
            event.preventDefault();
            console.log(`Confirming edit for node: ${context.editingNodeId}`);
            return true;
          } else if (event.key === cancelKey) {
            event.preventDefault();
            console.log(`Canceling edit for node: ${context.editingNodeId}`);
            return true;
          }
        }

        return false;
      },

      onRowDoubleClick: (node, _event) => {
        if (!enableDoubleClickEdit) return false;

        if (validateBeforeEdit) {
          const canEdit = validateBeforeEdit(node);
          if (canEdit instanceof Promise) {
            canEdit.then(result => {
              if (result) {
                console.log(`Starting inline edit via double-click: ${node.id}`);
              }
            });
          } else if (canEdit) {
            console.log(`Starting inline edit via double-click: ${node.id}`);
          }
        } else {
          console.log(`Starting inline edit via double-click: ${node.id}`);
        }

        return true;
      },

      onEditingStateChange: (editingNodeId) => {
        console.log(`Editing state changed: ${editingNodeId || 'none'}`);
      },

      onBeforeNodeUpdate: async (nodeId, newData) => {
        if (validateBeforeSave && newData.metadata?.name) {
          // Create a minimal TreeNodeInUI object for validation
          const node: TreeNodeInUI = {
            id: nodeId as NodeId,
            parentId: '' as NodeId,
            nodeType: 'unknown' as NodeType,
            hasChildren: false,
            depth: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
            visible: true,
            data: {...newData.data},
            draftData: {...newData.draftData},
            metadata: {...newData.metadata},
            draftMetadata: {
              ...newData.metadata,
            },
          };
          const isValid = await validateBeforeSave(node, newData.metadata.name);
          return isValid;
        }
        return true;
      },

      onAfterNodeUpdate: async (nodeId, newData) => {
        console.log(`Node ${nodeId} updated:`, newData);
      },

      onPluginInit: () => {
        console.log('InlineEditPlugin initialized');
      },

      onPluginDestroy: () => {
        console.log('InlineEditPlugin destroyed');
      },
    },

    config: {
      editStartKey,
      confirmKey,
      cancelKey,
      enableDoubleClickEdit,
    },
  };
}

export const inlineEditPlugin = createInlineEditPlugin();
