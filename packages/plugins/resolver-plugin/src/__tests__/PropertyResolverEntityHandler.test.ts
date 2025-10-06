import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId } from '@hierarchidb/common-type';
import { type CreateResolverData, ResolverEntityHandler } from '../handlers/ResolverEntityHandler.js';
import { resolverDB } from '../database/ResolverDatabase.js';

describe('ResolverEntityHandler', () => {
  let handler: ResolverEntityHandler;

  beforeEach(() => {
    handler = new ResolverEntityHandler();
  });

  afterEach(async () => {
    await resolverDB.resolvers.clear();
    await resolverDB.workingCopies.clear();
  });

  afterAll(async () => {
    await resolverDB.delete();
    resolverDB.close();
  });

  describe('createEntity', () => {
    it('should create a new Resolver entity', async () => {
      const nodeId = 'node-123' as NodeId;
      const data: CreateResolverData = {
        name: 'Test Resolver',
        description: 'Test description',
        sourceSchema: 'TestSource',
        targetSchema: 'TestTarget',
      };

      const entity = await handler.createEntity(nodeId, data);

      expect(entity).toBeDefined();
      expect(entity.nodeId).toBe(nodeId);
      expect(entity.name).toBe(data.name);
      expect(entity.description).toBe(data.description);
      expect(entity.sourceSchema).toBe(data.sourceSchema);
      expect(entity.targetSchema).toBe(data.targetSchema);
      expect(entity.isCompiled).toBe(false);
      expect(entity.version).toBe(1);
    });

    it('should create entity with default values when minimal data provided', async () => {
      const nodeId = 'node-456' as NodeId;
      const data: CreateResolverData = {
        name: 'Minimal Resolver',
      };

      const entity = await handler.createEntity(nodeId, data);

      expect(entity.name).toBe(data.name);
      expect(entity.description).toBe('');
      expect(entity.sourceSchema).toBe('');
      expect(entity.targetSchema).toBe('');
      expect(entity.mappingRules).toEqual([]);
      expect(entity.validationRules).toEqual([]);
      expect(entity.duplicateResolution).toEqual({ strategy: 'skip' });
      expect(entity.dataTransformations).toEqual([]);
    });
  });

  describe('updateEntity', () => {
    it('should update an existing Resolver entity', async () => {
      const nodeId = 'node-789' as NodeId;
      const entity = await handler.createEntity(nodeId, {
        name: 'Original Name',
      });

      const updatedEntity = await handler.updateEntity(entity.id, {
        name: 'Updated Name',
        sourceSchema: 'UpdatedSource',
      });

      expect(updatedEntity.name).toBe('Updated Name');
      expect(updatedEntity.sourceSchema).toBe('UpdatedSource');
      expect(updatedEntity.version).toBe(2);
      expect(updatedEntity.updatedAt).toBeGreaterThan(entity.updatedAt);
    });

    it('should throw error when updating non-existent entity', async () => {
      const nonExistentId = 'non-existent' as NodeId;

      await expect(
        handler.updateEntity(nonExistentId, { name: 'New Name' }),
      ).rejects.toThrow('Entity not found');
    });
  });

  describe('deleteEntity', () => {
    it('should delete an existing Resolver entity', async () => {
      const nodeId = 'node-delete' as NodeId;
      const entity = await handler.createEntity(nodeId, {
        name: 'To Delete',
      });

      await handler.deleteEntity(entity.id);

      const deletedEntity = await handler.getEntity(entity.id);
      expect(deletedEntity).toBeNull();
    });

    it('should clean up working copies when deleting entity', async () => {
      const nodeId = 'node-cleanup' as NodeId;
      const entity = await handler.createEntity(nodeId, {
        name: 'With Working Copy',
      });

      const workingCopy = await handler.createWorkingCopy(nodeId);
      expect(workingCopy).toBeDefined();

      await handler.deleteEntity(entity.id);

      const workingCopyAfterDelete = await handler.getWorkingCopy(nodeId);
      expect(workingCopyAfterDelete).toBeNull();
    });
  });

  describe('searchEntities', () => {
    beforeEach(async () => {
      // Create test entities
      await handler.createEntity('node-1' as NodeId, {
        name: 'Alpha Resolver',
        sourceSchema: 'SourceA',
        targetSchema: 'TargetA',
      });

      await handler.createEntity('node-2' as NodeId, {
        name: 'Beta Resolver',
        sourceSchema: 'SourceB',
        targetSchema: 'TargetB',
      });

      await handler.createEntity('node-3' as NodeId, {
        name: 'Gamma Resolver',
        sourceSchema: 'SourceA',
        targetSchema: 'TargetC',
      });
    });

    it('should search entities by name', async () => {
      const results = await handler.searchEntities({ name: 'Beta' });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Beta Resolver');
    });

    it('should search entities by sourceSchema', async () => {
      const results = await handler.searchEntities({ sourceSchema: 'SourceA' });

      expect(results).toHaveLength(2);
      expect(results.some(e => e.name === 'Alpha Resolver')).toBe(true);
      expect(results.some(e => e.name === 'Gamma Resolver')).toBe(true);
    });

    it('should search entities by targetSchema', async () => {
      const results = await handler.searchEntities({ targetSchema: 'TargetB' });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Beta Resolver');
    });

    it('should return all entities when no criteria provided', async () => {
      const results = await handler.searchEntities({});

      expect(results).toHaveLength(3);
    });
  });

  describe('Working Copy Operations', () => {
    it('should create a working copy of an entity', async () => {
      const nodeId = 'node-wc' as NodeId;
      const entity = await handler.createEntity(nodeId, {
        name: 'Original Entity',
        sourceSchema: 'OriginalSource',
      });

      const workingCopy = await handler.createWorkingCopy(nodeId);

      expect(workingCopy).toBeDefined();
      expect(workingCopy.treeNodeId).toBe(nodeId);
      expect(workingCopy.draft.name).toBe(entity.name);
      expect(workingCopy.draft.sourceSchema).toBe(entity.sourceSchema);
    });

    it('should update a working copy', async () => {
      const nodeId = 'node-wc-update' as NodeId;
      await handler.createEntity(nodeId, {
        name: 'Original',
      });

      const workingCopy = await handler.createWorkingCopy(nodeId);
      const updated = await handler.updateWorkingCopy(workingCopy.treeNodeId, {
        name: 'Modified',
        sourceSchema: 'NewSource',
      });

      expect(updated.draft.name).toBe('Modified');
      expect(updated.draft.sourceSchema).toBe('NewSource');
    });

    it('should commit working copy changes', async () => {
      const nodeId = 'node-wc-commit' as NodeId;
      await handler.createEntity(nodeId, {
        name: 'Original',
      });

      const workingCopy = await handler.createWorkingCopy(nodeId);
      await handler.updateWorkingCopy(workingCopy.treeNodeId, {
        name: 'Committed',
      });

      const committed = await handler.commitWorkingCopy(workingCopy.treeNodeId);

      expect(committed.name).toBe('Committed');
      expect(committed.version).toBe(2);

      // Working copy should be deleted after commit
      const wcAfterCommit = await handler.getWorkingCopy(nodeId);
      expect(wcAfterCommit).toBeNull();
    });

    it('should discard working copy changes', async () => {
      const nodeId = 'node-wc-discard' as NodeId;
      const entity = await handler.createEntity(nodeId, {
        name: 'Original',
      });

      const workingCopy = await handler.createWorkingCopy(nodeId);
      await handler.updateWorkingCopy(workingCopy.treeNodeId, {
        name: 'To Be Discarded',
      });

      await handler.discardWorkingCopy(workingCopy.treeNodeId);

      // Entity should remain unchanged
      const unchangedEntity = await handler.getEntity(entity.id);
      expect(unchangedEntity?.name).toBe('Original');

      // Working copy should be deleted
      const wcAfterDiscard = await handler.getWorkingCopy(nodeId);
      expect(wcAfterDiscard).toBeNull();
    });
  });

  describe('duplicate', () => {
    it('should duplicate a Resolver entity', async () => {
      const originalNodeId = 'node-original' as NodeId;
      const newNodeId = 'node-duplicate' as NodeId;

      await handler.createEntity(originalNodeId, {
        name: 'Original Resolver',
        sourceSchema: 'SourceSchema',
        targetSchema: 'TargetSchema',
        mappingRules: [
          {
            id: 'rule1',
            sourceProperty: 'prop1',
            targetProperty: 'target1',
            isRequired: true,
          },
        ],
      });

      const duplicate = await handler.duplicate(originalNodeId, newNodeId);

      expect(duplicate.nodeId).toBe(newNodeId);
      expect(duplicate.name).toBe('Original Resolver (Copy)');
      expect(duplicate.sourceSchema).toBe('SourceSchema');
      expect(duplicate.targetSchema).toBe('TargetSchema');
      expect(duplicate.mappingRules).toHaveLength(1);
      expect(duplicate.version).toBe(1);
    });
  });

  describe('validateMapping', () => {
    it('should validate mapping with errors', async () => {
      const nodeId = 'node-validate' as NodeId;
      const entity = await handler.createEntity(nodeId, {
        name: 'Invalid Resolver',
        // Missing source and target schemas
      });

      const validation = await handler.validateMapping(entity.id);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Source schema is required');
      expect(validation.errors).toContain('Target schema is required');
      expect(validation.warnings).toContain('No mapping rules defined');
    });

    it('should validate mapping with duplicate target properties', async () => {
      const nodeId = 'node-dup-targets' as NodeId;
      const entity = await handler.createEntity(nodeId, {
        name: 'Duplicate Targets',
        sourceSchema: 'Source',
        targetSchema: 'Target',
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

    it('should validate valid mapping', async () => {
      const nodeId = 'node-valid' as NodeId;
      const entity = await handler.createEntity(nodeId, {
        name: 'Valid Resolver',
        sourceSchema: 'Source',
        targetSchema: 'Target',
        mappingRules: [
          {
            id: 'rule1',
            sourceProperty: 'prop1',
            targetProperty: 'target1',
            isRequired: true,
          },
        ],
      });

      const validation = await handler.validateMapping(entity.id);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(0);
    });
  });

  describe('compileMapping', () => {
    it('should compile mapping rules', async () => {
      const nodeId = 'node-compile' as NodeId;
      const entity = await handler.createEntity(nodeId, {
        name: 'To Compile',
        sourceSchema: 'Source',
        targetSchema: 'Target',
      });

      await handler.compileMapping(entity.id);

      const compiled = await handler.getEntity(entity.id);
      expect(compiled?.isCompiled).toBe(true);
      expect(compiled?.lastCompiled).toBeDefined();
      expect(compiled?.compiledMetadata).toBeDefined();
    });
  });

  describe('clearCompiledMapping', () => {
    it('should clear compiled mapping data', async () => {
      const nodeId = 'node-clear' as NodeId;
      const entity = await handler.createEntity(nodeId, {
        name: 'Clear Compiled',
      });

      await handler.compileMapping(entity.id);
      await handler.clearCompiledMapping(entity.id);

      const cleared = await handler.getEntity(entity.id);
      expect(cleared?.isCompiled).toBe(false);
      expect(cleared?.lastCompiled).toBeUndefined();
      expect(cleared?.compiledFunction).toBeUndefined();
      expect(cleared?.compiledMetadata).toBeUndefined();
    });
  });
});
