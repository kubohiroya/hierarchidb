import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/common-type';
import { ResolverEntityHandler } from '../handlers/ResolverEntityHandler';
import { resolverDB } from '../database/ResolverDatabase';

describe('Resolver Integration Tests', () => {
  let handler: ResolverEntityHandler;
  const testNodeId = 'test-node-123' as NodeId;

  beforeEach(() => {
    handler = new ResolverEntityHandler();
  });

  afterEach(async () => {
    // Clean up database after each test
    await resolverDB.resolvers.clear();
    await resolverDB.workingCopies.clear();
  });

  describe('Entity Creation', () => {
    it('should create a Resolver entity with default values', async () => {
      const entity = await handler.createEntity(testNodeId, {
        name: 'New Resolver',
      });

      expect(entity).toBeDefined();
      expect(entity.nodeId).toBe(testNodeId);
      expect(entity.name).toBe('New Resolver');
      expect(entity.mappingRules).toEqual([]);
      expect(entity.validationRules).toEqual([]);
      expect(entity.isCompiled).toBe(false);
    });

    it('should create a Resolver entity with custom values', async () => {
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

      // Create working copy
      const workingCopy = await handler.createWorkingCopy(testNodeId);

      expect(workingCopy).toBeDefined();
      expect(workingCopy.originalId).toBe(entity.id);
      expect(workingCopy.name).toBe('Test Resolver');
      expect(workingCopy.isDirty).toBe(false);
    });

    it('should commit working copy changes', async () => {
      const entity = await handler.createEntity(testNodeId, {
        name: 'Original Name',
      });

      const workingCopy = await handler.createWorkingCopy(testNodeId);

      await handler.updateWorkingCopy(workingCopy.workingCopyId!, {
        name: 'Updated Resolver',
      });

      const committed = await handler.commitWorkingCopy(workingCopy.workingCopyId!);

      expect(committed.name).toBe('Updated Resolver');
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
    it('should compile mapping rules', async () => {
      const entity = await handler.createEntity(testNodeId, {
        name: 'Compilable Resolver',
        sourceSchema: 'source',
        targetSchema: 'target',
        mappingRules: [
          {
            id: 'rule1',
            sourceProperty: 'prop1',
            targetProperty: 'prop2',
            isRequired: true,
          },
        ],
      });

      await handler.compileMapping(entity.id);

      const compiled = await handler.getEntity(entity.id);
      expect(compiled?.isCompiled).toBe(true);
      expect(compiled?.lastCompiled).toBeDefined();
    });

    it('should clear compiled data', async () => {
      const entity = await handler.createEntity(testNodeId, {
        name: 'Clear Compile Test',
      });

      await handler.compileMapping(entity.id);
      await handler.clearCompiledMapping(entity.id);

      const cleared = await handler.getEntity(entity.id);
      expect(cleared?.isCompiled).toBe(false);
      expect(cleared?.lastCompiled).toBeUndefined();
    });
  });

  describe('Entity Lifecycle', () => {
    it('should handle entity duplication', async () => {
      await handler.createEntity(testNodeId, {
        name: 'Original Resolver',
        sourceSchema: 'source',
        mappingRules: [
          {
            id: 'rule1',
            sourceProperty: 'prop1',
            targetProperty: 'prop2',
            isRequired: true,
          },
        ],
      });

      const newNodeId = 'new-node-456' as NodeId;
      const duplicate = await handler.duplicate(testNodeId, newNodeId);

      expect(duplicate.name).toBe('Original Resolver (Copy)');
      expect(duplicate.sourceSchema).toBe('source');
      expect(duplicate.mappingRules).toHaveLength(1);
    });

    it('should validate mapping configuration', async () => {
      const entity = await handler.createEntity(testNodeId, {
        name: 'Validation Test',
        mappingRules: [
          {
            id: 'rule1',
            sourceProperty: 'prop1',
            targetProperty: 'sameProp',
            isRequired: true,
          },
          {
            id: 'rule2',
            sourceProperty: 'prop2',
            targetProperty: 'sameProp',
            isRequired: true,
          },
        ],
      });

      const validation = await handler.validateMapping(entity.id);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Duplicate target property: sameProp');
    });
  });
});