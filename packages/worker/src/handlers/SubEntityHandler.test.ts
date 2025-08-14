/**
 * @file SubEntityHandler.test.ts
 * @description Unit tests for SubEntityHandler advanced sub-entity operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Dexie from 'dexie';
import { SubEntityHandler } from './SubEntityHandler';
import type { ExtendedSubEntity } from './SubEntityHandler';
import type { TreeNodeId } from '@hierarchidb/core';

describe('SubEntityHandler', () => {
  let db: Dexie;
  let handler: SubEntityHandler;
  const parentNodeId = 'parent-node-123' as TreeNodeId;
  const parentNodeId2 = 'parent-node-456' as TreeNodeId;

  beforeEach(async () => {
    // Create in-memory database
    db = new Dexie('TestDB');
    db.version(1).stores({
      entities: 'nodeId, name, createdAt, updatedAt',
      workingCopies: 'workingCopyId, workingCopyOf, nodeId',
      subEntities: 'id, parentNodeId, [parentNodeId+subEntityType], createdAt, updatedAt',
    });

    await db.open();

    handler = new SubEntityHandler(db, 'entities', 'workingCopies', 'subEntities');

    // Create parent entities for testing
    await handler.createEntity(parentNodeId, { name: 'Parent 1' });
    await handler.createEntity(parentNodeId2, { name: 'Parent 2' });
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Basic Sub-Entity Operations', () => {
    describe('createSubEntity', () => {
      it('should create a sub-entity with default values', async () => {
        const subEntity = await handler.createSubEntity(parentNodeId, 'attachment', {
          data: { content: 'test' },
        });

        expect(subEntity.id).toBeDefined();
        expect(subEntity.parentNodeId).toBe(parentNodeId);
        expect(subEntity.subEntityType).toBe('attachment');
        expect(subEntity.data).toEqual({ content: 'test' });
        expect(subEntity.version).toBe(1);
      });

      it('should create a sub-entity with full metadata', async () => {
        const subEntity = await handler.createSubEntity(parentNodeId, 'task', {
          name: 'Important Task',
          data: { description: 'Do something' },
          metadata: {
            tags: ['urgent', 'high-priority'],
            priority: 1,
            visible: true,
          },
          relationships: {
            relatedTo: ['sub-1', 'sub-2'],
            dependsOn: ['sub-3'],
          },
        });

        expect(subEntity.name).toBe('Important Task');
        expect(subEntity.metadata?.tags).toEqual(['urgent', 'high-priority']);
        expect(subEntity.metadata?.priority).toBe(1);
        expect(subEntity.metadata?.visible).toBe(true);
        expect(subEntity.relationships?.relatedTo).toEqual(['sub-1', 'sub-2']);
        expect(subEntity.relationships?.dependsOn).toEqual(['sub-3']);
      });

      it('should throw error if parent entity does not exist', async () => {
        await expect(
          handler.createSubEntity('non-existent' as TreeNodeId, 'attachment', { data: {} })
        ).rejects.toThrow('Parent entity not found');
      });

      it('should validate sub-entity data', async () => {
        await expect(handler.createSubEntity(parentNodeId, '', { data: {} })).rejects.toThrow(
          'Sub-entity type is required'
        );
      });
    });

    describe('getSubEntities', () => {
      beforeEach(async () => {
        await handler.createSubEntity(parentNodeId, 'attachment', {
          name: 'File 1',
          data: { size: 100 },
        });
        await handler.createSubEntity(parentNodeId, 'attachment', {
          name: 'File 2',
          data: { size: 200 },
        });
        await handler.createSubEntity(parentNodeId, 'comment', {
          name: 'Comment 1',
          data: { text: 'Hello' },
        });
      });

      it('should get all sub-entities for a node', async () => {
        const subEntities = await handler.getSubEntities(parentNodeId);
        expect(subEntities).toHaveLength(3);
      });

      it('should get sub-entities by type', async () => {
        const attachments = await handler.getSubEntities(parentNodeId, 'attachment');
        expect(attachments).toHaveLength(2);
        expect(attachments.every((se) => se.subEntityType === 'attachment')).toBe(true);
      });

      it('should return empty array for node without sub-entities', async () => {
        const subEntities = await handler.getSubEntities(parentNodeId2);
        expect(subEntities).toHaveLength(0);
      });
    });

    describe('getSubEntity', () => {
      let subEntityId: string;

      beforeEach(async () => {
        const subEntity = await handler.createSubEntity(parentNodeId, 'attachment', {
          name: 'Test File',
        });
        subEntityId = subEntity.id;
      });

      it('should get a specific sub-entity by ID', async () => {
        const subEntity = await handler.getSubEntity(subEntityId);
        expect(subEntity).toBeDefined();
        expect(subEntity?.id).toBe(subEntityId);
        expect(subEntity?.name).toBe('Test File');
      });

      it('should return undefined for non-existent sub-entity', async () => {
        const subEntity = await handler.getSubEntity('non-existent');
        expect(subEntity).toBeUndefined();
      });
    });

    describe('updateSubEntity', () => {
      let subEntityId: string;

      beforeEach(async () => {
        const subEntity = await handler.createSubEntity(parentNodeId, 'task', {
          name: 'Original Task',
          data: { status: 'pending' },
        });
        subEntityId = subEntity.id;
      });

      it('should update sub-entity fields', async () => {
        await handler.updateSubEntity(subEntityId, {
          name: 'Updated Task',
          data: { status: 'completed' },
        });

        const updated = await handler.getSubEntity(subEntityId);
        expect(updated?.name).toBe('Updated Task');
        expect(updated?.data.status).toBe('completed');
      });

      it('should increment version on update', async () => {
        const original = await handler.getSubEntity(subEntityId);
        const originalVersion = original?.version || 0;

        await handler.updateSubEntity(subEntityId, { name: 'Updated' });

        const updated = await handler.getSubEntity(subEntityId);
        expect(updated?.version).toBe(originalVersion + 1);
      });

      it('should not update system fields', async () => {
        const original = await handler.getSubEntity(subEntityId);

        await handler.updateSubEntity(subEntityId, {
          id: 'different-id',
          parentNodeId: parentNodeId2,
          subEntityType: 'different-type',
          createdAt: 12345,
          version: 999,
        } as any);

        const updated = await handler.getSubEntity(subEntityId);
        expect(updated?.id).toBe(subEntityId);
        expect(updated?.parentNodeId).toBe(parentNodeId);
        expect(updated?.subEntityType).toBe('task');
        expect(updated?.createdAt).toBe(original?.createdAt);
        expect(updated?.version).toBe(2); // Auto-incremented
      });
    });

    describe('deleteSubEntity', () => {
      let subEntityId: string;

      beforeEach(async () => {
        const subEntity = await handler.createSubEntity(parentNodeId, 'attachment', {
          name: 'To Delete',
        });
        subEntityId = subEntity.id;
      });

      it('should delete a sub-entity', async () => {
        await handler.deleteSubEntity(subEntityId);

        const deleted = await handler.getSubEntity(subEntityId);
        expect(deleted).toBeUndefined();
      });

      it('should not throw for non-existent sub-entity', async () => {
        await expect(handler.deleteSubEntity('non-existent')).resolves.not.toThrow();
      });
    });

    describe('deleteSubEntitiesByType', () => {
      beforeEach(async () => {
        await handler.createSubEntity(parentNodeId, 'attachment', { name: 'File 1' });
        await handler.createSubEntity(parentNodeId, 'attachment', { name: 'File 2' });
        await handler.createSubEntity(parentNodeId, 'comment', { name: 'Comment 1' });
      });

      it('should delete all sub-entities of a specific type', async () => {
        const deletedCount = await handler.deleteSubEntitiesByType(parentNodeId, 'attachment');

        expect(deletedCount).toBe(2);

        const remaining = await handler.getSubEntities(parentNodeId);
        expect(remaining).toHaveLength(1);
        expect(remaining[0]?.subEntityType).toBe('comment');
      });
    });
  });

  describe('Advanced Query Operations', () => {
    beforeEach(async () => {
      // Create sub-entities with various attributes
      await handler.createSubEntity(parentNodeId, 'task', {
        name: 'Task 1',
        metadata: { tags: ['urgent'], priority: 1, visible: true },
        createdAt: 1000,
      });
      await handler.createSubEntity(parentNodeId, 'task', {
        name: 'Task 2',
        metadata: { tags: ['low'], priority: 3, visible: false },
        createdAt: 2000,
      });
      await handler.createSubEntity(parentNodeId2, 'task', {
        name: 'Task 3',
        metadata: { tags: ['urgent', 'important'], priority: 1, visible: true },
        createdAt: 3000,
      });
      await handler.createSubEntity(parentNodeId, 'comment', {
        name: 'Comment 1',
        metadata: { visible: true },
        createdAt: 4000,
      });
    });

    it('should query by parent node ID', async () => {
      const results = await handler.querySubEntities({
        parentNodeId: parentNodeId,
      });
      expect(results).toHaveLength(3);
    });

    it('should query by type', async () => {
      const results = await handler.querySubEntities({
        type: 'task',
      });
      expect(results).toHaveLength(3);
    });

    it('should query by tags', async () => {
      const results = await handler.querySubEntities({
        tags: ['urgent'],
      });
      expect(results).toHaveLength(2);
    });

    it('should query by priority', async () => {
      const results = await handler.querySubEntities({
        priority: 1,
      });
      expect(results).toHaveLength(2);
    });

    it('should query by visibility', async () => {
      const results = await handler.querySubEntities({
        visible: true,
      });
      expect(results).toHaveLength(3);
    });

    it('should query with pagination', async () => {
      const page1 = await handler.querySubEntities({
        type: 'task',
        limit: 2,
        offset: 0,
      });
      expect(page1).toHaveLength(2);

      const page2 = await handler.querySubEntities({
        type: 'task',
        limit: 2,
        offset: 2,
      });
      expect(page2).toHaveLength(1);
    });

    it('should query with sorting', async () => {
      const results = await handler.querySubEntities({
        type: 'task',
        orderBy: 'priority',
        orderDirection: 'asc',
      });

      expect(results[0]?.metadata?.priority).toBe(1);
      expect(results[2]?.metadata?.priority).toBe(3);
    });

    it('should combine multiple query criteria', async () => {
      const results = await handler.querySubEntities({
        parentNodeId: parentNodeId,
        type: 'task',
        tags: ['urgent'],
        visible: true,
      });
      expect(results).toHaveLength(1);
      expect(results[0]?.name).toBe('Task 1');
    });
  });

  describe('Batch Operations', () => {
    describe('batchCreateSubEntities', () => {
      it('should create multiple sub-entities', async () => {
        const result = await handler.batchCreateSubEntities([
          {
            nodeId: parentNodeId,
            type: 'attachment',
            data: { name: 'File 1' },
          },
          {
            nodeId: parentNodeId,
            type: 'attachment',
            data: { name: 'File 2' },
          },
          {
            nodeId: parentNodeId2,
            type: 'comment',
            data: { name: 'Comment 1' },
          },
        ]);

        expect(result.successful).toHaveLength(3);
        expect(result.failed).toHaveLength(0);
        expect(result.total).toBe(3);

        const parent1SubEntities = await handler.getSubEntities(parentNodeId);
        expect(parent1SubEntities).toHaveLength(2);
      });

      it('should handle failures gracefully', async () => {
        const result = await handler.batchCreateSubEntities([
          {
            nodeId: parentNodeId,
            type: 'task',
            data: { name: 'Valid Task' },
          },
          {
            nodeId: 'non-existent' as TreeNodeId,
            type: 'task',
            data: { id: 'invalid-parent', name: 'Invalid Task' },
          },
        ]);

        expect(result.successful).toHaveLength(1);
        expect(result.failed).toHaveLength(1);
        expect(result.failed[0]?.id).toBe('invalid-parent');
      });
    });
  });

  describe('Move and Copy Operations', () => {
    let subEntityIds: string[] = [];

    beforeEach(async () => {
      const se1 = await handler.createSubEntity(parentNodeId, 'task', { name: 'Task 1' });
      const se2 = await handler.createSubEntity(parentNodeId, 'task', { name: 'Task 2' });
      subEntityIds = [se1.id, se2.id];
    });

    describe('moveSubEntities', () => {
      it('should move sub-entities to a different parent', async () => {
        await handler.moveSubEntities(subEntityIds, parentNodeId2);

        const oldParentSubs = await handler.getSubEntities(parentNodeId);
        expect(oldParentSubs).toHaveLength(0);

        const newParentSubs = await handler.getSubEntities(parentNodeId2);
        expect(newParentSubs).toHaveLength(2);
      });

      it('should throw error if new parent does not exist', async () => {
        await expect(
          handler.moveSubEntities(subEntityIds, 'non-existent' as TreeNodeId)
        ).rejects.toThrow('New parent entity not found');
      });
    });

    describe('copySubEntities', () => {
      it('should copy all sub-entities to another parent', async () => {
        const copied = await handler.copySubEntities(parentNodeId, parentNodeId2);

        expect(copied).toHaveLength(2);

        // Original sub-entities should still exist
        const originalSubs = await handler.getSubEntities(parentNodeId);
        expect(originalSubs).toHaveLength(2);

        // Copied sub-entities should exist in new parent
        const copiedSubs = await handler.getSubEntities(parentNodeId2);
        expect(copiedSubs).toHaveLength(2);
        expect(copiedSubs[0]?.name).toContain('(Copy)');
      });

      it('should copy sub-entities of specific type', async () => {
        await handler.createSubEntity(parentNodeId, 'comment', { name: 'Comment 1' });

        const copied = await handler.copySubEntities(parentNodeId, parentNodeId2, 'task');

        expect(copied).toHaveLength(2);
        expect(copied.every((se) => se.subEntityType === 'task')).toBe(true);
      });
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      await handler.createSubEntity(parentNodeId, 'task', { name: 'Task 1' });
      await handler.createSubEntity(parentNodeId, 'task', { name: 'Task 2' });
      await handler.createSubEntity(parentNodeId, 'comment', { name: 'Comment 1' });
      await handler.createSubEntity(parentNodeId2, 'task', { name: 'Task 3' });
    });

    it('should get sub-entity count', async () => {
      expect(await handler.getSubEntityCount()).toBe(4);
      expect(await handler.getSubEntityCount(parentNodeId)).toBe(3);
      expect(await handler.getSubEntityCount(parentNodeId, 'task')).toBe(2);
    });

    it('should get sub-entity types for a node', async () => {
      const types = await handler.getSubEntityTypes(parentNodeId);
      expect(types).toHaveLength(2);
      expect(types).toContain('task');
      expect(types).toContain('comment');
    });

    it('should get sub-entities with parent data', async () => {
      const withParent = await handler.getSubEntitiesWithParent(parentNodeId, 'task');

      expect(withParent).toHaveLength(2);
      expect(withParent[0]?.parent).toBeDefined();
      expect(withParent[0]?.parent.name).toBe('Parent 1');
    });
  });

  describe('Relationship Validation', () => {
    it('should validate existing relationships', async () => {
      const se1 = await handler.createSubEntity(parentNodeId, 'task', { name: 'Task 1' });
      const se2 = await handler.createSubEntity(parentNodeId, 'task', {
        name: 'Task 2',
        relationships: {
          relatedTo: [se1.id],
          dependsOn: [se1.id],
        },
      });

      const isValid = await handler.validateSubEntityRelationships(se2.id);
      expect(isValid).toBe(true);
    });

    it('should invalidate broken relationships', async () => {
      const se = await handler.createSubEntity(parentNodeId, 'task', {
        name: 'Task',
        relationships: {
          relatedTo: ['non-existent-1'],
          dependsOn: ['non-existent-2'],
        },
      });

      const isValid = await handler.validateSubEntityRelationships(se.id);
      expect(isValid).toBe(false);
    });
  });

  describe('Import/Export', () => {
    beforeEach(async () => {
      await handler.createSubEntity(parentNodeId, 'task', {
        name: 'Task 1',
        data: { status: 'pending' },
        metadata: { priority: 1 },
      });
      await handler.createSubEntity(parentNodeId, 'task', {
        name: 'Task 2',
        data: { status: 'completed' },
        metadata: { priority: 2 },
      });
    });

    it('should export sub-entities to JSON', async () => {
      const json = await handler.exportSubEntities(parentNodeId, 'task');
      const parsed = JSON.parse(json);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      // Check that both tasks are exported
      const names = parsed.map((p: any) => p.name);
      expect(names).toContain('Task 1');
      expect(names).toContain('Task 2');
    });

    it('should import sub-entities from JSON', async () => {
      const exportData = await handler.exportSubEntities(parentNodeId, 'task');

      const result = await handler.importSubEntities(parentNodeId2, exportData);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);

      const imported = await handler.getSubEntities(parentNodeId2);
      expect(imported).toHaveLength(2);
    });

    it('should handle invalid JSON on import', async () => {
      await expect(handler.importSubEntities(parentNodeId, 'invalid json')).rejects.toThrow(
        'Invalid JSON data'
      );
    });

    it('should handle non-array JSON on import', async () => {
      await expect(handler.importSubEntities(parentNodeId, '{"not": "array"}')).rejects.toThrow(
        'JSON data must be an array'
      );
    });
  });

  describe('Validation', () => {
    it('should reject sub-entity without type', async () => {
      await expect(handler.createSubEntity(parentNodeId, '', { data: {} })).rejects.toThrow(
        'Sub-entity type is required'
      );
    });

    it('should reject invalid priority', async () => {
      await expect(
        handler.createSubEntity(parentNodeId, 'task', {
          metadata: { priority: -1 },
        })
      ).rejects.toThrow('Priority must be a non-negative number');
    });

    it('should reject invalid version', async () => {
      await expect(
        handler.createSubEntity(parentNodeId, 'task', {
          version: 0,
        })
      ).rejects.toThrow('Version must be positive');
    });
  });
});
