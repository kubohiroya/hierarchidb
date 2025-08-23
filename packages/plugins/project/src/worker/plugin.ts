/**
 * Project Worker Plugin Definition
 * 新しい3層アーキテクチャ用のWorkerプラグイン定義
 */

import { ProjectMetadata } from '../shared';
import { projectPluginAPI } from './api';
import { ProjectEntityHandler } from './handlers';

/**
 * Worker Plugin Definition for Project
 * 従来のNodeDefinitionに代わる新しい形式
 */
export const ProjectWorkerPlugin = {
  metadata: ProjectMetadata,
  api: projectPluginAPI,
  entityHandler: new ProjectEntityHandler(),
  
  // Database configuration
  database: {
    tableName: 'projects',
    schema: '&id, nodeId, name, description, createdAt, updatedAt, version',
    version: 1
  },

  // Worker-specific lifecycle hooks
  lifecycle: {
    onInitialize: () => {
      console.log('Project plugin initialized in Worker');
      return Promise.resolve();
    },
    
    onShutdown: () => {
      console.log('Project plugin shutting down in Worker');
      return Promise.resolve();
    }
  }
};