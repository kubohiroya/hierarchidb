/**
 * Folder UI Plugin definition
 */

// import type { UIPluginDefinition } from '@hierarchidb/ui-core';
import { PluginDefinition } from '@hierarchidb/plugin-api';
import { validateFolderData } from '../common/shared/utils.js';
import type { CreateFolderData } from '../common/types/types.js';
import { FolderCreateDialog } from './components/FolderCreateDialog.js';
import { FolderEditDialog } from './components/FolderEditDialog.js';
import { FolderIcon } from './components/FolderIcon.js';

/**
 * Folder UI Plugin
 */
export const FolderUIPlugin: PluginDefinition = {
  // Basic Information
  //nodeType: 'folder',
  displayName: 'Folder',
  description: 'Hierarchical folder-plugin organization',

  /*
  // Data Source Configuration
  dataSource: {
    requiresEntity: false, // Folders are TreeNodes themselves
  },

  // Capability Flags
  capabilities: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canHaveChildren: true,
    canMove: true,
    supportsWorkingCopy: false,
    supportsVersioning: false,
    supportsExport: false,
    supportsBulkOperations: true,
  },
   */

  // UI Components
  components: {
    icon: FolderIcon,
    createDialog: FolderCreateDialog,
    editDialog: FolderEditDialog,
  },

  // Action Hooks
  hooks: {
    onValidateCreateForm: async (params: { formData: unknown }) => {
      const validation = validateFolderData(params.formData as CreateFolderData);
      const errors: Record<string, string> = {};

      // Convert array of errors to Record format
      if (validation.errors) {
        validation.errors.forEach((error, index) => {
          if (error.includes('name')) {
            errors.name = error;
          } else if (error.includes('description')) {
            errors.description = error;
          } else {
            errors[`error_${index}`] = error;
          }
        });
      }

      return {
        valid: validation.isValid,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
      };
    },
  },

  // Menu and Display Settings
  menu: {
    createOrder: 10,
    group: 'container',
  },

  // Visual Styling
  style: {
    primaryColor: '#FFC107',
    icon: 'folder',
  },
};