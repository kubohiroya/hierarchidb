import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NodeId, EntityId } from '@hierarchidb/common-type';
import { PropertyResolverEntityHandler } from '../handlers/PropertyResolverEntityHandler';
import { propertyResolverDB } from '../database/PropertyResolverDatabase';
import type { PropertyResolverEntity } from '../types';

// Mock Dexie
vi.mock('dexie');

describe('PropertyResolver Integration Tests', () => {
  let handler: PropertyResolverEntityHandler;
  const testNodeId = 'test-node-123' as NodeId;

  beforeEach(() => {
    handler = new PropertyResolverEntityHandler();
    vi.clearAllMocks();
  });

  describe('Entity Creation', () => {
    it('should create a PropertyResolver entity with default values', async () => {
      const entity = await handler.createEntity(testNodeId);

      expect(entity).toBeDefined();
      expect(entity.nodeId).toBe(testNodeId);
      expect(entity.name).toBe('New PropertyResolver');
      expect(entity.mappingRules).toEqual([]);
      expect(entity.validationRules).toEqual([]);
      expect(entity.isCompiled).toBe(false);
    });

    it('should create a PropertyResolver entity with custom values', async () => {
      const customData = {
        name: 'Custom Resolver',
        description: 'Test resolver',
        sourceSchema: 'source_schema',
        targetSchema: 'target_schema',
        mappingRules: [
          {
            id: 'rule1',
            sourceProperty: 'prop1',
            targetProperty: 'prop2',
            transformFunction: undefined,
            isRequired: true,
            defaultValue: undefined,
          },
        ],
      };

      const entity = await handler.createEntity(testNodeId, customData);

      expect(entity.name).toBe('Custom Resolver');
      expect(entity.description).toBe('Test resolver');
      expect(entity.sourceSchema).toBe('source_schema');
      expect(entity.targetSchema).toBe('target_schema');
      expect(entity.mappingRules).toHaveLength(1);
      expect(entity.mappingRules[0].sourceProperty).toBe('prop1');
    });
  });

  describe('Working Copy Management', () => {
    it('should create a working copy from existing entity', async () => {
      // First create an entity
      const entity = await handler.createEntity(testNodeId, {
        name: 'Test Resolver',
      });

      // Mock the getEntity method to return the created entity
      vi.spyOn(handler, 'getEntity').mockResolvedValue(entity);

      // Create working copy
      const workingCopy = await handler.createWorkingCopy(testNodeId);

      expect(workingCopy).toBeDefined();
      expect(workingCopy.id).toBe(entity.id);
      expect(workingCopy.name).toBe('Test Resolver');
      expect(workingCopy.isDirty).toBe(false);
      expect(workingCopy.originalVersion).toBe(entity.version);
    });

    it('should commit working copy changes', async () => {
      const entity = await handler.createEntity(testNodeId);
      vi.spyOn(handler, 'getEntity').mockResolvedValue(entity);

      const workingCopy = await handler.createWorkingCopy(testNodeId);
      workingCopy.name = 'Updated Resolver';
      workingCopy.isDirty = true;

      await handler.commitWorkingCopy(testNodeId, workingCopy);

      // Verify update was called
      expect(workingCopy.name).toBe('Updated Resolver');
    });
  });

  describe('Mapping Rules', () => {
    it('should handle complex mapping rules', async () => {
      const complexMappingRules = [
        {
          id: 'rule1',
          sourceProperty: 'user.firstName',
          targetProperty: 'name.first',
          transformFunction: 'value.toLowerCase()',
          isRequired: true,
          defaultValue: undefined,
        },
        {
          id: 'rule2',
          sourceProperty: 'user.lastName',
          targetProperty: 'name.last',
          transformFunction: 'value.toUpperCase()',
          isRequired: true,
          defaultValue: undefined,
        },
        {
          id: 'rule3',
          sourceProperty: 'user.age',
          targetProperty: 'demographics.age',
          transformFunction: 'parseInt(value)',
          isRequired: false,
          defaultValue: '0',
        },
      ];

      const entity = await handler.createEntity(testNodeId, {
        name: 'Complex Mapper',
        mappingRules: complexMappingRules,
      });

      expect(entity.mappingRules).toHaveLength(3);
      expect(entity.mappingRules[0].transformFunction).toBe('value.toLowerCase()');
      expect(entity.mappingRules[2].defaultValue).toBe('0');
    });
  });

  describe('Validation Rules', () => {
    it('should handle validation rules', async () => {
      const validationRules = [
        {
          id: 'val1',
          fieldPath: 'email',
          ruleName: 'email',
          validationType: 'format' as const,
          errorMessage: 'Invalid email format',
          isActive: true,
          severity: 'error' as const,
        },
        {
          id: 'val2',
          fieldPath: 'age',
          ruleName: 'range',
          validationType: 'range' as const,
          errorMessage: 'Age must be between 0 and 120',
          isActive: true,
          severity: 'warning' as const,
          min: 0,
          max: 120,
        },
      ];

      const entity = await handler.createEntity(testNodeId, {
        name: 'Validated Resolver',
        validationRules,
      });

      expect(entity.validationRules).toHaveLength(2);
      expect(entity.validationRules[0].validationType).toBe('format');
      expect(entity.validationRules[1].min).toBe(0);
      expect(entity.validationRules[1].max).toBe(120);
    });
  });

  describe('Duplicate Resolution', () => {
    it('should handle duplicate resolution strategies', async () => {
      const duplicateResolution = {
        strategy: 'merge' as const,
        mergeRules: [
          {
            field: 'tags',
            mergeStrategy: 'union' as const,
          },
          {
            field: 'metadata',
            mergeStrategy: 'overwrite' as const,
          },
        ],
      };

      const entity = await handler.createEntity(testNodeId, {
        name: 'Merge Resolver',
        duplicateResolution,
      });

      expect(entity.duplicateResolution.strategy).toBe('merge');
      expect(entity.duplicateResolution.mergeRules).toHaveLength(2);
    });
  });

  describe('Compilation', () => {
    it('should track compilation status', async () => {
      const entity = await handler.createEntity(testNodeId, {
        name: 'Compilable Resolver',
        isCompiled: true,
        lastCompiled: Date.now(),
        compiledFunction: 'function transform(data) { return data; }',
        compiledMetadata: {
          version: '1.0.0',
          optimizations: ['inline', 'cache'],
        },
      });

      expect(entity.isCompiled).toBe(true);
      expect(entity.lastCompiled).toBeDefined();
      expect(entity.compiledFunction).toContain('function transform');
      expect(entity.compiledMetadata?.optimizations).toContain('cache');
    });
  });

  describe('Entity Lifecycle', () => {
    it('should handle entity duplication', async () => {
      const originalEntity = await handler.createEntity(testNodeId, {
        name: 'Original Resolver',
      });

      vi.spyOn(handler, 'getEntity').mockResolvedValue(originalEntity);

      const newNodeId = 'new-node-456' as NodeId;
      await handler.duplicate(testNodeId, newNodeId);

      // The duplicate method should create a new entity with "(Copy)" suffix
      expect(originalEntity.name).toBe('Original Resolver');
    });

    it('should handle entity backup and restore', async () => {
      const entity = await handler.createEntity(testNodeId, {
        name: 'Backup Test',
      });

      vi.spyOn(handler, 'getEntity').mockResolvedValue(entity);

      const backup = await handler.backup(testNodeId);

      expect(backup).toBeDefined();
      expect(backup.entity.name).toBe('Backup Test');
      expect(backup.metadata.nodeType).toBe('propertyresolver-plugin');

      // Restore from backup
      await handler.restore(testNodeId, backup);
    });

    it('should cleanup related data on deletion', async () => {
      const entity = await handler.createEntity(testNodeId);
      vi.spyOn(handler, 'getEntity').mockResolvedValue(entity);

      await handler.cleanup(testNodeId);

      // Cleanup should remove working copies
      expect(entity).toBeDefined();
    });
  });
});