import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { NodeId } from '@hierarchidb/common-core';
import { FolderEntityManager } from '../handlers/FolderEntityManager';
import { FolderDefinition } from '../definitions/FolderDefinition';

describe('Folder Plugin Integration', () => {
  let manager: FolderEntityManager;
  let testNodeId: NodeId;

  beforeEach(() => {
    manager = FolderEntityManager.getInstance();
    testNodeId = 'integration-test-node' as NodeId;
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe('End-to-End Workflow', () => {
    it('should complete full folder lifecycle', async () => {
      // 1. Create folder
      const folder = await manager.createFolder(testNodeId, {
        name: 'Project Folder',
        description: 'Main project folder'
      });

      expect(folder.name).toBe('Project Folder');
      expect(folder.nodeId).toBe(testNodeId);

      // 2. Add bookmarks
      const bookmark1 = await manager.addBookmark(testNodeId, {
        name: 'GitHub Repo',
        url: 'https://github.com/project/repo',
        description: 'Main repository',
        type: 'group',
        nodeId: testNodeId,
        groupId: 'bookmark-group-1',
        version: 1,
        updatedAt: Date.now()
      });

      const bookmark2 = await manager.addBookmark(testNodeId, {
        name: 'Documentation',
        url: 'https://docs.project.com',
        description: 'Project documentation',
        type: 'group',
        nodeId: testNodeId,
        groupId: 'bookmark-group-2',
        version: 1,
        updatedAt: Date.now()
      });

      const bookmarks = await manager.getBookmarks(testNodeId);
      expect(bookmarks).toHaveLength(2);

      // 3. Add template
      const template = await manager.addTemplate(testNodeId, {
        name: 'Project Structure',
        content: {
          type: 'folder',
          children: [
            { name: 'src', type: 'folder' },
            { name: 'docs', type: 'folder' },
            { name: 'tests', type: 'folder' }
          ]
        },
        description: 'Standard project structure',
        type: 'group',
        nodeId: testNodeId,
        groupId: 'template-group-1',
        version: 1,
        updatedAt: Date.now()
      });

      const templates = await manager.getTemplates(testNodeId);
      expect(templates).toHaveLength(1);
      expect(templates[0]?.name).toBe('Project Structure');

      // 4. Create working copy and modify
      const workingCopy = await manager.createWorkingCopy(testNodeId);

      const updatedWorkingCopy = await manager.updateWorkingCopy(workingCopy.id, {
        name: 'Final Project Folder',
        description: 'Updated description'
      });

      expect(updatedWorkingCopy.name).toBe('Final Project Folder');

      // 5. Commit working copy
      await manager.commitWorkingCopy(testNodeId, updatedWorkingCopy);
      const updatedFolder = await manager.getFolder(testNodeId);
      expect(updatedFolder?.name).toBe('Final Project Folder');
      expect(updatedFolder?.description).toBe('Updated description');

      // 6. Search functionality
      const searchResults = await manager.searchFolders('project');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0]?.id).toBe(folder.id);

      // 7. Cleanup
      await manager.removeBookmark(bookmark1.id);
      await manager.removeTemplate(template.id);
      
      const finalBookmarks = await manager.getBookmarks(testNodeId);
      expect(finalBookmarks).toHaveLength(1);
      expect(finalBookmarks[0]?.id).toBe(bookmark2.id);

      const finalTemplates = await manager.getTemplates(testNodeId);
      expect(finalTemplates).toHaveLength(0);
    });

    it('should handle working copy workflow correctly', async () => {
      // Create original folder
      const originalFolder = await manager.createFolder(testNodeId, {
        name: 'Original Folder',
        description: 'Original description'
      });

      // Create working copy from existing folder
      const workingCopy = await manager.createWorkingCopy(testNodeId);

      // Update working copy
      const updatedWorkingCopy = await manager.updateWorkingCopy(workingCopy.id, {
        name: 'First Update',
        description: 'Second update description'
      });
      await manager.commitWorkingCopy(testNodeId, updatedWorkingCopy);
      const finalFolder = await manager.getFolder(testNodeId);
      
      expect(finalFolder?.id).toBe(originalFolder.id); // Same entity, updated
      expect(finalFolder?.name).toBe('First Update');
      expect(finalFolder?.description).toBe('Second update description');
      expect(finalFolder?.version).toBe(originalFolder.version + 1);
    });
  });

  describe('Plugin Definition', () => {
    it('should have correct plugin configuration', () => {
      expect(FolderDefinition.nodeType).toBe('folder');
      expect(FolderDefinition.database.entityStore).toBe('folders');
      expect(FolderDefinition.database.version).toBe(1);
      expect(FolderDefinition.entityHandler).toBeDefined();
      expect(FolderDefinition.lifecycle.afterCreate).toBeDefined();
      expect(FolderDefinition.lifecycle.beforeDelete).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent entity operations gracefully', async () => {
      const nonExistentId = 'non-existent-id' as any;
      
      await expect(manager.getFolder(nonExistentId)).resolves.toBeUndefined();
      
      await expect(manager.updateFolder(nonExistentId, { name: 'Test' }))
        .rejects.toThrow('not found');
      
      // commitWorkingCopy requires a working copy object, not just an ID
      const dummyWorkingCopy = { id: nonExistentId, nodeId: nonExistentId } as any;
      await expect(manager.commitWorkingCopy(nonExistentId, dummyWorkingCopy))
        .rejects.toThrow('not found');
    });
  });
});