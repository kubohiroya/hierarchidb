/**
 * Simplified Project API using TreeNode.references
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
} from './ProjectEntity';

/**
 * Main Project API interface - simplified
 */
export interface ProjectAPI {
  // Core project operations
  createProject(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity>;
  getProject(nodeId: NodeId): Promise<ProjectEntity | undefined>;
  updateProject(nodeId: NodeId, data: UpdateProjectData): Promise<void>;
  deleteProject(nodeId: NodeId): Promise<void>;

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
 * Supporting types
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

/**
 * Aggregation status information
 */
export interface AggregationStatus {
  status: 'pending' | 'processing' | 'completed' | 'error';
  lastAggregated: number | null;
  resourceCount: number;
  layerCount: number;
  hasErrors: boolean;
  errorMessages: string[];
}
