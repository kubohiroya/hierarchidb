import Dexie from 'dexie';
import type { FolderEntity, FolderEntityWorkingCopy, FolderBookmark, FolderTemplate } from '../types/index';

export class FolderDatabase extends Dexie {
  folders!: Dexie.Table<FolderEntity, string>;
  workingCopies!: Dexie.Table<FolderEntityWorkingCopy, string>;
  bookmarks!: Dexie.Table<FolderBookmark, string>;
  templates!: Dexie.Table<FolderTemplate, string>;

  constructor() {
    super('FolderDatabase');

    this.version(1).stores({
      folders: '&id, nodeId, name, createdAt, updatedAt',
      workingCopies: '&id, nodeId, createdAt',
      bookmarks: '&id, folderId, name, url, createdAt',
      templates: '&id, folderId, name, createdAt'
    });
  }

  async cleanupExpiredWorkingCopies(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    await this.workingCopies.where('createdAt').below(cutoff).delete();
  }
}