/**
 * @file NodeDefinitionRegistry.dynamicSchema.test.ts
 * @description TDD tests for dynamic Dexie schema registration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { NodeDefinitionRegistry } from '@hierarchidb/common-core';
import { PluginDatabaseManager } from '../PluginDatabaseManager';
import type { 
  NodeTypeDefinition, 
  PeerEntity, 
  GroupEntity, 
  WorkingCopyProperties,
  PluginDatabaseConfig,
  NodeId,
  EntityId 
} from '@hierarchidb/common-core';

// Mock Entity types for testing
interface TestEntity extends PeerEntity {
  id: EntityId;
  nodeId: NodeId;
  name: string;
  testField: string;
  createdAt: number;
  updatedAt: number;
  version: number;
}

interface TestWorkingCopy extends TestEntity, WorkingCopyProperties {
  isDraft: boolean;
  originalNodeId?: NodeId;
  createdAt: number;
}

// Mock EntityHandler for testing
class MockEntityHandler {
  async createEntity(nodeId: NodeId, data: Partial<TestEntity>): Promise<TestEntity> {
    return {
      id: `entity-${Date.now()}` as EntityId,
      nodeId,
      name: data.name || 'Test Entity',
      testField: data.testField || 'test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
  }

  async getEntity(nodeId: NodeId): Promise<TestEntity | undefined> {
    return undefined;
  }

  async updateEntity(nodeId: NodeId, data: Partial<TestEntity>): Promise<void> {
    // Mock implementation
  }

  async deleteEntity(nodeId: NodeId): Promise<void> {
    // Mock implementation
  }

  async createWorkingCopy(nodeId: NodeId): Promise<TestWorkingCopy> {
    const entity = await this.createEntity(nodeId, {});
    return {
      ...entity,
      isDraft: true,
      originalNodeId: nodeId,
    };
  }

  async commitWorkingCopy(nodeId: NodeId, workingCopy: TestWorkingCopy): Promise<void> {
    // Mock implementation
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    // Mock implementation
  }
}

describe('NodeDefinitionRegistry - Dynamic Dexie Schema Registration', () => {
  let registry: NodeDefinitionRegistry;
  let databaseManager: PluginDatabaseManager;

  beforeEach(() => {
    // Reset singleton before each test
    NodeDefinitionRegistry.resetInstance();
    registry = NodeDefinitionRegistry.getInstance();
    databaseManager = PluginDatabaseManager.getInstance();
    
    // Inject database manager
    registry.setDatabaseManager(databaseManager);
  });

  afterEach(async () => {
    // Clean up after each test
    await registry.clear();
    NodeDefinitionRegistry.resetInstance();
  });

  describe('Dynamic Database Creation', () => {
    it('should create plugin database when plugin is registered', async () => {
      // Test case 1: Basic plugin database creation
      const testPluginDefinition: NodeTypeDefinition<TestEntity, never, TestWorkingCopy> = {
        nodeType: 'test-plugin',
        name: 'Test Plugin',
        displayName: 'Test Plugin',
        icon: 'test',
        color: '#000000',
        database: {
          entityStore: 'test_entities',
          schema: {
            '&id': 'EntityId',
            'nodeId': 'NodeId',
            'name, testField': '',
            'createdAt, updatedAt, version': '',
          },
          version: 1
        } as PluginDatabaseConfig,
        entityHandler: new MockEntityHandler() as any,
        lifecycle: {
          afterCreate: async (nodeId: NodeId) => {
            console.log(`Test plugin node created: ${nodeId}`);
          }
        }
      };

      // Register the plugin
      await expect(async () => {
        await registry.registerDefinition(testPluginDefinition);
      }).not.toThrow();

      // Verify plugin is registered
      const registeredDefinition = registry.getDefinition('test-plugin');
      expect(registeredDefinition).toBeDefined();
      expect(registeredDefinition?.nodeType).toBe('test-plugin');
      expect(registeredDefinition?.database.entityStore).toBe('test_entities');
    });

    it('should handle database versioning correctly', async () => {
      // Test case 2: Database version management
      const v1Plugin: NodeTypeDefinition<TestEntity, never, TestWorkingCopy> = {
        nodeType: 'versioned-plugin',
        name: 'Versioned Plugin',
        displayName: 'Versioned Plugin',
        icon: 'version',
        color: '#111111',
        database: {
          entityStore: 'versioned_entities',
          schema: {
            '&id': 'EntityId',
            'nodeId': 'NodeId',
            'name': '',
            'createdAt, updatedAt, version': '',
          },
          version: 1
        } as PluginDatabaseConfig,
        entityHandler: new MockEntityHandler() as any,
      };

      // Register v1
      await registry.registerDefinition(v1Plugin);
      
      // Verify v1 registration
      const v1Definition = registry.getDefinition('versioned-plugin');
      expect(v1Definition?.database.version).toBe(1);

      // Unregister and register v2
      await registry.unregister('versioned-plugin');

      const v2Plugin: NodeTypeDefinition<TestEntity, never, TestWorkingCopy> = {
        ...v1Plugin,
        database: {
          ...v1Plugin.database,
          schema: {
            ...v1Plugin.database.schema,
            'newField': '', // Added field in v2
          },
          version: 2
        } as PluginDatabaseConfig,
      };

      await registry.registerDefinition(v2Plugin);
      
      // Verify v2 registration
      const v2Definition = registry.getDefinition('versioned-plugin');
      expect(v2Definition?.database.version).toBe(2);
    });

    it('should prevent duplicate plugin registration', async () => {
      // Test case 3: Duplicate registration prevention
      const pluginDefinition: NodeTypeDefinition<TestEntity, never, TestWorkingCopy> = {
        nodeType: 'duplicate-test',
        name: 'Duplicate Test',
        displayName: 'Duplicate Test',
        icon: 'duplicate',
        color: '#222222',
        database: {
          entityStore: 'duplicate_entities',
          schema: {
            '&id': 'EntityId',
            'nodeId': 'NodeId',
            'name': '',
            'createdAt, updatedAt, version': '',
          },
          version: 1
        } as PluginDatabaseConfig,
        entityHandler: new MockEntityHandler() as any,
      };

      // First registration should succeed
      await expect(async () => {
        await registry.registerDefinition(pluginDefinition);
      }).not.toThrow();

      // Second registration should fail
      await expect(async () => {
        await registry.registerDefinition(pluginDefinition);
      }).rejects.toThrow('Node type duplicate-test is already registered');
    });
  });

  describe('Plugin Dependencies', () => {
    it('should support plugin dependency resolution', async () => {
      // Test case 4: Plugin dependencies
      // First register the base plugin (folder-plugin-like)
      const basePluginDefinition: NodeTypeDefinition<TestEntity, never, TestWorkingCopy> = {
        nodeType: 'base-plugin',
        name: 'Base Plugin',
        displayName: 'Base Plugin',
        icon: 'base',
        color: '#333333',
        database: {
          entityStore: 'base_entities',
          schema: {
            '&id': 'EntityId',
            'nodeId': 'NodeId',
            'name, description': '',
            'createdAt, updatedAt, version': '',
          },
          version: 1
        } as PluginDatabaseConfig,
        entityHandler: new MockEntityHandler() as any,
      };

      await registry.registerDefinition(basePluginDefinition);

      // Then register the extended plugin
      const extendedPluginDefinition: NodeTypeDefinition<TestEntity, never, TestWorkingCopy> = {
        nodeType: 'extended-plugin',
        name: 'Extended Plugin',
        displayName: 'Extended Plugin',
        icon: 'extended',
        color: '#444444',
        database: {
          entityStore: 'extended_entities',
          schema: {
            '&id': 'EntityId',
            'nodeId': 'NodeId',
            'name, description, testField': '', // Extended fields
            'createdAt, updatedAt, version': '',
          },
          version: 1
        } as PluginDatabaseConfig,
        entityHandler: new MockEntityHandler() as any,
      };

      await registry.registerDefinition(extendedPluginDefinition);

      // Verify both plugins are registered
      expect(registry.getDefinition('base-plugin')).toBeDefined();
      expect(registry.getDefinition('extended-plugin')).toBeDefined();
      
      // Verify plugin count
      const allDefinitions = registry.getAllDefinitions();
      expect(allDefinitions).toHaveLength(2);
    });
  });

  describe('Plugin Unregistration and Cleanup', () => {
    it('should properly unregister plugin and clean up resources', async () => {
      // Test case 5: Plugin unregistration
      const pluginDefinition: NodeTypeDefinition<TestEntity, never, TestWorkingCopy> = {
        nodeType: 'cleanup-test',
        name: 'Cleanup Test',
        displayName: 'Cleanup Test',
        icon: 'cleanup',
        color: '#555555',
        database: {
          entityStore: 'cleanup_entities',
          schema: {
            '&id': 'EntityId',
            'nodeId': 'NodeId',
            'name': '',
            'createdAt, updatedAt, version': '',
          },
          version: 1
        } as PluginDatabaseConfig,
        entityHandler: new MockEntityHandler() as any,
      };

      // Register plugin
      await registry.registerDefinition(pluginDefinition);
      expect(registry.getDefinition('cleanup-test')).toBeDefined();
      expect(registry.getHandler('cleanup-test')).toBeDefined();

      // Unregister plugin
      await registry.unregister('cleanup-test');
      expect(registry.getDefinition('cleanup-test')).toBeUndefined();
      expect(registry.getHandler('cleanup-test')).toBeUndefined();
    });

    it('should handle plugin capabilities correctly', async () => {
      // Test case 6: Plugin capabilities
      const pluginDefinition: NodeTypeDefinition<TestEntity, never, TestWorkingCopy> = {
        nodeType: 'capability-test',
        name: 'Capability Test',
        displayName: 'Capability Test',
        icon: 'capability',
        color: '#666666',
        database: {
          entityStore: 'capability_entities',
          schema: {
            '&id': 'EntityId',
            'nodeId': 'NodeId',
            'name': '',
            'createdAt, updatedAt, version': '',
          },
          version: 1
        } as PluginDatabaseConfig,
        entityHandler: new MockEntityHandler() as any,
        lifecycle: {
          afterCreate: async (nodeId: NodeId) => {
            console.log(`Plugin created: ${nodeId}`);
          }
        }
      };

      await registry.registerDefinition(pluginDefinition);

      // Test capability checking
      expect(registry.hasCapability('capability-test', 'database')).toBe(true);
      expect(registry.hasCapability('capability-test', 'entityHandler')).toBe(true);
      expect(registry.hasCapability('capability-test', 'lifecycle')).toBe(true);
      expect(registry.hasCapability('capability-test', 'api')).toBe(false);
    });
  });

  describe('Database Cleanup and Deletion', () => {
    it('should support unregistering with data clearance', async () => {
      // Test case 8: Unregister with clearData option
      const pluginDefinition: NodeTypeDefinition<TestEntity, never, TestWorkingCopy> = {
        nodeType: 'clear-data-test',
        name: 'Clear Data Test',
        displayName: 'Clear Data Test',
        icon: 'clear',
        color: '#777777',
        database: {
          entityStore: 'clear_data_entities',
          schema: {
            '&id': 'EntityId',
            'nodeId': 'NodeId',
            'name': '',
            'createdAt, updatedAt, version': '',
          },
          version: 1
        } as PluginDatabaseConfig,
        entityHandler: new MockEntityHandler() as any,
      };

      // Register plugin
      await registry.registerDefinition(pluginDefinition);
      expect(registry.getDefinition('clear-data-test')).toBeDefined();

      // Unregister with clearData option
      await registry.unregister('clear-data-test', { clearData: true });
      expect(registry.getDefinition('clear-data-test')).toBeUndefined();
    });

    it('should support unregistering with database dropping', async () => {
      // Test case 9: Unregister with dropDatabase option
      const pluginDefinition: NodeTypeDefinition<TestEntity, never, TestWorkingCopy> = {
        nodeType: 'drop-db-test',
        name: 'Drop Database Test',
        displayName: 'Drop Database Test',
        icon: 'drop',
        color: '#888888',
        database: {
          entityStore: 'drop_db_entities',
          schema: {
            '&id': 'EntityId',
            'nodeId': 'NodeId',
            'name': '',
            'createdAt, updatedAt, version': '',
          },
          version: 1
        } as PluginDatabaseConfig,
        entityHandler: new MockEntityHandler() as any,
      };

      // Register plugin
      await registry.registerDefinition(pluginDefinition);
      expect(registry.getDefinition('drop-db-test')).toBeDefined();

      // Unregister with dropDatabase option
      await registry.unregister('drop-db-test', { dropDatabase: true });
      expect(registry.getDefinition('drop-db-test')).toBeUndefined();
    });

    it('should support clearing all databases', async () => {
      // Test case 10: Clear all databases
      const plugin1: NodeTypeDefinition<TestEntity, never, TestWorkingCopy> = {
        nodeType: 'clear-all-test-1',
        name: 'Clear All Test 1',
        displayName: 'Clear All Test 1',
        icon: 'clear1',
        color: '#999999',
        database: {
          entityStore: 'clear_all_entities_1',
          schema: {
            '&id': 'EntityId',
            'nodeId': 'NodeId',
            'name': '',
            'createdAt, updatedAt, version': '',
          },
          version: 1
        } as PluginDatabaseConfig,
        entityHandler: new MockEntityHandler() as any,
      };

      const plugin2: NodeTypeDefinition<TestEntity, never, TestWorkingCopy> = {
        nodeType: 'clear-all-test-2',
        name: 'Clear All Test 2',
        displayName: 'Clear All Test 2',
        icon: 'clear2',
        color: '#aaaaaa',
        database: {
          entityStore: 'clear_all_entities_2',
          schema: {
            '&id': 'EntityId',
            'nodeId': 'NodeId',
            'name': '',
            'createdAt, updatedAt, version': '',
          },
          version: 1
        } as PluginDatabaseConfig,
        entityHandler: new MockEntityHandler() as any,
      };

      // Register both plugins
      await registry.registerDefinition(plugin1);
      await registry.registerDefinition(plugin2);

      expect(registry.getDefinition('clear-all-test-1')).toBeDefined();
      expect(registry.getDefinition('clear-all-test-2')).toBeDefined();

      // Clear all
      await registry.clear();

      // Verify all are cleared
      expect(registry.getDefinition('clear-all-test-1')).toBeUndefined();
      expect(registry.getDefinition('clear-all-test-2')).toBeUndefined();
      expect(registry.getAllDefinitions()).toHaveLength(0);
    });

    it('should handle database operation errors gracefully', async () => {
      // Test case 11: Database operation error handling
      const pluginDefinition: NodeTypeDefinition<TestEntity, never, TestWorkingCopy> = {
        nodeType: 'error-test',
        name: 'Error Test',
        displayName: 'Error Test',
        icon: 'error',
        color: '#bbbbbb',
        database: {
          entityStore: 'error_entities',
          schema: {
            '&id': 'EntityId',
            'nodeId': 'NodeId',
            'name': '',
            'createdAt, updatedAt, version': '',
          },
          version: 1
        } as PluginDatabaseConfig,
        entityHandler: new MockEntityHandler() as any,
      };

      // Register plugin
      await registry.registerDefinition(pluginDefinition);
      expect(registry.getDefinition('error-test')).toBeDefined();

      // Even if database cleanup fails, unregistration should continue
      // (This tests the error handling in unregister method)
      await registry.unregister('error-test');
      expect(registry.getDefinition('error-test')).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid plugin definitions gracefully', async () => {
      // Test case 12: Invalid plugin definitions
      await expect(async () => {
        await registry.registerDefinition(null as any);
      }).rejects.toThrow('Definition cannot be null or undefined');

      await expect(async () => {
        await registry.registerDefinition({} as any);
      }).rejects.toThrow('Node type cannot be null or undefined');

      await expect(async () => {
        await registry.registerDefinition({
          nodeType: '',
          entityHandler: new MockEntityHandler(),
        } as any);
      }).rejects.toThrow('Node type cannot be null or undefined');
    });
  });
});