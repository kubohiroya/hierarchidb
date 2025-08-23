# Project Plugin API Reference

This document provides comprehensive API documentation for the Project Plugin, including all interfaces, services, and integration points.

## Table of Contents

1. [Core Interfaces](#core-interfaces)
2. [Entity Types](#entity-types)
3. [Service APIs](#service-apis)
4. [Component APIs](#component-apis)
5. [Plugin Integration](#plugin-integration)
6. [Error Handling](#error-handling)
7. [Usage Examples](#usage-examples)

## Core Interfaces

### ProjectAPI

Main API interface for project operations.

```typescript
export interface ProjectAPI {
  // Project management
  createProject(nodeId: NodeId, data: Partial<ProjectEntity>): Promise<ProjectEntity>;
  getProject(nodeId: NodeId): Promise<ProjectEntity | null>;
  updateProject(nodeId: NodeId, updates: Partial<ProjectEntity>): Promise<ProjectEntity>;
  deleteProject(nodeId: NodeId): Promise<void>;

  // Resource reference management
  addResourceReference(
    projectNodeId: NodeId,
    resourceNodeId: NodeId,
    referenceType: ResourceReferenceType
  ): Promise<ResourceReference>;
  removeResourceReference(referenceId: EntityId): Promise<void>;
  getResourceReferences(projectNodeId: NodeId): Promise<ResourceReference[]>;
  validateResourceReferences(projectNodeId: NodeId): Promise<ValidationResult[]>;

  // Layer configuration
  configureLayer(
    projectNodeId: NodeId,
    layerConfig: LayerConfiguration
  ): Promise<LayerConfiguration>;
  removeLayer(layerId: string): Promise<void>;
  reorderLayers(projectNodeId: NodeId, layerOrder: string[]): Promise<void>;
  getLayerConfigurations(projectNodeId: NodeId): Promise<LayerConfiguration[]>;

  // Resource aggregation
  aggregateResources(projectNodeId: NodeId, options?: AggregationOptions): Promise<AggregatedData>;
  getAggregationStatus(projectNodeId: NodeId): Promise<AggregationStatus>;
  refreshAggregation(projectNodeId: NodeId): Promise<void>;

  // Export functionality
  exportProject(
    projectNodeId: NodeId,
    exportConfig: ExportConfiguration
  ): Promise<ExportResult>;
  getExportHistory(projectNodeId: NodeId): Promise<ExportConfiguration[]>;
  shareProject(projectNodeId: NodeId, sharingConfig: SharingConfig): Promise<ShareResult>;
}
```

### ResourceAggregationAPI

API for resource aggregation operations.

```typescript
export interface ResourceAggregationAPI {
  // Aggregation operations
  aggregateResources(
    resourceReferences: ResourceReference[],
    layerConfigurations: LayerConfiguration[]
  ): Promise<AggregatedData>;

  // Resource loading
  loadResourceData(resourceNodeId: NodeId): Promise<any>;
  loadMultipleResources(resourceNodeIds: NodeId[]): Promise<Map<NodeId, any>>;
  
  // Cache management
  invalidateResourceCache(resourceNodeId: NodeId): void;
  clearAggregationCache(projectNodeId: NodeId): void;
  
  // Validation
  validateResourceCompatibility(
    resources: ResourceReference[]
  ): Promise<CompatibilityResult>;
}
```

## Entity Types

### ProjectEntity

Main project configuration entity.

```typescript
export interface ProjectEntity extends PeerEntity {
  // Identity
  id: EntityId;
  nodeId: NodeId;

  // Project metadata
  name: string;
  description?: string;

  // Map configuration
  mapConfig: MapConfiguration;
  renderConfig: RenderConfiguration;
  aggregationConfig: AggregationConfiguration;

  // Lifecycle
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface MapConfiguration {
  center: [number, number];        // [longitude, latitude]
  zoom: number;                    // Initial zoom level
  bearing?: number;                // Map rotation in degrees
  pitch?: number;                  // Map tilt in degrees
  bounds?: [[number, number], [number, number]]; // [[sw], [ne]]
}

export interface RenderConfiguration {
  maxZoom: number;                 // Maximum zoom level
  minZoom: number;                 // Minimum zoom level
  pixelRatio?: number;             // Device pixel ratio override
  preserveDrawingBuffer?: boolean; // For screenshot capabilities
}

export interface AggregationConfiguration {
  lastAggregated: number;          // Timestamp of last aggregation
  resourceCount: number;           // Number of referenced resources
  layerCount: number;              // Number of configured layers
  hasErrors: boolean;              // Whether aggregation encountered errors
  errorMessages?: string[];        // Error details if any
}
```

### ResourceReference

Reference to a Resources tree node.

```typescript
export interface ResourceReference extends GroupEntity {
  // Identity
  id: EntityId;
  projectNodeId: NodeId;

  // Reference information
  resourceNodeId: NodeId;
  resourceTreeId: TreeId;
  referenceType: ResourceReferenceType;

  // Reference metadata
  displayName: string;
  isActive: boolean;
  loadPriority: number;

  // Aggregation settings
  aggregationConfig: ResourceAggregationConfig;

  // Reference validation
  validationStatus: ReferenceValidationStatus;

  // Lifecycle
  createdAt: number;
  updatedAt: number;
  version: number;
}

export type ResourceReferenceType = 
  | 'basemap'
  | 'shape'
  | 'stylemap'
  | 'location'
  | 'route'
  | 'folder';

export interface ResourceAggregationConfig {
  includeInAggregation: boolean;
  overrideStyles: boolean;
  customZIndex?: number;
  opacity?: number;
  visibility?: 'visible' | 'hidden' | 'conditional';
}

export interface ReferenceValidationStatus {
  isValid: boolean;
  lastValidated: number;
  errorMessage?: string;
}
```

### LayerConfiguration

Configuration for map layers.

```typescript
export interface LayerConfiguration extends RelationalEntity {
  // Identity
  id: EntityId;
  projectNodeId: NodeId;
  resourceReferenceId: EntityId;

  // Layer properties
  layerId: string;
  layerType: LayerType;
  layerOrder: number;

  // Visibility configuration
  isVisible: boolean;
  visibilityRules?: VisibilityRules;

  // Style configuration
  styleConfig: StyleConfiguration;

  // Interaction configuration
  interactionConfig: InteractionConfiguration;

  // Performance settings
  performanceConfig: PerformanceConfiguration;

  // Lifecycle
  createdAt: number;
  updatedAt: number;
  version: number;
}

export type LayerType = 
  | 'raster'
  | 'vector'
  | 'geojson'
  | 'symbol'
  | 'line'
  | 'fill'
  | 'heatmap'
  | 'hillshade';

export interface VisibilityRules {
  minZoom?: number;
  maxZoom?: number;
  conditions?: VisibilityCondition[];
}

export interface VisibilityCondition {
  property: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=';
  value: any;
}

export interface StyleConfiguration {
  source: LayerSource;
  paint?: Record<string, any>;
  layout?: Record<string, any>;
  filter?: any[];
}

export interface LayerSource {
  type: 'raster' | 'vector' | 'geojson' | 'image';
  url?: string;
  data?: any;
  tiles?: string[];
  bounds?: number[];
  attribution?: string;
}

export interface InteractionConfiguration {
  clickable: boolean;
  hoverable: boolean;
  popupTemplate?: string;
  tooltipTemplate?: string;
}

export interface PerformanceConfiguration {
  simplificationLevel?: number;
  clusterPoints?: boolean;
  maxFeatures?: number;
}
```

### ExportConfiguration

Configuration for exporting projects.

```typescript
export interface ExportConfiguration extends AutoEntity {
  // Identity
  id: EntityId;
  projectNodeId: NodeId;

  // Export metadata
  exportType: ExportType;
  exportName: string;
  exportDescription?: string;

  // Export settings
  exportConfig: ExportSettings;

  // Sharing configuration
  sharingConfig?: SharingConfiguration;

  // Export metadata
  exportMetadata: ExportMetadata;

  // Status tracking
  exportStatus: ExportStatus;

  // Lifecycle
  createdAt: number;
  updatedAt: number;
  version: number;
}

export type ExportType = 
  | 'image'
  | 'interactive'
  | 'data'
  | 'configuration'
  | 'template';

export interface ExportSettings {
  format: ExportFormat;
  quality?: 'low' | 'medium' | 'high';
  dimensions?: ExportDimensions;
  viewport?: ViewportSettings;
}

export type ExportFormat = 
  | 'png'
  | 'jpeg'
  | 'svg'
  | 'pdf'
  | 'html'
  | 'json'
  | 'geojson'
  | 'mvt'
  | 'mbtiles';

export interface ExportDimensions {
  width: number;
  height: number;
  dpi?: number;
}

export interface ViewportSettings {
  center: [number, number];
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export interface SharingConfiguration {
  isPublic: boolean;
  accessToken?: string;
  expiresAt?: number;
  allowDownload: boolean;
}

export interface ExportMetadata {
  filePath?: string;
  fileSize?: number;
  url?: string;
  thumbnailUrl?: string;
}

export interface ExportStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  errorMessage?: string;
  lastAttempted: number;
  completedAt?: number;
}
```

## Service APIs

### CrossTreeReferenceService

Service for managing cross-tree references.

```typescript
export class CrossTreeReferenceService {
  constructor(private treeQueryAPI: TreeQueryAPI) {}

  // Reference validation
  async validateReference(resourceNodeId: NodeId): Promise<boolean>;
  async validateMultipleReferences(resourceNodeIds: NodeId[]): Promise<ValidationResult[]>;

  // Tree structure operations
  async getResourcesTreeStructure(): Promise<TreeStructure>;
  async getResourceTreePath(resourceNodeId: NodeId): Promise<TreePath>;

  // Reference management
  async createReference(
    projectNodeId: NodeId,
    resourceNodeId: NodeId,
    referenceType: ResourceReferenceType
  ): Promise<ResourceReference>;
  async updateReference(referenceId: EntityId, updates: Partial<ResourceReference>): Promise<ResourceReference>;
  async deleteReference(referenceId: EntityId): Promise<void>;

  // Change tracking
  setupChangeTracking(resourceNodeId: NodeId, projectNodeId: NodeId): void;
  removeChangeTracking(resourceNodeId: NodeId, projectNodeId: NodeId): void;

  // Utility methods
  isSelectableNodeType(nodeType: string): boolean;
  getResourceDisplayName(resourceNodeId: NodeId): Promise<string>;
}

// Supporting types
export interface TreeStructure {
  rootNode: TreeStructureNode;
}

export interface TreeStructureNode {
  id: NodeId;
  name: string;
  nodeType: string;
  children?: TreeStructureNode[];
  isSelectable: boolean;
}

export interface TreePath {
  path: TreeNode[];
  depth: number;
}

export interface ValidationResult {
  nodeId: NodeId;
  isValid: boolean;
  errorMessage?: string;
  metadata?: any;
}
```

### LayerCompositionService

Service for composing map layers from resources.

```typescript
export class LayerCompositionService {
  // Layer composition
  async composeLayers(
    resourceReferences: ResourceReference[],
    layerConfigurations: LayerConfiguration[]
  ): Promise<MapLayer[]>;

  // Individual layer creation
  async createMapLayer(
    resourceRef: ResourceReference,
    config: LayerConfiguration
  ): Promise<MapLayer | null>;

  // Layer optimization
  async optimizeLayerStack(layers: MapLayer[]): Promise<MapLayer[]>;

  // Layer validation
  async validateLayerConfiguration(config: LayerConfiguration): Promise<ValidationResult>;
  async validateLayerCompatibility(layers: MapLayer[]): Promise<CompatibilityResult>;

  // Style management
  async applyStyleOverrides(
    layer: MapLayer,
    styleOverrides: Record<string, any>
  ): Promise<MapLayer>;
  async mergeLayerStyles(
    baseStyle: Record<string, any>,
    overrides: Record<string, any>
  ): Record<string, any>;
}

// Supporting types
export interface MapLayer {
  id: string;
  type: LayerType;
  source: LayerSource;
  paint?: Record<string, any>;
  layout?: Record<string, any>;
  filter?: any[];
  metadata?: LayerMetadata;
}

export interface LayerMetadata {
  resourceNodeId: NodeId;
  referenceType: ResourceReferenceType;
  loadPriority: number;
  performanceHints?: PerformanceHints;
}

export interface PerformanceHints {
  preferredTileSize?: number;
  maxZoomOptimization?: number;
  memoryUsageHint?: 'low' | 'medium' | 'high';
}

export interface CompatibilityResult {
  compatible: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}
```

### ExportService

Service for exporting projects.

```typescript
export class ExportService {
  // Export operations
  async exportProject(
    projectEntity: ProjectEntity,
    exportConfig: ExportConfiguration
  ): Promise<ExportResult>;

  // Export type handlers
  async exportAsImage(
    projectEntity: ProjectEntity,
    exportConfig: ExportConfiguration
  ): Promise<ExportResult>;
  async exportAsInteractiveMap(
    projectEntity: ProjectEntity,
    exportConfig: ExportConfiguration
  ): Promise<ExportResult>;
  async exportAsConfiguration(
    projectEntity: ProjectEntity,
    exportConfig: ExportConfiguration
  ): Promise<ExportResult>;

  // Sharing operations
  async shareProject(
    projectNodeId: NodeId,
    sharingConfig: SharingConfiguration
  ): Promise<ShareResult>;
  async generateShareUrl(projectNodeId: NodeId, options?: ShareUrlOptions): Promise<string>;
  async revokeShare(shareId: string): Promise<void>;

  // Export history
  async getExportHistory(projectNodeId: NodeId): Promise<ExportConfiguration[]>;
  async deleteExport(exportId: EntityId): Promise<void>;
}

// Supporting types
export interface ExportResult {
  exportId: EntityId;
  type: 'blob' | 'url' | 'file';
  data: Blob | string | File;
  filename?: string;
  metadata: ExportResultMetadata;
}

export interface ExportResultMetadata {
  fileSize: number;
  format: ExportFormat;
  dimensions?: ExportDimensions;
  createdAt: number;
  expiresAt?: number;
}

export interface ShareResult {
  shareId: string;
  shareUrl: string;
  accessToken?: string;
  expiresAt?: number;
}

export interface ShareUrlOptions {
  includeToken?: boolean;
  expirationDays?: number;
  allowDownload?: boolean;
}
```

## Component APIs

### ProjectDialog

Main project configuration dialog component.

```typescript
export interface ProjectDialogProps {
  nodeId: NodeId;
  isOpen: boolean;
  onClose: () => void;
  onSave: (projectData: ProjectEntity) => Promise<void>;
  initialData?: Partial<ProjectEntity>;
}

export const ProjectDialog: React.FC<ProjectDialogProps>;
```

### ResourceSelectionStep

Resource selection step component.

```typescript
export interface ResourceSelectionStepProps {
  projectData: ProjectFormData;
  onProjectDataChange: (data: ProjectFormData) => void;
  onNext: () => void;
}

export const ResourceSelectionStep: React.FC<ResourceSelectionStepProps>;
```

### ResourceTreeView

Interactive tree view for resource selection.

```typescript
export interface ResourceTreeViewProps {
  treeData: TreeStructure | null;
  selectedResources: ResourceSelection[];
  onSelectionChange: (resources: ResourceSelection[]) => void;
  filterOptions: ResourceFilterOptions;
  expandedNodes: Set<NodeId>;
  onNodeExpand: (nodeId: NodeId, expanded: boolean) => void;
}

export const ResourceTreeView: React.FC<ResourceTreeViewProps>;

// Supporting types
export interface ResourceSelection {
  nodeId: NodeId;
  displayName: string;
  nodeType: string;
  isActive: boolean;
}

export interface ResourceFilterOptions {
  nodeTypes?: string[];
  searchQuery?: string;
  showOnlySelectable?: boolean;
}
```

### LayerCompositionStep

Layer composition step component.

```typescript
export interface LayerCompositionStepProps {
  projectData: ProjectFormData;
  onProjectDataChange: (data: ProjectFormData) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export const LayerCompositionStep: React.FC<LayerCompositionStepProps>;
```

### IntegratedMapView

Map visualization component using MapLibreGL.js.

```typescript
export interface IntegratedMapViewProps {
  projectEntity: ProjectEntity;
  layerConfigurations: LayerConfiguration[];
  onMapLoad?: (map: MapLibreMap) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  onError?: (error: Error) => void;
}

export const IntegratedMapView: React.FC<IntegratedMapViewProps>;

// Supporting types
export interface MapViewport {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  bounds: [[number, number], [number, number]];
}
```

## Plugin Integration

### Plugin Definition

```typescript
export const ProjectDefinition: NodeTypeDefinition<
  ProjectEntity,
  ResourceReference | LayerConfiguration | ExportConfiguration,
  ProjectEntity
> = {
  nodeType: 'project',
  database: {
    entityStore: 'projects',
    groupEntityStores: ['resourceReferences'],
    relationalEntityStores: ['layerConfigurations'],
    autoEntityStores: ['exportConfigurations'],
    schema: {
      projects: '&nodeId, createdAt, updatedAt, lastRendered',
      resourceReferences: '&referenceId, projectNodeId, resourceNodeId, referenceType, isActive',
      layerConfigurations: '&layerId, projectNodeId, resourceReferenceId, layerOrder, isVisible',
      exportConfigurations: '&exportId, projectNodeId, exportType, createdAt'
    },
    version: 1
  },
  entityHandler: new ProjectEntityHandler(),
  handler: new ProjectHandler(),
  lifecycle: {
    afterCreate: async (node, context) => {
      // Project initialization logic
    },
    beforeDelete: async (node, context) => {
      // Cleanup logic
    }
  },
  ui: {
    dialogComponent: ProjectDialog,
    panelComponent: undefined
  }
};
```

### API Extensions

```typescript
export const projectAPIExtensions = {
  aggregateResources: {
    replace: async (args: [NodeId, AggregationOptions?]) => {
      const [projectNodeId, options] = args;
      const service = new ResourceAggregationService();
      return service.aggregateResources(projectNodeId, options);
    }
  },
  
  validateReferences: {
    replace: async (args: [NodeId]) => {
      const [projectNodeId] = args;
      const service = new CrossTreeReferenceService();
      return service.validateProjectReferences(projectNodeId);
    }
  },
  
  exportProject: {
    replace: async (args: [NodeId, ExportConfiguration]) => {
      const [projectNodeId, exportConfig] = args;
      const service = new ExportService();
      return service.exportProject(projectNodeId, exportConfig);
    }
  }
};
```

## Error Handling

### Error Types

```typescript
export class ProjectError extends Error {
  constructor(
    message: string,
    public code: ProjectErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'ProjectError';
  }
}

export enum ProjectErrorCode {
  INVALID_REFERENCE = 'INVALID_REFERENCE',
  AGGREGATION_FAILED = 'AGGREGATION_FAILED',
  EXPORT_FAILED = 'EXPORT_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  COMPOSITION_ERROR = 'COMPOSITION_ERROR'
}
```

### Error Handling Utilities

```typescript
export class ErrorHandler {
  static handleProjectError(error: Error, context?: any): void {
    if (error instanceof ProjectError) {
      switch (error.code) {
        case ProjectErrorCode.INVALID_REFERENCE:
          this.handleInvalidReference(error, context);
          break;
        case ProjectErrorCode.AGGREGATION_FAILED:
          this.handleAggregationError(error, context);
          break;
        default:
          this.handleGenericError(error, context);
      }
    } else {
      this.handleUnknownError(error, context);
    }
  }

  private static handleInvalidReference(error: ProjectError, context?: any): void {
    console.error('Invalid resource reference:', error.details);
    // Notify user and suggest remediation
  }

  private static handleAggregationError(error: ProjectError, context?: any): void {
    console.error('Resource aggregation failed:', error.details);
    // Attempt recovery or partial aggregation
  }
}
```

## Usage Examples

### Basic Project Creation

```typescript
// Create a new project
const projectAPI = getProjectAPI();

const project = await projectAPI.createProject('project-node-123' as NodeId, {
  name: 'My Geographic Project',
  description: 'A project combining multiple geographic resources',
  mapConfig: {
    center: [139.6917, 35.6895], // Tokyo
    zoom: 10
  }
});

// Add resource references
const basemapRef = await projectAPI.addResourceReference(
  project.nodeId,
  'basemap-node-456' as NodeId,
  'basemap'
);

const shapeRef = await projectAPI.addResourceReference(
  project.nodeId,
  'shape-node-789' as NodeId,
  'shape'
);

// Configure layers
const layerConfig: LayerConfiguration = {
  layerId: 'my-shape-layer',
  layerType: 'fill',
  layerOrder: 1,
  isVisible: true,
  styleConfig: {
    source: {
      type: 'geojson',
      data: shapeData
    },
    paint: {
      'fill-color': '#007cbf',
      'fill-opacity': 0.7
    }
  },
  interactionConfig: {
    clickable: true,
    hoverable: true
  }
};

await projectAPI.configureLayer(project.nodeId, layerConfig);

// Aggregate resources
const aggregatedData = await projectAPI.aggregateResources(project.nodeId);
```

### Resource Reference Management

```typescript
const referenceService = new CrossTreeReferenceService(treeQueryAPI);

// Get Resources tree structure
const treeStructure = await referenceService.getResourcesTreeStructure();

// Validate multiple references
const nodeIds: NodeId[] = ['node1', 'node2', 'node3'] as NodeId[];
const validationResults = await referenceService.validateMultipleReferences(nodeIds);

// Setup change tracking
referenceService.setupChangeTracking('resource-node' as NodeId, 'project-node' as NodeId);
```

### Layer Composition

```typescript
const compositionService = new LayerCompositionService();

// Compose layers from resources
const resourceRefs = await projectAPI.getResourceReferences('project-node' as NodeId);
const layerConfigs = await projectAPI.getLayerConfigurations('project-node' as NodeId);

const composedLayers = await compositionService.composeLayers(resourceRefs, layerConfigs);

// Optimize layer stack
const optimizedLayers = await compositionService.optimizeLayerStack(composedLayers);
```

### Export Project

```typescript
const exportService = new ExportService();

// Export as image
const exportConfig: ExportConfiguration = {
  exportType: 'image',
  exportName: 'My Project Map',
  exportConfig: {
    format: 'png',
    quality: 'high',
    dimensions: {
      width: 1920,
      height: 1080,
      dpi: 300
    }
  }
};

const exportResult = await exportService.exportProject(project, exportConfig);

// Share project
const shareResult = await exportService.shareProject('project-node' as NodeId, {
  isPublic: true,
  allowDownload: true,
  expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
});

console.log('Share URL:', shareResult.shareUrl);
```

### React Component Usage

```typescript
// Using ProjectDialog component
const MyProjectManager: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const handleSaveProject = async (projectData: ProjectEntity) => {
    try {
      await projectAPI.updateProject(projectData.nodeId, projectData);
      console.log('Project saved successfully');
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  };

  return (
    <div>
      <Button onClick={() => setIsDialogOpen(true)}>
        Edit Project
      </Button>
      
      <ProjectDialog
        nodeId={'my-project-node' as NodeId}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveProject}
      />
    </div>
  );
};
```

This API reference provides comprehensive documentation for all Project Plugin interfaces, services, and usage patterns. Use this as a guide for implementing and integrating with the Project Plugin system.