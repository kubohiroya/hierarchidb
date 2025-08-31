import { v4 as uuidv4 } from 'uuid';
import type {
  EntityId,
  NodeId,
  NodeTagAssociation,
  TagEntity,
  TagSuggestion,
} from '@hierarchidb/common-type';
import type { 
  CreateTagRequest,
  UpdateTagRequest,
  TagAssociationRequest 
} from '@hierarchidb/common-api';
import type { CoreDB } from '../db/CoreDB';
import type { TagAPI } from '@hierarchidb/common-api';

/**
 * TagService - Worker layer service for tag management
 *
 * Provides centralized tag management functionality that can be accessed
 * from UI through WorkerAPI. Handles CRUD operations for tags and
 * tag-node associations.
 */
export class TagService implements TagAPI {
  constructor(private coreDB: CoreDB) {}

  /**
   * Create a new tag
   */
  async createTag(request: CreateTagRequest): Promise<TagEntity> {
    const tagId = this.generateTagId();
    const now = Date.now();

    const tag: TagEntity = {
      id: tagId,
      name: request.name.trim(),
      color: request.color,
      description: request.description?.trim(),
      category: request.category,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    // Store tag in a dedicated table (implementation depends on CoreDB schema)
    await this.coreDB.createTag(tag);

    return tag;
  }

  /**
   * Get a tag by ID
   */
  async getTag(tagId: TagEntity['id']): Promise<TagEntity | undefined> {
    return await this.coreDB.getTag(tagId);
  }

  /**
   * Update an existing tag
   */
  async updateTag(
    tagId: TagEntity['id'],
    updates: UpdateTagRequest
  ): Promise<TagEntity | undefined> {
    const existing = await this.getTag(tagId);
    if (!existing) {
      throw new Error(`Tag ${tagId} not found`);
    }

    const updated: TagEntity = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
      version: existing.version + 1,
    };

    await this.coreDB.updateTag(updated);
    return updated;
  }

  /**
   * Delete a tag and all its associations
   */
  async deleteTag(tagId: TagEntity['id']): Promise<boolean> {
    const tag = await this.getTag(tagId);
    if (!tag) {
      return false;
    }

    // Remove all associations first
    await this.coreDB.removeAllTagAssociations(tagId);

    // Remove the tag
    await this.coreDB.deleteTag(tagId);

    return true;
  }

  /**
   * Get all tags
   */
  async getAllTags(): Promise<TagEntity[]> {
    return await this.coreDB.getAllTags();
  }

  /**
   * Search tags by name
   */
  async searchTags(query: string): Promise<TagEntity[]> {
    const allTags = await this.getAllTags();
    const normalizedQuery = query.toLowerCase().trim();

    return allTags.filter((tag) => tag.name.toLowerCase().includes(normalizedQuery));
  }

  /**
   * Get tag suggestions for autocomplete
   */
  async getTagSuggestions(query: string, limit: number = 10): Promise<TagSuggestion[]> {
    const matchingTags = await this.searchTags(query);

    return matchingTags
      .sort((a, b) => b.usageCount - a.usageCount) // Sort by usage count
      .slice(0, limit)
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        usageCount: tag.usageCount,
      }));
  }

  /**
   * Associate a tag with a node
   */
  async addTagToNode(request: TagAssociationRequest): Promise<NodeTagAssociation> {
    // Check if tag exists
    const tag = await this.getTag(request.tagId);
    if (!tag) {
      throw new Error(`Tag ${request.tagId} not found`);
    }

    // Check if association already exists
    const existingAssociation = await this.coreDB.getTagAssociation(request.nodeId, request.tagId);
    if (existingAssociation) {
      return existingAssociation;
    }

    const association: NodeTagAssociation = {
      nodeId: request.nodeId,
      tagId: request.tagId,
      createdAt: Date.now(),
    };

    await this.coreDB.createTagAssociation(association);

    // Update tag usage count
    await this.updateTag(request.tagId, {
      ...tag,
      usageCount: tag.usageCount + 1,
    });

    return association;
  }

  /**
   * Remove a tag from a node
   */
  async removeTagFromNode(request: TagAssociationRequest): Promise<boolean> {
    const removed = await this.coreDB.removeTagAssociation(request.nodeId, request.tagId);

    if (removed) {
      // Update tag usage count
      const tag = await this.getTag(request.tagId);
      if (tag && tag.usageCount > 0) {
        await this.updateTag(request.tagId, {
          ...tag,
          usageCount: tag.usageCount - 1,
        });
      }
    }

    return removed;
  }

  /**
   * Get all tags associated with a node
   */
  async getTagsForNode(nodeId: NodeId): Promise<TagEntity[]> {
    const associations = await this.coreDB.getTagAssociationsForNode(nodeId);
    const tags: TagEntity[] = [];

    for (const association of associations) {
      const tag = await this.getTag(association.tagId as unknown as EntityId);
      if (tag) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Get all nodes associated with a tag
   */
  async getNodesByTag(tagId: TagEntity['id']): Promise<NodeTagAssociation[]> {
    return await this.coreDB.getTagAssociationsForTag(tagId);
  }

  /**
   * Get all tag associations for multiple nodes
   */
  async getTagsForNodes(nodeIds: NodeId[]): Promise<Map<NodeId, TagEntity[]>> {
    const result = new Map<NodeId, TagEntity[]>();

    for (const nodeId of nodeIds) {
      const tags = await this.getTagsForNode(nodeId);
      result.set(nodeId, tags);
    }

    return result;
  }

  /**
   * Get tag statistics
   */
  async getTagStats(): Promise<{
    totalTags: number;
    totalAssociations: number;
    mostUsedTags: TagEntity[];
    recentTags: TagEntity[];
  }> {
    const allTags = await this.getAllTags();
    const totalAssociations = await this.coreDB.getTotalTagAssociations();

    const mostUsedTags = [...allTags].sort((a, b) => b.usageCount - a.usageCount).slice(0, 5);

    const recentTags = [...allTags].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

    return {
      totalTags: allTags.length,
      totalAssociations,
      mostUsedTags,
      recentTags,
    };
  }

  /**
   * Generate a unique tag ID using UUID
   */
  generateTagId(): TagEntity['id'] {
    return `tag_${uuidv4()}` as TagEntity['id'];
  }
}
