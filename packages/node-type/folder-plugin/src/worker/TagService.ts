/**
 * Tag Service - タグの管理とCRUD操作
 */

import type { 
  TagEntity,
  NodeId,
  EntityId,
  TagSuggestion,
  TagSearchOptions,
  NodeTagAssociation 
} from '@hierarchidb/common-type';
import type { CreateTagRequest, UpdateTagRequest } from '@hierarchidb/common-api';
import { Dexie, Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

/**
 * TagDatabase - タグ管理専用のDexieデータベース
 */
class TagDatabase extends Dexie {
  tags!: Table<TagEntity, EntityId>;
  nodeTagAssociations!: Table<NodeTagAssociation, EntityId>;

  constructor() {
    super('TagDatabase');
    
    this.version(1).stores({
      tags: '&id, name, category, usageCount, *nodeIds, referenceCount',
      nodeTagAssociations: '&id, nodeId, tagId, assignedAt, [nodeId+tagId]'
    });
  }
}

const tagDB = new TagDatabase();

/**
 * TagService - タグ管理のメインサービス
 */
type TagId = EntityId;

export class TagService {
  
  /**
   * 新しいタグを作成
   */
  async createTag(request: CreateTagRequest): Promise<TagEntity> {
    const tagId = this.generateTagId();
    const now = Date.now();
    
    const tag: TagEntity = {
      id: tagId as any, // TagIdをEntityIdにキャスト
      name: request.name,
      color: request.color || this.generateRandomColor(),
      description: request.description,
      category: request.category || 'user',
      usageCount: 0,
      nodeIds: [],
      referenceCount: 0,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    
    await tagDB.tags.add(tag as any);
    return tag;
  }
  
  /**
   * タグを更新
   */
  async updateTag(tagId: TagId, request: UpdateTagRequest): Promise<TagEntity> {
    const tag = await tagDB.tags.get(tagId as any);
    if (!tag) {
      throw new Error(`Tag with id ${tagId} not found`);
    }
    
    const updatedTag: TagEntity = {
      ...tag,
      ...request,
      updatedAt: Date.now(),
      version: tag.version + 1
    };
    
    await tagDB.tags.update(tagId as any, {
      name: updatedTag.name,
      color: updatedTag.color,
      description: updatedTag.description,
      category: updatedTag.category,
      usageCount: updatedTag.usageCount,
      updatedAt: updatedTag.updatedAt,
      version: updatedTag.version
    });
    return updatedTag;
  }
  
  /**
   * タグを削除
   */
  async deleteTag(tagId: TagId): Promise<void> {
    // 関連付けも削除
    await tagDB.nodeTagAssociations.where('tagId').equals(tagId as any).delete();
    await tagDB.tags.delete(tagId as any);
  }
  
  /**
   * ノードにタグを関連付け
   */
  async addTagToNode(nodeId: NodeId, tagId: TagId): Promise<void> {
    // 既存の関連付けをチェック
    const existing = await tagDB.nodeTagAssociations
      .where('[nodeId+tagId]')
      .equals([nodeId, tagId as any])
      .first();
      
    if (existing) {
      return; // 既に関連付けられている
    }
    
    const association: NodeTagAssociation = {
      id: this.generateEntityId(),
      nodeId,
      tagId,
      assignedAt: Date.now()
    };
    
    await tagDB.nodeTagAssociations.add(association);
    
    // タグの使用回数とノードリストを更新
    await this.updateTagUsage(tagId, nodeId, 'add');
  }
  
  /**
   * ノードからタグを削除
   */
  async removeTagFromNode(nodeId: NodeId, tagId: TagId): Promise<void> {
    await tagDB.nodeTagAssociations
      .where('[nodeId+tagId]')
      .equals([nodeId, tagId as any])
      .delete();
      
    await this.updateTagUsage(tagId, nodeId, 'remove');
  }
  
  /**
   * ノードのタグをすべて取得
   */
  async getTagsForNode(nodeId: NodeId): Promise<TagEntity[]> {
    const associations = await tagDB.nodeTagAssociations
      .where('nodeId')
      .equals(nodeId)
      .toArray();
      
    const tagIds = associations.map(a => a.tagId);
    const tags = await tagDB.tags.where('id').anyOf(tagIds as any[]).toArray();
    
    return tags;
  }
  
  /**
   * タグを検索（サジェスト用）
   */
  async searchTags(options: TagSearchOptions = {}): Promise<TagSuggestion[]> {
    let query = tagDB.tags.toCollection();
    
    if (options.category) {
      query = query.filter(tag => tag.category === options.category);
    }
    
    if (options.query) {
      const searchTerm = options.query.toLowerCase();
      query = query.filter(tag => {
        const nameMatch = tag.name.toLowerCase().includes(searchTerm);
        const descMatch = tag.description ? tag.description.toLowerCase().includes(searchTerm) : false;
        return nameMatch || descMatch;
      });
    }
    
    // ソートと制限
    const sortBy = options.sortBy || 'usageCount';
    const sortOrder = options.sortOrder || 'desc';
    
    let tags: TagEntity[];
    if (sortBy === 'name') {
      tags = await query.sortBy('name');
    } else if (sortBy === 'usageCount') {
      tags = await query.reverse().sortBy('usageCount');
    } else {
      tags = await query.toArray();
    }
    
    // 制限適用
    tags = tags.slice(0, options.limit || 50);
    
    if (sortOrder === 'asc') {
      tags.reverse();
    }
    
    return tags.map(tag => ({
      id: tag.id as any as TagId,
      name: tag.name,
      color: tag.color,
      usageCount: tag.usageCount,
      description: tag.description
    }));
  }
  
  /**
   * 全タグを取得
   */
  async getAllTags(): Promise<TagEntity[]> {
    return await tagDB.tags.toArray();
  }
  
  /**
   * タグの使用統計を更新
   */
  private async updateTagUsage(tagId: TagId, nodeId: NodeId, action: 'add' | 'remove'): Promise<void> {
    await tagDB.transaction('rw', tagDB.tags, async () => {
      const tag = await tagDB.tags.get(tagId as any);
      if (!tag) return;
      
      let nodeIds = [...tag.nodeIds];
      let usageCount = tag.usageCount;
      let referenceCount = tag.referenceCount;
      
      if (action === 'add') {
        if (!nodeIds.includes(nodeId)) {
          nodeIds.push(nodeId);
          usageCount += 1;
          referenceCount += 1;
        }
      } else {
        const index = nodeIds.indexOf(nodeId);
        if (index > -1) {
          nodeIds.splice(index, 1);
          usageCount = Math.max(0, usageCount - 1);
          referenceCount = Math.max(0, referenceCount - 1);
        }
      }
      
      await tagDB.tags.update(tagId as any, {
        nodeIds,
        usageCount,
        referenceCount,
        lastAccessedAt: Date.now(),
        updatedAt: Date.now(),
        version: tag.version + 1
      });
    });
  }
  
  /**
   * UUIDを使用してタグIDを生成
   */
  private generateTagId(): TagId {
    return `tag_${uuidv4()}` as TagId;
  }
  
  /**
   * ランダムなEntityIDを生成
   */
  private generateEntityId(): EntityId {
    return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as EntityId;
  }
  
  /**
   * ランダムな色を生成
   */
  private generateRandomColor(): string {
    const colors = [
      '#f44336', '#e91e63', '#9c27b0', '#673ab7',
      '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
      '#009688', '#4caf50', '#8bc34a', '#cddc39',
      '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
    ] as const;
    return colors[Math.floor(Math.random() * colors.length)] as string;
  }
}

export const tagService = new TagService();
