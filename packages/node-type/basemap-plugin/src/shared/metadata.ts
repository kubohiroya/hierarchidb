/**
 * @file shared/metadata.ts
 * @description BaseMap plugin metadata
 */

export const PLUGIN_METADATA = {
  id: 'com.hierarchidb.basemap',
  name: 'BaseMap Plugin',
  version: '1.0.0',
  description: 'BaseMap visualization plugin extending folder functionality',
  extends: 'folder-plugin',
  architecture: 'extension',
  
  // Extension metadata
  extensionInfo: {
    basePlugin: 'folder-plugin',
    extensionType: 'visualization',
    stepsAdded: 4,
    fieldsAdded: 9
  },
  
  // Capabilities
  capabilities: {
    mapVisualization: true,
    styleCustomization: true,
    viewportControl: true,
    interactionControl: true
  },
  
  // Requirements
  requirements: {
    browser: {
      webgl: true,
      canvas: true
    },
    dependencies: [
      '@hierarchidb/node-type-folder-plugin',
      '@hierarchidb/ui-map'
    ]
  }
} as const;