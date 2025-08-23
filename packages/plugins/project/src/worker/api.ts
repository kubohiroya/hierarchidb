/**
 * Worker API implementation for Project plugin
 * Implements ProjectAPI interface from shared layer
 */

import { NodeId } from '@hierarchidb/00-core';
import type {
  ProjectEntity, 
  CreateProjectData, 
  UpdateProjectData, 
  ProjectStatistics,
  LayerConfiguration,
  AggregationResult,
  AggregationStatus
} from '../shared';
import { ProjectEntityHandler } from './handlers';

/**
 * Project Worker API implementation
 * This will be registered in the PluginRegistry system
 */
export const projectPluginAPI = {
  nodeType: 'project',
  methods: {
    async createEntity(nodeId: NodeId, data: CreateProjectData): Promise<ProjectEntity> {
      const handler = new ProjectEntityHandler();
      return await handler.createEntity(nodeId, data);
    },

    async getEntity(nodeId: NodeId): Promise<ProjectEntity | undefined> {
      const handler = new ProjectEntityHandler();
      return await handler.getEntity(nodeId);
    },

    async updateEntity(nodeId: NodeId, data: UpdateProjectData): Promise<void> {
      const handler = new ProjectEntityHandler();
      await handler.updateEntity(nodeId, data);
    },

    async deleteEntity(nodeId: NodeId): Promise<void> {
      const handler = new ProjectEntityHandler();
      await handler.deleteEntity(nodeId);
    },

    async addResourceReference(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<void> {
      const handler = new ProjectEntityHandler();
      await handler.addResourceReference(projectNodeId, resourceNodeId);
    },

    async removeResourceReference(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<void> {
      const handler = new ProjectEntityHandler();
      await handler.removeResourceReference(projectNodeId, resourceNodeId);
    },

    async getResourceReferences(projectNodeId: NodeId): Promise<NodeId[]> {
      const handler = new ProjectEntityHandler();
      return await handler.getResourceReferences(projectNodeId);
    },

    async configureLayer(projectNodeId: NodeId, resourceNodeId: NodeId, config: LayerConfiguration): Promise<void> {
      const handler = new ProjectEntityHandler();
      await handler.configureLayer(projectNodeId, resourceNodeId, config);
    },

    async getLayerConfiguration(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<LayerConfiguration | undefined> {
      const handler = new ProjectEntityHandler();
      return await handler.getLayerConfiguration(projectNodeId, resourceNodeId);
    },

    async removeLayerConfiguration(projectNodeId: NodeId, resourceNodeId: NodeId): Promise<void> {
      const handler = new ProjectEntityHandler();
      await handler.removeLayerConfiguration(projectNodeId, resourceNodeId);
    },

    async aggregateProject(projectNodeId: NodeId): Promise<AggregationResult> {
      const handler = new ProjectEntityHandler();
      return await handler.aggregateProject(projectNodeId);
    },

    async getAggregationStatus(projectNodeId: NodeId): Promise<AggregationStatus> {
      const handler = new ProjectEntityHandler();
      return await handler.getAggregationStatus(projectNodeId);
    },

    async getProjectStatistics(projectNodeId: NodeId): Promise<ProjectStatistics> {
      const handler = new ProjectEntityHandler();
      return await handler.getProjectStatistics(projectNodeId);
    }
  }
};