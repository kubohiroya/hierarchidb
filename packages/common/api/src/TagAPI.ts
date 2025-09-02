import type {
  EntityId,
  NodeId,
  NodeTagAssociation,
  TagEntity,
  TagSuggestion,
} from '@hierarchidb/common-type';

export interface CreateTagRequest {
  name: string;
  color: string;
  description?: string;
  category: 'system' | 'user' | 'auto';
}

export interface UpdateTagRequest {
  name?: string;
  color?: string;
  description?: string;
  category?: 'system' | 'user' | 'auto';
  usageCount: number;
}

export interface TagAssociationRequest {
  nodeId: NodeId;
  tagId: EntityId;
}

export interface TagAPI {
  /**
   * Create a new tag
   */
  createTag(request: CreateTagRequest): Promise<TagEntity>;

  /**
   * Get a tag by ID
   */
  getTag(tagId: EntityId): Promise<TagEntity | undefined>;

  /**
   * Update an existing tag
   */
  updateTag(tagId: EntityId, updates: UpdateTagRequest): Promise<TagEntity | undefined>;

  /**
   * Delete a tag and all its associations
   */
  deleteTag(tagId: EntityId): Promise<boolean>;

  /**
   * Get all tags
   */
  getAllTags(): Promise<TagEntity[]>;

  /**
   * Search tags by name
   */
  searchTags(query: string): Promise<TagEntity[]>;

  /**
   * Get tag suggestions for autocomplete
   */
  getTagSuggestions(query: string, limit: number): Promise<TagSuggestion[]>;

  /**
   * Associate a tag with a node
   */
  addTagToNode(request: TagAssociationRequest): Promise<NodeTagAssociation>;

  /**
   * Remove a tag from a node
   */
  removeTagFromNode(request: TagAssociationRequest): Promise<boolean>;

  /**
   * Get all tags associated with a node
   */
  getTagsForNode(nodeId: NodeId): Promise<TagEntity[]>;

  /**
   * Get all nodes associated with a tag
   */
  getNodesByTag(tagId: EntityId): Promise<NodeTagAssociation[]>;

  /**
   * Get all tag associations for multiple nodes
   */
  getTagsForNodes(nodeIds: NodeId[]): Promise<Map<NodeId, TagEntity[]>>;

  /**
   * Get tag statistics
   */
  getTagStats(): Promise<{
    totalTags: number;
    totalAssociations: number;
    mostUsedTags: TagEntity[];
    recentTags: TagEntity[];
  }>;

  /**
   * Generate a unique tag ID using UUID
   */
  generateTagId(): TagEntity['id'];
}
