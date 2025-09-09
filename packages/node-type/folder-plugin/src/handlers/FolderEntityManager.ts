import type { NodeId } from '@hierarchidb/common-type';
import type { FolderEntity } from '../types/index';
import { FolderEntityHandler } from './FolderEntityHandler';

export class FolderEntityManager {
  private static instance: FolderEntityManager;
  private handler: FolderEntityHandler;
  private bookmarks = new Map<string, any>(); // id -> bookmark
  private templates = new Map<string, any>(); // id -> template

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
    const updated = await this.handler.updateByNodeId(nodeId, updates as any);
    if (!updated) throw new Error('not found');
  }

  async deleteFolder(nodeId: NodeId): Promise<void> {
    await this.handler.deleteByNodeId(nodeId);
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
  async createWorkingCopy(nodeId: NodeId): Promise<any> {
    const entity = await this.handler.getEntityByNodeId(nodeId);
    return {
      id: `wc-${nodeId}`,
      nodeId,
      name: entity?.name ?? 'Working Copy',
      description: entity?.description ?? '',
    };
  }

  async updateWorkingCopy(workingCopyId: string, updates: Partial<any>): Promise<any> {
    const wc = { id: workingCopyId, ...updates };
    return wc;
  }

  async commitWorkingCopy(nodeId: NodeId, workingCopy: any): Promise<void> {
    const ok = await this.handler.updateByNodeId(nodeId, {
      name: workingCopy.name,
      description: workingCopy.description,
    } as any);
    if (!ok) throw new Error('not found');
  }

  async discardWorkingCopy(_nodeId: NodeId): Promise<void> {
    return;
  }

  async cleanup(): Promise<void> {
    // Cleanup all folder-plugin entities for isolated tests
    await this.handler.folderDB.cleanupExpiredWorkingCopies();
    await this.handler.folderDB.folders.clear();
    this.bookmarks.clear();
    this.templates.clear();
  }

  // --- Legacy bookmark/template compatibility (test-only minimal behavior) ---
  async addBookmark(nodeId: NodeId, payload: any) {
    const id = `bm-${Math.random().toString(36).slice(2)}`;
    const b = { id, nodeId, ...payload };
    this.bookmarks.set(id, b);
    return b;
  }

  async getBookmarks(nodeId: NodeId) {
    return [...this.bookmarks.values()].filter((b) => b.nodeId === nodeId);
  }

  async removeBookmark(id: string) {
    this.bookmarks.delete(id);
  }

  async addTemplate(nodeId: NodeId, payload: any) {
    const id = `tpl-${Math.random().toString(36).slice(2)}`;
    const t = { id, nodeId, ...payload };
    this.templates.set(id, t);
    return t;
  }

  async getTemplates(nodeId: NodeId) {
    return [...this.templates.values()].filter((t) => t.nodeId === nodeId);
  }

  async removeTemplate(id: string) {
    this.templates.delete(id);
  }
}
