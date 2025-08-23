/**
 * Project API interface - UI-Worker通信契約
 */

import type { NodeId } from '@hierarchidb/00-core';
import type {
  ProjectEntity, 
  CreateProjectData, 
  UpdateProjectData,
  ProjectStatistics,
  LayerConfiguration,
  LayerSource,
  MapLibrePaintProperty,
  MapLibreLayoutProperty,
  MapLibreFilterExpression
} from './types';

/**
 * Main Project API interface for UI-Worker communication via PluginRegistry
 */
export interface ProjectAPI {
  // Core project operations
  createEntity(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity>;
  getEntity(nodeId: NodeId): Promise<ProjectEntity | undefined>;
  updateEntity(nodeId: NodeId, data: UpdateProjectData): Promise<void>;
  deleteEntity(nodeId: NodeId): Promise<void>;

  // Resource reference operations (uses TreeNode.references)
  addResourceReference(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<void>;
  removeResourceReference(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<void>;
  getResourceReferences(projectNodeId: NodeId): Promise<NodeId[]>;

  // Layer configuration
  configureLayer(projectNodeId: NodeId, resourceNodeId: NodeId, config: LayerConfiguration): Promise<void>;
  getLayerConfiguration(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<LayerConfiguration | undefined>;
  removeLayerConfiguration(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<void>;

  // Project aggregation
  aggregateProject(projectNodeId: NodeId): Promise<AggregationResult>;
  getAggregationStatus(projectNodeId: NodeId): Promise<AggregationStatus>;

  // Statistics
  getProjectStatistics(projectNodeId: NodeId): Promise<ProjectStatistics>;
}

/**
 * Aggregation result types
 */
export interface AggregationResult {
  projectNodeId: NodeId;
  layers: ComposedMapLayer[];
  metadata: AggregationResultMetadata;
  statistics: AggregationStatistics;
}

export interface ComposedMapLayer {
  id: string;
  type: string;
  source: LayerSource;
  paint?: Record<string, MapLibrePaintProperty>;
  layout?: Record<string, MapLibreLayoutProperty>;
  filter?: MapLibreFilterExpression;
}



export interface AggregationResultMetadata {
  aggregationId: string;
  totalResources: number;
  totalLayers: number;
  aggregationTime: number;
}

export interface AggregationStatistics {
  resourcesLoaded: number;
  layersComposed: number;
  totalDataSize: number;
}

export interface AggregationStatus {
  status: 'pending' | 'processing' | 'completed' | 'error';
  lastAggregated: number | null;
  resourceCount: number;
  layerCount: number;
  hasErrors: boolean;
  errorMessages: string[];
}