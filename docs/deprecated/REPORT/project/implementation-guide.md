# Project Plugin Implementation Guide

This document provides comprehensive guidance for implementing the Project Plugin, including development phases, technical requirements, and step-by-step implementation instructions.

## Implementation Overview

The Project Plugin implementation follows a phased approach:

1. **Phase 1**: Core infrastructure and basic resource selection
2. **Phase 2**: Layer composition and map integration  
3. **Phase 3**: Export functionality and advanced features
4. **Phase 4**: Performance optimization and collaborative features

## Development Environment Setup

### Prerequisites

```bash
# Ensure HierarchiDB development environment is set up
pnpm install
pnpm build

# Verify core dependencies
pnpm typecheck
pnpm test:run
```

### Plugin Directory Structure

```
packages/plugins/project/
├── package.json                 # Plugin package configuration
├── tsconfig.json               # TypeScript configuration
├── tsup.config.ts              # Build configuration
├── vitest.config.ts            # Test configuration
└── src/
    ├── openstreetmap-type.ts                # Plugin entry point
    ├── constants.ts            # Plugin constants
    ├── types/                  # TypeScript type definitions
    │   ├── openstreetmap-type.ts
    │   ├── ProjectEntity.ts
    │   ├── ResourceReference.ts
    │   ├── LayerConfiguration.ts
    │   └── ExportConfiguration.ts
    ├── handlers/               # Entity handlers
    │   ├── ProjectEntityHandler.ts
    │   └── ProjectHandler.ts
    ├── services/               # Business logic services
    │   ├── ResourceAggregationService.ts
    │   ├── LayerCompositionService.ts
    │   ├── CrossTreeReferenceService.ts
    │   └── ExportService.ts
    ├── components/             # UI components
    │   ├── ProjectDialog.tsx
    │   ├── ResourceSelectionStep.tsx
    │   ├── LayerCompositionStep.tsx
    │   ├── MapPreviewStep.tsx
    │   ├── ExportStep.tsx
    │   └── shared/
    │       ├── ResourceTreeView.tsx
    │       ├── LayerConfigurationPanel.tsx
    │       └── IntegratedMapView.tsx
    ├── definitions/            # Plugin definition
    │   └── ProjectDefinition.ts
    └── __tests__/              # Test files
        ├── handlers/
        ├── services/
        └── components/
```

## Phase 1: Core Infrastructure

### Timeline: Week 1 (5 days)

#### Day 1: Project Setup and Entity Definitions

**Tasks:**
- Create plugin directory structure
- Set up build configuration and dependencies
- Define core TypeScript interfaces

**Entity Handler Implementation:**

```typescript
// src/handlers/ProjectEntityHandler.ts
import { BaseEntityHandler } from '@hierarchidb/worker';
import { ProjectEntity } from '../types';

export class ProjectEntityHandler extends BaseEntityHandler<ProjectEntity> {
  protected tableName = 'projects';

  async createEntity(nodeId: NodeId, data: Partial<ProjectEntity>): Promise<ProjectEntity> {
    const entity: ProjectEntity = {
      id: this.generateEntityId(),
      nodeId,
      name: data.name || 'New Project',
      description: data.description || '',
      mapConfig: {
        center: data.mapConfig?.center || [139.6917, 35.6895], // Tokyo
        zoom: data.mapConfig?.zoom || 10,
        bearing: data.mapConfig?.bearing || 0,
        pitch: data.mapConfig?.pitch || 0
      },
      renderConfig: {
        maxZoom: 18,
        minZoom: 0
      },
      aggregationConfig: {
        lastAggregated: 0,
        resourceCount: 0,
        layerCount: 0,
        hasErrors: false
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1
    };

    await this.table.add(entity);
    return entity;
  }

  async updateEntity(id: EntityId, updates: Partial<ProjectEntity>): Promise<ProjectEntity> {
    const existingEntity = await this.getEntity(id);
    if (!existingEntity) {
      throw new Error(`Project entity not found: ${id}`);
    }

    const updatedEntity: ProjectEntity = {
      ...existingEntity,
      ...updates,
      updatedAt: Date.now(),
      version: existingEntity.version + 1
    };

    await this.table.put(updatedEntity);
    return updatedEntity;
  }
}
```

