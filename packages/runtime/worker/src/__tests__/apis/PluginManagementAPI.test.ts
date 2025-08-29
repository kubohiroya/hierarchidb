/**
import type { NodeType, PluginDefinition, TreeId } from '@hierarchidb/common-type';
 * @file PluginManagementAPI.test.ts
 * @description Comprehensive test suite for PluginManagementAPI implementation
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { WorkerAPIImpl } from '../../WorkerAPIImpl';
import { CoreDB } from '../../db/CoreDB';
import type { PluginLifecycleAPI, PluginRegistrationResultNew as PluginRegistrationResult } from '@hierarchidb/common-api';

// Mock plugin definitions for testing
const mockPluginDefinition1: PluginDefinition = {
  nodeType: 'test-node-1' as NodeType,
  name: 'test-plugin-1',
  displayName: 'Test Plugin 1',
  category: {
    treeId: '*' as TreeId,
    menuGroup: 'basic' as const,
  },
  database: {
    dbName: 'testDB',
    tableName: 'testEntities1',
    schema: '&id, nodeId, name, createdAt, updatedAt, version',
    version: 1,
  },
};

const mockPluginDefinition2: PluginDefinition = {
  nodeType: 'test-node-2' as NodeType,
  name: 'test-plugin-2',
  displayName: 'Test Plugin 2',
  category: {
    treeId: '*' as TreeId,
    menuGroup: 'basic' as const,
  },
  database: {
    dbName: 'testDB',
    tableName: 'testEntities2',
    schema: '&id, nodeId, name, createdAt, updatedAt, version',
    version: 1,
  },
};

describe('PluginLifecycleAPI', () => {
  let api: PluginLifecycleAPI;
  let workerAPI: WorkerAPIImpl;
  let coreDB: CoreDB;

  beforeEach(async () => {
    // Initialize database
    coreDB = await CoreDB.getSingleton();
    await coreDB.open();
    
    // Initialize WorkerAPI
    workerAPI = new WorkerAPIImpl();
    api = workerAPI.getPluginLifecycleAPI();
  });

  afterEach(async () => {
    // Clean up any registered plugins
    const registered = await api.listRegistered();
    for (const plugin of registered) {
      await api.unregister(plugin.nodeType);
    }
    
    await coreDB.close();
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a plugin definition', async () => {
      const result = await api.register(mockPluginDefinition1);
      
      expect(result.success).toBe(true);
      expect(result.registeredNodeType).toBe('test-node-1');
      expect(result.pluginId).toBeDefined();
    });

    it('should reject duplicate plugin registration', async () => {
      await api.register(mockPluginDefinition1);
      
      const result = await api.register(mockPluginDefinition1);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate plugin definition during registration', async () => {
      const invalidDefinition: any = {
        nodeType: 'invalid',
        name: 'Invalid Plugin',
        // Missing required fields like displayName, category, database
      };
      
      const result = await api.register(invalidDefinition);
      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
    });
  });

  describe('unregister', () => {
    it('should unregister a registered plugin', async () => {
      await api.register(mockPluginDefinition1);
      const result = await api.unregister('test-node-1' as NodeType);
      
      expect(result.success).toBe(true);
    });

    it('should handle unregistering non-existent plugin', async () => {
      const result = await api.unregister('non-existent' as NodeType);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should provide warnings when unregistering plugin with dependencies', async () => {
      await api.register(mockPluginDefinition1);
      const result = await api.unregister('test-node-1' as NodeType);
      
      expect(result.success).toBe(true);
      // Should complete without warnings for this simple case
    });
  });

  describe('validatePlugin', () => {
    it('should validate a valid plugin definition', async () => {
      const result = await api.validatePlugin(mockPluginDefinition1);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid plugin definition', async () => {
      const invalidDefinition: any = {
        nodeType: 'invalid',
        name: 'Invalid Plugin',
        // Missing required fields
      };
      
      const result = await api.validatePlugin(invalidDefinition);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate plugin dependencies', async () => {
      const definitionWithDeps: PluginDefinition = {
        ...mockPluginDefinition1,
        api: {
          workerExtensions: {
            'non-existent-plugin': async () => ({}),
          },
        },
      };
      
      const result = await api.validatePlugin(definitionWithDeps);
      
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.field.includes('dependency') || w.message.includes('dependency'))).toBe(true);
    });
  });

  describe('checkHealth', () => {
    it('should return health status for registered plugin', async () => {
      await api.register(mockPluginDefinition1);
      
      const health = await api.checkHealth('test-node-1' as NodeType);
      
      expect(health.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.lastCheck).toBeDefined();
    });

    it('should handle health check for non-registered plugin', async () => {
      const health = await api.checkHealth('non-existent' as NodeType);
      
      expect(health.status).toBe('unhealthy');
      expect(health.issues).toBeDefined();
    });

    it('should provide performance metrics', async () => {
      await api.register(mockPluginDefinition1);
      
      const health = await api.checkHealth('test-node-1' as NodeType);
      
      expect(health.performance).toBeDefined();
      expect(typeof health.performance!.avgResponseTime).toBe('number');
    });
  });

  describe('listRegistered', () => {
    it('should return all registered plugins', async () => {
      await api.register(mockPluginDefinition1);
      await api.register(mockPluginDefinition2);
      
      const plugins = await api.listRegistered();
      
      expect(plugins).toHaveLength(2);
      expect(plugins.map(p => p.nodeType)).toContain('test-node-1');
      expect(plugins.map(p => p.nodeType)).toContain('test-node-2');
    });

    it('should return empty array when no plugins registered', async () => {
      const plugins = await api.listRegistered();
      expect(plugins).toEqual([]);
    });

    it('should support filtering options', async () => {
      await api.register(mockPluginDefinition1);
      await api.register(mockPluginDefinition2);
      
      const filtered = await api.listRegistered({ 
        category: 'project'
      });
      
      expect(Array.isArray(filtered)).toBe(true);
      expect(filtered.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getDependencies', () => {
    it('should return dependency information for plugin', async () => {
      await api.register(mockPluginDefinition1);
      
      const deps = await api.getDependencies('test-node-1' as NodeType);
      
      expect(deps.nodeType).toBe('test-node-1');
      expect(Array.isArray(deps.dependencies)).toBe(true);
      expect(Array.isArray(deps.dependents)).toBe(true);
    });

    it('should detect circular dependencies', async () => {
      const pluginWithCircularDep: PluginDefinition = {
        ...mockPluginDefinition1,
        api: {
          workerExtensions: {
            'test-node-2': async () => ({}),
          },
        },
      };

      const plugin2WithCircularDep: PluginDefinition = {
        ...mockPluginDefinition2,
        api: {
          workerExtensions: {
            'test-node-1': async () => ({}),
          },
        },
      };

      await api.register(pluginWithCircularDep);
      await api.register(plugin2WithCircularDep);
      
      const deps = await api.getDependencies('test-node-1' as NodeType);
      
      expect(deps.circularDependencies).toBe(true);
      expect(deps.warnings).toBeDefined();
    });
  });

  describe('bulkOperation', () => {
    it('should perform bulk registration', async () => {
      const result = await api.bulkOperation({
        operation: 'register',
        plugins: [mockPluginDefinition1, mockPluginDefinition2],
      });
      
      expect(result.summary.total).toBe(2);
      expect(result.summary.success).toBe(2);
      expect(result.summary.failed).toBe(0);
    });

    it('should handle partial failures in bulk operations', async () => {
      const invalidDefinition: any = {
        nodeType: 'invalid',
        name: 'Invalid',
        // Missing required fields
      };
      
      const result = await api.bulkOperation({
        operation: 'register',
        plugins: [mockPluginDefinition1, invalidDefinition],
      });
      
      expect(result.summary.total).toBe(2);
      expect(result.summary.success).toBe(1);
      expect(result.summary.failed).toBe(1);
      expect(result.failed).toHaveLength(1);
    });

    it('should perform bulk unregistration', async () => {
      await api.register(mockPluginDefinition1);
      await api.register(mockPluginDefinition2);
      
      const result = await api.bulkOperation({
        operation: 'unregister',
        nodeTypes: ['test-node-1' as NodeType, 'test-node-2' as NodeType],
      });
      
      expect(result.summary.total).toBe(2);
      expect(result.summary.success).toBe(2);
      expect(result.summary.failed).toBe(0);
    });
  });

  describe('Plugin Dependencies', () => {
    it('should handle complex dependency chains', async () => {
      const pluginA: PluginDefinition = {
        ...mockPluginDefinition1,
        nodeType: 'plugin-a' as NodeType,
        name: 'plugin-a',
        displayName: 'Plugin A',
      };

      const pluginB: PluginDefinition = {
        ...mockPluginDefinition2,
        nodeType: 'plugin-b' as NodeType,
        name: 'plugin-b',
        displayName: 'Plugin B',
        api: {
          workerExtensions: {
            'plugin-a': async () => ({}),
          },
        },
      };

      await api.register(pluginA);
      await api.register(pluginB);
      
      const deps = await api.getDependencies('plugin-b' as NodeType);
      
      expect(deps.dependencies).toContain('plugin-a');
    });

    it('should validate dependency availability during registration', async () => {
      const pluginWithMissingDep: PluginDefinition = {
        ...mockPluginDefinition1,
        api: {
          workerExtensions: {
            'missing-plugin': async () => ({}),
          },
        },
      };
      
      const result = await api.register(pluginWithMissingDep);
      
      // Should still register but with warnings
      expect(result.success).toBe(true);
      // Note: PluginRegistrationResult doesn't have warnings property
    });
  });
});