/**
 * @file LocationDefinition.ts
 * @description Location plugin definition with Shape plugin integration
 */

import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';
import { LocationDialog } from '../components/LocationDialog';
import { LocationPanel } from '../components/LocationPanel';

/**
 * Location plugin definition extending Shape plugin capabilities
 */
export const LocationPluginDefinition = {
  // Plugin identification
  nodeType: 'location' as NodeType,
  nodeTypeDisplayName: 'Location',
  nodeTypeDescription: 'Geographic location data management with Shape plugin integration',
  nodeTypeIcon: 'LocationOn',
  
  // Database configuration
  database: {
    entityStore: 'locations',
    workingCopyStore: 'locationWorkingCopies',
    
    schema: {
      locations: {
        // Primary and indexed fields for efficient queries
        indexes: '&id, nodeId, [category+type], dataSource, [point.coordinates[0]+point.coordinates[1]], ' +
                'parentLocationId, relatedShapeId, processingStatus, importance, ' +
                '[address.countryCode+address.city], createdAt, updatedAt',
        version: 2
      },
      locationWorkingCopies: {
        indexes: '&id, nodeId, isDraft, copiedAt, originalVersion',
        version: 2
      },
      // Batch processing tables (inherited from Shape)
      locationBatchSessions: {
        indexes: '&sessionId, nodeId, status, startTime',
        version: 1
      },
      locationBatchTasks: {
        indexes: '&taskId, sessionId, status, [sessionId+status]',
        version: 1
      }
    },
    
    version: 2
  },
  
  // Entity handler with metadata support
  entityHandler: null as any, // Will be instantiated with database table
  
  // Batch processing manager
  batchManager: null as any, // Will be instantiated on demand
  
  // Lifecycle hooks
  lifecycle: {
    async onCreate(nodeId: NodeId, _context: any): Promise<void> {
      console.log(`[LocationPlugin] Creating location node: ${nodeId}`);
      
      // Initialize entity handler with database table
      // if (!this.entityHandler) {
      //   this.entityHandler = new LocationEntityHandler(context.database.locations);
      // }
      
      // Initialize batch manager if needed
      // if (!this.batchManager) {
      //   this.batchManager = new LocationBatchManager();
      // }
    },
    
    async afterCreate(node: TreeNode, _context: any): Promise<void> {
      console.log(`[LocationPlugin] Created location node: ${node.id}`);
      
      // Check if this location should be linked to a Shape
      // if (node.metadata?.relatedShapeId) {
      //   await this.linkToShape(node.id, node.metadata.relatedShapeId);
      // }
    },
    
    async beforeDelete(node: TreeNode, _context: any): Promise<void> {
      console.log(`[LocationPlugin] Deleting location node: ${node.id}`);
      
      // Clean up Shape relationships
      // const entity = await this.entityHandler.getEntityByNodeId(node.id);
      // if (entity?.relatedShapeId) {
      //   await this.unlinkFromShape(node.id, entity.relatedShapeId);
      // }
      
      // Clean up batch sessions
      // await this.cleanupBatchSessions(node.id);
    },
    
    async afterUpdate(node: TreeNode, _context: any): Promise<void> {
      console.log(`[LocationPlugin] Updated location node: ${node.id}`);
      
      // Update search index if location changed
      // const entity = await this.entityHandler.getEntityByNodeId(node.id);
      // if (entity) {
      //   await this.updateSearchIndex(entity);
      // }
    },
    
    async onExport(node: TreeNode, _context: any): Promise<any> {
      // const entity = await this.entityHandler.getEntityByNodeId(node.id);
      // if (!entity) return null;
      
      // Export as GeoJSON
      // Placeholder implementation
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [0, 0],
        },
        properties: {
          id: node.id,
          name: node.name,
        },
      };
    },
    
    async onImport(data: any, context: any): Promise<TreeNode> {
      // Import from GeoJSON
      if (data.type === 'Feature' && data.geometry?.type === 'Point') {
        const nodeId = context.generateNodeId() as NodeId;
        
        // Placeholder implementation
        return {
          id: nodeId,
          nodeType: 'location' as NodeType,
          name: data.properties.name || 'Imported Location',
          parentId: null as any,
          depth: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };
      }
      
      throw new Error('Invalid import data format');
    }
  },
  
  // UI components
  ui: {
    dialogComponent: LocationDialog,
    panelComponent: LocationPanel,
    
    config: {
      // Menu configuration
      showInCreateMenu: true,
      createMenuLabel: 'Location',
      createMenuIcon: 'LocationOn',
      createMenuCategory: 'geographic',
      createMenuDescription: 'Create a geographic location point',
      
      // Panel configuration
      panelPosition: 'right',
      panelDefaultWidth: 400,
      panelMinWidth: 300,
      panelMaxWidth: 600,
      panelResizable: true,
      
      // Dialog configuration
      dialogMaxWidth: 'lg',
      dialogFullScreen: false,
      dialogFullWidth: true,
      
      // Tree display
      treeIcon: 'LocationOn',
      treeIconColor: '#f44336',
      showChildCount: true,
      allowDragDrop: true,
      
      // Batch processing UI
      batchProcessingEnabled: true,
      batchProcessingWizard: true,
      batchProcessingSteps: 8,
    }
  },
  
  // Plugin capabilities
  capabilities: {
    // Core capabilities
    supportsBatchProcessing: true,
    supportsWorkingCopy: true,
    supportsRelationalData: true,
    supportsMetadata: true,
    supportsCustomFields: true,
    supportsTags: true,
    
    // Import/Export
    supportsExport: true,
    supportsImport: true,
    exportFormats: ['geojson', 'csv', 'kml'],
    importFormats: ['geojson', 'csv', 'kml', 'gpx'],
    
    // Visualization
    supportsVisualization: true,
    visualizationTypes: ['marker', 'cluster', 'heatmap'],
    supportsMapIntegration: true,
    
    // Search and filtering
    supportsSearch: true,
    supportsAdvancedFiltering: true,
    supportsProximitySearch: true,
    supportsGeocoding: true,
    
    // Data management
    supportsVersioning: true,
    supportsValidation: true,
    supportsDuplication: true,
    supportsMerging: true,
    
    // Shape plugin integration
    extendsPlugin: 'shape-plugin',
    shapeIntegration: {
      canBeShapeAnchor: true,
      canReferenceShapes: true,
      supportsBatchWithShapes: true,
    }
  },
  
  // Plugin metadata
  metadata: {
    version: '1.0.0',
    author: 'HierarchiDB Team',
    license: 'MIT',
    homepage: 'https://hierarchidb.org/plugins/location',
    repository: 'https://github.com/hierarchidb/location-plugin',
    
    tags: [
      'geographic',
      'location',
      'points',
      'openstreetmap',
      'geonames',
      'wikidata',
      'geocoding',
      'shape-extension'
    ],
    
    dependencies: {
      '@hierarchidb/common-type': '^1.0.0',
      '@hierarchidb/plugin-base': '^1.0.0',
      '@hierarchidb/shape-plugin': '^1.0.0',
    },
    
    requiredPermissions: [
      'network',      // For API calls
      'storage',      // For data persistence
      'geolocation',  // For device location
    ],
    
    compatibleWith: [
      'shape-plugin',
      'route-plugin',
      'project',
      'basemap-plugin',
    ],
    
    configuration: {
      defaultDataSource: 'openstreetmap',
      defaultSearchRadius: 1000, // meters
      defaultMaxResults: 100,
      enableClustering: true,
      clusterRadius: 50, // pixels
      minClusterSize: 2,
      maxZoomForClusters: 14,
      geocodingProvider: 'nominatim',
      corsProxyUrl: null,
    }
  }
};

export default LocationPluginDefinition;
