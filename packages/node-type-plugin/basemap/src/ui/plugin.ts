/**
 * BaseMap UI Plugin definition
 * Integrates with the UI plugin registry system
 */

// UI Plugin will be defined inline for now
import { BaseMapMetadata } from '../shared';
import { BaseMapDialogContainer } from './components';
import { BaseMapIcon } from './components/BaseMapIcon';
import { BaseMapPanel } from './components/BaseMapPanel';

/**
 * BaseMap UI Plugin configuration
 */
export const BaseMapUIPlugin = {
  // Plugin metadata (shared with Worker)
  metadata: BaseMapMetadata,
  
  // UI Components
  components: {
    DialogComponent: BaseMapDialogContainer,
    PanelComponent: BaseMapPanel,
    IconComponent: BaseMapIcon,
  },
  
  // UI-side validation (immediate feedback)
  validation: {
    validateForm: (data: unknown) => {
      // Import validation function dynamically to avoid bundling issues
      return import('../shared').then(({ validateCreateBaseMapData }) => {
        return validateCreateBaseMapData(data as any);
      });
    }
  },
  
  // UI-side lifecycle hooks
  lifecycle: {
    beforeCreate: async (data: unknown) => {
      console.log('UI: Before create BaseMap', data);
    },
    
    afterCreate: async (entity: unknown) => {
      // TODO: Add proper notification system integration
      console.log(`BaseMap "${(entity as any).name}" created successfully`);
    },
    
    beforeUpdate: async (nodeId: string, data: unknown) => {
      console.log('UI: Before update BaseMap', nodeId, data);
    },
    
    afterUpdate: async (_nodeId: string, entity: unknown) => {
      // TODO: Add proper notification system integration  
      console.log(`BaseMap "${(entity as any).name}" updated successfully`);
    },
    
    beforeDelete: async (_nodeId: string) => {
      // TODO: Add proper confirmation dialog integration
      return await new Promise<boolean>((resolve) => {
        const confirmed = confirm('Are you sure you want to delete this BaseMap? This action cannot be undone.');
        resolve(confirmed);
      });
    },
    
    afterDelete: async (_nodeId: string) => {
      // TODO: Add proper notification system integration
      console.log('BaseMap deleted successfully');
    }
  },

  // UI-specific configuration
  ui: {
    defaultDialogMode: 'stepper',
    dialogSize: 'large',
    supportedViewModes: ['dialog', 'panel'],
    contextMenuItems: [
      {
        id: 'duplicate',
        label: 'Duplicate BaseMap',
        icon: 'ContentCopy',
        action: 'duplicate'
      },
      {
        id: 'export-style',
        label: 'Export Style',
        icon: 'Download',
        action: 'export'
      }
    ]
  }
};