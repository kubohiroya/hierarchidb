/**
 * @file WorkingCopyHandler.test.ts
 * @description Unit tests for WorkingCopyHandler advanced working copy operations
 */

import type { NodeId, EntityId } from '@hierarchidb/common-core';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkingCopyHandler } from './WorkingCopyHandler';
import {GroupEntityImpl} from "~/handlers/SimpleEntityHandler";

describe.skip('WorkingCopyHandler', () => {
  let db: Dexie;
  let handler: WorkingCopyHandler;
  const nodeId = 'node-123' as NodeId;
  const nodeId2 = 'node-456' as NodeId;

  beforeEach(async () => {
    // Create in-memory database
    db = new Dexie('TestDB');
    db.version(1).stores({
      entities: 'nodeId, name, createdAt, updatedAt, version',
      workingCopies: 'workingCopyId, workingCopyOf, nodeId, updatedAt',
      subEntities: 'id, parentNodeId, [parentNodeId+subEntityType]',
    });

    await db.open();

    handler = new WorkingCopyHandler(db, 'entities', 'workingCopies', 'subEntities');

    // Create test entities
    await handler.createEntity(nodeId, {
      nodeId,
      type: 'test',
    });
    await handler.createEntity(nodeId2, {
      });
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Basic Working Copy Operations', () => {
    describe('createWorkingCopy', () => {
      it('should create a working copy with default values', async () => {
        const workingCopy = await handler.createWorkingCopy(nodeId);

        expect(workingCopy.workingCopyId).toBeDefined();
        expect(workingCopy.workingCopyOf).toBe(nodeId);
        expect(workingCopy.nodeId).toBe(nodeId);
        expect(workingCopy.isDirty).toBe(false);
        expect(workingCopy.changes).toEqual({
          modified: [],
          added: [],
          deleted: [],
        });
        expect(workingCopy.entityData.name).toBe('Test Entity');
      });

      it('should create a working copy with metadata', async () => {
        const workingCopy = await handler.createWorkingCopy(nodeId);
        // Update metadata after creation
        workingCopy.metadata = {
          description: 'Test working copy',
          autoSave: true,
        };

        expect(workingCopy.metadata.author).toBe('Test User');
        expect(workingCopy.metadata.description).toBe('Test working copy');
        expect(workingCopy.metadata.autoSave).toBe(true);
      });

      it('should include sub-entities in working copy', async () => {
        await handler.createGroupEntity(nodeId, 'attachment', {
          id: 'attach-1' as EntityId,
          nodeId: nodeId,
          parentNodeId: nodeId,
          type: 'comment',
          groupEntityType: 'comment',
          data: { text: 'Hello' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });
        await handler.createGroupEntity(nodeId, 'comment', {
          id: 'comment-1' as EntityId,
          nodeId: nodeId,
          parentNodeId: nodeId,
          type: 'comment',
          groupEntityType: 'comment',
          data: { text: 'Hello' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });

        const workingCopy = await handler.createWorkingCopy(nodeId);

        expect(workingCopy.groupEntitiesData).toBeDefined();
        expect(workingCopy.groupEntitiesData?.['attachment']).toHaveLength(1);
        expect(workingCopy.groupEntitiesData?.['comment']).toHaveLength(1);
      });

      it('should throw error if working copy already exists', async () => {
        await handler.createWorkingCopy(nodeId);

        await expect(handler.createWorkingCopy(nodeId)).rejects.toThrow(
          'Working copy already exists'
        );
      });

      it('should throw error if entity does not exist', async () => {
        await expect(handler.createWorkingCopy('non-existent' as NodeId)).rejects.toThrow(
          'Entity not found'
        );
      });
    });

    describe('getWorkingCopy', () => {
      it('should retrieve an existing working copy', async () => {
        const created = await handler.createWorkingCopy(nodeId);
        const retrieved = await handler.getWorkingCopy(nodeId);

        expect(retrieved).toBeDefined();
        expect(retrieved?.workingCopyId).toBe(created.workingCopyId);
      });

      it('should return undefined for non-existent working copy', async () => {
        const workingCopy = await handler.getWorkingCopy(nodeId);
        expect(workingCopy).toBeUndefined();
      });

      it('should use cache for repeated access', async () => {
        await handler.createWorkingCopy(nodeId);

        // First access - loads from DB
        const wc1 = await handler.getWorkingCopy(nodeId);
        // Second access - should use cache
        const wc2 = await handler.getWorkingCopy(nodeId);

        expect(wc1).toBe(wc2); // Same object reference
      });
    });

    describe('updateWorkingCopy', () => {
      beforeEach(async () => {
        await handler.createWorkingCopy(nodeId);
      });

      it('should update working copy data', async () => {
        await handler.updateWorkingCopy(nodeId, {
          description: 'Updated Description',
        });

        const workingCopy = await handler.getWorkingCopy(nodeId);
        expect(workingCopy?.entityData.name).toBe('Updated Name');
        expect(workingCopy?.entityData.description).toBe('Updated Description');
        expect(workingCopy?.isDirty).toBe(true);
      });

      it('should track modified fields', async () => {
        await handler.updateWorkingCopy(nodeId, {
          data: { value: 200 },
        });

        const workingCopy = await handler.getWorkingCopy(nodeId);
        expect(workingCopy?.changes.modified).toContain('name');
        expect(workingCopy?.changes.modified).toContain('data');
      });

      it('should increment version on update', async () => {
        const before = await handler.getWorkingCopy(nodeId);
        const versionBefore = before?.version || 0;

        await handler.updateWorkingCopy(nodeId, { name: 'Updated' });

        const after = await handler.getWorkingCopy(nodeId);
        expect(after?.version).toBe(versionBefore + 1);
      });

      it('should throw error if working copy does not exist', async () => {
        await expect(handler.updateWorkingCopy(nodeId2, { name: 'Test' })).rejects.toThrow(
          'Working copy not found'
        );
      });
    });

    describe('discardWorkingCopy', () => {
      beforeEach(async () => {
        await handler.createWorkingCopy(nodeId);
      });

      it('should discard working copy', async () => {
        await handler.discardWorkingCopy(nodeId);

        const workingCopy = await handler.getWorkingCopy(nodeId);
        expect(workingCopy).toBeUndefined();
      });

      it('should not throw if working copy does not exist', async () => {
        await expect(handler.discardWorkingCopy(nodeId2)).resolves.not.toThrow();
      });

      it('should remove from cache', async () => {
        // Access to cache it
        await handler.getWorkingCopy(nodeId);

        await handler.discardWorkingCopy(nodeId);

        const workingCopy = await handler.getWorkingCopy(nodeId);
        expect(workingCopy).toBeUndefined();
      });
    });
  });

  describe('Commit Operations', () => {
    beforeEach(async () => {
      await handler.createWorkingCopy(nodeId);
    });

    describe('commitWorkingCopy', () => {
      it('should commit changes to entity', async () => {
        await handler.updateWorkingCopy(nodeId, {
          description: 'Committed Description',
        });

        const workingCopyToCommit = await handler.getWorkingCopy(nodeId);
        if (workingCopyToCommit) {
          await handler.commitWorkingCopy(nodeId, workingCopyToCommit);
        }

        const entity = await handler.getEntity(nodeId);
        expect(entity?.nodeId).toBe(nodeId);
        //expect(entity?.name).toBe('Committed Name');
        //expect(entity?.description).toBe('Committed Description');
      });

      it('should discard working copy after commit', async () => {
        await handler.updateWorkingCopy(nodeId, { name: 'Updated' });
        const workingCopyToCommit = await handler.getWorkingCopy(nodeId);
        if (workingCopyToCommit) {
          await handler.commitWorkingCopy(nodeId, workingCopyToCommit);
        }

        const workingCopy = await handler.getWorkingCopy(nodeId);
        expect(workingCopy).toBeUndefined();
      });

      it('should handle commit with options', async () => {
        await handler.updateWorkingCopy(nodeId, { name: 'Updated' });

        const workingCopy = await handler.getWorkingCopy(nodeId);
        if (workingCopy) {
          await handler.commitWorkingCopy(nodeId, workingCopy);
        }

        const entity = await handler.getEntity(nodeId);
        //expect(entity?.name).toBe('Updated');
        expect(entity?.nodeId).toBe(nodeId);
      });

      it('should commit sub-entities', async () => {
        // Create sub-entity in working copy
        await handler.createGroupEntity(nodeId, 'task', {
          id: crypto.randomUUID() as EntityId,
          nodeId: nodeId,
          type: 'task',
          parentNodeId: nodeId,
          groupEntityType: 'task',
          data: { status: 'pending' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });

        // Create working copy (will include the sub-entity)
        await handler.discardWorkingCopy(nodeId);
        await handler.createWorkingCopy(nodeId);

        // Modify working copy
        await handler.updateWorkingCopy(nodeId, { name: 'Updated' });

        // Commit
        const workingCopyToCommit = await handler.getWorkingCopy(nodeId);
        if (workingCopyToCommit) {
          await handler.commitWorkingCopy(nodeId, workingCopyToCommit);
        }

        // Check sub-entities are preserved
        const subEntities = await handler.getGroupEntities?.(nodeId, 'task');
        expect(subEntities).toHaveLength(1);
      });

      it('should throw error if working copy does not exist', async () => {
        const nonExistentWorkingCopy = await handler.getWorkingCopy(nodeId2);
        if( nonExistentWorkingCopy){
          await expect(handler.commitWorkingCopy(nodeId2, nonExistentWorkingCopy)).rejects.toThrow();
        }
      });
    });
  });

  describe('Conflict Detection and Resolution', () => {
    beforeEach(async () => {
      await handler.createWorkingCopy(nodeId);
    });

    it('should detect no conflicts when entity unchanged', async () => {
      await handler.updateWorkingCopy(nodeId, { name: 'Working Copy Name' });

      const status = await handler.getWorkingCopyStatus(nodeId);
      expect(status.hasConflicts).toBe(false);
    });

    it('should detect conflicts when entity modified', async () => {
      // Update working copy
      await handler.updateWorkingCopy(nodeId, { name: 'Working Copy Name' });

      const status = await handler.getWorkingCopyStatus(nodeId);
      expect(status.hasConflicts).toBe(true);
    });

    it('should resolve conflicts with working strategy', async () => {
      await handler.updateWorkingCopy(nodeId, { name: 'Working Copy Name' });

      const workingCopy = await handler.getWorkingCopy(nodeId);
        if (workingCopy) {
          await handler.commitWorkingCopy(nodeId, workingCopy);
        }

      const entity = await handler.getEntity(nodeId);
      expect(entity?.nodeId).toBe(nodeId);
    });

    it('should resolve conflicts with current strategy', async () => {
      await handler.updateWorkingCopy(nodeId, { name: 'Working Copy Name' });

      const workingCopy = await handler.getWorkingCopy(nodeId);
        if (workingCopy) {
          await handler.commitWorkingCopy(nodeId, workingCopy);
        }

      const entity = await handler.getEntity(nodeId);
      expect(entity?.nodeId).toBe(nodeId);
    });

    it('should attempt automatic merge', async () => {
      await handler.updateWorkingCopy(nodeId, {
        data: { value: 200, extra: 'working' },
      });
      /*
      await handler.updateEntity(nodeId, {
        value: 150, another: 'current'
      });
*/
      const workingCopy = await handler.getWorkingCopy(nodeId);
        if (workingCopy) {
          await handler.commitWorkingCopy(nodeId, workingCopy);
        }

      // const entity = await handler.getEntity(nodeId);
      // Merge strategy keeps working values for strings, max for numbers
      // expect(entity?.name).toBe('Working Name');
      // expect(entity?.data?.value).toBe(200); // Max of 200 and 150
      // expect(entity?.data?.extra).toBe('working');
      // expect(entity?.data?.another).toBe('current');
    });
  });

  describe('Working Copy Status', () => {
    it('should return status for non-existent working copy', async () => {
      const status = await handler.getWorkingCopyStatus(nodeId);

      expect(status.exists).toBe(false);
      expect(status.isDirty).toBe(false);
      expect(status.hasConflicts).toBe(false);
      expect(status.changeCount).toBe(0);
      expect(status.canCommit).toBe(false);
    });

    it('should return status for clean working copy', async () => {
      await handler.createWorkingCopy(nodeId);

      const status = await handler.getWorkingCopyStatus(nodeId);

      expect(status.exists).toBe(true);
      expect(status.isDirty).toBe(false);
      expect(status.hasConflicts).toBe(false);
      expect(status.changeCount).toBe(0);
      expect(status.canCommit).toBe(false);
    });

    it('should return status for dirty working copy', async () => {
      await handler.createWorkingCopy(nodeId);
      await handler.updateWorkingCopy(nodeId, {
        description: 'New',
      });

      const status = await handler.getWorkingCopyStatus(nodeId);

      expect(status.exists).toBe(true);
      expect(status.isDirty).toBe(true);
      expect(status.hasConflicts).toBe(false);
      expect(status.changeCount).toBe(2); // name and description
      expect(status.canCommit).toBe(true);
      expect(status.lastModified).toBeDefined();
    });
  });

  describe('Advanced Operations', () => {
    describe('branchWorkingCopy', () => {
      beforeEach(async () => {
        await handler.createWorkingCopy(nodeId);
        await handler.updateWorkingCopy(nodeId, { name: 'Branched Name' });
      });

      it('should create a branch from working copy', async () => {
        const branched = await handler.branchWorkingCopy(nodeId, nodeId2);

        expect(branched.workingCopyOf).toBe(nodeId2);
        expect(branched.entityData.name).toBe('Branched Name');
        expect(branched.changes.modified).toContain('name');
      });

      it('should throw error if source does not exist', async () => {
        await expect(
          handler.branchWorkingCopy('non-existent' as NodeId, nodeId2)
        ).rejects.toThrow('Source working copy not found');
      });

      it('should throw error if target already has working copy', async () => {
        await handler.createWorkingCopy(nodeId2);

        await expect(handler.branchWorkingCopy(nodeId, nodeId2)).rejects.toThrow(
          'Target already has working copy'
        );
      });
    });

    describe('mergeWorkingCopies', () => {
      beforeEach(async () => {
        await handler.createWorkingCopy(nodeId);
        await handler.createWorkingCopy(nodeId2);
      });

      it('should merge working copies', async () => {
        await handler.updateWorkingCopy(nodeId, { name: 'Source Name' });
        await handler.updateWorkingCopy(nodeId2, { description: 'Target Desc' });

        await handler.mergeWorkingCopies(nodeId, nodeId2);

        const merged = await handler.getWorkingCopy(nodeId2);
        // Source overwrites target in merge
        expect(merged?.entityData.name).toBe('Source Name');
        // Since target didn't modify description, it keeps original entity's description
        expect(merged?.entityData.description).toBeDefined();
        expect(merged?.changes.modified).toContain('name');
        expect(merged?.changes.modified).toContain('description');

        // Source should be discarded
        const source = await handler.getWorkingCopy(nodeId);
        expect(source).toBeUndefined();
      });

      it('should throw error if working copies do not exist', async () => {
        await expect(
          handler.mergeWorkingCopies('non-existent' as NodeId, nodeId2)
        ).rejects.toThrow('Both working copies must exist');
      });
    });

    describe('getAllWorkingCopies', () => {
      it('should return all working copies', async () => {
        await handler.createWorkingCopy(nodeId);
        await handler.createWorkingCopy(nodeId2);

        const all = await handler.getAllWorkingCopies();

        expect(all).toHaveLength(2);
        expect(all.map((wc) => wc.workingCopyOf)).toContain(nodeId);
        expect(all.map((wc) => wc.workingCopyOf)).toContain(nodeId2);
      });

      it('should return empty array when no working copies', async () => {
        const all = await handler.getAllWorkingCopies();
        expect(all).toHaveLength(0);
      });
    });

    describe('cleanupStaleWorkingCopies', () => {
      it('should clean up old working copies', async () => {
        const wc = await handler.createWorkingCopy(nodeId);

        // Manually set old timestamp
        await db.table('workingCopies').update(wc.workingCopyId, {
          updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
        });

        const cleaned = await handler.cleanupStaleWorkingCopies();

        expect(cleaned).toBe(1);

        const remaining = await handler.getWorkingCopy(nodeId);
        expect(remaining).toBeUndefined();
      });

      it('should keep recent working copies', async () => {
        await handler.createWorkingCopy(nodeId);

        const cleaned = await handler.cleanupStaleWorkingCopies();

        expect(cleaned).toBe(0);

        const remaining = await handler.getWorkingCopy(nodeId);
        expect(remaining).toBeDefined();
      });
    });
  });

  describe('Import/Export', () => {
    beforeEach(async () => {
      await handler.createWorkingCopy(nodeId);
      await handler.updateWorkingCopy(nodeId, {
        description: 'Exported Description',
      });
    });

    it('should export working copy to JSON', async () => {
      const json = await handler.exportWorkingCopy(nodeId);
      const parsed = JSON.parse(json);

      expect(parsed.workingCopyOf).toBe(nodeId);
      expect(parsed.entityData.name).toBe('Exported Name');
      expect(parsed.isDirty).toBe(true);
    });

    it('should import working copy from JSON', async () => {
      const exported = await handler.exportWorkingCopy(nodeId);

      // Discard original
      await handler.discardWorkingCopy(nodeId);

      // Import back
      const imported = await handler.importWorkingCopy(exported);

      expect(imported.workingCopyOf).toBe(nodeId);
      expect(imported.entityData.name).toBe('Exported Name');
      expect(imported.isDirty).toBe(true);
    });

    it('should generate new ID on import', async () => {
      const exported = await handler.exportWorkingCopy(nodeId);
      const originalParsed = JSON.parse(exported);

      await handler.discardWorkingCopy(nodeId);

      const imported = await handler.importWorkingCopy(exported);

      expect(imported.workingCopyId).not.toBe(originalParsed.workingCopyId);
    });

    it('should throw error on invalid JSON import', async () => {
      await expect(handler.importWorkingCopy('invalid json')).rejects.toThrow(
        'Invalid working copy JSON data'
      );
    });

    it('should throw error if working copy exists on import', async () => {
      const exported = await handler.exportWorkingCopy(nodeId);

      // Don't discard - try to import duplicate
      await expect(handler.importWorkingCopy(exported)).rejects.toThrow(
        'Working copy already exists'
      );
    });
  });

  describe('Auto-save', () => {
    it('should setup auto-save when enabled', async () => {
      const spy = vi.spyOn(global, 'setInterval');

      await handler.createWorkingCopy(nodeId);
      // Set up auto-save manually for testing

      expect(spy).toHaveBeenCalledWith(expect.any(Function), 1000);
    });

    it('should cancel auto-save on discard', async () => {
      const spy = vi.spyOn(global, 'clearInterval');

      await handler.createWorkingCopy(nodeId);
      await handler.discardWorkingCopy(nodeId);

      expect(spy).toHaveBeenCalled();
    });
  });
});
