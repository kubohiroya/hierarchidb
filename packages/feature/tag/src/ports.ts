import type {
  NodeId,
  EntityId,
  TagEntity,
  NodeTagAssociation,
} from '@hierarchidb/common-type';

export interface TagDBPort {
  createTag(tag: TagEntity): Promise<void>;
  getTag(tagId: EntityId): Promise<TagEntity | undefined>;
  updateTag(tag: TagEntity): Promise<void>;
  deleteTag(tagId: EntityId): Promise<void>;
  getAllTags(): Promise<TagEntity[]>;

  createTagAssociation(association: NodeTagAssociation): Promise<void>;
  getTagAssociation(nodeId: NodeId, tagId: EntityId): Promise<NodeTagAssociation | undefined>;
  removeTagAssociation(nodeId: NodeId, tagId: EntityId): Promise<boolean>;
  removeAllTagAssociations(tagId: EntityId): Promise<number>;
  getTagAssociationsForNode(nodeId: NodeId): Promise<NodeTagAssociation[]>;
  getTagAssociationsForTag(tagId: EntityId): Promise<NodeTagAssociation[]>;
  getTotalTagAssociations(): Promise<number>;
}

