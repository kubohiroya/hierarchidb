# Project Plugin Data Model

This document describes the comprehensive data model for the Project Plugin, including all entity types used for database storage, their relationships, and the resource aggregation architecture that processes them.

## Overview

The Project Plugin implements a high-performance resource aggregation system with:
- **4-stage aggregation pipeline**: Selection → Composition → Rendering → Export
- **Cross-tree reference system**: Safe references to Resources tree nodes
- **Entity system**: HierarchiDB-compliant data storage with resource references
- **MapLibreGL.js integration**: High-performance map visualization

## Database Architecture

### Database Structure

The Project Plugin uses specialized database tables for resource aggregation:

```typescript
interface ProjectDatabaseStructure {
  // Main project configuration storage
  projects: ProjectEntity[];              // Main project configurations (PeerEntity)
  
  // Resource reference management
  resourceReferences: ResourceReference[]; // References to Resources tree nodes (GroupEntity)
  
  // Layer and composition configuration
  layerConfigurations: LayerConfiguration[]; // Layer-specific settings (RelationalEntity)
  
  // Export and sharing
  exportConfigurations: ExportConfiguration[]; // Export settings and metadata (AutoEntity)
}
```

### Indexing Strategy

```typescript
const indexConfiguration = {
  // Primary indices for core entities
  projects: '&nodeId, createdAt, updatedAt, lastRendered',
  resourceReferences: '&referenceId, projectNodeId, resourceNodeId, referenceType, isActive',
  layerConfigurations: '&layerId, projectNodeId, resourceReferenceId, layerOrder, isVisible',
  exportConfigurations: '&exportId, projectNodeId, exportType, createdAt',
  
  // Performance indices for queries
  resourceReferences_by_project: '[projectNodeId+referenceType], resourceTreeId',
  layerConfigurations_by_project: '[projectNodeId+layerOrder], isVisible',
  exportConfigurations_by_project: '[projectNodeId+exportType], lastAccessed'
};
```

## Entity Type Definitions

### Core Entities

#### ProjectEntity (PeerEntity)
Main project configuration entity with 1:1 correspondence to TreeNode.

```typescript
export interface ProjectEntity extends PeerEntity {
  // Identity
  id: EntityId;
  nodeId: NodeId;
  
  // Project metadata
  name: string;
  description?: string;
  
  // Map configuration
  mapConfig: {
    center: [number, number];    // [longitude, latitude]
    zoom: number;                // Initial zoom level
    bearing?: number;            // Map rotation in degrees
    pitch?: number;              // Map tilt in degrees
    bounds?: [[number, number], [number, number]]; // [[sw], [ne]]
  };
  
  // Rendering settings
  renderConfig: {
    maxZoom: number;             // Maximum zoom level
    minZoom: number;             // Minimum zoom level
    pixelRatio?: number;         // Device pixel ratio override
    preserveDrawingBuffer?: boolean; // For screenshot capabilities
  };
  
  // Aggregation metadata
  aggregationConfig: {
    lastAggregated: number;      // Timestamp of last aggregation
    resourceCount: number;       // Number of referenced resources
    layerCount: number;          // Number of configured layers
    hasErrors: boolean;          // Whether aggregation encountered errors
    errorMessages?: string[];    // Error details if any
  };
  
  // Lifecycle
  createdAt: number;
  updatedAt: number;
  version: number;
}
```

#### ResourceReference (GroupEntity)
References to nodes in the Resources tree with aggregation metadata.

```typescript
export interface ResourceReference extends GroupEntity {
  // Identity
  id: EntityId;
  projectNodeId: NodeId;       // Parent project node
  
  // Reference information
  resourceNodeId: NodeId;      // Referenced node in Resources tree
  resourceTreeId: TreeId;      // Tree containing the referenced node
  referenceType: ResourceReferenceType;
  
  // Reference metadata
  displayName: string;         // User-friendly name for reference
  isActive: boolean;           // Whether reference is currently active
  loadPriority: number;        // Loading order (0 = highest priority)
  
  // Aggregation settings
  aggregationConfig: {
    includeInAggregation: boolean;  // Whether to include in map composition
    overrideStyles: boolean;        // Whether to override original styles
    customZIndex?: number;          // Layer ordering override
    opacity?: number;               // Opacity override (0-1)
    visibility?: 'visible' | 'hidden' | 'conditional'; // Visibility settings
  };
  
  // Reference validation
  validationStatus: {
    isValid: boolean;           // Whether reference is currently valid
    lastValidated: number;      // Timestamp of last validation
    errorMessage?: string;      // Validation error if any
  };
  
  // Lifecycle
  createdAt: number;
  updatedAt: number;
  version: number;
}

export type ResourceReferenceType = 
  | 'basemap'           // Reference to basemap node
  | 'shape'             // Reference to shape node
  | 'stylemap'          // Reference to stylemap node
  | 'location'          // Reference to location node
  | 'route'             // Reference to route node
  | 'folder';           // Reference to folder (for batch operations)
```

