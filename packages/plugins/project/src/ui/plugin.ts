/**
 * Project UI Plugin Definition
 * 新しい3層アーキテクチャ用のUIプラグイン定義
 */

import { ProjectMetadata } from '../shared';
import { useProjectAPI } from './hooks';

// Placeholder components (実際のコンポーネントは別途移動が必要)
const ProjectDialog = (): null => null;
const ProjectPanel = (): null => null;
const ProjectIcon = (): null => null;

/**
 * UI Plugin Definition for Project
 */
export const ProjectUIPlugin = {
  metadata: ProjectMetadata,
  
  components: {
    DialogComponent: ProjectDialog,
    PanelComponent: ProjectPanel,
    IconComponent: ProjectIcon,
  },
  
  hooks: {
    useProjectAPI,
  },
  
  // UI-specific validation (immediate feedback)
  validation: {
    validateForm: (data: any): { isValid: boolean; errors: Array<{ field: string; message: string }> } => {
      const errors = [];
      if (!data.name?.trim()) {
        errors.push({ field: 'name', message: 'Project name is required' });
      }
      return { isValid: errors.length === 0, errors };
    }
  },
  
  // UI-specific lifecycle hooks
  lifecycle: {
    afterCreate: (entity: any): Promise<void> => {
      // Show success notification
      console.log(`Project "${entity.name}" created successfully`);
      return Promise.resolve();
    },
    
    beforeDelete: (entity: any): Promise<boolean> => {
      // Show confirmation dialog
      return Promise.resolve(confirm(`Are you sure you want to delete project "${entity.name}"?`));
    }
  },
};