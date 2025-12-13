/**
 * Styler extension handler
 * Processes Styler-specific data when creating/editing folders
 */

import type { NodeId } from '@hierarchidb/common-types';

export interface StylerExtensionData {
  stylerConfig?: {
    styleType?: 'choropleth' | 'points' | 'lines';
  };
  styleType?: 'choropleth' | 'points' | 'lines'; // legacy
  dataSource?: string;
  colorScheme?: string;
  opacity?: number;
  strokeWidth?: number;
}

type StylerStoredConfig = StylerExtensionData & {
  nodeId: NodeId;
  colorScheme: string;
  opacity: number;
  strokeWidth: number;
  createdAt: number;
  updatedAt: number;
};

export class StylerExtensionHandler {
  /**
   * Process extension data when creating a folder-plugin
   */
  async onCreate(nodeId: NodeId, data: StylerExtensionData): Promise<void> {
    // Store Styler configuration in database
    console.log('Creating Styler configuration for node:', nodeId, data);

    // 1. Validate the Styler configuration
    const validation = await this.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid Styler configuration: ${validation.errors.join(', ')}`);
    }

    // 2. Store configuration in StylerDB
    try {
      const resolvedStyleType = data.stylerConfig?.styleType ?? data.styleType ?? 'choropleth';
      const config: StylerStoredConfig = {
        nodeId,
        stylerConfig: {
          ...(data.stylerConfig ?? {}),
          styleType: resolvedStyleType,
        },
        dataSource: data.dataSource || '',
        colorScheme: data.colorScheme || 'viridis',
        opacity: data.opacity || 0.8,
        strokeWidth: data.strokeWidth || 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Store in database (would use actual database implementation)
      console.log('Storing Styler configuration:', config);

      // 3. Initialize any necessary data structures
      await this.initializeStylerData(nodeId, config);
    } catch (error) {
      console.error('Failed to create Styler configuration:', error);
      throw error;
    }
  }

  /**
   * Process extension data when updating a folder-plugin
   */
  async onUpdate(nodeId: NodeId, data: Partial<StylerExtensionData>): Promise<void> {
    // Update Styler configuration
    console.log('Updating Styler configuration for node:', nodeId, data);

    try {
      // 1. Load existing configuration
      const existingConfig = await this.loadConfiguration(nodeId);
      if (!existingConfig) {
        throw new Error(`Styler configuration not found for node: ${nodeId}`);
      }

      // 2. Merge with new data
      const resolvedStyleType = data.stylerConfig?.styleType ?? data.styleType ?? existingConfig.stylerConfig?.styleType ?? 'choropleth';
      const updatedConfig: StylerStoredConfig = {
        ...(existingConfig ?? ({ nodeId } as StylerStoredConfig)),
        ...data,
        nodeId,
        colorScheme: data.colorScheme ?? existingConfig?.colorScheme ?? 'viridis',
        opacity: data.opacity ?? existingConfig?.opacity ?? 0.8,
        strokeWidth: data.strokeWidth ?? existingConfig?.strokeWidth ?? 1,
        stylerConfig: {
          ...(existingConfig.stylerConfig ?? {}),
          ...(data.stylerConfig ?? {}),
          styleType: resolvedStyleType,
        },
        updatedAt: Date.now(),
        createdAt: (existingConfig as StylerStoredConfig | null)?.createdAt ?? Date.now(),
      };

      // 3. Validate the updated configuration
      const validation = await this.validate(updatedConfig);
      if (!validation.isValid) {
        throw new Error(`Invalid Styler configuration: ${validation.errors.join(', ')}`);
      }

      // 4. Save to database
      await this.saveConfiguration(nodeId, updatedConfig);
      console.log('Styler configuration updated successfully');
    } catch (error) {
      console.error('Failed to update Styler configuration:', error);
      throw error;
    }
  }

  /**
   * Clean up when a folder-plugin is deleted
   */
  async onDelete(nodeId: NodeId): Promise<void> {
    // Clean up Styler data
    console.log('Cleaning up Styler data for node:', nodeId);

    try {
      // 1. Delete Styler configuration
      await this.deleteConfiguration(nodeId);

      // 2. Remove any associated data files
      await this.cleanupDataFiles(nodeId);

      // 3. Clean up cache entries
      await this.clearCache(nodeId);

      console.log('Styler cleanup completed successfully');
    } catch (error) {
      console.error('Failed to cleanup Styler data:', error);
      // Don't throw error for cleanup operations to avoid blocking deletion
    }
  }

  /**
   * Validate extension data
   */
  async validate(data: StylerExtensionData): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate style type
    const styleType = data.stylerConfig?.styleType ?? data.styleType;
    if (styleType && !['choropleth', 'points', 'lines'].includes(styleType)) {
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

  private async initializeStylerData(nodeId: NodeId, _config: StylerStoredConfig): Promise<void> {
    // Initialize any necessary data structures for the Styler
    console.log('Initializing Styler data structures for:', nodeId);
    // This would set up default data structures, cache entries, etc.
  }

  private async loadConfiguration(nodeId: NodeId): Promise<StylerStoredConfig | null> {
    // Load existing configuration from database
    console.log('Loading Styler configuration for:', nodeId);
    // This would fetch from actual database
    return null; // Placeholder
  }

  private async saveConfiguration(nodeId: NodeId, config: StylerStoredConfig): Promise<void> {
    // Save configuration to database
    console.log('Saving Styler configuration for:', nodeId, config);
    // This would save to actual database
  }

  private async deleteConfiguration(nodeId: NodeId): Promise<void> {
    // Delete configuration from database
    console.log('Deleting Styler configuration for:', nodeId);
    // This would delete from actual database
  }

  private async cleanupDataFiles(nodeId: NodeId): Promise<void> {
    // Remove any associated data files
    console.log('Cleaning up Styler data files for:', nodeId);
    // This would clean up temporary files, generated styles, etc.
  }

  private async clearCache(nodeId: NodeId): Promise<void> {
    // Clear cache entries
    console.log('Clearing Styler cache for:', nodeId);
    // This would clear any cached data related to this Styler
  }
}
