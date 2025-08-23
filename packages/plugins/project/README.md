# @hierarchidb/plugin-project

A comprehensive map project management plugin for HierarchiDB that enables users to create, manage, and visualize map-based projects with multiple data layers and resources.

## Overview

The Project Plugin provides a complete solution for organizing and visualizing geospatial data within HierarchiDB. It allows users to:

- Create map-based projects with configurable viewports
- Reference and manage multiple data resources (BaseMap, StyleMap, etc.)
- Configure layer rendering and styling
- Export projects in multiple formats
- Monitor project aggregation and performance

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [User Guide](#user-guide)
- [Configuration](#configuration)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Installation

```bash
# Install the plugin
pnpm add @hierarchidb/plugin-project

# Peer dependencies
pnpm add @hierarchidb/core @hierarchidb/worker @hierarchidb/ui-core
```

## Quick Start

### Basic Plugin Registration

```typescript
import { NodeTypeRegistry } from '@hierarchidb/worker';
import { ProjectDefinition } from '@hierarchidb/plugin-project';

// Register the Project plugin
NodeTypeRegistry.getInstance().register(ProjectDefinition);
```

### Creating a Project

```typescript
import { createProject } from '@hierarchidb/plugin-project';

const projectData = {
  name: 'My Map Project',
  description: 'A comprehensive map showing regional data',
  mapConfig: {
    center: [-122.4194, 37.7749], // San Francisco
    zoom: 10,
    bearing: 0,
    pitch: 0,
  },
  initialReferences: ['basemap-node-id', 'stylemap-node-id'],
};

const project = await createProject(projectData);
```

### Using Project UI Components

```typescript
import { ProjectDialog, ProjectView, ProjectPanel } from '@hierarchidb/plugin-project';

// In your React component
<ProjectDialog
  nodeId={nodeId}
  isOpen={isDialogOpen}
  onClose={() => setIsDialogOpen(false)}
  onSave={handleSave}
  mode="create"
/>
```

## Core Concepts

### Project Entity

A Project is a `PeerEntity` that maintains a 1:1 relationship with a TreeNode. It aggregates multiple data resources through TreeNode references rather than complex entity relationships.

```typescript
interface ProjectEntity extends PeerEntity {
  // Basic information
  name: string;
  description: string;
  
  // Map configuration
  mapConfig: MapConfiguration;
  renderConfig: RenderConfiguration;
  
  // Layer management
  layerConfigurations: Record<NodeId, LayerConfiguration>;
  
  // Export capabilities
  exportConfigurations: ExportConfiguration[];
  
  // Aggregation metadata
  aggregationMetadata: AggregationMetadata;
}
```

### Resource References

Projects use TreeNode.references to link to other nodes (BaseMap, StyleMap, Shape data, etc.) without creating complex entity relationships:

```typescript
// TreeNode.references contains NodeId[] of referenced resources
const treeNode = {
  id: 'project-node-id' as NodeId,
  references: [
    'basemap-node-id' as NodeId,
    'stylemap-node-id' as NodeId,
    'shapes-node-id' as NodeId,
  ],
  // ... other TreeNode properties
};
```

### Layer Configuration

Each referenced resource can have its own layer configuration:

```typescript
interface LayerConfiguration {
  layerId: string;
  layerType: LayerType;
  layerOrder: number;
  isVisible: boolean;
  opacity: number;
  styleConfig: StyleConfiguration;
  interactionConfig: InteractionConfiguration;
  visibilityRules?: VisibilityRules;
}
```

## API Reference

### Core Functions

#### `createProject(data: CreateProjectData): Promise<ProjectEntity>`

Creates a new project with the specified configuration.

**Parameters:**
- `data.name` (string): Project name
- `data.description` (string, optional): Project description
- `data.mapConfig` (Partial<MapConfiguration>, optional): Initial map configuration
- `data.renderConfig` (Partial<RenderConfiguration>, optional): Render settings
- `data.initialReferences` (NodeId[], optional): Initial resource references
- `data.layerConfigurations` (Record<string, LayerConfiguration>, optional): Layer configurations

**Returns:** Promise<ProjectEntity>

#### `updateProject(nodeId: NodeId, data: UpdateProjectData): Promise<ProjectEntity>`

Updates an existing project.

**Parameters:**
- `nodeId` (NodeId): Project node ID
- `data` (UpdateProjectData): Update data

**Returns:** Promise<ProjectEntity>

#### `deleteProject(nodeId: NodeId): Promise<void>`

Deletes a project and cleans up its resources.

**Parameters:**
- `nodeId` (NodeId): Project node ID

#### `validateProjectName(name: string): boolean`

Validates a project name according to the plugin's rules.

**Parameters:**
- `name` (string): Project name to validate

**Returns:** boolean

### Layer Management

#### `createDefaultLayerConfiguration(layerType: LayerType): LayerConfiguration`

Creates a default layer configuration for the specified layer type.

**Parameters:**
- `layerType` (LayerType): Type of layer ('raster', 'vector', 'geojson', 'image', 'background')

**Returns:** LayerConfiguration

#### `generateLayerId(): string`

Generates a unique layer identifier.

**Returns:** string

#### `isValidLayerConfiguration(config: LayerConfiguration): boolean`

Validates a layer configuration.

**Parameters:**
- `config` (LayerConfiguration): Layer configuration to validate

**Returns:** boolean

### UI Components

#### `<ProjectDialog>`

Main dialog component for creating and editing projects.

**Props:**
- `nodeId` (NodeId, optional): Node ID for editing existing project
- `isOpen` (boolean): Whether dialog is open
- `onClose` (() => void): Close handler
- `onSave` ((project: ProjectEntity) => void): Save handler
- `mode` ('create' | 'edit'): Dialog mode

#### `<ProjectView>`

Map view component for displaying project content.

**Props:**
- `nodeId` (NodeId): Project node ID
- `className` (string, optional): CSS class name
- `height` (number, optional): Component height

#### `<ProjectPanel>`

Side panel component for project management.

**Props:**
- `nodeId` (NodeId): Project node ID
- `onUpdate` ((project: ProjectEntity) => void, optional): Update handler

## User Guide

### Creating a Project

1. **Open the Create Dialog**: Click the "Create Project" button or use the context menu
2. **Basic Information**: Enter project name and description
3. **Map Configuration**: Set initial viewport (center, zoom, bearing, pitch)
4. **Resource Selection**: Choose BaseMap and other data resources
5. **Layer Configuration**: Configure how each resource appears on the map
6. **Preview**: Review the project configuration in the preview tab
7. **Save**: Click "Create Project" to save

### Managing Layers

#### Adding Layers
- Select resources in the Resource Selection step
- Each resource becomes a layer in your project
- Configure layer properties (visibility, opacity, order)

#### Layer Styling
- Use the Layer Configuration step to customize appearance
- Set paint and layout properties for vector layers
- Configure filters and visibility rules

#### Layer Interaction
- Enable click and hover interactions
- Create popup and tooltip templates
- Define conditional visibility based on zoom level

### Exporting Projects

The Project plugin supports multiple export formats:

#### Image Export
```typescript
const exportConfig: ExportConfiguration = {
  id: 'export-1',
  exportName: 'Project Overview',
  exportType: 'image',
  exportFormat: 'png',
  exportSettings: {
    width: 1920,
    height: 1080,
    dpi: 300,
    quality: 0.9,
    includeAttribution: true,
  },
};
```

#### Data Export
- **GeoJSON**: Export project data as GeoJSON
- **KML**: Export for Google Earth compatibility
- **Shapefile**: Export for GIS applications

### Best Practices

#### Performance Optimization
- Limit the number of visible layers
- Use appropriate zoom-level visibility rules
- Optimize layer order for rendering efficiency
- Monitor aggregation metadata for performance issues

#### Data Organization
- Use descriptive project names and descriptions
- Group related resources logically
- Maintain consistent layer naming conventions
- Regular cleanup of unused export configurations

## Configuration

### Plugin Configuration

```typescript
export const PLUGIN_CONFIG = {
  name: 'project',
  version: '1.0.0',
  description: 'Map Project Management Plugin',
  nodeType: 'project',
  capabilities: {
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: true,
    supportsChildren: false,
    supportedOperations: ['create', 'read', 'update', 'delete'],
  },
};
```

### Default Configurations

```typescript
// Default map configuration
export const DEFAULT_MAP_CONFIG: MapConfiguration = {
  center: [0, 0],
  zoom: 2,
  bearing: 0,
  pitch: 0,
};

// Default render configuration
export const DEFAULT_RENDER_CONFIG: RenderConfiguration = {
  maxZoom: 18,
  minZoom: 0,
  pixelRatio: 1,
  preserveDrawingBuffer: false,
};
```

### Environment Variables

```bash
# Optional: Configure default map settings
VITE_DEFAULT_MAP_CENTER="-122.4194,37.7749"
VITE_DEFAULT_MAP_ZOOM="10"

# Optional: Performance settings
VITE_MAX_CONCURRENT_LAYERS="10"
VITE_AGGREGATION_TIMEOUT="5000"
```

## Examples

### Basic Project Creation

```typescript
import { ProjectDefinition, createProject } from '@hierarchidb/plugin-project';

// Register the plugin
NodeTypeRegistry.getInstance().register(ProjectDefinition);

// Create a simple project
const project = await createProject({
  name: 'San Francisco Transit Map',
  description: 'Interactive map showing public transit options',
  mapConfig: {
    center: [-122.4194, 37.7749],
    zoom: 12,
    bearing: 0,
    pitch: 0,
  },
  initialReferences: ['sf-basemap', 'transit-data'],
});
```

### Advanced Layer Configuration

```typescript
const layerConfig: LayerConfiguration = {
  layerId: 'transit-lines',
  layerType: 'vector',
  layerOrder: 10,
  isVisible: true,
  opacity: 0.8,
  styleConfig: {
    source: {
      type: 'vector',
      url: 'mapbox://transit-data',
    },
    paint: {
      'line-color': [
        'match',
        ['get', 'route_type'],
        'bus', '#ff6b35',
        'rail', '#1a73e8',
        'ferry', '#34a853',
        '#333333'
      ],
      'line-width': 3,
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
  },
  interactionConfig: {
    clickable: true,
    hoverable: true,
    popupTemplate: '<h3>{{route_name}}</h3><p>Type: {{route_type}}</p>',
  },
  visibilityRules: {
    minZoom: 8,
    maxZoom: 18,
  },
};
```

### React Component Integration

```typescript
import React, { useState } from 'react';
import { ProjectDialog, ProjectView } from '@hierarchidb/plugin-project';
import { NodeId } from '@hierarchidb/core';

const ProjectManager: React.FC = () => {
  const [selectedProjectId, setSelectedProjectId] = useState<NodeId | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreateProject = () => {
    setSelectedProjectId(null);
    setIsDialogOpen(true);
  };

  const handleEditProject = (nodeId: NodeId) => {
    setSelectedProjectId(nodeId);
    setIsDialogOpen(true);
  };

  const handleSaveProject = (project: ProjectEntity) => {
    console.log('Project saved:', project);
    setIsDialogOpen(false);
  };

  return (
    <div>
      <button onClick={handleCreateProject}>
        Create New Project
      </button>
      
      {selectedProjectId && (
        <ProjectView 
          nodeId={selectedProjectId}
          height={600}
        />
      )}
      
      <ProjectDialog
        nodeId={selectedProjectId}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveProject}
        mode={selectedProjectId ? 'edit' : 'create'}
      />
    </div>
  );
};
```

## Troubleshooting

### Common Issues

#### "Layer not displaying"
- Check layer visibility settings
- Verify resource references are valid
- Ensure layer order is appropriate
- Check zoom level visibility rules

#### "Performance issues with multiple layers"
- Reduce number of visible layers
- Implement zoom-level visibility rules
- Optimize layer styling (simpler paint rules)
- Monitor aggregation metadata

#### "Export failing"
- Check export settings (dimensions, format)
- Verify all required resources are loaded
- Ensure sufficient memory for large exports
- Check browser download permissions

### Debug Mode

Enable debug logging:

```typescript
// Enable detailed logging
localStorage.setItem('hierarchidb:project:debug', 'true');

// Log layer rendering performance
localStorage.setItem('hierarchidb:project:profile', 'true');
```

### Performance Monitoring

Monitor project performance:

```typescript
// Access aggregation metadata
const metadata = project.aggregationMetadata;
console.log('Resource count:', metadata.resourceCount);
console.log('Layer count:', metadata.layerCount);
console.log('Has errors:', metadata.hasErrors);
console.log('Last aggregation time:', metadata.aggregationTime, 'ms');
```

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please read CONTRIBUTING.md for guidelines.

## Support

For issues and questions:
- GitHub Issues: [hierarchidb/issues](https://github.com/hierarchidb/hierarchidb/issues)
- Documentation: [hierarchidb.dev](https://hierarchidb.dev)
- Community: [Discord](https://discord.gg/hierarchidb)