import type {
  PluginDefinition,
  TreeNode,
  NodeId,
  NodeType,
  TreeId,
} from '@hierarchidb/common-type';
import { ProjectEntityHandler } from './handlers/ProjectEntityHandler';
import { projectDB } from './database/project-database';
import type { ProjectEntity } from './types/project-types';

// Main plugin definition
export const ProjectPluginDefinition: PluginDefinition = {
  nodeType: 'project-plugin' as NodeType,
  name: 'project-plugin',
  displayName: 'Project',
  category: {
    treeId: '*' as TreeId | '*',
    menuGroup: 'document',
  },

  database: {
    dbName: 'projectDB',
    schema: {
      projects: '&id, nodeId, type, name, category, [category+name], createdAt, updatedAt',
    },
    version: 1,
  },

  entityHandler: new ProjectEntityHandler(),

  icon: {
    emoji: '🗺️',
  },

  ui: {
    dialogComponentPath: './components/wizard/ProjectWizard',
    panelComponentPath: './components/map/ProjectMapView',
  },

  lifecycle: {
    afterCreate: async (_nodeId: NodeId, entity: ProjectEntity) => {
      console.log('Project created:', entity.name);

      // Initialize project resources
      if (entity.outputConfig.tiles.enabled) {
        console.log('Initializing tile generation...');
      }
    },

    afterUpdate: async (_nodeId: NodeId, entity: ProjectEntity) => {
      console.log('Project updated:', entity.name);

      // Log update
      console.log('Layers:', entity.layers.length);
      console.log('Analyses:', entity.spatialAnalyses.length);
    },

    beforeDelete: async (_nodeId: NodeId) => {
      console.log('Deleting project with node:', _nodeId);

      // Clean up will be handled by entity handler
    },

    afterMove: async (_nodeId: NodeId, newParentId: NodeId) => {
      console.log('Project moved to:', newParentId);
    },
  },

  validation: {
    canUpdate: async (
      _node: TreeNode,
      entity: ProjectEntity,
      updates: Partial<ProjectEntity>,
      _context: any
    ) => {
      const handler = new ProjectEntityHandler();
      return await handler.validate({ ...entity, ...updates });
    },

    canDelete: async (_node: TreeNode, entity: ProjectEntity, _context: any) => {
      // Check if user has permission to delete
      if (entity.visibility === 'public' && !_context?.isAdmin) {
        return {
          valid: false,
          reason: 'Only administrators can delete public projects',
        };
      }
      return { valid: true };
    },

    canMove: async (
      _node: TreeNode,
      _entity: ProjectEntity,
      _newParentNode: TreeNode,
      _context: any
    ) => {
      // Projects can be moved anywhere
      return { valid: true };
    },
  },

  search: {
    searchableFields: ['name', 'description', 'tags', 'category'],

    indexEntity: (entity: ProjectEntity) => {
      return {
        id: entity.id,
        nodeId: entity.nodeId,
        name: entity.name,
        description: entity.description,
        category: entity.category,
        tags: entity.tags.join(' '),
        layerCount: entity.layers.length,
        visibility: entity.visibility,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      };
    },

    searchEntities: async (query: string, _options: any) => {
      const results = await projectDB.projects
        .filter((project: any) => {
          const searchText =
            `${project.name} ${project.description} ${project.tags.join(' ')}`.toLowerCase();
          return searchText.includes(query.toLowerCase());
        })
        .toArray();

      return results.map((r: any) => ({
        entity: r,
        score: 1.0, // Simple scoring
      }));
    },
  },

  commands: {
    'project.runAnalysis': {
      execute: async (params: { projectId: string; analysisId: string }) => {
        const project = await projectDB.projects.get(params.projectId as any);
        if (!project) throw new Error('Project not found');

        const analysis = project.spatialAnalyses.find((a: any) => a.id === params.analysisId);
        if (!analysis) throw new Error('Analysis not found');

        console.log('Executing analysis:', analysis.name);
        // Execute analysis using SpatialAnalysisEngine

        return { success: true };
      },
      canExecute: async (_params: any) => {
        return { valid: true };
      },
    },

    'project.generateTiles': {
      execute: async (params: { projectId: string }) => {
        const project = await projectDB.projects.get(params.projectId as any);
        if (!project) throw new Error('Project not found');

        if (!project.outputConfig.tiles.enabled) {
          throw new Error('Tile generation is not enabled for this project');
        }

        console.log('Generating tiles for project:', project.name);
        // Generate tiles based on configuration

        return { success: true };
      },
      canExecute: async (_params: any) => {
        return { valid: true };
      },
    },
  },
};
