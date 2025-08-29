/**
 * @file FolderEntityHandler.ts
 * @description Folder entity handler using common base classes
 */

import type { NodeId, EntityId } from '@hierarchidb/common-type';
import type { Table } from 'dexie';
import { 
  HierarchicalEntityHandler,
  MetadataEntityHandler,
  type HierarchicalEntity,
  type MetadataEntity,
  type HierarchicalSearchCriteria,
  type MetadataSearchCriteria
} from '@hierarchidb/plugin-base';

import type { 
  FolderEntity, 
  FolderEntityWorkingCopy, 
  FolderBookmark, 
  FolderTemplate,
  FolderSettings 
} from '../types';
import { FolderDatabase } from '../database/FolderDatabase';

/**
 * Combined entity type with hierarchical and metadata support
 */
export interface FolderEntityExtended extends FolderEntity, HierarchicalEntity, MetadataEntity {}

/**
 * Combined search criteria
 */
export interface FolderSearchCriteria extends HierarchicalSearchCriteria, MetadataSearchCriteria {
  category?: string;
  hasBookmarks?: boolean;
  hasTemplates?: boolean;
}

/**
 * Folder entity handler with hierarchical and metadata support
 */
export class FolderEntityHandler extends HierarchicalEntityHandler<
  FolderEntityExtended,
  FolderEntityWorkingCopy,
  Partial<FolderEntity>,
  FolderSearchCriteria
> {
  public folderDB: FolderDatabase;
  protected table: Table<FolderEntityExtended, EntityId>;
  
  // Compose MetadataEntityHandler functionality
  private metadataHandler: MetadataEntityHandler<
    FolderEntityExtended,
    FolderEntityWorkingCopy,
    Partial<FolderEntity>,
    FolderSearchCriteria
  >;

  constructor() {
    super();
    this.folderDB = new FolderDatabase();
    this.table = this.folderDB.folders as any;
    
    // Initialize metadata handler with same table
    this.metadataHandler = new MetadataEntityHandlerAdapter(this.table);
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
      tags: data.tags || [],
      category: data.category,
      settings: data.settings || {
        allowNestedFolders: true,
        maxDepth: 10,
        sortOrder: 'name'
      },
      metadata: data.metadata || {},
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
    await this.folderDB.bookmarks
      .where('folderId')
      .equals(entity.nodeId)
      .delete();
    
    // Remove templates
    await this.folderDB.templates
      .where('folderId')
      .equals(entity.nodeId)
      .delete();
  }

  // ========== Folder-specific methods ==========

  /**
   * Add bookmark to folder
   */
  async addBookmark(nodeId: NodeId, bookmark: Omit<FolderBookmark, 'id' | 'folderId'>): Promise<void> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`Folder not found: ${nodeId}`);
    }

    const bookmarkRecord: FolderBookmark = {
      id: crypto.randomUUID(),
      folderId: nodeId,
      ...bookmark,
      createdAt: Date.now()
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
      .and(item => item.folderId === nodeId)
      .delete();
  }

  /**
   * Get bookmarks for folder
   */
  async getBookmarks(nodeId: NodeId): Promise<FolderBookmark[]> {
    return await this.folderDB.bookmarks
      .where('folderId')
      .equals(nodeId)
      .toArray();
  }

  /**
   * Add template to folder
   */
  async addTemplate(nodeId: NodeId, template: Omit<FolderTemplate, 'id' | 'folderId'>): Promise<void> {
    const entity = await this.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`Folder not found: ${nodeId}`);
    }

    const templateRecord: FolderTemplate = {
      id: crypto.randomUUID(),
      folderId: nodeId,
      ...template,
      createdAt: Date.now(),
      updatedAt: Date.now()
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
      .and(item => item.folderId === nodeId)
      .delete();
  }

  /**
   * Get templates for folder
   */
  async getTemplates(nodeId: NodeId): Promise<FolderTemplate[]> {
    return await this.folderDB.templates
      .where('folderId')
      .equals(nodeId)
      .toArray();
  }

  /**
   * Search folders with extended criteria
   */
  async searchFolders(criteria: FolderSearchCriteria): Promise<FolderEntityExtended[]> {
    let results = await this.searchEntities(criteria);

    // Apply folder-specific filters
    if (criteria.category) {
      results = results.filter(f => f.category === criteria.category);
    }

    if (criteria.hasBookmarks !== undefined) {
      const folderIds = await this.getFoldersWithBookmarks();
      results = results.filter(f => {
        const hasBookmarks = folderIds.includes(f.nodeId);
        return hasBookmarks === criteria.hasBookmarks;
      });
    }

    if (criteria.hasTemplates !== undefined) {
      const folderIds = await this.getFoldersWithTemplates();
      results = results.filter(f => {
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
    return [...new Set(bookmarks.map(b => b.folderId))];
  }

  /**
   * Get folders that have templates
   */
  private async getFoldersWithTemplates(): Promise<NodeId[]> {
    const templates = await this.folderDB.templates.toArray();
    return [...new Set(templates.map(t => t.folderId))];
  }

  /**
   * Clean up expired working copies
   */
  async cleanup(): Promise<void> {
    await this.folderDB.cleanupExpiredWorkingCopies();
  }

  // ========== Metadata delegation methods ==========

  /**
   * Set metadata (delegated to metadata handler)
   */
  async setMetadata(entityId: EntityId, key: string, value: any): Promise<any> {
    return await this.metadataHandler.setMetadata(entityId, key, value);
  }

  /**
   * Get metadata (delegated to metadata handler)
   */
  async getMetadata(entityId: EntityId, key: string): Promise<any> {
    return await this.metadataHandler.getMetadata(entityId, key);
  }

  /**
   * Add tag (delegated to metadata handler)
   */
  async addTag(entityId: EntityId, tag: string): Promise<void> {
    return await this.metadataHandler.addTag(entityId, tag);
  }

  /**
   * Remove tag (delegated to metadata handler)
   */
  async removeTag(entityId: EntityId, tag: string): Promise<void> {
    return await this.metadataHandler.removeTag(entityId, tag);
  }

  /**
   * Get tags (delegated to metadata handler)
   */
  async getTags(entityId: EntityId): Promise<string[]> {
    return await this.metadataHandler.getTags(entityId);
  }
}

/**
 * Adapter class to make MetadataEntityHandler work with composition
 */
class MetadataEntityHandlerAdapter<
  TEntity extends FolderEntityExtended,
  TWorkingCopy extends FolderEntityWorkingCopy
> extends MetadataEntityHandler<TEntity, TWorkingCopy> {
  constructor(protected table: Table<TEntity, EntityId>) {
    super();
  }
  
  protected buildEntity(): TEntity {
    throw new Error('Not used in adapter');
  }
}