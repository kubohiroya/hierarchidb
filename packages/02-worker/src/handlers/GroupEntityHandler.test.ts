/**
 * @file GroupEntityHandler.test.ts
 * @description Unit tests for GroupEntityHandler advanced group entity operations
 */

import type { NodeId, EntityId, GroupEntity } from '@hierarchidb/00-core';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseEntityHandler } from './BaseEntityHandler';

// Concrete test implementation of GroupEntityHandler
class TestGroupEntityHandler extends BaseEntityHandler<GroupEntity> {
  async createEntity(nodeId: NodeId, data?: Partial<GroupEntity>): Promise<GroupEntity> {
    const entity: GroupEntity = {
      id: crypto.randomUUID() as EntityId,
      nodeId: nodeId,
      type: data?.type || 'default',
      createdAt: data?.createdAt || Date.now(),
      updatedAt: data?.updatedAt || Date.now(),
      version: data?.version || 1,
    };
    
    await this.db.table(this.tableName).add(entity);
    return entity;
  }
  
  async getEntity(nodeId: NodeId): Promise<GroupEntity | undefined> {
    return await this.db.table(this.tableName)
      .where('nodeId')
      .equals(nodeId)
      .first();
  }
  
  async updateEntity(nodeId: NodeId, data: Partial<GroupEntity>): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (!existing) throw new Error(`Entity not found: ${nodeId}`);
    
    await this.db.table(this.tableName).update(existing.id, {
      ...data,
      updatedAt: Date.now(),
      version: (existing.version || 0) + 1,
    });
  }
  
  async deleteEntity(nodeId: NodeId): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (existing) {
      await this.db.table(this.tableName).delete(existing.id);
    }
  }
  
  // Group-specific methods
  async createGroupEntity(nodeId: NodeId, groupEntityType: string, data: GroupEntity): Promise<void> {
    // Validate type is not empty
    if (!groupEntityType) {
      throw new Error('Group entity type is required');
    }
    await this.db.table(this.tableName).add(data);
  }
  
  async getGroupEntities(nodeId: NodeId, type?: string): Promise<GroupEntity[]> {
    let query = this.db.table(this.tableName).where('nodeId').equals(nodeId);
    const results = await query.toArray();
    
    if (type) {
      return results.filter((e: any) => e.type === type);
    }
    return results;
  }
  
  async getGroupEntity(entityId: EntityId): Promise<GroupEntity | undefined> {
    return await this.db.table(this.tableName).get(entityId);
  }
  
  async updateGroupEntity(entityId: EntityId, data: Partial<GroupEntity>): Promise<void> {
    await this.db.table(this.tableName).update(entityId, {
      ...data,
      updatedAt: Date.now(),
    });
  }
  
  async deleteGroupEntity(entityId: EntityId): Promise<void> {
    await this.db.table(this.tableName).delete(entityId);
  }
  
  async deleteGroupEntities(nodeId: NodeId, type?: string): Promise<void> {
    const entities = await this.getGroupEntities(nodeId, type);
    for (const entity of entities) {
      await this.deleteGroupEntity(entity.id);
    }
  }
}

