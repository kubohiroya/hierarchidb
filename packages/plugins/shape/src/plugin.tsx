/**
 import type {
 NodeId,
 PluginDefinition,
 TreeNode,
 TreeNodeType,
 } from "@hierarchidb/00-core";
 import { mockShapeService } from "./services/MockShapeService";

 interface IconDefinition {
 muiIconName: string;
 emoji: string;
 color: string;
 }


 * Shape Plugin Definition for HierarchiDB
 * Provides geographic shape data management capabilities
 * 
 * TODO: Update to match current PluginAPI architecture


export const ShapePluginDefinition: PluginDefinition<ShapeEntity, never, ShapeWorkingCopy> = {
  // Node type identification
  nodeType: 'shape' as TreeNodeType,
  name: 'Shape',
  displayName: 'Geographic Shape',
  
  // Icon configuration  
  icon: shapeIcon,
  
  // Category configuration - available in all trees, advanced menu
  category: {
    treeId: '*',
    menuGroup: 'advanced',
    createOrder: 25,
  },
  
  // i18n configuration (future implementation)
  i18n: {
    namespace: 'plugin-shape',
    defaultLocale: 'en',
    localesPath: '/plugins/shape/locales/{{lng}}/core.json',
  },
  
  database: {
    dbName: 'ShapeDB',
    tableName: 'shapes',
    schema: 'nodeId, name, dataSourceName, createdAt, updatedAt',
    version: 1,
  },
  
  entityHandler: {
    async createEntity(nodeId: NodeId, data: Partial<ShapeEntity>): Promise<ShapeEntity> {
      return mockShapeService.createEntity(nodeId, data);
    },
    
    async getEntity(entityId: EntityId): Promise<ShapeEntity | undefined> {
      return mockShapeService.getEntity(entityId);
    },
    
    async updateEntity(entityId: EntityId, updates: Partial<ShapeEntity>): Promise<ShapeEntity> {
      return mockShapeService.updateEntity(entityId, updates);
    },
    
    async deleteEntity(entityId: EntityId): Promise<void> {
      return mockShapeService.deleteEntity(entityId);
    },
    
    async createWorkingCopy(nodeId: NodeId, entity?: ShapeEntity): Promise<ShapeWorkingCopy> {
      return mockShapeService.createWorkingCopy(nodeId, entity);
    },
    
    async commitWorkingCopy(nodeId: NodeId, _workingCopy: ShapeWorkingCopy): Promise<ShapeEntity> {
      return mockShapeService.commitWorkingCopy(nodeId);
    },
  },
  
  lifecycle: {
    afterCreate: async (node: TreeNode, _context: LifecycleContext) => {
      console.log('Shape node created:', node.id);
    },
    
    beforeDelete: async (node: TreeNode, _context: LifecycleContext) => {
      console.log('Shape node will be deleted:', node.id);
      // Clean up any associated batch processing data
    },
  },
  
  ui: {
    // Path to dialog component - will be loaded dynamically
    dialogComponentPath: '@hierarchidb/plugin-shape/components/ShapesStepperDialog',
    panelComponentPath: '@hierarchidb/plugin-shape/components/ShapePanel',
    formComponentPath: '@hierarchidb/plugin-shape/components/ShapeForm',
    iconComponentPath: '@hierarchidb/plugin-shape/components/ShapeIcon',
  },
  
  validation: {
    validateEntity: (entity: Partial<ShapeEntity>) => {
      const errors: string[] = [];
      
      if (!entity.name || entity.name.length === 0) {
        errors.push('Name is required');
      }
      
      if (!entity.dataSourceName) {
        errors.push('Data source must be selected');
      }
      
      if (!entity.licenseAgreement) {
        errors.push('License agreement is required');
      }
      
      return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    },
  },
  
  // API extensions (future implementation)
  api: {
    workerExtensions: {},
    clientExtensions: {},
  },
  
  // Additional metadata
  metadata: {
    version: '1.0.0',
    author: 'HierarchiDB Team',
    description: 'Manage geographic shape data with batch processing capabilities for multiple data sources',
    tags: ['geographic', 'shapes', 'maps', 'batch-processing', 'geojson'],
    experimental: false,
    priority: 25, // Display priority in menus
  },
};
 */
