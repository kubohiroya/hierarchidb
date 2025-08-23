/**
 * Project Plugin Definition
 * Simple plugin using only PeerEntity (ProjectEntity) with TreeNode.references for cross-tree references
 */

import type { NodeDefinition, IconDefinition, EntityHandler } from '@hierarchidb/00-core';
import type { ProjectEntity } from '../types/ProjectEntity';
import { ProjectEntityHandler } from '../handlers/ProjectEntityHandler';
import type { NodeId } from '@hierarchidb/00-core';

/**
 * Project node type definition
 * Uses TreeNode.references for resource references instead of complex entity relationships
 */
export const ProjectDefinition: NodeDefinition<ProjectEntity> = {
  // Basic information
  nodeType: 'project',
  name: 'Project',
  displayName: 'Map Project',
  icon: { name: 'map', emoji: '🗺️' } as IconDefinition,

  // Category configuration
  category: {
    treeId: '*',
    menuGroup: 'basic',
    createOrder: 2,
  },

  // Database configuration - simple single-table setup
  database: {
    dbName: 'ProjectDB',
    tableName: 'entities',
    schema: '&id, nodeId, name, description, createdAt, updatedAt, version',
    version: 1,
  },

  // Entity handler - ProjectEntityHandler instance
  entityHandler: new ProjectEntityHandler() as unknown as EntityHandler<ProjectEntity>,

  // Lifecycle hooks
  lifecycle: {
    afterCreate: (nodeId: NodeId, entity: ProjectEntity) => {
      console.log(`Project created: ${entity.name} (${nodeId})`);
      return Promise.resolve();
    },

    beforeDelete: (nodeId: NodeId) => {
      console.log(`Cleaning up project: ${nodeId}`);
      // Clean up any project-specific resources
      return Promise.resolve();
    },
  },

  // Validation
  validation: {
    namePattern: /^[a-zA-Z0-9\s\-_]+$/,
    maxChildren: 0, // Projects don't have children
    customValidators: [
      {
        name: 'validateProjectName',
        validate: (entity: ProjectEntity) => {
          if (!entity.name || entity.name.trim().length === 0) {
            return { valid: false, message: 'Project name is required' };
          }
          if (entity.name.length > 255) {
            return { valid: false, message: 'Project name must be less than 255 characters' };
          }
          return { valid: true };
        },
      },
    ],
  },
};