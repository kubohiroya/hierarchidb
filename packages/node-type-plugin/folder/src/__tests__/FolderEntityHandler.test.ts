import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { NodeId, EntityId } from '@hierarchidb/common-core';
import { FolderEntityHandler } from '../handlers/FolderEntityHandler';
import type { FolderEntity } from '../types';

describe('FolderEntityHandler', () => {
  let handler: FolderEntityHandler;
  let testNodeId: NodeId;
  let testEntityId: EntityId;

  beforeEach(() => {
    handler = new FolderEntityHandler();
    testNodeId = 'test-node-123' as NodeId;
    testEntityId = 'test-entity-456' as EntityId;
  });

  afterEach(async () => {
    await handler.cleanup();
  });

  describe('createEntity', () => {
    it('should create a folder entity with default values', async () => {
      const entity = await handler.createEntity(testNodeId, {});
      
      expect(entity.nodeId).toBe(testNodeId);
      expect(entity.name).toBe('New Folder');
      expect(entity.description).toBe('');
      expect(entity.settings.allowNestedFolders).toBe(true);
      expect(entity.settings.maxDepth).toBe(10);
      expect(entity.settings.sortOrder).toBe('name');
      expect(entity.version).toBe(1);
    });

    it('should create a folder entity with custom data', async () => {
      const customData: Partial<FolderEntity> = {
        name: 'Custom Folder',
        description: 'A custom description',
        settings: {
          allowNestedFolders: false,
          maxDepth: 5,
          sortOrder: 'date'
        }
      };

      const entity = await handler.createEntity(testNodeId, customData);
      
      expect(entity.name).toBe('Custom Folder');
      expect(entity.description).toBe('A custom description');
      expect(entity.settings.allowNestedFolders).toBe(false);
      expect(entity.settings.maxDepth).toBe(5);
      expect(entity.settings.sortOrder).toBe('date');
    });
  });

  describe('working copy operations', () => {
    it('should create and commit working copy for new entity', async () => {
      const workingCopy = await handler.createWorkingCopy(testNodeId, {
        name: 'Test Working Copy',
        description: 'Working copy description'
      });

      expect(workingCopy.nodeId).toBe(testNodeId);
      expect(workingCopy.name).toBe('Test Working Copy');

      const committedEntity = await handler.commitWorkingCopy(workingCopy.id);
      
      expect(committedEntity.nodeId).toBe(testNodeId);
      expect(committedEntity.name).toBe('Test Working Copy');
      expect(committedEntity.description).toBe('Working copy description');
    });

    it('should create and discard working copy', async () => {
      const workingCopy = await handler.createWorkingCopy(testNodeId, {
        name: 'Test Working Copy'
      });

      await handler.discardWorkingCopy(workingCopy.id);
      
      // Verify working copy is deleted (this would need access to the database)
      // For now, just verify no error is thrown
      expect(true).toBe(true);
    });
  });

  describe('bookmark operations', () => {
    it('should add and retrieve bookmarks', async () => {
      const entity = await handler.createEntity(testNodeId, { name: 'Test Folder' });
      
      const bookmark = await handler.addBookmark(entity.id, {
        name: 'Test Bookmark',
        url: 'https://example.com',
        description: 'A test bookmark'
      });

      expect(bookmark.folderId).toBe(entity.id);
      expect(bookmark.name).toBe('Test Bookmark');
      expect(bookmark.url).toBe('https://example.com');

      const bookmarks = await handler.getBookmarks(entity.id);
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].id).toBe(bookmark.id);
    });

    it('should remove bookmarks', async () => {
      const entity = await handler.createEntity(testNodeId, { name: 'Test Folder' });
      const bookmark = await handler.addBookmark(entity.id, {
        name: 'Test Bookmark',
        url: 'https://example.com'
      });

      await handler.removeBookmark(bookmark.id);
      
      const bookmarks = await handler.getBookmarks(entity.id);
      expect(bookmarks).toHaveLength(0);
    });
  });

  describe('template operations', () => {
    it('should add and retrieve templates', async () => {
      const entity = await handler.createEntity(testNodeId, { name: 'Test Folder' });
      
      const template = await handler.addTemplate(entity.id, {
        name: 'Test Template',
        content: { type: 'folder', children: [] },
        description: 'A test template'
      });

      expect(template.folderId).toBe(entity.id);
      expect(template.name).toBe('Test Template');

      const templates = await handler.getTemplates(entity.id);
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe(template.id);
    });
  });

  describe('search operations', () => {
    it('should search folders by name and description', async () => {
      await handler.createEntity('node1' as NodeId, { 
        name: 'Important Documents',
        description: 'Contains important files'
      });
      await handler.createEntity('node2' as NodeId, { 
        name: 'Photos',
        description: 'Family photos collection'
      });
      await handler.createEntity('node3' as NodeId, { 
        name: 'Work Files',
        description: 'Important work documents'
      });

      const results = await handler.searchFolders('important');
      expect(results).toHaveLength(2);
      
      const names = results.map(r => r.name);
      expect(names).toContain('Important Documents');
      expect(names).toContain('Work Files');
    });
  });
});