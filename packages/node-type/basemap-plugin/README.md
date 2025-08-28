# @hierarchidb/plugin-basemap

A comprehensive basemap management plugin for HierarchiDB that provides interactive map visualization, spatial analysis, and advanced mapping capabilities.

## Overview

The BaseMap Plugin enables users to:

- Create and manage interactive basemaps with MapLibre GL
- Configure map sources (raster tiles, vector tiles, static images)
- Perform spatial analysis and measurements
- Optimize map styles and performance
- Export maps in multiple formats
- Monitor map performance and usage analytics

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Advanced Features](#advanced-features)
- [User Guide](#user-guide)
- [Configuration](#configuration)
- [Examples](#examples)

## Installation

```bash
# Install the plugin
pnpm add @hierarchidb/plugin-basemap

# Peer dependencies
pnpm add @hierarchidb/core @hierarchidb/worker @hierarchidb/ui-core maplibre-gl
```

## Quick Start

### Plugin Registration

```typescript
import { NodeTypeRegistry } from '@hierarchidb/worker';
import { BaseMapDefinition } from '@hierarchidb/plugin-basemap';

// Register the BaseMap plugin
NodeTypeRegistry.getInstance().register(BaseMapDefinition);
```

### Creating a BaseMap

```typescript
import { createBaseMap } from '@hierarchidb/plugin-basemap';

const baseMapData = {
  name: 'City Streets',
  description: 'High-detail street map for urban planning',
  mapStyle: {
    version: 8,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm-layer',
        type: 'raster',
        source: 'osm-tiles',
      },
    ],
  },
  center: [-122.4194, 37.7749], // San Francisco
  zoom: 12,
  bearing: 0,
  pitch: 0,
};

const baseMap = await createBaseMap(baseMapData);
```

### Using BaseMap UI Components

```typescript
import { BaseMapDialog, BaseMapView, BaseMapEditor } from '@hierarchidb/plugin-basemap';

// Create/Edit Dialog
<BaseMapDialog
  nodeId={nodeId}
  isOpen={isDialogOpen}
  onClose={() => setIsDialogOpen(false)}
  onSave={handleSave}
  mode="create"
/>

// Map Viewer
<BaseMapView
  nodeId={nodeId}
  height={400}
  interactive={true}
/>

// Map Editor
<BaseMapEditor
  nodeId={nodeId}
  onStyleChange={handleStyleChange}
  onViewportChange={handleViewportChange}
/>
```

## Core Concepts

### BaseMap Entity

A BaseMap is a `PeerEntity` that defines an interactive map with sources, layers, and configuration:

```typescript
interface BaseMapEntity extends PeerEntity {
  // Basic information
  name: string;
  description: string;
  
  // Map configuration
  mapStyle: MapLibreStyle;
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  
  // Bounds and constraints
  bounds?: [[number, number], [number, number]];
  maxZoom?: number;
  minZoom?: number;
  
  // Performance settings
  performanceConfig: PerformanceConfiguration;
  
  // Analytics
  analytics: MapAnalytics;
  
  // Lifecycle
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}
```

### MapLibre Style

BaseMap uses MapLibre GL style specification:

```typescript
interface MapLibreStyle {
  version: 8;
  name?: string;
  sources: Record<string, SourceSpecification>;
  layers: LayerSpecification[];
  sprite?: string;
  glyphs?: string;
  metadata?: any;
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;
}
```

### Advanced Services

The plugin includes advanced services for spatial analysis and optimization:

```typescript
interface BaseMapAdvancedService {
  // Spatial analysis
  analyzeSpatialExtent(nodeId: NodeId): Promise<SpatialAnalysisResult>;
  measureDistance(nodeId: NodeId, coordinates: [number, number][]): Promise<number>;
  calculateArea(nodeId: NodeId, polygon: [number, number][]): Promise<number>;
  
  // Style optimization
  optimizeMapStyle(nodeId: NodeId, options?: OptimizationOptions): Promise<MapLibreStyle>;
  validateMapConfiguration(nodeId: NodeId): Promise<ValidationResult>;
  
  // Export capabilities
  exportAsImage(nodeId: NodeId, options: ImageExportOptions): Promise<Blob>;
  exportAsPDF(nodeId: NodeId, options: PDFExportOptions): Promise<Blob>;
  exportAsGeoJSON(nodeId: NodeId): Promise<GeoJSON>;
}
```

## API Reference

### Core Functions

#### `createBaseMap(data: CreateBaseMapData): Promise<BaseMapEntity>`

Creates a new basemap with the specified configuration.

**Parameters:**
- `data.name` (string): Map name
- `data.description` (string, optional): Map description
- `data.mapStyle` (MapLibreStyle): MapLibre style specification
- `data.center` ([number, number], optional): Initial center coordinates
- `data.zoom` (number, optional): Initial zoom level
- `data.bearing` (number, optional): Initial bearing (0-360)
- `data.pitch` (number, optional): Initial pitch (0-60)

**Returns:** Promise<BaseMapEntity>

#### `updateBaseMap(nodeId: NodeId, data: UpdateBaseMapData): Promise<BaseMapEntity>`

Updates an existing basemap.

#### `deleteBaseMap(nodeId: NodeId): Promise<void>`

Deletes a basemap and cleans up its resources.

### Advanced API Methods

#### Spatial Analysis

```typescript
// Analyze spatial extent of map data
const analysis = await BaseMapAdvancedService.getInstance()
  .analyzeSpatialExtent(nodeId);

console.log('Bounds:', analysis.bounds);
console.log('Area:', analysis.totalArea);
console.log('Feature count:', analysis.featureCount);
```

#### Style Optimization

```typescript
// Optimize map style for performance
const optimizedStyle = await BaseMapAdvancedService.getInstance()
  .optimizeMapStyle(nodeId, {
    removeUnusedSources: true,
    simplifyGeometry: true,
    optimizeFilters: true,
  });
```

#### Export Functions

```typescript
// Export as high-resolution image
const imageBlob = await BaseMapAdvancedService.getInstance()
  .exportAsImage(nodeId, {
    width: 1920,
    height: 1080,
    format: 'png',
    dpi: 300,
  });

// Export as PDF for printing
const pdfBlob = await BaseMapAdvancedService.getInstance()
  .exportAsPDF(nodeId, {
    pageSize: 'A4',
    orientation: 'landscape',
    includeAttribution: true,
  });
```

### UI Components

#### `<BaseMapDialog>`

Main dialog for creating and editing basemaps.

**Props:**
- `nodeId` (NodeId, optional): Node ID for editing
- `isOpen` (boolean): Dialog visibility
- `onClose` (() => void): Close handler
- `onSave` ((baseMap: BaseMapEntity) => void): Save handler
- `mode` ('create' | 'edit'): Dialog mode

#### `<BaseMapView>`

Interactive map viewer component.

**Props:**
- `nodeId` (NodeId): BaseMap node ID
- `height` (number, optional): Component height
- `interactive` (boolean, optional): Enable user interaction
- `onMapLoad` ((map: maplibregl.Map) => void, optional): Map load callback

#### `<BaseMapEditor>`

Advanced map editor with style editing capabilities.

**Props:**
- `nodeId` (NodeId): BaseMap node ID
- `onStyleChange` ((style: MapLibreStyle) => void): Style change handler
- `onViewportChange` ((viewport: ViewState) => void): Viewport change handler

#### `<BaseMapAnalytics>`

Analytics dashboard for map performance and usage.

**Props:**
- `nodeId` (NodeId): BaseMap node ID
- `timeRange` ('1d' | '7d' | '30d', optional): Analytics time range

## Advanced Features

### Spatial Analysis

The BaseMap plugin includes comprehensive spatial analysis tools:

```typescript
interface SpatialAnalysisResult {
  bounds: [[number, number], [number, number]];
  center: [number, number];
  totalArea: number; // in square meters
  featureCount: number;
  layerAnalysis: LayerAnalysis[];
  recommendations: string[];
}

interface LayerAnalysis {
  layerId: string;
  layerType: string;
  featureCount: number;
  bounds: [[number, number], [number, number]];
  averageFeatureSize: number;
  complexity: 'low' | 'medium' | 'high';
}
```

### Performance Optimization

Automatic style optimization for better performance:

```typescript
interface OptimizationOptions {
  removeUnusedSources: boolean;
  simplifyGeometry: boolean;
  optimizeFilters: boolean;
  consolidateLayers: boolean;
  maxFeatureCount?: number;
  targetFileSize?: number;
}

interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  reductionPercent: number;
  optimizations: string[];
  warnings: string[];
}
```

### Map Validation

Comprehensive validation of map configurations:

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  performance: PerformanceMetrics;
}

interface ValidationError {
  type: 'style' | 'source' | 'layer' | 'bounds';
  message: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}
```

## User Guide

### Creating a BaseMap

1. **Open Create Dialog**: Click "Create BaseMap" or use context menu
2. **Basic Information**: Enter name and description
3. **Map Configuration**: Set initial viewport (center, zoom, bearing, pitch)
4. **Style Configuration**: Define map sources and layers
5. **Bounds and Constraints**: Optionally set map boundaries
6. **Performance Settings**: Configure rendering options
7. **Preview**: Test the map configuration
8. **Save**: Create the basemap

### Map Style Configuration

#### Adding Sources

```typescript
// Raster tile source
{
  "osm": {
    "type": "raster",
    "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    "tileSize": 256,
    "attribution": "© OpenStreetMap contributors"
  }
}

// Vector tile source
{
  "mapbox": {
    "type": "vector",
    "url": "mapbox://mapbox.mapbox-streets-v8"
  }
}

// GeoJSON source
{
  "data": {
    "type": "geojson",
    "data": {
      "type": "FeatureCollection",
      "features": [...]
    }
  }
}
```

#### Adding Layers

```typescript
// Raster layer
{
  "id": "background",
  "type": "raster",
  "source": "osm"
}

// Vector layers
{
  "id": "water",
  "type": "fill",
  "source": "mapbox",
  "source-layer": "water",
  "paint": {
    "fill-color": "#4264fb"
  }
}
```

### Performance Optimization

#### Best Practices

1. **Limit Source Count**: Use fewer sources for better performance
2. **Optimize Tile Sizes**: Use appropriate tile sizes (256px for most cases)
3. **Filter Layers**: Apply filters to reduce rendered features
4. **Use Zoom Ranges**: Set min/max zoom for layers
5. **Monitor Analytics**: Use the analytics dashboard to identify bottlenecks

#### Automatic Optimization

```typescript
// Enable automatic optimization
const optimized = await BaseMapAdvancedService.getInstance()
  .optimizeMapStyle(nodeId, {
    removeUnusedSources: true,
    simplifyGeometry: true,
    optimizeFilters: true,
    consolidateLayers: true,
    maxFeatureCount: 10000,
  });
```

### Export Options

#### Image Export

- **PNG**: High quality with transparency support
- **JPEG**: Smaller file size, no transparency
- **WebP**: Modern format with excellent compression

#### Data Export

- **GeoJSON**: Standard geospatial data format
- **Style JSON**: MapLibre style specification
- **Metadata**: Map configuration and analytics

#### Print Export

- **PDF**: Vector format for high-quality printing
- **Customizable layouts**: A4, A3, Letter, Legal
- **Attribution**: Automatic attribution inclusion

## Configuration

### Plugin Configuration

```typescript
export const BASEMAP_CONFIG = {
  name: 'basemap',
  version: '1.0.0',
  description: 'Interactive BaseMap Management',
  capabilities: {
    supportsCreate: true,
    supportsUpdate: true,
    supportsDelete: true,
    supportsChildren: false,
  },
  defaultSettings: {
    maxZoom: 18,
    minZoom: 0,
    tileSize: 256,
    preserveDrawingBuffer: true,
  },
};
```

### Performance Configuration

```typescript
interface PerformanceConfiguration {
  maxSourceCount: number;
  maxLayerCount: number;
  tileLoadTimeout: number;
  cacheSize: number;
  enableOptimization: boolean;
  optimizationThresholds: {
    featureCount: number;
    fileSize: number;
  };
}
```

## Examples

### Simple Raster BaseMap

```typescript
const osmBaseMap = await createBaseMap({
  name: 'OpenStreetMap',
  description: 'Standard OpenStreetMap basemap',
  mapStyle: {
    version: 8,
    sources: {
      'osm': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm-layer',
        type: 'raster',
        source: 'osm',
      },
    ],
  },
  center: [0, 0],
  zoom: 2,
});
```

### Vector BaseMap with Custom Styling

```typescript
const vectorBaseMap = await createBaseMap({
  name: 'Custom Vector Map',
  description: 'Styled vector basemap',
  mapStyle: {
    version: 8,
    sources: {
      'mapbox': {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v8',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#f8f8f8',
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'mapbox',
        'source-layer': 'water',
        paint: {
          'fill-color': '#4264fb',
          'fill-opacity': 0.6,
        },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'mapbox',
        'source-layer': 'road',
        paint: {
          'line-color': '#ffffff',
          'line-width': 2,
        },
        filter: ['==', 'class', 'primary'],
      },
    ],
  },
  center: [-74.006, 40.7128], // New York City
  zoom: 10,
});
```

### Advanced Analytics Integration

```typescript
import React, { useEffect, useState } from 'react';
import { BaseMapAnalytics, BaseMapAdvancedService } from '@hierarchidb/plugin-basemap';

const MapDashboard: React.FC<{ nodeId: NodeId }> = ({ nodeId }) => {
  const [analysis, setAnalysis] = useState<SpatialAnalysisResult | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    const loadAnalytics = async () => {
      const service = BaseMapAdvancedService.getInstance();
      
      // Load spatial analysis
      const spatialAnalysis = await service.analyzeSpatialExtent(nodeId);
      setAnalysis(spatialAnalysis);
      
      // Load performance metrics
      const validation = await service.validateMapConfiguration(nodeId);
      setPerformance(validation.performance);
    };

    loadAnalytics();
  }, [nodeId]);

  return (
    <div>
      <h2>Map Dashboard</h2>
      
      {analysis && (
        <div>
          <h3>Spatial Analysis</h3>
          <p>Total Area: {analysis.totalArea.toLocaleString()} m²</p>
          <p>Feature Count: {analysis.featureCount}</p>
          <p>Bounds: {analysis.bounds.map(coord => coord.join(', ')).join(' to ')}</p>
        </div>
      )}
      
      {performance && (
        <div>
          <h3>Performance Metrics</h3>
          <p>Load Time: {performance.averageLoadTime}ms</p>
          <p>Memory Usage: {performance.memoryUsage}MB</p>
          <p>Render FPS: {performance.averageFPS}</p>
        </div>
      )}
      
      <BaseMapAnalytics nodeId={nodeId} timeRange="7d" />
    </div>
  );
};
```

## License

MIT License - see LICENSE file for details.