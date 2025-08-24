/**
 * Worker API implementation for BaseMap plugin
 * Implements BaseMapAPI interface from shared layer
 */

import { NodeId } from '@hierarchidb/common-core';
import type { PluginAPI } from '@hierarchidb/common-api';
import { 
  BaseMapAPI, 
  BaseMapEntity, 
  CreateBaseMapData, 
  UpdateBaseMapData, 
  BaseMapStatistics,
  BaseMapApiMetadata,
  MapViewportState,
  BaseMapDisplayOptions,
  BaseMapValidationResult,
  MapLibreStyleConfig,

  validateUpdateBaseMapData,
  validateStyleConfig,
  calculateEstimatedTileCount,
  calculateBoundsArea,
  generateThumbnailPlaceholder
} from '../shared';
import { BaseMapEntityHandler } from './handlers';

/**
 * BaseMap Worker API implementation
 * This will be registered in the PluginRegistry system
 */
export const basemapPluginAPI: PluginAPI<BaseMapAPI> = {
  nodeType: 'basemap',
  methods: {
    async createEntity(nodeId: NodeId, data: CreateBaseMapData): Promise<BaseMapEntity> {
      const handler = new BaseMapEntityHandler();
      return await handler.createEntity(nodeId, data);
    },

    async getEntity(nodeId: NodeId): Promise<BaseMapEntity | undefined> {
      const handler = new BaseMapEntityHandler();
      return await handler.getEntity(nodeId);
    },

    async updateEntity(nodeId: NodeId, data: UpdateBaseMapData): Promise<void> {
      const handler = new BaseMapEntityHandler();
      await handler.updateEntity(nodeId, data);
    },

    async deleteEntity(nodeId: NodeId): Promise<void> {
      const handler = new BaseMapEntityHandler();
      await handler.deleteEntity(nodeId);
    },

    async setMapStyle(nodeId: NodeId, style: 'streets' | 'satellite' | 'hybrid' | 'terrain' | 'custom'): Promise<void> {
      const handler = new BaseMapEntityHandler();
      await handler.updateEntity(nodeId, { mapStyle: style });
    },

    async setCustomStyle(nodeId: NodeId, styleUrl: string): Promise<void> {
      const handler = new BaseMapEntityHandler();
      await handler.updateEntity(nodeId, { 
        mapStyle: 'custom', 
        styleUrl,
        styleConfig: undefined // Clear styleConfig when using URL
      });
    },

    async setCustomStyleConfig(nodeId: NodeId, styleConfig: MapLibreStyleConfig): Promise<void> {
      const validation = validateStyleConfig(styleConfig);
      if (!validation.isValid) {
        throw new Error(`Invalid style configuration: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      const handler = new BaseMapEntityHandler();
      await handler.updateEntity(nodeId, { 
        mapStyle: 'custom',
        styleConfig,
        styleUrl: undefined // Clear URL when using config
      });
    },

    async getMapStyle(nodeId: NodeId): Promise<string | undefined> {
      const handler = new BaseMapEntityHandler();
      const entity = await handler.getEntity(nodeId);
      return entity?.mapStyle;
    },

    async setViewport(nodeId: NodeId, viewport: MapViewportState): Promise<void> {
      const handler = new BaseMapEntityHandler();
      await handler.updateEntity(nodeId, {
        center: viewport.center,
        zoom: viewport.zoom,
        bearing: viewport.bearing,
        pitch: viewport.pitch,
        bounds: viewport.bounds
      });
    },

    async getViewport(nodeId: NodeId): Promise<MapViewportState | undefined> {
      const handler = new BaseMapEntityHandler();
      const entity = await handler.getEntity(nodeId);
      if (!entity) return undefined;

      return {
        center: entity.center,
        zoom: entity.zoom,
        bearing: entity.bearing,
        pitch: entity.pitch,
        bounds: entity.bounds
      };
    },

    async setCenter(nodeId: NodeId, center: [number, number]): Promise<void> {
      const handler = new BaseMapEntityHandler();
      await handler.updateEntity(nodeId, { center });
    },

    async setZoom(nodeId: NodeId, zoom: number): Promise<void> {
      const handler = new BaseMapEntityHandler();
      await handler.updateEntity(nodeId, { zoom });
    },

    async setBounds(nodeId: NodeId, bounds: { north: number; south: number; east: number; west: number }): Promise<void> {
      const handler = new BaseMapEntityHandler();
      await handler.updateEntity(nodeId, { bounds });
    },

    async setDisplayOptions(nodeId: NodeId, options: BaseMapDisplayOptions): Promise<void> {
      const handler = new BaseMapEntityHandler();
      await handler.updateEntity(nodeId, { displayOptions: options });
    },

    async getDisplayOptions(nodeId: NodeId): Promise<BaseMapDisplayOptions | undefined> {
      const handler = new BaseMapEntityHandler();
      const entity = await handler.getEntity(nodeId);
      return entity?.displayOptions;
    },

    async validateMapConfiguration(nodeId: NodeId): Promise<BaseMapValidationResult> {
      const handler = new BaseMapEntityHandler();
      const entity = await handler.getEntity(nodeId);
      
      if (!entity) {
        return {
          isValid: false,
          errors: [{ code: 'ENTITY_NOT_FOUND', message: 'BaseMap entity not found' }],
          warnings: [],
          configuration: {
            hasValidStyle: false,
            hasValidViewport: false,
            hasValidBounds: false,
            estimatedTileCount: 0,
            estimatedDataSize: 0
          }
        };
      }

      // Validate the entity data
      const entityValidation = validateUpdateBaseMapData({
        name: entity.name,
        mapStyle: entity.mapStyle,
        center: entity.center,
        zoom: entity.zoom,
        bearing: entity.bearing,
        pitch: entity.pitch,
        bounds: entity.bounds
      });

      // Additional validation for style configuration
      let styleValidation: any = { isValid: true, errors: [], warnings: [] };
      if (entity.mapStyle === 'custom' && entity.styleConfig) {
        styleValidation = validateStyleConfig(entity.styleConfig);
      }

      // Calculate performance metrics
      let estimatedTileCount = 0;
      let estimatedDataSize = 0;
      
      if (entity.bounds) {
        estimatedTileCount = calculateEstimatedTileCount(entity.bounds, entity.zoom);
        const boundsArea = calculateBoundsArea(entity.bounds);
        estimatedDataSize = Math.floor(boundsArea * entity.zoom * 1000); // Rough estimate
      }

      return {
        isValid: entityValidation.isValid && styleValidation.isValid,
        errors: [...entityValidation.errors, ...styleValidation.errors],
        warnings: [...entityValidation.warnings, ...styleValidation.warnings],
        configuration: {
          hasValidStyle: entity.mapStyle !== 'custom' || (!!entity.styleUrl || !!entity.styleConfig),
          hasValidViewport: true, // Basic viewport is always valid if entity exists
          hasValidBounds: !entity.bounds || (
            entity.bounds.north > entity.bounds.south &&
            entity.bounds.east > entity.bounds.west
          ),
          estimatedTileCount,
          estimatedDataSize
        }
      };
    },

    async generateThumbnail(nodeId: NodeId, width: number, height: number): Promise<string> {
      const handler = new BaseMapEntityHandler();
      const entity = await handler.getEntity(nodeId);
      
      if (!entity) {
        throw new Error('BaseMap entity not found');
      }

      // For now, generate a placeholder thumbnail
      // In a real implementation, this would render the actual map
      const thumbnailUrl = generateThumbnailPlaceholder(width, height, entity.mapStyle);
      
      // Update entity with thumbnail URL
      await handler.updateEntity(nodeId, { thumbnailUrl });
      
      return thumbnailUrl;
    },

    async getBaseMapStatistics(nodeId: NodeId): Promise<BaseMapStatistics> {
      const handler = new BaseMapEntityHandler();
      const entity = await handler.getEntity(nodeId);
      
      if (!entity) {
        throw new Error('BaseMap entity not found');
      }

      // For now, return mock statistics
      // In a real implementation, this would track actual usage
      return {
        nodeId,
        totalTilesLoaded: 0,
        totalDataSize: 0,
        cacheHitRate: 0,
        lastAccessed: entity.updatedAt,
        accessCount: 1,
        averageLoadTime: 0,
        errors: {
          tileLoadErrors: 0,
          networkErrors: 0,
          styleLoadErrors: 0
        }
      };
    },

    async getMapMetadata(nodeId: NodeId): Promise<BaseMapApiMetadata> {
      const handler = new BaseMapEntityHandler();
      const entity = await handler.getEntity(nodeId);
      
      if (!entity) {
        throw new Error('BaseMap entity not found');
      }

      // Extract metadata from entity
      const layerCount = entity.styleConfig?.layers?.length || 1;
      const sourceCount = entity.styleConfig?.sources ? Object.keys(entity.styleConfig.sources).length : 1;
      
      let bounds = null;
      if (entity.bounds) {
        bounds = entity.bounds;
      } else if (entity.styleConfig?.center) {
        // Create a small bounds around center for display
        const [lng, lat] = entity.styleConfig.center;
        const delta = 0.01; // Small delta for default bounds
        bounds = {
          north: lat + delta,
          south: lat - delta,
          east: lng + delta,
          west: lng - delta
        };
      }

      return {
        nodeId,
        mapStyle: entity.mapStyle,
        hasCustomStyle: entity.mapStyle === 'custom',
        layerCount,
        sourceCount,
        bounds,
        zoomRange: {
          min: 0,
          max: 22
        },
        attribution: entity.attribution ? [entity.attribution] : [],
        supportedProjections: ['EPSG:3857'] // Web Mercator is standard
      };
    }
  }
};