/**
 * @file UnifiedNodeTypeRegistry.test.ts
 * @description Unit tests for UnifiedNodeTypeRegistry
 */

import type { TreeNodeId, TreeNodeType } from '@hierarchidb/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BaseEntity,
  BaseSubEntity,
  BaseWorkingCopy,
  EntityHandler,
  UnifiedPluginDefinition,
} from '../types/unified-plugin';
import { UnifiedNodeTypeRegistry } from '../UnifiedNodeTypeRegistry';

// Mock entity types
interface TestEntity extends BaseEntity {
  name: string;
  description?: string;
}

interface TestWorkingCopy extends BaseWorkingCopy {
  name: string;
  description?: string;
}

// Mock entity handler
class MockEntityHandler implements EntityHandler<TestEntity, BaseSubEntity, TestWorkingCopy> {
  async createEntity(nodeId: TreeNodeId, data?: Partial<TestEntity>): Promise<TestEntity> {
    return {
      nodeId,
      name: data?.name || 'Test Entity',
      description: data?.description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
  }

  async getEntity(nodeId: TreeNodeId): Promise<TestEntity | undefined> {
    return undefined;
  }

  async updateEntity(nodeId: TreeNodeId, data: Partial<TestEntity>): Promise<void> {
    // Mock implementation
  }

  async deleteEntity(nodeId: TreeNodeId): Promise<void> {
    // Mock implementation
  }

  async createWorkingCopy(nodeId: TreeNodeId): Promise<TestWorkingCopy> {
    return {
      nodeId,
      name: 'Working Copy',
      workingCopyId: 'test-working-copy-id',
      workingCopyOf: nodeId,
      copiedAt: Date.now(),
      isDirty: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
  }

  async commitWorkingCopy(nodeId: TreeNodeId, workingCopy: TestWorkingCopy): Promise<void> {
    // Mock implementation
  }

  async discardWorkingCopy(nodeId: TreeNodeId): Promise<void> {
    // Mock implementation
  }
}

// Create test plugin definition
function createTestPlugin(
  nodeType: TreeNodeType,
  dependencies?: string[]
): UnifiedPluginDefinition<TestEntity, BaseSubEntity, TestWorkingCopy> {
  return {
    nodeType,
    name: `Test Plugin ${nodeType}`,
    displayName: `Test ${nodeType}`,
    database: {
      dbName: 'testDb',
      tableName: 'testTable',
      schema: 'nodeId, name, description',
      version: 1,
    },
    entityHandler: new MockEntityHandler(),
    routing: {
      actions: {
        view: {
          component: vi.fn() as any,
        },
        edit: {
          component: vi.fn() as any,
        },
      },
      defaultAction: 'view',
    },
    meta: {
      version: '1.0.0',
      description: 'Test plugin',
      tags: ['test', 'mock'],
      dependencies,
    },
  };
}

describe('UnifiedNodeTypeRegistry', () => {
  let registry: UnifiedNodeTypeRegistry;

  beforeEach(() => {
    // Reset singleton before each test
    UnifiedNodeTypeRegistry.resetInstance();
    registry = UnifiedNodeTypeRegistry.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = UnifiedNodeTypeRegistry.getInstance();
      const instance2 = UnifiedNodeTypeRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = UnifiedNodeTypeRegistry.getInstance();
      UnifiedNodeTypeRegistry.resetInstance();
      const instance2 = UnifiedNodeTypeRegistry.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Plugin Registration', () => {
    it('should register a plugin successfully', () => {
      const plugin = createTestPlugin('testNode' as TreeNodeType);

      registry.registerPlugin(plugin);

      const retrieved = registry.getPluginDefinition('testNode' as TreeNodeType);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test Plugin testNode');
    });

    it('should skip duplicate registration with warning', () => {
      const plugin = createTestPlugin('testNode' as TreeNodeType);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      registry.registerPlugin(plugin);
      registry.registerPlugin(plugin); // Duplicate

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should throw error for missing dependencies', () => {
      const plugin = createTestPlugin('testNode' as TreeNodeType, ['missingDep']);

      expect(() => {
        registry.registerPlugin(plugin);
      }).toThrow('Missing dependency: missingDep');
    });

    it('should register plugin with satisfied dependencies', () => {
      const dependency = createTestPlugin('dependency' as TreeNodeType);
      const plugin = createTestPlugin('testNode' as TreeNodeType, ['dependency']);

      registry.registerPlugin(dependency);
      registry.registerPlugin(plugin);

      expect(registry.getPluginDefinition('testNode' as TreeNodeType)).toBeDefined();
    });
  });

  describe('Plugin Retrieval', () => {
    beforeEach(() => {
      const plugin = createTestPlugin('testNode' as TreeNodeType);
      registry.registerPlugin(plugin);
    });

    it('should get plugin definition', () => {
      const definition = registry.getPluginDefinition('testNode' as TreeNodeType);
      expect(definition).toBeDefined();
      expect(definition?.nodeType).toBe('testNode');
    });

    it('should get entity handler', () => {
      const handler = registry.getEntityHandler('testNode' as TreeNodeType);
      expect(handler).toBeDefined();
      expect(handler).toBeInstanceOf(MockEntityHandler);
    });

    it('should get router action', () => {
      const action = registry.getRouterAction('testNode' as TreeNodeType, 'view');
      expect(action).toBeDefined();
      expect(action?.component).toBeDefined();
    });

    it('should get available actions', () => {
      const actions = registry.getAvailableActions('testNode' as TreeNodeType);
      expect(actions).toContain('view');
      expect(actions).toContain('edit');
    });

    it('should throw error for null nodeType', () => {
      expect(() => {
        registry.getPluginDefinition(null as any);
      }).toThrow('nodeType cannot be null or undefined');
    });
  });

  describe('Plugin Search', () => {
    beforeEach(() => {
      const plugin1 = createTestPlugin('node1' as TreeNodeType);
      const plugin2 = createTestPlugin('node2' as TreeNodeType);
      plugin2.meta.tags = ['special', 'test'];

      registry.registerPlugin(plugin1);
      registry.registerPlugin(plugin2);
    });

    it('should find plugins by tag', () => {
      const found = registry.findPluginsByTag('special');
      expect(found).toHaveLength(1);
      expect(found[0].nodeType).toBe('node2');
    });

    it('should return empty array for non-existent tag', () => {
      const found = registry.findPluginsByTag('nonexistent');
      expect(found).toHaveLength(0);
    });

    it('should get all plugins', () => {
      const all = registry.getAllPlugins();
      expect(all).toHaveLength(2);
    });
  });

  describe('Dependency Management', () => {
    it('should get plugin dependencies', () => {
      // First register the dependencies
      const dep1 = createTestPlugin('dep1' as TreeNodeType);
      const dep2 = createTestPlugin('dep2' as TreeNodeType);
      registry.registerPlugin(dep1);
      registry.registerPlugin(dep2);

      // Then register the plugin with dependencies
      const plugin = createTestPlugin('testNode' as TreeNodeType, ['dep1', 'dep2']);
      registry.registerPlugin(plugin);

      const deps = registry.getPluginDependencies('testNode' as TreeNodeType);
      expect(deps).toEqual(['dep1', 'dep2']);
    });

    it('should validate dependencies correctly', () => {
      const dep1 = createTestPlugin('dep1' as TreeNodeType);
      const dep2 = createTestPlugin('dep2' as TreeNodeType);
      const plugin = createTestPlugin('testNode' as TreeNodeType, ['dep1', 'dep2']);

      registry.registerPlugin(dep1);
      registry.registerPlugin(dep2);
      registry.registerPlugin(plugin);

      expect(registry.validatePluginDependencies('testNode' as TreeNodeType)).toBe(true);
    });

    it('should sort plugins by dependencies', () => {
      const plugin1 = createTestPlugin('plugin1' as TreeNodeType, ['plugin2']);
      const plugin2 = createTestPlugin('plugin2' as TreeNodeType, ['plugin3']);
      const plugin3 = createTestPlugin('plugin3' as TreeNodeType);

      registry.registerPluginBatch([plugin1, plugin2, plugin3]);

      const sorted = registry.getPluginsInDependencyOrder();
      expect(sorted[0]?.nodeType).toBe('plugin3');
      expect(sorted[1]?.nodeType).toBe('plugin2');
      expect(sorted[2]?.nodeType).toBe('plugin1');
    });
  });

  describe('Backward Compatibility', () => {
    it('should register as NodeTypeConfig', () => {
      const plugin = createTestPlugin('testNode' as TreeNodeType);
      registry.registerPlugin(plugin);

      const config = registry.getNodeTypeConfig('testNode' as TreeNodeType);
      expect(config).toBeDefined();
      expect(config?.displayName).toBe('Test testNode');
    });

    it('should support getAllNodeTypes', () => {
      const plugin = createTestPlugin('testNode' as TreeNodeType);
      registry.registerPlugin(plugin);

      const types = registry.getAllNodeTypes();
      expect(types).toContain('testNode');
    });
  });

  describe('Clear and Reset', () => {
    it('should clear all registrations', () => {
      const plugin = createTestPlugin('testNode' as TreeNodeType);
      registry.registerPlugin(plugin);

      registry.clear();

      expect(registry.getPluginDefinition('testNode' as TreeNodeType)).toBeUndefined();
      expect(registry.getAllPlugins()).toHaveLength(0);
    });
  });
});
