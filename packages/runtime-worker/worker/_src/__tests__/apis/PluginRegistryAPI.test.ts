/**
import type { NodeType, PluginDefinition, TreeId, NodeId } from '@hierarchidb/common-type';
 * @file PluginRegistryAPI.test.ts
 * @description Comprehensive test suite for PluginRegistryAPI implementation
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { WorkerAPIImpl } from '../../WorkerAPIImpl';
import { CoreDB } from '../../db/CoreDB';
import type { NodeTypeRegistryAPI } from '@hierarchidb/common-api';

// Mock plugin definition for testing
const mockPluginDefinition: PluginDefinition = {
  nodeType: 'test-registry-node' as NodeType,
  name: 'test-registry-plugin',
  displayName: 'Test Registry Plugin',
  category: {
    treeId: '*' as TreeId,
    menuGroup: 'basic' as const,
  },
  database: {
    dbName: 'testDB',
    tableName: 'testRegistryEntities',
    schema: '&id, nodeId, name, createdAt, updatedAt, version',
    version: 1,
  },
};

describe('NodeTypeRegistryAPI', () => {
  let api: NodeTypeRegistryAPI;
  let workerAPI: WorkerAPIImpl;
  let coreDB: CoreDB;

  beforeEach(async () => {
    // Initialize database
    coreDB = await CoreDB.getSingleton();
    await coreDB.open();
    
    // Initialize WorkerAPI
    workerAPI = new WorkerAPIImpl();
    api = workerAPI.getNodeTypeRegistryAPI();
  });

  afterEach(async () => {
    // Clean up any registered plugins
    const registered = await api.listRegisteredPlugins();
    for (const plugin of registered) {
      await api.unregisterPlugin(plugin.nodeType as NodeType);
    }
    
    await coreDB.close();
    vi.clearAllMocks();
  });

  describe('Node Type Operations', () => {
    beforeEach(async () => {
      await api.registerPlugin(mockPluginDefinition);
    });

    it('should list supported node types', async () => {
      const supportedTypes = await api.listSupportedNodeTypes();
      
      expect(Array.isArray(supportedTypes)).toBe(true);
      expect(supportedTypes).toContain('test-registry-node');
    });

    it('should check if node type is supported', async () => {
      const isSupported = await api.isSupportedNodeType('test-registry-node' as NodeType);
      const isNotSupported = await api.isSupportedNodeType('non-existent' as NodeType);
      
      expect(isSupported).toBe(true);
      expect(isNotSupported).toBe(false);
    });

    it('should get node definition', async () => {
      const definition = await api.getNodeDefinition('test-registry-node' as NodeType);
      
      expect(definition).toBeDefined();
      expect(definition?.nodeType).toBe('test-registry-node');
      expect(definition?.name).toBe('test-registry-plugin');
    });

    it('should return undefined for non-existent node definition', async () => {
      const definition = await api.getNodeDefinition('non-existent' as NodeType);
      
      expect(definition).toBeUndefined();
    });

    it('should validate node type operations', async () => {
      const result = await api.validateNodeTypeOperation(
        'test-registry-node' as NodeType,
        'create'
      );
      
      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });
  });

  describe('Plugin Management', () => {
    beforeEach(async () => {
      await api.registerPlugin(mockPluginDefinition);
    });

    it('should list registered plugins', async () => {
      const plugins = await api.listRegisteredPlugins();
      
      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBeGreaterThan(0);
      expect(plugins.some(p => p.nodeType === 'test-registry-node')).toBe(true);
    });

    it('should get plugins for tree', async () => {
      const plugins = await api.getPluginsForTree('test-tree');
      
      expect(Array.isArray(plugins)).toBe(true);
    });

    it('should get plugin metadata', async () => {
      const metadata = await api.getPluginMetadata('test-registry-plugin');
      
      expect(metadata).toBeDefined();
      expect(metadata?.nodeType).toBe('test-registry-node');
    });

    it('should return undefined for non-existent plugin metadata', async () => {
      const metadata = await api.getPluginMetadata('non-existent');
      
      expect(metadata).toBeUndefined();
    });

    it('should get plugin capabilities', async () => {
      const capabilities = await api.getPluginCapabilities('test-registry-plugin');
      
      expect(capabilities).toBeDefined();
    });

    it('should check if plugin is active', async () => {
      const isActive = await api.isPluginActive('test-registry-plugin');
      
      expect(typeof isActive).toBe('boolean');
    });
  });

  describe('Plugin Registry Operations', () => {
    it('should register plugin successfully', async () => {
      const result = await api.registerPlugin(mockPluginDefinition);
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle duplicate plugin registration', async () => {
      await api.registerPlugin(mockPluginDefinition);
      const result = await api.registerPlugin(mockPluginDefinition);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should unregister plugin successfully', async () => {
      await api.registerPlugin(mockPluginDefinition);
      const result = await api.unregisterPlugin('test-registry-node' as NodeType);
      
      expect(result.success).toBe(true);
      expect(typeof result.cleanedUpNodes).toBe('number');
    });

    it('should handle unregistering non-existent plugin', async () => {
      const result = await api.unregisterPlugin('non-existent' as NodeType);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reload plugin successfully', async () => {
      await api.registerPlugin(mockPluginDefinition);
      
      const updatedDefinition: PluginDefinition = {
        ...mockPluginDefinition,
        displayName: 'Updated Test Plugin',
      };
      
      const result = await api.reloadPlugin(
        'test-registry-node' as NodeType,
        updatedDefinition
      );
      
      expect(result.success).toBe(true);
      expect(typeof result.affectedNodes).toBe('number');
    });
  });

  describe('Plugin Validation', () => {
    it('should validate valid plugin definition', async () => {
      const result = await api.validatePluginDefinition(mockPluginDefinition);
      
      expect(result.valid).toBe(true);
      if (!result.valid) {
        expect(result.message).toBeUndefined();
      }
    });

    it('should detect invalid plugin definition', async () => {
      const invalidDefinition: any = {
        nodeType: 'invalid',
        // Missing required fields
      };
      
      const result = await api.validatePluginDefinition(invalidDefinition);
      
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.message).toBeDefined();
      }
    });

    it('should check plugin compatibility', async () => {
      await api.registerPlugin(mockPluginDefinition);
      
      const result = await api.checkPluginCompatibility('test-registry-node' as NodeType);
      
      expect(result).toBeDefined();
      expect(typeof result.compatible).toBe('boolean');
      expect(typeof result.version).toBe('string');
      expect(typeof result.requiredVersion).toBe('string');
    });

    it('should get plugin system health', async () => {
      const health = await api.getPluginSystemHealth();
      
      expect(health).toBeDefined();
      expect(typeof health.totalPlugins).toBe('number');
      expect(typeof health.activePlugins).toBe('number');
      expect(typeof health.failedPlugins).toBe('number');
      expect(Array.isArray(health.systemErrors)).toBe(true);
      expect(health.performance).toBeDefined();
      expect(typeof health.performance.averageLoadTime).toBe('number');
      expect(typeof health.performance.totalMemoryUsage).toBe('number');
    });
  });

  describe('Node Type Capabilities', () => {
    beforeEach(async () => {
      await api.registerPlugin(mockPluginDefinition);
    });

    it('should get supported operations for node type', async () => {
      const operations = await api.getSupportedOperations('test-registry-node' as NodeType);
      
      expect(Array.isArray(operations)).toBe(true);
      expect(operations.length).toBeGreaterThan(0);
      expect(operations.every(op => 
        ['create', 'read', 'update', 'delete', 'move', 'copy'].includes(op)
      )).toBe(true);
    });

    it('should check if node type supports children', async () => {
      const supportsChildren = await api.supportsChildren('test-registry-node' as NodeType);
      
      expect(typeof supportsChildren).toBe('boolean');
    });

    it('should get allowed child types', async () => {
      const allowedTypes = await api.getAllowedChildTypes('test-registry-node' as NodeType);
      
      expect(Array.isArray(allowedTypes)).toBe(true);
    });
  });

  describe('Plugin API Extensions', () => {
    beforeEach(async () => {
      await api.registerPlugin(mockPluginDefinition);
    });

    it('should get plugin extension', async () => {
      const extension = await api.getExtension('test-registry-node' as NodeType);
      
      expect(extension).toBeDefined();
    });

    it('should register plugin extension', async () => {
      const mockAPI = {
        testMethod: async () => 'test result',
      };
      
      await api.registerExtension('test-extension' as NodeType, mockAPI);
      
      // Should complete without throwing
      expect(true).toBe(true);
    });

    it('should return undefined for non-existent extension', async () => {
      const extension = await api.getExtension('non-existent' as NodeType);
      
      expect(extension).toBeUndefined();
    });
  });

  describe('Backward Compatibility', () => {
    beforeEach(async () => {
      await api.registerPlugin(mockPluginDefinition);
    });

    it('should handle deprecated listSupportedNodeTypes', async () => {
      const supportedTypes = await api.listSupportedNodeTypes();
      
      expect(Array.isArray(supportedTypes)).toBe(true);
      // Should show deprecation warning in logs but still work
    });

    it('should handle deprecated isSupportedNodeType', async () => {
      const isSupported = await api.isSupportedNodeType('test-registry-node' as NodeType);
      
      expect(typeof isSupported).toBe('boolean');
      // Should show deprecation warning in logs but still work
    });

    it('should handle deprecated getPluginsForTree', async () => {
      const plugins = await api.getPluginsForTree('test-tree');
      
      expect(Array.isArray(plugins)).toBe(true);
      // Should show deprecation warning in logs but still work
    });
  });
});