**Plugin Definition:**

```typescript
// src/definitions/ProjectDefinition.ts
import { NodeTypeDefinition } from '@hierarchidb/core';
import { ProjectEntity, ResourceReference, LayerConfiguration, ExportConfiguration } from '../types';
import { ProjectEntityHandler } from '../handlers/ProjectEntityHandler';
import { ProjectHandler } from '../handlers/ProjectHandler';
import { ProjectDialog } from '../components/ProjectDialog';

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
      // Main entity store
      projects: '&nodeId, createdAt, updatedAt, lastRendered',
      
      // Group entities (resource references)
      resourceReferences: '&referenceId, projectNodeId, resourceNodeId, referenceType, isActive',
      
      // Relational entities (layer configurations)
      layerConfigurations: '&layerId, projectNodeId, resourceReferenceId, layerOrder, isVisible',
      
      // Auto entities (export configurations)
      exportConfigurations: '&exportId, projectNodeId, exportType, createdAt'
    },
    version: 1
  },
  entityHandler: new ProjectEntityHandler(),
  handler: new ProjectHandler(),
  lifecycle: {
    afterCreate: async (node, context) => {
      console.log(`Project created: ${node.id}`);
    },
    beforeDelete: async (node, context) => {
      // Clean up resource references and configurations
      await context.deleteRelatedEntities(node.id);
    }
  },
  ui: {
    dialogComponent: ProjectDialog,
    panelComponent: undefined // Will be implemented in Phase 2
  }
};
```

#### Day 2: Cross-Tree Reference Service

**Reference Service Implementation:**

```typescript
// src/services/CrossTreeReferenceService.ts
import { TreeQueryAPI, NodeId, TreeId } from '@hierarchidb/api';

export class CrossTreeReferenceService {
  constructor(private treeQueryAPI: TreeQueryAPI) {}

  async validateReference(resourceNodeId: NodeId): Promise<boolean> {
    try {
      const node = await this.treeQueryAPI.getNode(resourceNodeId);
      return node !== null;
    } catch (error) {
      console.error('Reference validation failed:', error);
      return false;
    }
  }

  async getResourcesTreeStructure(): Promise<TreeStructure> {
    // Get the Resources tree root
    const resourcesTreeId = await this.getResourcesTreeId();
    const rootNode = await this.treeQueryAPI.getTreeRoot(resourcesTreeId);
    
    if (!rootNode) {
      throw new Error('Resources tree root not found');
    }

    return this.buildTreeStructure(rootNode);
  }

  private async buildTreeStructure(rootNode: TreeNode): Promise<TreeStructure> {
    const children = await this.treeQueryAPI.getChildren(rootNode.id);
    
    const treeNodes: TreeStructureNode[] = await Promise.all(
      children.map(async child => ({
        id: child.id,
        name: child.name,
        nodeType: child.nodeType,
        children: child.nodeType === 'folder' 
          ? await this.buildTreeStructure(child) 
          : undefined,
        isSelectable: this.isSelectableNodeType(child.nodeType)
      }))
    );

    return {
      rootNode: {
        id: rootNode.id,
        name: rootNode.name,
        nodeType: rootNode.nodeType,
        children: treeNodes,
        isSelectable: false
      }
    };
  }

  private isSelectableNodeType(nodeType: string): boolean {
    const selectableTypes = ['basemap', 'shape', 'stylemap', 'location', 'route'];
    return selectableTypes.includes(nodeType);
  }

  private async getResourcesTreeId(): Promise<TreeId> {
    // Implementation depends on how Resources/Projects trees are distinguished
    // This might involve tree metadata or naming conventions
    const trees = await this.treeQueryAPI.getAllTrees();
    const resourcesTree = trees.find(tree => tree.name === 'Resources');
    
    if (!resourcesTree) {
      throw new Error('Resources tree not found');
    }
    
    return resourcesTree.id;
  }
}
```

