/**
 * Plugin Registration Module
 * Centralizes plugin imports and registration for HierarchiDB
 */

import { UnifiedNodeTypeRegistry } from '../registry/UnifiedNodeTypeRegistry';

/**
 * Register all available plugins with the unified registry
 */
export function registerBuiltinPlugins(): void {
  const registry = UnifiedNodeTypeRegistry.getInstance();
  
  // Register Folder plugin
  const folderPlugin = {
    nodeType: 'folder' as any,
    name: 'Folder',
    displayName: 'Folder',
    icon: {
      muiIconName: 'Folder',
      emoji: '📁',
      color: '#FFA726',
    },
    category: {
      treeId: '*',
      menuGroup: 'basic',
      createOrder: 10,
    },
    i18n: {
      namespace: 'plugin-folder',
      defaultLocale: 'en',
      localesPath: '/plugins/folder/locales/{{lng}}/core.json',
    },
    database: {
      dbName: 'FolderDB',
      tableName: 'folders',
      schema: 'nodeId, name, description, createdAt, updatedAt',
      version: 1,
    },
    ui: {
      dialogComponentPath: '@hierarchidb/plugin-folder/components/FolderCreateDialog',
      panelComponentPath: '@hierarchidb/plugin-folder/components/FolderPanel',
      formComponentPath: '@hierarchidb/plugin-folder/components/FolderForm',
      iconComponentPath: '@hierarchidb/plugin-folder/components/FolderIcon',
    },
    metadata: {
      version: '1.0.0',
      author: 'HierarchiDB Team',
      description: 'Basic folder organization functionality',
      tags: ['organization', 'folder', 'basic'],
      experimental: false,
      priority: 10,
    },
  } as any;
  
  // Register BaseMap plugin
  const basemapPlugin = {
    nodeType: 'basemap' as any,
    name: 'BaseMap',
    displayName: 'Base Map',
    icon: {
      muiIconName: 'Map',
      emoji: '🗺️',
      color: '#4CAF50',
    },
    category: {
      treeId: '*',
      menuGroup: 'advanced',
      createOrder: 15,
    },
    i18n: {
      namespace: 'plugin-basemap',
      defaultLocale: 'en',
      localesPath: '/plugins/basemap/locales/{{lng}}/core.json',
    },
    database: {
      dbName: 'BaseMapDB',
      tableName: 'basemaps',
      schema: 'nodeId, name, mapStyle, tileConfig, createdAt, updatedAt',
      version: 1,
    },
    ui: {
      dialogComponentPath: '@hierarchidb/plugin-basemap/components/BaseMapDialog',
      panelComponentPath: '@hierarchidb/plugin-basemap/components/BaseMapPanel',
      formComponentPath: '@hierarchidb/plugin-basemap/components/BaseMapForm',
      iconComponentPath: '@hierarchidb/plugin-basemap/components/BaseMapIcon',
    },
    metadata: {
      version: '1.0.0',
      author: 'HierarchiDB Team',
      description: 'Base map functionality with tile rendering and caching',
      tags: ['map', 'basemap', 'tiles', 'geographic'],
      experimental: false,
      priority: 15,
    },
  } as any;

  // Register StyleMap plugin
  const stylemapPlugin = {
    nodeType: 'stylemap' as any,
    name: 'StyleMap',
    displayName: 'Style Map',
    icon: {
      muiIconName: 'Palette',
      emoji: '🎨',
      color: '#FF5722',
    },
    category: {
      treeId: '*',
      menuGroup: 'advanced',
      createOrder: 20,
    },
    i18n: {
      namespace: 'plugin-stylemap',
      defaultLocale: 'en',
      localesPath: '/plugins/stylemap/locales/{{lng}}/core.json',
    },
    database: {
      dbName: 'StyleMapDB',
      tableName: 'stylemaps',
      schema: 'nodeId, name, filename, colorScheme, filterRules, createdAt, updatedAt',
      version: 1,
    },
    ui: {
      dialogComponentPath: '@hierarchidb/plugin-stylemap/components/StyleMapDialog',
      panelComponentPath: '@hierarchidb/plugin-stylemap/components/StyleMapPanel',
      formComponentPath: '@hierarchidb/plugin-stylemap/components/StyleMapForm',
      iconComponentPath: '@hierarchidb/plugin-stylemap/components/StyleMapIcon',
    },
    metadata: {
      version: '1.0.0',
      author: 'HierarchiDB Team',
      description: 'CSV/TSV data to MapLibre style mapping with color schemes and filtering',
      tags: ['style', 'mapping', 'csv', 'color', 'visualization'],
      experimental: false,
      priority: 20,
    },
  } as any;
  
  // Register Shape plugin
  const shapePlugin = {
    nodeType: 'shape' as any,
    name: 'Shape',
    displayName: 'Geographic Shape',
    icon: {
      muiIconName: 'Layers',
      emoji: '🗺️',
      color: '#4CAF50',
    },
    category: {
      treeId: '*',
      menuGroup: 'advanced',
      createOrder: 25,
    },
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
    ui: {
      dialogComponentPath: '@hierarchidb/plugin-shape/components/ShapesStepperDialog',
      panelComponentPath: '@hierarchidb/plugin-shape/components/ShapePanel',
      formComponentPath: '@hierarchidb/plugin-shape/components/ShapeForm',
      iconComponentPath: '@hierarchidb/plugin-shape/components/ShapeIcon',
    },
    metadata: {
      version: '1.0.0',
      author: 'HierarchiDB Team',
      description: 'Manage geographic shape data with batch processing capabilities for multiple data sources',
      tags: ['geographic', 'shapes', 'maps', 'batch-processing', 'geojson'],
      experimental: false,
      priority: 25,
    },
  } as any;
  
  // Register all plugins in order: folder, basemap, stylemap, shape
  registry.registerPlugin(folderPlugin);
  registry.registerPlugin(basemapPlugin);
  registry.registerPlugin(stylemapPlugin);
  registry.registerPlugin(shapePlugin);
  
  console.log('Registered builtin plugins:', registry.getAllNodeTypes());
}

