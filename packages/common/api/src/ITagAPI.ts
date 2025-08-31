import type {
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
}

export interface TagAssociationRequest {
  nodeId: NodeId;
  tagId: TagEntity['id'];
}

export interface ITagAPI {
  /**
   * Create a new tag
   */
  createTag(request: CreateTagRequest): Promise<TagEntity>;

  /**
   * Get a tag by ID
   */
  getTag(tagId: TagEntity['id']): Promise<TagEntity | undefined>;

  /**
   * Update an existing tag
   */
  updateTag(tagId: TagEntity['id'], updates: UpdateTagRequest): Promise<TagEntity | undefined>;

  /**
   * Delete a tag and all its associations
   */
  deleteTag(tagId: TagEntity['id']): Promise<boolean>;

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
  getNodesByTag(tagId: TagEntity['id']): Promise<NodeTagAssociation[]>;

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
