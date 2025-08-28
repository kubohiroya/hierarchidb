/**
 * Shape UI Plugin Definition
 * UI environment plugin registration
 */

import { ShapeMetadata } from '../shared';
import { ShapeDialog, ShapePanel } from './components';

/**
 * UI Plugin definition for Shape plugin
 * Exports React components and UI-specific functionality
 */
export const ShapeUIPlugin = {
  metadata: ShapeMetadata,
  
  // React components
  components: {
    DialogComponent: ShapeDialog,
    PanelComponent: ShapePanel,
    IconComponent: undefined as any, // Could add a custom icon component
  },
  
  // UI-specific validation (immediate feedback)
  validation: {
    validateForm: (data: any) => {
      const errors: string[] = [];
      
      if (!data.name?.trim()) {
        errors.push('Name is required');
      }
      
      if (data.name && data.name.length > 100) {
        errors.push('Name must be 100 characters or less');
      }
      
      if (!data.dataSourceName) {
        errors.push('Data source selection is required');
      }
      
      return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    }
  },
  
  // UI lifecycle hooks
  lifecycle: {
    afterCreate: async (entity: any) => {
      // Could show success notification
      console.log(`Shape "${entity.name}" created successfully`);
    },
    
    afterUpdate: async (entity: any) => {
      console.log(`Shape "${entity.name}" updated successfully`);
    },
    
    beforeDelete: async (entity: any) => {
      // Could show confirmation dialog
      console.log(`Preparing to delete shape "${entity.name}"`);
      return true; // Allow deletion
    },
    
    afterDelete: async (entity: any) => {
      console.log(`Shape "${entity.name}" deleted successfully`);
    }
  },
  
  // UI-specific configuration
  ui: {
    dialogWidth: 'lg',
    panelWidth: 400,
    showInToolbar: true,
    showInContextMenu: true,
    
    // Custom menu items
    menuItems: [
      {
        id: 'start-batch-processing',
        label: 'Start Processing',
        icon: 'play_arrow',
        condition: (entity: any) => 
          entity.selectedCountries?.length > 0 && 
          entity.processingStatus !== 'processing'
      },
      {
        id: 'view-processing-log',
        label: 'View Processing Log',
        icon: 'list_alt',
        condition: (entity: any) => entity.batchSessionId
      },
      {
        id: 'export-data',
        label: 'Export Data',
        icon: 'download',
        condition: (entity: any) => entity.processingStatus === 'completed'
      }
    ]
  }
} as const;