#### LayerConfiguration (RelationalEntity)
Configuration for how each resource appears in the composed map.

```typescript
export interface LayerConfiguration extends RelationalEntity {
  // Identity
  id: EntityId;
  projectNodeId: NodeId;          // Parent project node
  resourceReferenceId: EntityId;  // Associated resource reference
  
  // Layer properties
  layerId: string;                // Unique layer identifier
  layerType: LayerType;           // Type of map layer
  layerOrder: number;             // Rendering order (higher = on top)
  
  // Visibility configuration
  isVisible: boolean;             // Whether layer is currently visible
  visibilityRules?: {
    minZoom?: number;             // Minimum zoom for visibility
    maxZoom?: number;             // Maximum zoom for visibility
    conditions?: VisibilityCondition[]; // Conditional visibility rules
  };
  
  // Style configuration
  styleConfig: {
    source: LayerSource;          // Data source configuration
    paint?: Record<string, any>;  // MapLibreGL paint properties
    layout?: Record<string, any>; // MapLibreGL layout properties
    filter?: any[];               // MapLibreGL filter expression
  };
  
  // Interaction configuration
  interactionConfig: {
    clickable: boolean;           // Whether layer responds to clicks
    hoverable: boolean;           // Whether layer responds to hover
    popupTemplate?: string;       // Popup content template
    tooltipTemplate?: string;     // Tooltip content template
  };
  
  // Performance settings
  performanceConfig: {
    simplificationLevel?: number; // Geometry simplification level
    clusterPoints?: boolean;      // Whether to cluster point data
    maxFeatures?: number;         // Maximum features to render
  };
  
  // Lifecycle
  createdAt: number;
  updatedAt: number;
  version: number;
}

export type LayerType = 
  | 'raster'            // Raster basemap layer
  | 'vector'            // Vector tile layer
  | 'geojson'           // GeoJSON data layer
  | 'symbol'            // Symbol/marker layer
  | 'line'              // Line/route layer
  | 'fill'              // Polygon fill layer
  | 'heatmap'           // Heatmap visualization
  | 'hillshade';        // Terrain hillshade

export interface LayerSource {
  type: 'raster' | 'vector' | 'geojson' | 'image';
  url?: string;                   // Source URL
  data?: any;                     // Inline data (for GeoJSON)
  tiles?: string[];               // Tile URL templates
  bounds?: number[];              // Source bounds
  attribution?: string;           // Attribution text
}

export interface VisibilityCondition {
  property: string;               // Property to check
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=';
  value: any;                     // Comparison value
}
```

#### ExportConfiguration (AutoEntity)
Configuration for exporting and sharing project compositions.

```typescript
export interface ExportConfiguration extends AutoEntity {
  // Identity
  id: EntityId;
  projectNodeId: NodeId;          // Parent project node
  
  // Export metadata
  exportType: ExportType;         // Type of export
  exportName: string;             // User-friendly export name
  exportDescription?: string;     // Export description
  
  // Export settings
  exportConfig: {
    format: ExportFormat;         // Output format
    quality?: 'low' | 'medium' | 'high'; // Export quality
    dimensions?: {
      width: number;              // Export width in pixels
      height: number;             // Export height in pixels
      dpi?: number;               // Dots per inch for print exports
    };
    viewport?: {
      center: [number, number];   // Export center coordinates
      zoom: number;               // Export zoom level
      bearing?: number;           // Export rotation
      pitch?: number;             // Export tilt
    };
  };
  
  // Sharing configuration
  sharingConfig?: {
    isPublic: boolean;            // Whether export is publicly accessible
    accessToken?: string;         // Access token for private shares
    expiresAt?: number;           // Expiration timestamp
    allowDownload: boolean;       // Whether to allow file downloads
  };
  
  // Export metadata
  exportMetadata: {
    filePath?: string;            // Local file path (if saved)
    fileSize?: number;            // Export file size in bytes
    url?: string;                 // Sharing URL (if uploaded)
    thumbnailUrl?: string;        // Preview thumbnail URL
  };
  
  // Status tracking
  exportStatus: {
    status: ExportStatus;         // Current export status
    progress?: number;            // Export progress (0-100)
    errorMessage?: string;        // Error message if failed
    lastAttempted: number;        // Timestamp of last export attempt
    completedAt?: number;         // Timestamp of successful completion
  };
  
  // Lifecycle
  createdAt: number;
  updatedAt: number;
  version: number;
}

export type ExportType = 
  | 'image'             // Static image export
  | 'interactive'       // Interactive map export
  | 'data'              // Raw data export
  | 'configuration'     // Project configuration export
  | 'template';         // Reusable template export

export type ExportFormat = 
  | 'png'               // PNG image
  | 'jpeg'              // JPEG image
  | 'svg'               // SVG vector image
  | 'pdf'               // PDF document
  | 'html'              // Standalone HTML
  | 'json'              // JSON configuration
  | 'geojson'           // GeoJSON data
  | 'mvt'               // Mapbox Vector Tiles
  | 'mbtiles';          // MBTiles archive

export type ExportStatus = 
  | 'pending'           // Export queued
  | 'processing'        // Export in progress
  | 'completed'         // Export successful
  | 'failed'            // Export failed
  | 'cancelled';        // Export cancelled
```

