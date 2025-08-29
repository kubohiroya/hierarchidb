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

    // 1. Validate the StyleMap configuration
    const validation = await this.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid StyleMap configuration: ${validation.errors.join(', ')}`);
    }

    // 2. Store configuration in StyleMapDB
    try {
      const config = {
        nodeId,
        styleType: data.styleType || 'choropleth',
        dataSource: data.dataSource || '',
        colorScheme: data.colorScheme || 'viridis',
        opacity: data.opacity || 0.8,
        strokeWidth: data.strokeWidth || 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Store in database (would use actual database implementation)
      console.log('Storing StyleMap configuration:', config);
      
      // 3. Initialize any necessary data structures
      await this.initializeStyleMapData(nodeId, config);
    } catch (error) {
      console.error('Failed to create StyleMap configuration:', error);
      throw error;
    }
  }

  /**
   * Process extension data when updating a folder-plugin
   */
  async onUpdate(nodeId: NodeId, data: Partial<StyleMapExtensionData>): Promise<void> {
    // Update StyleMap configuration
    console.log('Updating StyleMap configuration for node:', nodeId, data);

    try {
      // 1. Load existing configuration
      const existingConfig = await this.loadConfiguration(nodeId);
      if (!existingConfig) {
        throw new Error(`StyleMap configuration not found for node: ${nodeId}`);
      }

      // 2. Merge with new data
      const updatedConfig = {
        ...existingConfig,
        ...data,
        updatedAt: Date.now(),
      };

      // 3. Validate the updated configuration
      const validation = await this.validate(updatedConfig);
      if (!validation.isValid) {
        throw new Error(`Invalid StyleMap configuration: ${validation.errors.join(', ')}`);
      }

      // 4. Save to database
      await this.saveConfiguration(nodeId, updatedConfig);
      console.log('StyleMap configuration updated successfully');
    } catch (error) {
      console.error('Failed to update StyleMap configuration:', error);
      throw error;
    }
  }

  /**
   * Clean up when a folder-plugin is deleted
   */
  async onDelete(nodeId: NodeId): Promise<void> {
    // Clean up StyleMap data
    console.log('Cleaning up StyleMap data for node:', nodeId);

    try {
      // 1. Delete StyleMap configuration
      await this.deleteConfiguration(nodeId);

      // 2. Remove any associated data files
      await this.cleanupDataFiles(nodeId);

      // 3. Clean up cache entries
      await this.clearCache(nodeId);

      console.log('StyleMap cleanup completed successfully');
    } catch (error) {
      console.error('Failed to cleanup StyleMap data:', error);
      // Don't throw error for cleanup operations to avoid blocking deletion
    }
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

  // === Private Helper Methods ===

  private async initializeStyleMapData(nodeId: NodeId, _config: any): Promise<void> {
    // Initialize any necessary data structures for the StyleMap
    console.log('Initializing StyleMap data structures for:', nodeId);
    // This would set up default data structures, cache entries, etc.
  }

  private async loadConfiguration(nodeId: NodeId): Promise<StyleMapExtensionData | null> {
    // Load existing configuration from database
    console.log('Loading StyleMap configuration for:', nodeId);
    // This would fetch from actual database
    return null; // Placeholder
  }

  private async saveConfiguration(nodeId: NodeId, config: any): Promise<void> {
    // Save configuration to database
    console.log('Saving StyleMap configuration for:', nodeId, config);
    // This would save to actual database
  }

  private async deleteConfiguration(nodeId: NodeId): Promise<void> {
    // Delete configuration from database
    console.log('Deleting StyleMap configuration for:', nodeId);
    // This would delete from actual database
  }

  private async cleanupDataFiles(nodeId: NodeId): Promise<void> {
    // Remove any associated data files
    console.log('Cleaning up StyleMap data files for:', nodeId);
    // This would clean up temporary files, generated styles, etc.
  }

  private async clearCache(nodeId: NodeId): Promise<void> {
    // Clear cache entries
    console.log('Clearing StyleMap cache for:', nodeId);
    // This would clear any cached data related to this StyleMap
  }
}

export default StyleMapExtensionHandler;
