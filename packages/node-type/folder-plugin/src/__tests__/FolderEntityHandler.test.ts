import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { FolderEntityHandler } from '../handlers/FolderEntityHandler';
import type { FolderEntity } from '../types/index';
import type { FolderEntityExtended } from '../handlers/FolderEntityHandler';

describe('FolderEntityHandler', () => {
  let handler: FolderEntityHandler;
  let testNodeId: NodeId;

  beforeEach(() => {
    handler = new FolderEntityHandler();
    testNodeId = 'test-node-123' as NodeId;
  });

  afterEach(async () => {
    await handler.cleanup();
  });

  describe('createEntity', () => {
    it('should create a folder-plugin entity with default values', async () => {
      const entity = (await handler.createEntity(testNodeId, {})) as FolderEntityExtended;

      expect(entity.nodeId).toBe(testNodeId);
      expect(entity.name).toBe('New Folder');
      expect(entity.description).toBe('');
      expect(entity.settings?.allowNestedFolders).toBe(true);
      expect(entity.settings?.maxDepth).toBe(10);
      expect(entity.settings?.sortOrder).toBe('name');
      expect(entity.version).toBe(1);
    });

    it('should create a folder-plugin entity with custom data', async () => {
      const customData: Partial<FolderEntity> = {
        name: 'Custom Folder',
        description: 'A custom description',
        settings: {
          allowNestedFolders: false,
          maxDepth: 5,
          sortOrder: 'date',
        },
      };

      const entity = (await handler.createEntity(testNodeId, customData)) as FolderEntityExtended;

      expect(entity.name).toBe('Custom Folder');
      expect(entity.description).toBe('A custom description');
      expect(entity.settings?.allowNestedFolders).toBe(false);
      expect(entity.settings?.maxDepth).toBe(5);
      expect(entity.settings?.sortOrder).toBe('date');
    });
  });

  describe('search operations', () => {
    it('should search folders by name and description', async () => {
      await handler.createEntity('node1' as NodeId, {
        name: 'Important Documents',
        description: 'Contains important files',
      });
      await handler.createEntity('node2' as NodeId, {
        name: 'Photos',
        description: 'Family photos collection',
      });
      await handler.createEntity('node3' as NodeId, {
        name: 'Work Files',
        description: 'Important work documents',
      });

      const results = await handler.searchFolders('important');
      expect(results).toHaveLength(2);

      const names = results.map((r) => r.name);
      expect(names).toContain('Important Documents');
      expect(names).toContain('Work Files');
    });
  });
});