## Resource Aggregation System

### Aggregation Pipeline

The resource aggregation system follows a structured pipeline:

```typescript
interface AggregationPipeline {
  // 1. Reference Resolution
  resolveReferences(projectNodeId: NodeId): Promise<ResourceReference[]>;
  
  // 2. Resource Loading
  loadResourceData(references: ResourceReference[]): Promise<LoadedResource[]>;
  
  // 3. Layer Composition
  composeLayers(resources: LoadedResource[], configs: LayerConfiguration[]): Promise<MapLayer[]>;
  
  // 4. Map Rendering
  renderMap(layers: MapLayer[], viewport: MapConfig): Promise<MapInstance>;
}
```

### Cross-Tree Reference System

References to Resources tree nodes are managed through the TreeNode reference system:

```typescript
interface CrossTreeReference {
  // Reference identity
  sourceNodeId: NodeId;           // Project node making reference
  targetNodeId: NodeId;           // Referenced node in Resources tree
  targetTreeId: TreeId;           // Tree containing referenced node
  
  // Reference metadata
  referenceType: string;          // Type of reference relationship
  isValid: boolean;               // Whether reference is currently valid
  
  // Change tracking
  lastValidated: number;          // Timestamp of last validation
  targetVersion?: number;         // Version of referenced node when last validated
}
```

### Aggregation Strategies

Different aggregation strategies are used based on resource types:

```typescript
interface AggregationStrategy {
  // Basemap aggregation
  aggregateBasemaps(references: ResourceReference[]): Promise<BasemapLayer[]>;
  
  // Vector data aggregation
  aggregateShapes(references: ResourceReference[]): Promise<VectorLayer[]>;
  
  // Style application
  applyStyles(layers: Layer[], stylemaps: ResourceReference[]): Promise<StyledLayer[]>;
  
  // Point data aggregation
  aggregateLocations(references: ResourceReference[]): Promise<SymbolLayer[]>;
  
  // Route aggregation
  aggregateRoutes(references: ResourceReference[]): Promise<LineLayer[]>;
}
```

## Performance Considerations

### Reference Caching

```typescript
interface ReferenceCache {
  // Cache for resolved references
  resolvedReferences: Map<NodeId, ResourceReference[]>;
  
  // Cache for loaded resource data
  resourceData: Map<EntityId, any>;
  
  // Cache invalidation
  invalidateProject(projectNodeId: NodeId): void;
  invalidateResource(resourceNodeId: NodeId): void;
}
```

### Lazy Loading

Resources are loaded on-demand to optimize performance:

```typescript
interface LazyLoadingStrategy {
  // Load only visible layers
  loadVisibleLayers(viewport: MapViewport): Promise<Layer[]>;
  
  // Progressive detail loading
  loadDetailLevel(zoomLevel: number): Promise<DetailLevel>;
  
  // Preload adjacent tiles
  preloadNearbyTiles(currentTile: TileCoordinate): void;
}
```

## API Integration

### PluginAPI Extensions

The Project Plugin extends the PluginAPI with resource aggregation capabilities:

```typescript
export interface ProjectAPIExtensions {
  // Resource aggregation
  aggregateResources(projectNodeId: NodeId): Promise<AggregatedData>;
  
  // Reference management
  addResourceReference(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<ResourceReference>;
  removeResourceReference(referenceId: EntityId): Promise<void>;
  validateReferences(projectNodeId: NodeId): Promise<ValidationResult[]>;
  
  // Layer management
  configureLayers(projectNodeId: NodeId, configs: LayerConfiguration[]): Promise<void>;
  reorderLayers(projectNodeId: NodeId, layerOrder: string[]): Promise<void>;
  
  // Export functions
  exportProject(projectNodeId: NodeId, config: ExportConfiguration): Promise<ExportResult>;
  shareProject(projectNodeId: NodeId, sharingConfig: SharingConfig): Promise<ShareResult>;
}
```

---

This data model provides the foundation for implementing the Project Plugin's resource aggregation and map composition capabilities within HierarchiDB's entity system architecture.