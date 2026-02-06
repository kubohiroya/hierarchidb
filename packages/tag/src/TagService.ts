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
  type TagEntity, toTagId } from '@hierarchidb/tag-api';
import { SingletonMixin, generateId } from '@hierarchidb/util';
import type { TagDBPort } from './ports.js';
import crypto from 'crypto';

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
    const tag: TagEntity = {
      id: crypto.randomUUID() as TagId,
      name: request.name.trim(),
      color: request.color,
      description: request.description?.trim(),
      usageCount: 0,
      nodeIds: [],
      referenceCount: 0,
      lastAccessedAt: now,
      createdAt: now,
    };

    await this.db.createTag(tag);
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
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit)
      .map((t) => ({ id: t.id, name: t.name, color: t.color, usageCount: t.usageCount }));
  }

  async addTagToNode(request: TagAssociationRequest): Promise<NodeTagAssociation> {
    const tag = await this.getTag(request.tagId);
    if (!tag) throw new Error(`Tag ${request.tagId} not found`);

    const existing = await this.db.getTagAssociation(request.nodeId, request.tagId);
    if (existing) return existing;

    const association: NodeTagAssociation = {
      id: `${request.nodeId}_${request.tagId}` as NodeTagAssociationId,
      nodeId: request.nodeId,
      tagId: request.tagId,
      assignedAt: Date.now() as Timestamp,
    };

    await this.db.createTagAssociation(association);
    await this.updateTag(request.tagId, { usageCount: tag.usageCount + 1 });
    return association;
  }

  async removeTagFromNode(request: TagAssociationRequest): Promise<boolean> {
    const removed = await this.db.removeTagAssociation(request.nodeId, request.tagId);
    if (removed) {
      const tag = await this.getTag(request.tagId);
      if (tag) await this.updateTag(request.tagId, { usageCount: Math.max(0, tag.usageCount - 1) });
    }
    return removed;
  }

  async getTagsForNode(nodeId: NodeId): Promise<TagEntity[]> {
    const assocs = await this.db.getTagAssociationsForNode(nodeId);
    const tags: TagEntity[] = [];
    for (const a of assocs) {
      const t = await this.getTag(a.tagId);
      if (t) tags.push(t);
    }
    return tags;
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
    const mostUsedTags = [...all].sort((a, b) => b.usageCount - a.usageCount).slice(0, 5);
    const recentTags = [...all].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    return { totalTags: all.length, totalAssociations, mostUsedTags, recentTags };
  }

  generateTagId(): TagId {
    return toTagId(`tag_${generateId()}`);
  }
}