/**
 * Initialize plugin APIs for 3-layer architecture support
 */
export async function initializePluginAPIs(workerAPI: any): Promise<void> {
  console.log('Initializing plugin APIs for 3-layer architecture...');

  // Get the plugin registry from WorkerAPI
  const pluginRegistry = await workerAPI.getPluginRegistryAPI();

  // Project plugin not yet available - skip for now
  // try {
  //   const { projectPluginAPI } = await import('@hierarchidb/plugin-project/worker' as string);
  //   await pluginRegistry.registerExtension('project', projectPluginAPI.methods);
  //   console.log('Registered project plugin API');
  // } catch (error) {
  //   console.warn('Project plugin not available:', error);
  // }

  // Basemap plugin API not yet available - skip for now
  // try {
  //   const { basemapPluginAPI } = await import('@hierarchidb/plugin-basemap/worker' as string);
  //   await pluginRegistry.registerExtension('basemap', basemapPluginAPI.methods);
  //   console.log('Registered basemap plugin API');
  // } catch (error) {
  //   console.warn('Basemap plugin API not available (may not be updated to 3-layer yet):', error);
  // }

  // Stylemap plugin API not yet available - skip for now
  // try {
  //   const { stylemapPluginAPI } = await import('@hierarchidb/plugin-stylemap/worker' as string);
  //   await pluginRegistry.registerExtension('stylemap', stylemapPluginAPI.methods);
  //   console.log('Registered stylemap plugin API');
  // } catch (error) {
  //   console.warn('Stylemap plugin API not available (may not be updated to 3-layer yet):', error);
  // }

  // Shape plugin API not yet available - skip for now
  // try {
  //   const { shapePluginAPI } = await import('@hierarchidb/plugin-shape/worker' as string);
  //   await pluginRegistry.registerExtension('shape', shapePluginAPI.methods);
  //   console.log('Registered shape plugin API');
  // } catch (error) {
  //   console.warn('Shape plugin API not available (may not be updated to 3-layer yet):', error);
  // }

  console.log('Plugin API initialization completed');
}