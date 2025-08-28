/**
 * StyleMap extension handler
 * Processes StyleMap-specific data when creating/editing folders
 */

import type { NodeId } from '@hierarchidb/common-type';

export interface StyleMapExtensionData {
  styleType?: 'choropleth' | 'heatmap' | 'points' | 'lines';
  dataSource?: string;
  colorScheme?: string;
  opacity?: number;
  strokeWidth?: number;
}

export class StyleMapExtensionHandler {
  /**
   * Process extension data when creating a folder-plugin
   */
  async onCreate(nodeId: NodeId, data: StyleMapExtensionData): Promise<void> {
    // Store StyleMap configuration in database
    console.log('Creating StyleMap configuration for node:', nodeId, data);

    // TODO: Implement actual storage logic
    // This would typically involve:
    // 1. Validating the StyleMap configuration
    // 2. Storing configuration in StyleMapDB
    // 3. Initializing any necessary data structures
  }

  /**
   * Process extension data when updating a folder-plugin
   */
  async onUpdate(nodeId: NodeId, data: Partial<StyleMapExtensionData>): Promise<void> {
    // Update StyleMap configuration
    console.log('Updating StyleMap configuration for node:', nodeId, data);

    // TODO: Implement actual update logic
    // This would typically involve:
    // 1. Loading existing configuration
    // 2. Merging with new data
    // 3. Validating the updated configuration
    // 4. Saving to database
  }

  /**
   * Clean up when a folder-plugin is deleted
   */
  async onDelete(nodeId: NodeId): Promise<void> {
    // Clean up StyleMap data
    console.log('Cleaning up StyleMap data for node:', nodeId);

    // TODO: Implement cleanup logic
    // This would typically involve:
    // 1. Deleting StyleMap configuration
    // 2. Removing any associated data files
    // 3. Cleaning up cache entries
  }

  /**
   * Validate extension data
   */
  async validate(data: StyleMapExtensionData): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate style type
    if (data.styleType && !['choropleth', 'heatmap', 'points', 'lines'].includes(data.styleType)) {
      errors.push('Invalid style type');
    }

    // Validate opacity
    if (data.opacity !== undefined && (data.opacity < 0 || data.opacity > 1)) {
      errors.push('Opacity must be between 0 and 1');
    }

    // Validate data source if provided
    if (data.dataSource && data.dataSource.trim().length === 0) {
      errors.push('Data source cannot be empty');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export default StyleMapExtensionHandler;
