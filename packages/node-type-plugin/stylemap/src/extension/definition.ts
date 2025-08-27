/**
 * StyleMap plugin extension definition
 * Extends the folder plugin with StyleMap-specific fields and validation
 */

import type { PluginExtensionDefinition } from '@hierarchidb/common-core';
import { StyleMapExtensionStep } from './components/StyleMapExtensionStep';
import { StyleMapExtensionHandler } from './handler';

export const styleMapExtension: PluginExtensionDefinition = {
  nodeType: 'stylemap',
  extends: 'folder',
  
  extendedSteps: [
    {
      stepNumber: 2,
      title: 'StyleMap Configuration',
      component: StyleMapExtensionStep,
      isOptional: true,
    }
  ],
  
  extendedFields: {
    styleType: {
      type: 'select',
      label: 'Style Type',
      options: ['choropleth', 'heatmap', 'points', 'lines'],
      defaultValue: 'choropleth',
    },
    dataSource: {
      type: 'text',
      label: 'Data Source',
    },
    colorScheme: {
      type: 'select',
      label: 'Color Scheme',
      options: ['blues', 'reds', 'greens', 'viridis', 'plasma'],
      defaultValue: 'blues',
    },
    opacity: {
      type: 'number',
      label: 'Opacity',
      min: 0,
      max: 1,
      defaultValue: 0.7,
    },
  },
  
  extendedValidation: {
    validate: async (data: any) => {
      const errors: string[] = [];
      
      if (data.styleType && !['choropleth', 'heatmap', 'points', 'lines'].includes(data.styleType)) {
        errors.push('Invalid style type');
      }
      
      if (data.opacity !== undefined && (data.opacity < 0 || data.opacity > 1)) {
        errors.push('Opacity must be between 0 and 1');
      }
      
      return {
        isValid: errors.length === 0,
        errors,
      };
    }
  },
  
  handler: new StyleMapExtensionHandler(),
};