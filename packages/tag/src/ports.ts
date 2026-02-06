import type { NodeId } from '@hierarchidb/core-types';
import type { NodeTagAssociation, TagEntity, TagId } from '@hierarchidb/tag-api';

export interface TagDBPort {
  createTag(tag: TagEntity): Promise<void>;

  getTag(tagId: TagId): Promise<TagEntity | undefined>;

  updateTag(tag: TagEntity): Promise<void>;

  deleteTag(tagId: TagId): Promise<void>;

  getAllTags(): Promise<TagEntity[]>;

  createTagAssociation(association: NodeTagAssociation): Promise<void>;

  getTagAssociation(nodeId: NodeId, tagId: TagId): Promise<NodeTagAssociation | undefined>;

  removeTagAssociation(nodeId: NodeId, tagId: TagId): Promise<boolean>;

  removeAllTagAssociations(tagId: TagId): Promise<number>;

  getTagAssociationsForNode(nodeId: NodeId): Promise<NodeTagAssociation[]>;

  getTagAssociationsForTag(tagId: TagId): Promise<NodeTagAssociation[]>;

  getTotalTagAssociations(): Promise<number>;
}
