import type { NodeId, Timestamp } from '@hierarchidb/core-types';
import {
  type CreateTagRequest,
  type TagId,
  type TagAPI,
  type TagAssociationRequest,
  type TagSuggestion,
  type UpdateTagRequest,
  type NodeTagAssociation,
  type NodeTagAssociationId,
  type TagEntity,
  toTagId,
} from '@hierarchidb/tag-api';
import { SingletonMixin, generateId } from '@hierarchidb/util';
import type { TagDBPort } from './ports.js';

/**
 * TagService - generic tagging service using a DB port.
 * This service is environment-agnostic; it only needs a TagDBPort implementation.
 */
export class TagService implements TagAPI {
  static getSingleton(db: TagDBPort): Promise<TagService> {
    return SingletonMixin.getSingleton('TagService', async () => new TagService(db));
  }

  constructor(private db: TagDBPort) {
  }

  async createTag(request: CreateTagRequest): Promise<TagEntity> {
    const now = Date.now() as Timestamp;
    const uuid =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : null;
    if (!uuid) {
      throw new Error('crypto.randomUUID is not available');
    }
    const tag: TagEntity = {
      id: uuid as TagId,
      name: request.name.trim(),
      color: request.color,
      description: request.description?.trim(),
      referenceCount: 0,
      lastAccessedAt: now,
      createdAt: now,
    };

    try {
      await this.db.createTag(tag);
    } catch (err) {
      const name = (err as { name?: string }).name ?? 'Error';
      if (name === 'ConstraintError') {
        throw new Error(
          `[TagService] createTag failed due to duplicate key (tagId=${tag.id}, name=${tag.name})`,
          { cause: err as Error }
        );
      }
      throw err;
    }
    return tag;
  }

  async getTag(tagId: TagId): Promise<TagEntity | undefined> {
    return await this.db.getTag(tagId);
  }

  async updateTag(tagId: TagId, updates: UpdateTagRequest): Promise<TagEntity | undefined> {
    const existing = await this.getTag(tagId);
    if (!existing) throw new Error(`Tag ${tagId} not found`);

    const updated: TagEntity = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    } as TagEntity;

