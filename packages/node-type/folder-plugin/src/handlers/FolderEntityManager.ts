import type { NodeId, EntityId } from '@hierarchidb/common-type';
import type { FolderEntity } from '../types/index';
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
    return (await this.handler.createEntity(nodeId, data || {})) as unknown as FolderEntity;
  }

  async updateFolder(nodeId: NodeId, updates: Partial<FolderEntity>): Promise<void> {
    const entity = await this.handler.getEntityByNodeId(nodeId);
    if (!entity) return;
    await this.handler.updateEntity(entity.id as unknown as EntityId, updates as any);
  }

  async deleteFolder(nodeId: NodeId): Promise<void> {
    const entity = await this.handler.getEntityByNodeId(nodeId);
    if (!entity) return;
    await this.handler.deleteEntity(entity.id as unknown as EntityId);
  }

  async getFolder(nodeId: NodeId): Promise<FolderEntity | undefined> {
    const entity = await this.handler.getEntityByNodeId(nodeId);
    return (entity || undefined) as unknown as FolderEntity | undefined;
  }

  async getFolderByNodeId(nodeId: NodeId): Promise<FolderEntity | undefined> {
    const entity = await this.handler.getEntityByNodeId(nodeId);
    return (entity || undefined) as unknown as FolderEntity | undefined;
  }

  // Working copy operations are not implemented in this plugin version

  // Bookmark/Template features have been discarded; no-ops retained for compatibility can be added if needed.

  async searchFolders(query: string): Promise<FolderEntity[]> {
    const list = await this.handler.searchFolders(query);
    return list as unknown as FolderEntity[];
  }

  // Placeholder working copy APIs for compatibility with legacy tests
  async createWorkingCopy(_nodeId: NodeId): Promise<any> {
    return {};
  }

  async updateWorkingCopy(_workingCopyId: EntityId, _updates: Partial<any>): Promise<any> {
    return {};
  }

  async commitWorkingCopy(_nodeId: NodeId, _workingCopy: any): Promise<void> {
    return;
  }

  async discardWorkingCopy(_nodeId: NodeId): Promise<void> {
    return;
  }

  async cleanup(): Promise<void> {
    // Cleanup all folder-plugin working copies
    await this.handler.folderDB.cleanupExpiredWorkingCopies();
  }
}