#### Day 3: Basic UI Components

**Project Dialog Foundation:**

```typescript
// src/components/ProjectDialog.tsx
import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box
} from '@mui/material';
import { ProjectEntity } from '../types';
import { ResourceSelectionStep } from './ResourceSelectionStep';

interface ProjectDialogProps {
  nodeId: NodeId;
  isOpen: boolean;
  onClose: () => void;
  onSave: (projectData: ProjectEntity) => Promise<void>;
  initialData?: Partial<ProjectEntity>;
}

export const ProjectDialog: React.FC<ProjectDialogProps> = ({
  nodeId,
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [projectData, setProjectData] = useState<ProjectFormData>(() => 
    initializeProjectData(nodeId, initialData)
  );

  const steps = [
    'リソース選択',
    'レイヤー構成', 
    'マップ プレビュー',
    'エクスポート設定'
  ];

  const handleNext = useCallback(() => {
    setActiveStep(prev => Math.min(prev + 1, steps.length - 1));
  }, [steps.length]);

  const handleBack = useCallback(() => {
    setActiveStep(prev => Math.max(prev - 1, 0));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const entity = convertFormDataToEntity(projectData);
      await onSave(entity);
      onClose();
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  }, [projectData, onSave, onClose]);

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{ 
        sx: { 
          height: '90vh',
          display: 'flex',
          flexDirection: 'column'
        } 
      }}
    >
      <DialogTitle>
        プロジェクト設定
      </DialogTitle>

      <Box sx={{ px: 3, py: 1 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent sx={{ flex: 1, overflow: 'hidden' }}>
        {activeStep === 0 && (
          <ResourceSelectionStep
            projectData={projectData}
            onProjectDataChange={setProjectData}
            onNext={handleNext}
          />
        )}
        {/* Other steps will be implemented in later phases */}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          キャンセル
        </Button>
        <Button
          onClick={handleBack}
          disabled={activeStep === 0}
        >
          戻る
        </Button>
        <Button
          onClick={activeStep === steps.length - 1 ? handleSave : handleNext}
          variant="contained"
          disabled={!canProceedToNextStep(activeStep, projectData)}
        >
          {activeStep === steps.length - 1 ? '保存' : '次へ'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

#### Day 4: Resource Selection Component

**Resource Tree View:**

```typescript
// src/components/shared/ResourceTreeView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  TreeView,
  TreeItem,
  TreeItemProps
} from '@mui/x-tree-view';
import {
  ExpandMoreIcon,
  ChevronRightIcon,
  Checkbox,
  FormControlLabel,
  Box,
  Typography
} from '@mui/material';
import { CrossTreeReferenceService } from '../../services/CrossTreeReferenceService';

interface ResourceTreeViewProps {
  onSelectionChange: (selectedResources: ResourceSelection[]) => void;
  selectedResources: ResourceSelection[];
}

