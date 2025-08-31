/**
 * @file FolderEntityHandler.ts
 * @description Folder entity handler using common base classes
 */

import type { NodeId, EntityId } from '@hierarchidb/common-type';
import type { Table } from 'dexie';
import {
  HierarchicalEntityHandler,
  type HierarchicalEntity,
  type HierarchicalSearchCriteria,
} from '@hierarchidb/node-type-base-plugin';

import type {
  FolderEntity,
  FolderEntityWorkingCopy,
  FolderBookmark,
  FolderTemplate,
  FolderSettings,
} from '../types';
import { FolderDatabase } from '../database/FolderDatabase';

/**
 * Combined entity type with hierarchical support
 */
export interface FolderEntityExtended extends FolderEntity, HierarchicalEntity {}

/**
 * Combined search criteria
 */
export interface FolderSearchCriteria extends HierarchicalSearchCriteria {
  category?: string;
  hasBookmarks?: boolean;
  hasTemplates?: boolean;
}

/**
 * Folder entity handler with hierarchical support
 */
export class FolderEntityHandler extends HierarchicalEntityHandler<
  FolderEntityExtended,
  FolderEntityWorkingCopy,
  Partial<FolderEntity>,
  FolderSearchCriteria
> {
  public folderDB: FolderDatabase;
  protected table: Table<FolderEntityExtended, EntityId>;

  constructor() {
    super();
    this.folderDB = new FolderDatabase();
    this.table = this.folderDB.folders as any;
  }

  /**
   * Build folder entity
   */
  protected buildEntity(
    nodeId: NodeId,
    entityId: EntityId,
    data: Partial<FolderEntity>
  ): FolderEntityExtended {
    const now = Date.now();

    return {
      id: entityId,
      nodeId,
      name: data.name || 'New Folder',
      description: data.description || '',
      category: data.category,
      settings: data.settings || {
        allowNestedFolders: true,
        maxDepth: 10,
        sortOrder: 'name',
      },
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      version: data.version || 1,
      // Hierarchical fields
      parentId: data.parentId,
      depth: data.depth || 0,
      path: data.path || `/${nodeId}`,
      childCount: 0,
      // Custom fields
      customFields: data.customFields || {},
    } as FolderEntityExtended;
  }

  /**
   * Clean up folder-specific data
   */
  protected async cleanupEntityData(entity: FolderEntityExtended): Promise<void> {
    // Remove bookmarks
    await this.folderDB.bookmarks.where('folderId').equals(entity.nodeId).delete();

    // Remove templates
    await this.folderDB.templates.where('folderId').equals(entity.nodeId).delete();
  }

  // ========== Folder-specific methods ==========

  /**
   * Add bookmark to folder
   */
  async addBookmark(
    nodeId: NodeId,
    bookmark: Omit<FolderBookmark, 'id' | 'folderId'>
  ): Promise<void> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`Folder not found: ${nodeId}`);
    }

    const bookmarkRecord: FolderBookmark = {
      id: crypto.randomUUID(),
      folderId: nodeId,
      ...bookmark,
      createdAt: Date.now(),
    };

    await this.folderDB.bookmarks.add(bookmarkRecord);
  }

  /**
   * Remove bookmark from folder
   */
  async removeBookmark(nodeId: NodeId, bookmarkId: string): Promise<void> {
    await this.folderDB.bookmarks
      .where('id')
      .equals(bookmarkId)
      .and((item) => item.folderId === nodeId)
      .delete();
  }

  /**
   * Get bookmarks for folder
   */
  async getBookmarks(nodeId: NodeId): Promise<FolderBookmark[]> {
    return await this.folderDB.bookmarks.where('folderId').equals(nodeId).toArray();
  }

  /**
   * Add template to folder
   */
  async addTemplate(
    nodeId: NodeId,
    template: Omit<FolderTemplate, 'id' | 'folderId'>
  ): Promise<void> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`Folder not found: ${nodeId}`);
    }

    const templateRecord: FolderTemplate = {
      id: crypto.randomUUID(),
      folderId: nodeId,
      ...template,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.folderDB.templates.add(templateRecord);
  }

  /**
   * Remove template from folder
   */
  async removeTemplate(nodeId: NodeId, templateId: string): Promise<void> {
    await this.folderDB.templates
      .where('id')
      .equals(templateId)
      .and((item) => item.folderId === nodeId)
      .delete();
  }

  /**
   * Get templates for folder
   */
  async getTemplates(nodeId: NodeId): Promise<FolderTemplate[]> {
    return await this.folderDB.templates.where('folderId').equals(nodeId).toArray();
  }

  /**
   * Search folders with extended criteria
   */
  async searchFolders(criteria: FolderSearchCriteria): Promise<FolderEntityExtended[]> {
    let results = await this.searchEntities(criteria);

    // Apply folder-specific filters
    if (criteria.category) {
      results = results.filter((f) => f.category === criteria.category);
    }

    if (criteria.hasBookmarks !== undefined) {
      const folderIds = await this.getFoldersWithBookmarks();
      results = results.filter((f) => {
        const hasBookmarks = folderIds.includes(f.nodeId);
        return hasBookmarks === criteria.hasBookmarks;
      });
    }

    if (criteria.hasTemplates !== undefined) {
      const folderIds = await this.getFoldersWithTemplates();
      results = results.filter((f) => {
        const hasTemplates = folderIds.includes(f.nodeId);
        return hasTemplates === criteria.hasTemplates;
      });
    }

    return results;
  }

  /**
   * Get folders that have bookmarks
   */
  private async getFoldersWithBookmarks(): Promise<NodeId[]> {
    const bookmarks = await this.folderDB.bookmarks.toArray();
    return [...new Set(bookmarks.map((b) => b.folderId))];
  }

  /**
   * Get folders that have templates
   */
  private async getFoldersWithTemplates(): Promise<NodeId[]> {
    const templates = await this.folderDB.templates.toArray();
    return [...new Set(templates.map((t) => t.folderId))];
  }

  /**
   * Clean up expired working copies
   */
  async cleanup(): Promise<void> {
    await this.folderDB.cleanupExpiredWorkingCopies();
  }

  // ==================
  // 多段階ダイアログサポート
  // ==================

  /**
   * フォルダー作成の多段階ダイアログのステップ能力を評価
   */
  async getStepCapabilities(data: any, step: number): Promise<{
    canNavigateTo: boolean;
    canStartBatch: boolean;
    canSave: boolean;
    canProceedToNext: boolean;
    canBackToPrevious: boolean;
  }> {
    // フォルダーは3段階のステップを持つ
    // Step 0: 基本情報 (名前、説明)
    // Step 1: 権限設定
    // Step 2: テンプレートとブックマーク設定

    const totalSteps = 3;
    
    switch (step) {
      case 0: // 基本情報ステップ
        return {
          canNavigateTo: true,
          canStartBatch: false, // 基本情報が必要なので初期ステップではバッチ処理不可
          canSave: false, // 最低限の情報が必要
          canProceedToNext: !!(data.name && data.name.trim().length > 0),
          canBackToPrevious: false // 最初のステップ
        };

      case 1: // 権限設定ステップ
        const hasBasicInfo = !!(data.name && data.name.trim().length > 0);
        return {
          canNavigateTo: hasBasicInfo,
          canStartBatch: hasBasicInfo, // 基本情報があればバッチ処理可能
          canSave: hasBasicInfo, // 基本情報があれば保存可能
          canProceedToNext: true, // 権限設定はオプション
          canBackToPrevious: true
        };

      case 2: // テンプレートとブックマーク設定ステップ
        const canNavigateToFinal = !!(data.name && data.name.trim().length > 0);
        return {
          canNavigateTo: canNavigateToFinal,
          canStartBatch: canNavigateToFinal,
          canSave: canNavigateToFinal,
          canProceedToNext: false, // 最終ステップ
          canBackToPrevious: true
        };

      default:
        return {
          canNavigateTo: false,
          canStartBatch: false,
          canSave: false,
          canProceedToNext: false,
          canBackToPrevious: false
        };
    }
  }

  /**
   * フォルダーデータのバリデーション
   */
  async validate(data: any): Promise<{ valid: boolean; errors: string[]; warnings?: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 必須フィールドのチェック
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('フォルダー名は必須です');
    } else if (data.name.trim().length > 255) {
      errors.push('フォルダー名は255文字以下である必要があります');
    }

    // 名前の形式チェック
    if (data.name && typeof data.name === 'string') {
      const invalidChars = /[<>:"/\\|?*]/;
      if (invalidChars.test(data.name)) {
        errors.push('フォルダー名に無効な文字が含まれています');
      }
    }

    // 説明の長さチェック
    if (data.description && typeof data.description === 'string' && data.description.length > 1000) {
      warnings.push('説明が長すぎます（1000文字以下を推奨）');
    }

    // 権限設定のチェック
    if (data.permissions) {
      if (typeof data.permissions !== 'object') {
        errors.push('権限設定の形式が正しくありません');
      } else {
        const validPermissions = ['read', 'write', 'delete', 'share'];
        for (const [user, perms] of Object.entries(data.permissions)) {
          if (!Array.isArray(perms)) {
            errors.push(`${user}の権限設定が配列ではありません`);
            continue;
          }
          for (const perm of perms as string[]) {
            if (!validPermissions.includes(perm)) {
              errors.push(`無効な権限: ${perm}`);
            }
          }
        }
      }
    }

    // テンプレートのチェック
    if (data.templates && !Array.isArray(data.templates)) {
      errors.push('テンプレート設定は配列である必要があります');
    }

    // ブックマークのチェック
    if (data.bookmarks && !Array.isArray(data.bookmarks)) {
      errors.push('ブックマーク設定は配列である必要があります');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

}
