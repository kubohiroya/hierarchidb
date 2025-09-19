/**
  * Inline Edit Plugin
  * TreeTable
  */

import type { TreeTablePlugin } from '../plugin/types.js';
import type { TreeNodeInUI } from '../types.js';
import type { NodeId, NodeType } from '@hierarchidb/common-type';
import { KeyboardEvent } from 'react';

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
        if (validateBeforeSave && newData.name) {
          // Create a minimal TreeNodeInUI object for validation
          const node: TreeNodeInUI = {
            id: nodeId as NodeId,
            parentId: '' as NodeId,
            nodeType: 'unknown' as NodeType,
            name: newData.name,
            hasChildren: false,
            depth: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          };
          const isValid = await validateBeforeSave(node, newData.name);
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