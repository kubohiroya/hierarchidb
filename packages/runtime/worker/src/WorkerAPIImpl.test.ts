import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommandProcessor } from '~/command/CommandProcessor';
import { SimpleNodeTypeRegistry } from '~/registry/SimpleNodeTypeRegistry';
import { WorkerAPIImpl } from '~/WorkerAPIImpl';
// Use native crypto.randomUUID() instead of uuid package

describe('WorkerAPIImpl', () => {
  let workerAPI: WorkerAPIImpl;

  beforeEach(() => {
    workerAPI = new WorkerAPIImpl('test-db');
  });

  afterEach(async () => {
    await workerAPI.shutdown();
  });

  describe('initialization', () => {
    it('should initialize with database name', () => {
      expect(workerAPI).toBeDefined();
    });

    it('should initialize with default database name', () => {
      const defaultAPI = new WorkerAPIImpl();
      expect(defaultAPI).toBeDefined();
    });
  });

  describe('component access', () => {
    it('should provide access to CommandProcessor', () => {
      const processor = workerAPI.getCommandProcessor();
      expect(processor).toBeInstanceOf(CommandProcessor);
    });

    it('should provide access to NodeTypeRegistry', () => {
      const registry = workerAPI.getNodeTypeRegistry();
      expect(registry).toBeInstanceOf(SimpleNodeTypeRegistry);
    });

    it('should return the same instances on multiple calls', () => {
      const processor1 = workerAPI.getCommandProcessor();
      const processor2 = workerAPI.getCommandProcessor();
      expect(processor1).toBe(processor2);

      const registry1 = workerAPI.getNodeTypeRegistry();
      const registry2 = workerAPI.getNodeTypeRegistry();
      expect(registry1).toBe(registry2);
    });
  });

  describe('undo/redo integration', () => {
    it('should delegate undo to CommandProcessor', async () => {
      const processor = workerAPI.getCommandProcessor();

      // Initially, no undo available
      expect(processor.canUndo()).toBe(false);

      // Execute undo through WorkerAPI
      const result = await workerAPI.undo();

      // Should return error when no command to undo
      expect(result).toHaveProperty('success', false);
      if ('error' in result) {
        expect(result.error).toBe('No command to undo');
      }
    });

    it('should delegate redo to CommandProcessor', async () => {
      const processor = workerAPI.getCommandProcessor();

      // Initially, no redo available
      expect(processor.canRedo()).toBe(false);

      // Execute redo through WorkerAPI
      const result = await workerAPI.redo();

      // Should return error when no command to redo
      expect(result).toHaveProperty('success', false);
      if ('error' in result) {
        expect(result.error).toBe('No command to redo');
      }
    });
  });

  describe('node type registry integration', () => {
    it('should allow registering node types', () => {
      const registry = workerAPI.getNodeTypeRegistry();

      registry.registerNodeType('customType', {
        icon: 'custom-icon',
        color: '#FF0000',
      });

      expect(registry.isRegistered('customType')).toBe(true);
    });

    it('should preserve node type registrations across operations', () => {
      const registry = workerAPI.getNodeTypeRegistry();

      // Register a type
      registry.registerNodeType('persistentType', {
        icon: 'persistent-icon',
      });

      // Get registry again (same instance)
      const sameRegistry = workerAPI.getNodeTypeRegistry();

      // Should still be registered
      expect(sameRegistry.isRegistered('persistentType')).toBe(true);
      expect(sameRegistry.getNodeTypeConfig('persistentType')).toEqual({
        icon: 'persistent-icon',
      });
    });
  });
});