export const ResourceTreeView: React.FC<ResourceTreeViewProps> = ({
  onSelectionChange,
  selectedResources
}) => {
  const [treeData, setTreeData] = useState<TreeStructure | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load tree structure
  useEffect(() => {
    const loadTreeData = async () => {
      try {
        const referenceService = new CrossTreeReferenceService(/* TreeQueryAPI */);
        const structure = await referenceService.getResourcesTreeStructure();
        setTreeData(structure);
        
        // Auto-expand root level
        if (structure.rootNode.children) {
          setExpanded([structure.rootNode.id]);
        }
      } catch (error) {
        console.error('Failed to load resources tree:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTreeData();
  }, []);

  const handleNodeToggle = useCallback((event: React.SyntheticEvent, nodeIds: string[]) => {
    setExpanded(nodeIds);
  }, []);

  const handleNodeSelect = useCallback((nodeId: NodeId, selected: boolean) => {
    if (selected) {
      // Add resource to selection
      const newResource: ResourceSelection = {
        nodeId,
        displayName: getNodeDisplayName(nodeId),
        nodeType: getNodeType(nodeId),
        isActive: true
      };
      onSelectionChange([...selectedResources, newResource]);
    } else {
      // Remove resource from selection
      onSelectionChange(selectedResources.filter(r => r.nodeId !== nodeId));
    }
  }, [selectedResources, onSelectionChange]);

  if (loading) {
    return <TreeViewSkeleton />;
  }

  if (!treeData) {
    return <TreeViewError message="リソースツリーの読み込みに失敗しました" />;
  }

  return (
    <TreeView
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      expanded={expanded}
      onNodeToggle={handleNodeToggle}
      sx={{ flexGrow: 1, overflowY: 'auto' }}
    >
      {renderTreeNodes(treeData.rootNode)}
    </TreeView>
  );

  function renderTreeNodes(node: TreeStructureNode): React.ReactNode {
    const isSelected = selectedResources.some(r => r.nodeId === node.id);
    
    return (
      <TreeItem
        key={node.id}
        nodeId={node.id}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
            {node.isSelectable && (
              <Checkbox
                size="small"
                checked={isSelected}
                onChange={(e) => handleNodeSelect(node.id, e.target.checked)}
                sx={{ mr: 1 }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <Typography variant="body2">
              {node.name}
            </Typography>
            <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
              ({node.nodeType})
            </Typography>
          </Box>
        }
      >
        {node.children?.map(child => renderTreeNodes(child))}
      </TreeItem>
    );
  }
};
```

#### Day 5: Testing and Integration

**Unit Tests:**

```typescript
// src/__tests__/handlers/ProjectEntityHandler.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectEntityHandler } from '../../handlers/ProjectEntityHandler';
import { setupTestDatabase } from '@hierarchidb/test-utils';

describe('ProjectEntityHandler', () => {
  let handler: ProjectEntityHandler;
  let testNodeId: NodeId;

  beforeEach(async () => {
    const db = await setupTestDatabase();
    handler = new ProjectEntityHandler(db);
    testNodeId = 'test-node-123' as NodeId;
  });

  it('should create project entity with default values', async () => {
    const entity = await handler.createEntity(testNodeId, {
      name: 'Test Project'
    });

    expect(entity.nodeId).toBe(testNodeId);
    expect(entity.name).toBe('Test Project');
    expect(entity.mapConfig.center).toEqual([139.6917, 35.6895]);
    expect(entity.mapConfig.zoom).toBe(10);
    expect(entity.aggregationConfig.resourceCount).toBe(0);
  });

  it('should update project entity and increment version', async () => {
    const created = await handler.createEntity(testNodeId, {
      name: 'Original Name'
    });

    const updated = await handler.updateEntity(created.id, {
      name: 'Updated Name'
    });

    expect(updated.name).toBe('Updated Name');
    expect(updated.version).toBe(created.version + 1);
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
  });
});
```

**Integration Tests:**

```typescript
// src/__tests__/services/CrossTreeReferenceService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CrossTreeReferenceService } from '../../services/CrossTreeReferenceService';

describe('CrossTreeReferenceService', () => {
  let service: CrossTreeReferenceService;
  let mockTreeQueryAPI: any;

  beforeEach(() => {
    mockTreeQueryAPI = {
      getNode: vi.fn(),
      getTreeRoot: vi.fn(),
      getChildren: vi.fn(),
      getAllTrees: vi.fn()
    };
    
    service = new CrossTreeReferenceService(mockTreeQueryAPI);
  });

  it('should validate existing resource reference', async () => {
    const testNodeId = 'resource-node-123' as NodeId;
    mockTreeQueryAPI.getNode.mockResolvedValue({
      id: testNodeId,
      name: 'Test Resource'
    });

    const isValid = await service.validateReference(testNodeId);
    expect(isValid).toBe(true);
    expect(mockTreeQueryAPI.getNode).toHaveBeenCalledWith(testNodeId);
  });

  it('should return false for non-existent resource reference', async () => {
    const testNodeId = 'non-existent-node' as NodeId;
    mockTreeQueryAPI.getNode.mockResolvedValue(null);

    const isValid = await service.validateReference(testNodeId);
    expect(isValid).toBe(false);
  });
});
```

## Phase 2: Layer Composition and Map Integration

### Timeline: Week 2 (5 days)

#### Day 6-7: Layer Configuration Components

**Layer Composition Service:**

```typescript
// src/services/LayerCompositionService.ts
import { LayerConfiguration, ResourceReference } from '../types';
import { MapLayer } from '@maplibre/maplibre-gl-js';

export class LayerCompositionService {
  async composeLayers(
    resourceReferences: ResourceReference[],
    layerConfigurations: LayerConfiguration[]
  ): Promise<MapLayer[]> {
    const layers: MapLayer[] = [];

    // Sort by layer order
    const sortedConfigs = layerConfigurations.sort((a, b) => a.layerOrder - b.layerOrder);

    for (const config of sortedConfigs) {
      if (!config.isVisible) continue;

      const resourceRef = resourceReferences.find(ref => ref.id === config.resourceReferenceId);
      if (!resourceRef) continue;

      const layer = await this.createMapLayer(resourceRef, config);
      if (layer) {
        layers.push(layer);
      }
    }

    return layers;
  }

  private async createMapLayer(
    resourceRef: ResourceReference,
    config: LayerConfiguration
  ): Promise<MapLayer | null> {
    switch (resourceRef.referenceType) {
      case 'basemap':
        return this.createBasemapLayer(resourceRef, config);
      case 'shape':
        return this.createShapeLayer(resourceRef, config);
      case 'location':
        return this.createLocationLayer(resourceRef, config);
      case 'route':
        return this.createRouteLayer(resourceRef, config);
      default:
        console.warn(`Unsupported resource type: ${resourceRef.referenceType}`);
        return null;
    }
  }

  private async createBasemapLayer(
    resourceRef: ResourceReference,
    config: LayerConfiguration
  ): Promise<MapLayer> {
    // Implementation for basemap layer creation
    return {
      id: config.layerId,
      type: 'raster',
      source: config.styleConfig.source,
      paint: config.styleConfig.paint,
      layout: config.styleConfig.layout
    };
  }

  // Additional layer creation methods...
}
```

#### Day 8-9: MapLibreGL.js Integration

**Integrated Map View Component:**

```typescript
// src/components/shared/IntegratedMapView.tsx
import React, { useRef, useEffect, useState } from 'react';
import { Map as MapLibreMap, MapOptions } from 'maplibre-gl';
import { Box, CircularProgress, Alert } from '@mui/material';
import { LayerConfiguration, ProjectEntity } from '../../types';
import { LayerCompositionService } from '../../services/LayerCompositionService';

interface IntegratedMapViewProps {
  projectEntity: ProjectEntity;
  layerConfigurations: LayerConfiguration[];
  onMapLoad?: (map: MapLibreMap) => void;
  onError?: (error: Error) => void;
}

export const IntegratedMapView: React.FC<IntegratedMapViewProps> = ({
  projectEntity,
  layerConfigurations,
  onMapLoad,
  onError
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    const mapOptions: MapOptions = {
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: []
      },
      center: projectEntity.mapConfig.center,
      zoom: projectEntity.mapConfig.zoom,
      bearing: projectEntity.mapConfig.bearing,
      pitch: projectEntity.mapConfig.pitch,
      maxZoom: projectEntity.renderConfig.maxZoom,
      minZoom: projectEntity.renderConfig.minZoom
    };

    try {
      map.current = new MapLibreMap(mapOptions);

      map.current.on('load', () => {
        setIsLoading(false);
        onMapLoad?.(map.current!);
        loadProjectLayers();
      });

      map.current.on('error', (e) => {
        const errorMsg = `Map error: ${e.error?.message || 'Unknown error'}`;
        setError(errorMsg);
        onError?.(new Error(errorMsg));
      });

    } catch (err) {
      const errorMsg = `Failed to initialize map: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(errorMsg);
      setIsLoading(false);
    }

    return () => {
      map.current?.remove();
    };
  }, [projectEntity]);

  // Update layers when configuration changes
  useEffect(() => {
    if (map.current?.isStyleLoaded()) {
      loadProjectLayers();
    }
  }, [layerConfigurations]);

  const loadProjectLayers = async () => {
    if (!map.current) return;

    try {
      setIsLoading(true);
      
      const compositionService = new LayerCompositionService();
      const layers = await compositionService.composeLayers(
        [], // Resource references would be loaded here
        layerConfigurations
      );

      // Clear existing layers
      const existingLayers = map.current.getStyle().layers || [];
      existingLayers.forEach(layer => {
        if (layer.id.startsWith('project-')) {
          map.current!.removeLayer(layer.id);
        }
      });

      // Add new layers
      layers.forEach(layer => {
        map.current!.addLayer(layer);
      });

    } catch (err) {
      const errorMsg = `Failed to load layers: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(errorMsg);
      onError?.(new Error(errorMsg));
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '100%'
        }}
      />
      
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.8)'
          }}
        >
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
};
```

#### Day 10: Testing and Documentation

**Component Tests:**

```typescript
// src/__tests__/components/ProjectDialog.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectDialog } from '../../components/ProjectDialog';

describe('ProjectDialog', () => {
  const mockProps = {
    nodeId: 'test-node' as NodeId,
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn()
  };

  it('should render dialog with stepper navigation', () => {
    render(<ProjectDialog {...mockProps} />);
    
    expect(screen.getByText('プロジェクト設定')).toBeInTheDocument();
    expect(screen.getByText('リソース選択')).toBeInTheDocument();
    expect(screen.getByText('レイヤー構成')).toBeInTheDocument();
  });

  it('should navigate between steps', async () => {
    render(<ProjectDialog {...mockProps} />);
    
    const nextButton = screen.getByText('次へ');
    fireEvent.click(nextButton);
    
    await waitFor(() => {
      expect(screen.getByText('戻る')).not.toBeDisabled();
    });
  });

  it('should call onSave when completing final step', async () => {
    const onSave = vi.fn();
    render(<ProjectDialog {...mockProps} onSave={onSave} />);
    
    // Navigate to final step and save
    // (Implementation depends on completing all steps)
    
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });
});
```

## Phase 3: Export and Advanced Features

### Timeline: Week 3 (5 days)

#### Day 11-12: Export Service Implementation

```typescript
// src/services/ExportService.ts
export class ExportService {
  async exportProject(
    projectEntity: ProjectEntity,
    exportConfig: ExportConfiguration
  ): Promise<ExportResult> {
    switch (exportConfig.exportType) {
      case 'image':
        return this.exportAsImage(projectEntity, exportConfig);
      case 'interactive':
        return this.exportAsInteractiveMap(projectEntity, exportConfig);
      case 'configuration':
        return this.exportAsConfiguration(projectEntity, exportConfig);
      default:
        throw new Error(`Unsupported export type: ${exportConfig.exportType}`);
    }
  }

  private async exportAsImage(
    projectEntity: ProjectEntity,
    exportConfig: ExportConfiguration
  ): Promise<ExportResult> {
    // Implementation for image export using map canvas
    const canvas = await this.renderMapToCanvas(projectEntity, exportConfig);
    const blob = await this.canvasToBlob(canvas, exportConfig.exportConfig.format);
    
    return {
      type: 'blob',
      data: blob,
      filename: this.generateFilename(projectEntity, exportConfig)
    };
  }

  // Additional export methods...
}
```

#### Day 13-15: Performance Optimization and Final Integration

**Performance Optimizations:**

```typescript
// src/services/ResourceAggregationService.ts
export class ResourceAggregationService {
  private cache = new Map<string, any>();
  
  async aggregateResources(
    projectNodeId: NodeId,
    options: AggregationOptions = {}
  ): Promise<AggregatedData> {
    const cacheKey = this.generateCacheKey(projectNodeId, options);
    
    if (this.cache.has(cacheKey) && !options.forceRefresh) {
      return this.cache.get(cacheKey);
    }

    const resourceReferences = await this.loadResourceReferences(projectNodeId);
    const layerConfigurations = await this.loadLayerConfigurations(projectNodeId);
    
    const aggregatedData: AggregatedData = {
      layers: await this.composeLayers(resourceReferences, layerConfigurations),
      metadata: this.generateMetadata(resourceReferences, layerConfigurations),
      stats: this.calculateStats(resourceReferences, layerConfigurations)
    };

    this.cache.set(cacheKey, aggregatedData);
    return aggregatedData;
  }

  invalidateCache(projectNodeId: NodeId): void {
    const keysToDelete = Array.from(this.cache.keys())
      .filter(key => key.includes(projectNodeId));
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}
```

## Build and Deployment

### Package Configuration

```json
{
  "name": "@hierarchidb/plugin-project",
  "version": "1.0.0",
  "description": "Project Plugin for HierarchiDB - Resource aggregation and map composition",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "scripts": {
    "build": "tsup src/openstreetmap-type.ts --format cjs,esm --dts",
    "dev": "tsup src/openstreetmap-type.ts --format cjs,esm --dts --watch",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@hierarchidb/core": "workspace:*",
    "@hierarchidb/api": "workspace:*",
    "@hierarchidb/worker": "workspace:*",
    "@hierarchidb/ui-core": "workspace:*",
    "maplibre-gl": "^4.0.0",
    "react": "^18.0.0",
    "@mui/material": "^5.0.0",
    "@mui/x-tree-view": "^6.0.0"
  },
  "devDependencies": {
    "@hierarchidb/test-utils": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  }
}
```

### Build Configuration

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/openstreetmap-type.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    '@mui/material',
    '@mui/x-tree-view',
    'maplibre-gl'
  ]
});
```

## Quality Assurance

### Testing Strategy

1. **Unit Tests**: Core services and handlers
2. **Component Tests**: UI components with React Testing Library
3. **Integration Tests**: End-to-end workflows
4. **Performance Tests**: Resource aggregation and map rendering

### Code Quality Checks

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Testing
pnpm test:run

# Build verification
pnpm build
```

### Documentation Requirements

- Complete API documentation
- Component usage examples
- Integration guide for other plugins
- Performance optimization guide

## Troubleshooting

### Common Issues

1. **Cross-tree reference failures**: Verify tree structure and node existence
2. **Map rendering errors**: Check MapLibreGL.js compatibility and style configuration
3. **Performance issues**: Implement proper caching and lazy loading
4. **Type errors**: Ensure proper branded type usage throughout

### Debug Tools

```typescript
// Debug helper for development
export const ProjectDebugger = {
  logResourceReferences: (projectNodeId: NodeId) => {
    // Log all resource references for debugging
  },
  
  validateLayerConfiguration: (config: LayerConfiguration) => {
    // Validate layer configuration
  },
  
  inspectMapState: (map: MapLibreMap) => {
    // Inspect current map state
  }
};
```

This implementation guide provides a comprehensive roadmap for building the Project Plugin with proper architecture, testing, and quality assurance practices.

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"content": "docs/shape \u30c7\u30a3\u30ec\u30af\u30c8\u30ea\u306e\u5185\u5bb9\u3092\u8abf\u67fb\u3057\u3066\u4f53\u88c1\u3092\u78ba\u8a8d", "status": "completed"}, {"content": "docs/project \u30c7\u30a3\u30ec\u30af\u30c8\u30ea\u3092\u4f5c\u6210\u3057\u3066\u30d7\u30ed\u30b8\u30a7\u30af\u30c8\u30d7\u30e9\u30b0\u30a4\u30f3\u306e\u4ed5\u69d8\u66f8\u3092\u4f5c\u6210", "status": "completed"}]