    await this.db.updateTag(updated);
    return updated;
  }

  async deleteTag(tagId: TagId): Promise<boolean> {
    const tag = await this.getTag(tagId);
    if (!tag) return false;
    await this.db.removeAllTagAssociations(tagId);
    await this.db.deleteTag(tagId);
    return true;
  }

  async getAllTags(): Promise<TagEntity[]> {
    return await this.db.getAllTags();
  }

  async searchTags(query: string): Promise<TagEntity[]> {
    const all = await this.getAllTags();
    const q = query.trim().toLowerCase();
    return all.filter((t) => t.name.toLowerCase().includes(q));
  }

  async getTagSuggestions(query: string, limit: number = 10): Promise<TagSuggestion[]> {
    const tags = await this.searchTags(query);
    return tags
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((t) => ({ id: t.id, name: t.name, color: t.color }));
  }

  async addTagToNode(request: TagAssociationRequest): Promise<NodeTagAssociation> {
    const tag = await this.getTag(request.tagId);
    if (!tag) throw new Error(`Tag ${request.tagId} not found`);

    const existing = await this.db.getTagAssociation(
      request.nodeId,
      request.tagId,
      request.scope
    );
    if (existing) return existing;

    const association: NodeTagAssociation = {
      id: `${request.nodeId}_${request.tagId}_${request.scope}` as NodeTagAssociationId,
      nodeId: request.nodeId,
      tagId: request.tagId,
      scope: request.scope,
      assignedAt: Date.now() as Timestamp,
    };

    try {
      await this.db.createTagAssociation(association);
    } catch (err) {
      const name = (err as { name?: string }).name ?? 'Error';
      if (name === 'ConstraintError') {
        const existingAfter = await this.db.getTagAssociation(
          association.nodeId,
          association.tagId,
          association.scope
        );
        if (existingAfter) {
          return existingAfter;
        }
        const nodeAssociations = await this.db.getTagAssociationsForNode(association.nodeId);
        const matched = nodeAssociations.find(
          (assoc) =>
            assoc.tagId === association.tagId && assoc.scope === association.scope
        );
        if (matched) {
          return matched;
        }
        throw new Error(
          `[TagService] addTagToNode failed due to duplicate key (nodeId=${association.nodeId}, tagId=${association.tagId}, associationId=${association.id})`,
          { cause: err as Error }
        );
      }
      throw err;
    }
    return association;
  }

  async removeTagFromNode(request: TagAssociationRequest): Promise<boolean> {
    return await this.db.removeTagAssociation(request.nodeId, request.tagId, request.scope);
  }

  async getTagsForNode(nodeId: NodeId): Promise<TagEntity[]> {
    const assocs = await this.db.getTagAssociationsForNode(nodeId);
    const effective = this.selectEffectiveAssociations(assocs);
    const tags: TagEntity[] = [];
    for (const assoc of effective) {
      const t = await this.getTag(assoc.tagId);
      if (t) tags.push(t);
    }
    return tags;
  }

  async getTagAssociationsForNode(nodeId: NodeId): Promise<NodeTagAssociation[]> {
    return await this.db.getTagAssociationsForNode(nodeId);
  }

  async getNodesByTag(tagId: TagId): Promise<NodeTagAssociation[]> {
    return await this.db.getTagAssociationsForTag(tagId);
  }

  async getTagsForNodes(nodeIds: NodeId[]): Promise<Map<NodeId, TagEntity[]>> {
    const result = new Map<NodeId, TagEntity[]>();
    for (const id of nodeIds) {
      result.set(id, await this.getTagsForNode(id));
    }
    return result;
  }

  async getTagStats(): Promise<{
    totalTags: number;
    totalAssociations: number;
    mostUsedTags: TagEntity[];
    recentTags: TagEntity[];
  }> {
    const all = await this.getAllTags();
    const totalAssociations = await this.db.getTotalTagAssociations();
    const usageCounts = await this.getUsageCounts();
    const mostUsedTags = [...all]
      .sort((a, b) => (usageCounts.get(b.id) ?? 0) - (usageCounts.get(a.id) ?? 0))
      .slice(0, 5);
    const recentTags = [...all].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    return { totalTags: all.length, totalAssociations, mostUsedTags, recentTags };
  }

  generateTagId(): TagId {
    return toTagId(`tag_${generateId()}`);
  }

  private selectEffectiveAssociations(
    associations: NodeTagAssociation[]
  ): NodeTagAssociation[] {
    const byNode = new Map<string, NodeTagAssociation[]>();
    for (const assoc of associations) {
      const key = String(assoc.nodeId);
      const list = byNode.get(key);
      if (list) {
        list.push(assoc);
      } else {
        byNode.set(key, [assoc]);
      }
    }
    const effective: NodeTagAssociation[] = [];
    for (const list of byNode.values()) {
      const hasDraft = list.some((assoc) => assoc.scope === 'draft');
      if (hasDraft) {
        effective.push(...list.filter((assoc) => assoc.scope === 'draft'));
      } else {
        effective.push(...list);
      }
    }
    return effective;
  }

  private async getUsageCounts(): Promise<Map<TagId, number>> {
    const allAssociations = await this.db.getTotalTagAssociations();
    if (allAssociations === 0) return new Map<TagId, number>();
    const tags = await this.getAllTags();
    const counts = new Map<TagId, number>();
    const draftScopeCache = new Map<NodeId, boolean>();
    const hasDraftAssociations = async (nodeId: NodeId) => {
      if (draftScopeCache.has(nodeId)) return draftScopeCache.get(nodeId) ?? false;
      const nodeAssociations = await this.db.getTagAssociationsForNode(nodeId);
      const hasDraft = nodeAssociations.some((assoc) => assoc.scope === 'draft');
      draftScopeCache.set(nodeId, hasDraft);
      return hasDraft;
    };
    for (const tag of tags) {
      const assocs = await this.db.getTagAssociationsForTag(tag.id);
      const effective = this.selectEffectiveAssociations(assocs);
      let count = 0;
      for (const assoc of effective) {
        if (assoc.scope === 'published') {
          const hasDraft = await hasDraftAssociations(assoc.nodeId);
          if (hasDraft) {
            continue;
          }
        }
        if (assoc.tagId === tag.id) {
          count += 1;
        }
      }
      counts.set(tag.id, count);
    }
    return counts;
  }
}
