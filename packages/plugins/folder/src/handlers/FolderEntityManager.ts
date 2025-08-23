import type { NodeId, EntityId } from '@hierarchidb/00-core';
import type { FolderEntity, FolderEntityWorkingCopy, FolderBookmark, FolderTemplate } from '../types/index';
import { FolderEntityHandler } from './FolderEntityHandler';

export class FolderEntityManager {
  private static instance: FolderEntityManager;
  private handler: FolderEntityHandler;

  private constructor() {
    this.handler = new FolderEntityHandler();
  }

  static getInstance(): FolderEntityManager {
    if (!FolderEntityManager.instance) {
      FolderEntityManager.instance = new FolderEntityManager();
    }
    return FolderEntityManager.instance;
  }

  async createFolder(nodeId: NodeId, data?: Partial<FolderEntity>): Promise<FolderEntity> {
    return this.handler.createEntity(nodeId, data);
  }

  async updateFolder(nodeId: NodeId, updates: Partial<FolderEntity>): Promise<void> {
    return this.handler.updateEntity(nodeId, updates);
  }

  async deleteFolder(nodeId: NodeId): Promise<void> {
    return this.handler.deleteEntity(nodeId);
  }

  async getFolder(nodeId: NodeId): Promise<FolderEntity | undefined> {
    return this.handler.getEntity(nodeId);
  }

  async getFolderByNodeId(nodeId: NodeId): Promise<FolderEntity | undefined> {
    return this.handler.getEntity(nodeId);
  }

  async createWorkingCopy(nodeId: NodeId): Promise<FolderEntityWorkingCopy> {
    return this.handler.createWorkingCopy(nodeId);
  }

  async updateWorkingCopy(workingCopyId: EntityId, updates: Partial<FolderEntityWorkingCopy>): Promise<FolderEntityWorkingCopy> {
    return this.handler.updateWorkingCopy(workingCopyId, updates);
  }

  async commitWorkingCopy(nodeId: NodeId, workingCopy: FolderEntityWorkingCopy): Promise<void> {
    return this.handler.commitWorkingCopy(nodeId, workingCopy);
  }

  async discardWorkingCopy(nodeId: NodeId): Promise<void> {
    return this.handler.discardWorkingCopy(nodeId);
  }

  async addBookmark(nodeId: NodeId, bookmark: Omit<FolderBookmark, 'id' | 'folderId' | 'createdAt'>): Promise<FolderBookmark> {
    return this.handler.addBookmark(nodeId, bookmark);
  }

  async removeBookmark(bookmarkId: EntityId): Promise<void> {
    return this.handler.removeBookmark(bookmarkId);
  }

  async getBookmarks(nodeId: NodeId): Promise<FolderBookmark[]> {
    return this.handler.getBookmarks(nodeId);
  }

  async addTemplate(nodeId: NodeId, template: Omit<FolderTemplate, 'id' | 'folderId' | 'createdAt'>): Promise<FolderTemplate> {
    return this.handler.addTemplate(nodeId, template);
  }

  async removeTemplate(templateId: EntityId): Promise<void> {
    return this.handler.removeTemplate(templateId);
  }

  async getTemplates(nodeId: NodeId): Promise<FolderTemplate[]> {
    return this.handler.getTemplates(nodeId);
  }

  async searchFolders(query: string): Promise<FolderEntity[]> {
    return this.handler.searchFolders(query);
  }

  async cleanup(): Promise<void> {
    // Cleanup all folder working copies
    await this.handler.folderDB.cleanupExpiredWorkingCopies();
  }
}