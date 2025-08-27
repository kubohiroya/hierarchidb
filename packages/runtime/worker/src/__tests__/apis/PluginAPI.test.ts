/**
 * @file PluginAPI.test.ts
 * @description Test suite for PluginAPI extension system
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { PluginAPIRegistry } from '@hierarchidb/common-api';
import type { NodeId } from '@hierarchidb/common-core';

describe('PluginAPI', () => {
  let registry: PluginAPIRegistry;

  beforeEach(() => {
    registry = new PluginAPIRegistry();
  });

  describe('registration', () => {
    it('should register a plugin API extension', () => {
      const testPlugin = {
        nodeType: 'test' as const,
        methods: {
          getTestData: async (nodeId: NodeId) => ({ value: `data-${nodeId}` }),
          updateTestValue: async (nodeId: NodeId, value: string) => {
            console.log(`Updating ${nodeId} with ${value}`);
          },
        }
      };

      registry.register(testPlugin);

      const extension = registry.getExtension('test');
      expect(extension).toBeDefined();
      expect(extension?.nodeType).toBe('test');
    });

    it('should unregister a plugin API extension', () => {
      const testPlugin = {
        nodeType: 'test' as const,
        methods: {
          getTestData: async (nodeId: NodeId) => ({ value: 'test' }),
        }
      };

      registry.register(testPlugin);
      expect(registry.getExtension('test')).toBeDefined();

      registry.unregister('test');
      expect(registry.getExtension('test')).toBeUndefined();
    });

    it('should overwrite existing plugin for same nodeType', () => {
      const plugin1 = {
        nodeType: 'test' as const,
        methods: {
          method1: async (nodeId: NodeId) => 'result1',
        }
      };

      const plugin2 = {
        nodeType: 'test' as const,
        methods: {
          method2: async (nodeId: NodeId) => 'result2',
        }
      };

      registry.register(plugin1);
      registry.register(plugin2);

      const extension = registry.getExtension('test');
      expect(extension?.methods.method1).toBeUndefined();
      expect(extension?.methods.method2).toBeDefined();
    });
  });

  describe('method invocation', () => {
    beforeEach(() => {
      const testPlugin = {
        nodeType: 'test' as const,
        methods: {
          getTestData: async (nodeId: NodeId) => ({ value: `data-${nodeId}` }),
          updateTestValue: async (nodeId: NodeId, value: string) => {
            // Mock implementation
          },
        }
      };

      registry.register(testPlugin);
    });

    it('should invoke plugin methods with correct arguments', async () => {
      const nodeId = 'test-node-123' as NodeId;
      const result = await registry.invokeMethod('test', 'getTestData', nodeId);

      expect(result).toEqual({ value: 'data-test-node-123' });
    });

    it('should invoke plugin methods with multiple arguments', async () => {
      const nodeId = 'test-node-456' as NodeId;
      await registry.invokeMethod('test', 'updateTestValue', nodeId, 'new-value');
      // This test just ensures the method can be called without throwing
    });

    it('should throw error for non-existent plugin', async () => {
      const nodeId = 'test-node-123' as NodeId;
      await expect(
        registry.invokeMethod('nonexistent', 'someMethod', nodeId)
      ).rejects.toThrow('Method someMethod not found for nonexistent');
    });

    it('should throw error for non-existent method', async () => {
      const nodeId = 'test-node-123' as NodeId;
      await expect(
        registry.invokeMethod('test', 'nonexistentMethod', nodeId)
      ).rejects.toThrow('Method nonexistentMethod not found for test');
    });
  });

  describe('method queries', () => {
    beforeEach(() => {
      const testPlugin = {
        nodeType: 'test' as const,
        methods: {
          getTestData: async (nodeId: NodeId) => ({ value: 'test' }),
          updateTestValue: async (nodeId: NodeId, value: string) => {},
        }
      };

      registry.register(testPlugin);
    });

    it('should check if plugin has specific method', () => {
      expect(registry.hasMethod('test', 'getTestData')).toBe(true);
      expect(registry.hasMethod('test', 'nonexistentMethod')).toBe(false);
      expect(registry.hasMethod('nonexistent', 'getTestData')).toBe(false);
    });

    it('should return available methods for plugin', () => {
      const methods = registry.getAvailableMethods('test');
      expect(methods).toContain('getTestData');
      expect(methods).toContain('updateTestValue');
      expect(methods).toHaveLength(2);
    });

    it('should return empty array for non-existent plugin', () => {
      const methods = registry.getAvailableMethods('nonexistent');
      expect(methods).toEqual([]);
    });

    it('should return all registered extensions', () => {
      const anotherPlugin = {
        nodeType: 'another' as const,
        methods: {
          anotherMethod: async (nodeId: NodeId) => 'result',
        }
      };

      registry.register(anotherPlugin);

      const extensions = registry.getAllExtensions();
      expect(extensions).toHaveLength(2);
      expect(extensions.map(ext => ext.nodeType)).toContain('test');
      expect(extensions.map(ext => ext.nodeType)).toContain('another');
    });
  });

  describe('type safety', () => {
    it('should maintain type safety for method invocation', async () => {
      const typedPlugin = {
        nodeType: 'typed' as const,
        methods: {
          getString: async (nodeId: NodeId, input: string): Promise<string> => `result: ${input}`,
          getNumber: async (nodeId: NodeId, input: number): Promise<number> => input * 2,
        }
      };

      registry.register(typedPlugin);

      const nodeId = 'test-node-123' as NodeId;
      const stringResult = await registry.invokeMethod('typed', 'getString', nodeId, 'test');
      expect(typeof stringResult).toBe('string');
      expect(stringResult).toBe('result: test');

      const numberResult = await registry.invokeMethod('typed', 'getNumber', nodeId, 5);
      expect(typeof numberResult).toBe('number');
      expect(numberResult).toBe(10);
    });
  });
});