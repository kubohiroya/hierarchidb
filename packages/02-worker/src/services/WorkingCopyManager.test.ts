/**
 * @file WorkingCopyManager.test.ts
 * @description Tests for WorkingCopyManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NodeId, PeerEntity, WorkingCopyProperties } from '@hierarchidb/00-core';
import type { EntityMetadata } from '@hierarchidb/00-core';
import Dexie from 'dexie';
import 'fake-indexeddb/auto';
import { WorkingCopyManager, WorkingCopySession } from './WorkingCopyManager';

// Test entity interface
interface TestEntity extends PeerEntity {
  nodeId: NodeId;
  name: string;
  description: string;
  data?: any;
}

describe('WorkingCopyManager', () => {
  let db: Dexie;
  let manager: WorkingCopyManager;
  const nodeId = 'test-node-1' as NodeId;

  beforeEach(async () => {
    // Create test database
    db = new Dexie('WorkingCopyTestDB');
    db.version(1).stores({
      entities: 'nodeId',
      workingCopies: 'nodeId, originalNodeId',
      relationalEntities: 'id, referenceCount',
    });

    await db.open();
    manager = new WorkingCopyManager(db);

    // Create test entity
    await db.table('entities').add({
      nodeId,
      name: 'Test Entity',
      description: 'Original Description',
      data: { value: 42 },
    });
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('create', () => {
    it('should create working copy from existing entity', async () => {
      const metadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'entities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
        workingCopyConfig: {
          enabled: true,
          tableName: 'workingCopies',
        },
      };

      const workingCopy = await manager.create<TestEntity>(nodeId, metadata);

      expect(workingCopy).toBeDefined();
      expect(workingCopy.nodeId).toBe(nodeId);
      expect(workingCopy.name).toBe('Test Entity');
      expect(workingCopy.description).toBe('Original Description');
      expect(workingCopy.originalNodeId).toBe(nodeId);
      expect(workingCopy.nodeId).toBeDefined();
      expect(workingCopy.copiedAt).toBeDefined();
      expect(workingCopy.hasEntityCopy).toBe(false);

      // Verify working copy is stored
      const stored = await db.table('workingCopies').get(workingCopy.nodeId);
      expect(stored).toBeDefined();
      expect(stored.originalNodeId).toBe(nodeId);
    });

    it('should throw error if original entity does not exist', async () => {
      const metadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'entities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
        workingCopyConfig: {
          enabled: true,
          tableName: 'workingCopies',
        },
      };

      await expect(
        manager.create<TestEntity>('non-existent' as NodeId, metadata)
      ).rejects.toThrow('Original entity not found: non-existent');
    });

    it('should throw error if working copy config is not enabled', async () => {
      const metadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'entities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
        // No working copy config
      };

      await expect(
        manager.create<TestEntity>(nodeId, metadata)
      ).rejects.toThrow('Working copy not enabled for this entity');
    });
  });

  describe('commit', () => {
    it('should commit working copy changes to main entity', async () => {
      const metadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'entities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
        workingCopyConfig: {
          enabled: true,
          tableName: 'workingCopies',
        },
      };

      // Create working copy
      const workingCopy = await manager.create<TestEntity>(nodeId, metadata);
      
      // Modify working copy
      workingCopy.description = 'Modified Description';
      workingCopy.data = { value: 100 };
      workingCopy.hasEntityCopy = true;

      // Create session
      const session = new WorkingCopySession(nodeId);
      session.addWorkingCopy(metadata.tableName, workingCopy);

      // Commit changes
      await manager.commit(session, metadata);

      // Verify main entity is updated
      const updatedEntity = await db.table('entities').get(nodeId);
      expect(updatedEntity.description).toBe('Modified Description');
      expect(updatedEntity.data.value).toBe(100);
      expect(updatedEntity.updatedAt).toBeDefined();

      // Verify working copy is deleted
      const deletedWorkingCopy = await db.table('workingCopies').get(workingCopy.nodeId);
      expect(deletedWorkingCopy).toBeUndefined();
    });

    it('should handle relational entity reference updates', async () => {
      // Setup relational entity
      await db.table('relationalEntities').add({
        id: 'shared-resource-1',
        referenceCount: 1,
        referencingNodeIds: ['other-node'],
      });

      const metadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'entities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
        workingCopyConfig: {
          enabled: true,
          tableName: 'workingCopies',
        },
      };

      const relationalMetadata: EntityMetadata = {
        entityType: 'relational',
        tableName: 'relationalEntities',
        relationship: {
          type: 'many-to-many',
          foreignKeyField: 'referencingNodeIds',
          cascadeDelete: false,
        },
        referenceManagement: {
          countField: 'referenceCount',
          nodeListField: 'referencingNodeIds',
          autoDeleteWhenZero: true,
        },
      };

      const workingCopy = await manager.create<TestEntity>(nodeId, metadata);
      
      const session = new WorkingCopySession(nodeId);
      session.addWorkingCopy(metadata.tableName, workingCopy);

      // Add reference to relational entity
      await manager.updateRelationalReference(
        'shared-resource-1',
        nodeId,
        'add',
        relationalMetadata
      );

      // Verify reference is added
      const relational = await db.table('relationalEntities').get('shared-resource-1');
      expect(relational.referenceCount).toBe(2);
      expect(relational.referencingNodeIds).toContain(nodeId);
    });

    it('should skip commit if no working copy in session', async () => {
      const metadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'entities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
        workingCopyConfig: {
          enabled: true,
          tableName: 'workingCopies',
        },
      };

      const session = new WorkingCopySession(nodeId);
      
      // Should not throw
      await expect(manager.commit(session, metadata)).resolves.toBeUndefined();
    });
  });

  describe('discard', () => {
    it('should discard working copy without updating main entity', async () => {
      const metadata: EntityMetadata = {
        entityType: 'peer',
        tableName: 'entities',
        relationship: {
          type: 'one-to-one',
          foreignKeyField: 'nodeId',
          cascadeDelete: true,
        },
        workingCopyConfig: {
          enabled: true,
          tableName: 'workingCopies',
        },
      };

      const workingCopy = await manager.create<TestEntity>(nodeId, metadata);
      workingCopy.description = 'Modified Description';

      const session = new WorkingCopySession(nodeId);
      session.addWorkingCopy(metadata.tableName, workingCopy);

      await manager.discard(session, metadata);

      // Verify main entity is unchanged
      const entity = await db.table('entities').get(nodeId);
      expect(entity.description).toBe('Original Description');

      // Verify working copy is deleted
      const deletedWorkingCopy = await db.table('workingCopies').get(workingCopy.nodeId);
      expect(deletedWorkingCopy).toBeUndefined();
    });
  });

  describe('updateRelationalReference', () => {
    beforeEach(async () => {
      await db.table('relationalEntities').add({
        id: 'resource-1',
        referenceCount: 1,
        referencingNodeIds: [nodeId],
      });
    });

    it('should add reference to relational entity', async () => {
      const metadata: EntityMetadata = {
        entityType: 'relational',
        tableName: 'relationalEntities',
        relationship: {
          type: 'many-to-many',
          foreignKeyField: 'referencingNodeIds',
          cascadeDelete: false,
        },
        referenceManagement: {
          countField: 'referenceCount',
          nodeListField: 'referencingNodeIds',
          autoDeleteWhenZero: true,
        },
      };

      await manager.updateRelationalReference(
        'resource-1',
        'new-node' as NodeId,
        'add',
        metadata
      );

      const resource = await db.table('relationalEntities').get('resource-1');
      expect(resource.referenceCount).toBe(2);
      expect(resource.referencingNodeIds).toContain('new-node');
    });

    it('should remove reference from relational entity', async () => {
      const metadata: EntityMetadata = {
        entityType: 'relational',
        tableName: 'relationalEntities',
        relationship: {
          type: 'many-to-many',
          foreignKeyField: 'referencingNodeIds',
          cascadeDelete: false,
        },
        referenceManagement: {
          countField: 'referenceCount',
          nodeListField: 'referencingNodeIds',
          autoDeleteWhenZero: false,
        },
      };

      await manager.updateRelationalReference(
        'resource-1',
        nodeId,
        'remove',
        metadata
      );

      const resource = await db.table('relationalEntities').get('resource-1');
      expect(resource.referenceCount).toBe(0);
      expect(resource.referencingNodeIds).not.toContain(nodeId);
    });

    it('should auto-delete relational entity when reference count reaches zero', async () => {
      const metadata: EntityMetadata = {
        entityType: 'relational',
        tableName: 'relationalEntities',
        relationship: {
          type: 'many-to-many',
          foreignKeyField: 'referencingNodeIds',
          cascadeDelete: false,
        },
        referenceManagement: {
          countField: 'referenceCount',
          nodeListField: 'referencingNodeIds',
          autoDeleteWhenZero: true,
        },
      };

      await manager.updateRelationalReference(
        'resource-1',
        nodeId,
        'remove',
        metadata
      );

      const resource = await db.table('relationalEntities').get('resource-1');
      expect(resource).toBeUndefined();
    });
  });
});

describe('WorkingCopySession', () => {
  const nodeId = 'test-node' as NodeId;

  it('should manage working copies for multiple tables', () => {
    const session = new WorkingCopySession(nodeId);
    
    const workingCopy1 = {
      nodeId: 'wc-1',
      workingCopyOf: nodeId,
    } as any;

    const workingCopy2 = {
      nodeId: 'wc-2',
      workingCopyOf: nodeId,
    } as any;

    session.addWorkingCopy('store1', workingCopy1);
    session.addWorkingCopy('store2', workingCopy2);

    expect(session.getWorkingCopy('store1')).toBe(workingCopy1);
    expect(session.getWorkingCopy('store2')).toBe(workingCopy2);
    expect(session.getTableNames()).toEqual(['store1', 'store2']);
  });

  it('should get primary working copy', () => {
    const session = new WorkingCopySession(nodeId);
    
    const primaryCopy = {
      nodeId,
      id: 'primary',
      entityType: 'peer',
    } as any;

    const secondaryCopy = {
      nodeId: 'secondary',
      entityType: 'group',
    } as any;

    session.addWorkingCopy('primary', primaryCopy);
    session.addWorkingCopy('secondary', secondaryCopy);

    expect(session.getPrimaryWorkingCopy()).toBe(primaryCopy);
  });

  it('should clear all working copies', () => {
    const session = new WorkingCopySession(nodeId);
    
    session.addWorkingCopy('store1', {} as any);
    session.addWorkingCopy('store2', {} as any);
    
    session.clear();
    
    expect(session.getTableNames()).toEqual([]);
    expect(session.getWorkingCopy('store1')).toBeUndefined();
  });
});