describe('GroupEntityHandler', () => {
  let db: Dexie;
  let handler: TestGroupEntityHandler;
  const parentNodeId = 'parent-node-123' as NodeId;

  beforeEach(async () => {
    // Create in-memory database
    db = new Dexie('TestDB');
    db.version(1).stores({
      entities: '&id, nodeId, type, createdAt, updatedAt',
      workingCopies: 'workingCopyId, workingCopyOf, nodeId',
      subEntities: '&id, nodeId, type, createdAt, updatedAt',
    });

    await db.open();
    handler = new TestGroupEntityHandler(db, 'entities', 'workingCopies', 'subEntities');
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Basic Operations', () => {
    describe('createGroupEntity', () => {
      it('should create a group entity', async () => {
        const entityData: GroupEntity = {
          id: 'test-1' as EntityId,
          nodeId: parentNodeId,
          type: 'attachment',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };

        await handler.createGroupEntity(parentNodeId, 'attachment', entityData);

        const subEntities = await handler.getGroupEntities(parentNodeId, 'attachment');
        expect(subEntities).toHaveLength(1);
        expect(subEntities[0]?.nodeId).toBe(parentNodeId);
        expect(subEntities[0]?.type).toBe('attachment');
      });

      it('should validate group entity type', async () => {
        const entityData: GroupEntity = {
          id: 'invalid' as EntityId,
          nodeId: parentNodeId,
          type: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };

        await expect(
          handler.createGroupEntity(parentNodeId, '', entityData)
        ).rejects.toThrow('Group entity type is required');
      });
    });

    describe('getGroupEntities', () => {
      beforeEach(async () => {
        await handler.createGroupEntity(parentNodeId, 'attachment', {
          id: 'file-1' as EntityId,
          nodeId: parentNodeId,
          type: 'attachment',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });
        await handler.createGroupEntity(parentNodeId, 'comment', {
          id: 'comment-1' as EntityId,
          nodeId: parentNodeId,
          type: 'comment',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });
      });

      it('should get all sub-entities for a node', async () => {
        const allEntities = await handler.getGroupEntities(parentNodeId);
        expect(allEntities).toHaveLength(2);
      });

      it('should get sub-entities by type', async () => {
        const attachments = await handler.getGroupEntities(parentNodeId, 'attachment');
        expect(attachments).toHaveLength(1);
        expect(attachments[0]?.type).toBe('attachment');
      });

      it('should return empty array for node without sub-entities', async () => {
        const subEntities = await handler.getGroupEntities('empty-node' as NodeId);
        expect(subEntities).toHaveLength(0);
      });
    });

    describe('getGroupEntity', () => {
      let entityId: EntityId;

      beforeEach(async () => {
        entityId = 'test-entity-id' as EntityId;
        await handler.createGroupEntity(parentNodeId, 'attachment', {
          id: entityId,
          nodeId: parentNodeId,
          type: 'attachment',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });
      });

      it('should get a specific group entity by ID', async () => {
        const entity = await handler.getGroupEntity(entityId);
        expect(entity).toBeDefined();
        expect(entity?.id).toBe(entityId);
        expect(entity?.type).toBe('attachment');
      });

      it('should return undefined for non-existent group entity', async () => {
        const entity = await handler.getGroupEntity('non-existent' as EntityId);
        expect(entity).toBeUndefined();
      });
    });

    describe('updateGroupEntity', () => {
      let entityId: EntityId;

      beforeEach(async () => {
        entityId = 'update-test-id' as EntityId;
        await handler.createGroupEntity(parentNodeId, 'task', {
          id: entityId,
          nodeId: parentNodeId,
          type: 'task',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });
      });

      it('should update group entity fields', async () => {
        await handler.updateGroupEntity(entityId, {
          type: 'updated-task',
        });

        const updated = await handler.getGroupEntity(entityId);
        expect(updated?.type).toBe('updated-task');
      });
    });

    describe('deleteGroupEntity', () => {
      let entityId: EntityId;

      beforeEach(async () => {
        entityId = 'delete-test-id' as EntityId;
        await handler.createGroupEntity(parentNodeId, 'attachment', {
          id: entityId,
          nodeId: parentNodeId,
          type: 'attachment',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });
      });

      it('should delete a group entity', async () => {
        await handler.deleteGroupEntity(entityId);

        const deleted = await handler.getGroupEntity(entityId);
        expect(deleted).toBeUndefined();
      });

      it('should not throw for non-existent group entity', async () => {
        await expect(
          handler.deleteGroupEntity('non-existent' as EntityId)
        ).resolves.not.toThrow();
      });
    });

    describe('deleteGroupEntities', () => {
      beforeEach(async () => {
        await handler.createGroupEntity(parentNodeId, 'attachment', {
          id: 'attach-1' as EntityId,
          nodeId: parentNodeId,
          type: 'attachment',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });
        await handler.createGroupEntity(parentNodeId, 'attachment', {
          id: 'attach-2' as EntityId,
          nodeId: parentNodeId,
          type: 'attachment',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });
        await handler.createGroupEntity(parentNodeId, 'comment', {
          id: 'comment-1' as EntityId,
          nodeId: parentNodeId,
          type: 'comment',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });
      });

      it('should delete all sub-entities of a specific type', async () => {
        await handler.deleteGroupEntities(parentNodeId, 'attachment');

        const remainingAttachments = await handler.getGroupEntities(parentNodeId, 'attachment');
        const remainingComments = await handler.getGroupEntities(parentNodeId, 'comment');
        
        expect(remainingAttachments).toHaveLength(0);
        expect(remainingComments).toHaveLength(1);
        expect(remainingComments[0]?.type).toBe('comment');
      });
    });
  });
});