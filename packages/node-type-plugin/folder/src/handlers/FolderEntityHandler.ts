import type { NodeId, EntityId } from '@hierarchidb/common-core';

import type { FolderEntity, FolderEntityWorkingCopy, FolderBookmark, FolderTemplate } from '../types/index';
import { FolderDatabase } from '../database/FolderDatabase';

export class FolderEntityHandler {
  public folderDB: FolderDatabase;

  constructor() {
    this.folderDB = new FolderDatabase();
  }

  async createEntity(nodeId: NodeId, data?: Partial<FolderEntity>): Promise<FolderEntity> {
    const entityId = crypto.randomUUID() as EntityId;
    const now = Date.now();
    
    const entity: FolderEntity = {
      id: entityId,
      nodeId,
      name: data?.name || 'New Folder',
      description: data?.description || '',
      settings: data?.settings || {
        allowNestedFolders: true,
        maxDepth: 10,
        sortOrder: 'name'
      },
      metadata: data?.metadata || {},
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await this.folderDB.folders.add(entity);
    return entity;
  }

  async getEntity(nodeId: NodeId): Promise<FolderEntity | undefined> {
    return await this.folderDB.folders.where('nodeId').equals(nodeId).first();
  }

  async updateEntity(nodeId: NodeId, data: Partial<FolderEntity>): Promise<void> {
    const existing = await this.getEntity(nodeId);
    if (!existing) {
      throw new Error(`Folder entity for node ${nodeId} not found`);
    }

    const updated: FolderEntity = {
      ...existing,
      ...data,
      id: existing.id,
      nodeId: existing.nodeId,
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    await this.folderDB.folders.put(updated);
  }

  async deleteEntity(nodeId: NodeId): Promise<void> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      return; // Already deleted
    }

    await this.folderDB.transaction('rw', this.folderDB.folders, this.folderDB.bookmarks, this.folderDB.templates, async () => {
      await this.folderDB.folders.delete(entity.id);
      await this.folderDB.bookmarks.where('folderId').equals(entity.id).delete();
      await this.folderDB.templates.where('folderId').equals(entity.id).delete();
    });
  }

  async createWorkingCopy(nodeId: NodeId): Promise<FolderEntityWorkingCopy> {
    const entity = await this.getEntity(nodeId);
    const workingCopyId = crypto.randomUUID() as EntityId;
    const now = Date.now();

    const workingCopy: FolderEntityWorkingCopy = entity ? {
      id: workingCopyId,
      nodeId,
      name: entity.name,
      description: entity.description,
      settings: entity.settings,
      metadata: entity.metadata,
      createdAt: now,
      updatedAt: now,
      version: entity.version,
      copiedAt: now,
      originalNodeId: nodeId,
      originalVersion: entity.version,
    } : {
      id: workingCopyId,
      nodeId,
      name: 'New Folder',
      description: '',
      settings: {
        allowNestedFolders: true,
        maxDepth: 10,
        sortOrder: 'name'
      },
      metadata: {},
      createdAt: now,
      updatedAt: now,
      version: 1,
      copiedAt: now,
    };

    await this.folderDB.workingCopies.add(workingCopy);
    return workingCopy;
  }

  async commitWorkingCopy(nodeId: NodeId, workingCopy: FolderEntityWorkingCopy): Promise<void> {
    const existingEntity = await this.getEntity(nodeId);
    
    if (existingEntity) {
      await this.updateEntity(nodeId, {
        name: workingCopy.name,
        description: workingCopy.description,
        settings: workingCopy.settings,
        metadata: workingCopy.metadata,
      });
    } else {
      await this.createEntity(nodeId, workingCopy);
    }

    await this.folderDB.workingCopies.delete(workingCopy.id);
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    const workingCopy = await this.folderDB.workingCopies.where('nodeId').equals(nodeId).first();
    if (workingCopy) {
      await this.folderDB.workingCopies.delete(workingCopy.id);
    }
  }

  async cleanup(nodeId: NodeId): Promise<void> {
    await this.discardWorkingCopy(nodeId);
    await this.folderDB.cleanupExpiredWorkingCopies();
  }

  // Additional methods for folder-specific functionality
  async updateWorkingCopy(workingCopyId: EntityId, updates: Partial<FolderEntityWorkingCopy>): Promise<FolderEntityWorkingCopy> {
    const existing = await this.folderDB.workingCopies.get(workingCopyId);
    if (!existing) {
      throw new Error(`Working copy ${workingCopyId} not found`);
    }

    const updated: FolderEntityWorkingCopy = {
      ...existing,
      ...updates,
      id: workingCopyId,
      updatedAt: Date.now(),
    };

    await this.folderDB.workingCopies.put(updated);
    return updated;
  }

  async addBookmark(nodeId: NodeId, bookmark: Omit<FolderBookmark, 'id' | 'folderId' | 'createdAt'>): Promise<FolderBookmark> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Folder entity for node ${nodeId} not found`);
    }

    const bookmarkId = crypto.randomUUID() as EntityId;
    const newBookmark: FolderBookmark = {
      id: bookmarkId,
      folderId: entity.id,
      ...bookmark,
      createdAt: Date.now(),
    };

    await this.folderDB.bookmarks.add(newBookmark);
    return newBookmark;
  }

  async removeBookmark(bookmarkId: EntityId): Promise<void> {
    await this.folderDB.bookmarks.delete(bookmarkId);
  }

  async getBookmarks(nodeId: NodeId): Promise<FolderBookmark[]> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      return [];
    }
    return await this.folderDB.bookmarks.where('folderId').equals(entity.id).toArray();
  }

  async addTemplate(nodeId: NodeId, template: Omit<FolderTemplate, 'id' | 'folderId' | 'createdAt'>): Promise<FolderTemplate> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      throw new Error(`Folder entity for node ${nodeId} not found`);
    }

    const templateId = crypto.randomUUID() as EntityId;
    const newTemplate: FolderTemplate = {
      id: templateId,
      folderId: entity.id,
      ...template,
      createdAt: Date.now(),
    };

    await this.folderDB.templates.add(newTemplate);
    return newTemplate;
  }

  async removeTemplate(templateId: EntityId): Promise<void> {
    await this.folderDB.templates.delete(templateId);
  }

  async getTemplates(nodeId: NodeId): Promise<FolderTemplate[]> {
    const entity = await this.getEntity(nodeId);
    if (!entity) {
      return [];
    }
    return await this.folderDB.templates.where('folderId').equals(entity.id).toArray();
  }

  async searchFolders(query: string): Promise<FolderEntity[]> {
    const lowerQuery = query.toLowerCase();
    return await this.folderDB.folders
      .filter(folder => 
        folder.name.toLowerCase().includes(lowerQuery) ||
        folder.description.toLowerCase().includes(lowerQuery)
      )
      .toArray();
  }
}