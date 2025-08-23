/**
 * Project database schema and configuration
 */

export const ProjectDatabaseSchema = {
  version: 1,
  stores: {
    projects: '&id, nodeId, name, description, createdAt, updatedAt, version',
  }
};

export const ProjectDatabaseConfig = {
  tableName: 'projects',
  primaryKey: 'id',
  nodeIdIndex: 'nodeId'
};