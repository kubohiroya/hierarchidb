import type { TagDBPort } from '@hierarchidb/tag';
import type { CoreDB } from '../CoreDB';
import type { NodeId, EntityId, TagEntity, NodeTagAssociation } from '@hierarchidb/common-type';

export class TagDBPortCoreDBAdapter implements TagDBPort {
  constructor(private coreDB: CoreDB) {}

  createTag(tag: TagEntity): Promise<void> {
    return this.coreDB.createTag(tag);
  }
  getTag(tagId: EntityId): Promise<TagEntity | undefined> {
    return this.coreDB.getTag(tagId);
  }
  updateTag(tag: TagEntity): Promise<void> {
    return this.coreDB.updateTag(tag);
  }
  deleteTag(tagId: EntityId): Promise<void> {
    return this.coreDB.deleteTag(tagId);
  }
  getAllTags(): Promise<TagEntity[]> {
    return this.coreDB.getAllTags();
  }

  createTagAssociation(association: NodeTagAssociation): Promise<void> {
    return this.coreDB.createTagAssociation(association);
  }
  getTagAssociation(nodeId: NodeId, tagId: EntityId): Promise<NodeTagAssociation | undefined> {
    return this.coreDB.getTagAssociation(nodeId, tagId);
  }
  removeTagAssociation(nodeId: NodeId, tagId: EntityId): Promise<boolean> {
    return this.coreDB.removeTagAssociation(nodeId, tagId);
  }
  removeAllTagAssociations(tagId: EntityId): Promise<number> {
    return this.coreDB.removeAllTagAssociations(tagId);
  }
  getTagAssociationsForNode(nodeId: NodeId): Promise<NodeTagAssociation[]> {
    return this.coreDB.getTagAssociationsForNode(nodeId);
  }
  getTagAssociationsForTag(tagId: EntityId): Promise<NodeTagAssociation[]> {
    return this.coreDB.getTagAssociationsForTag(tagId);
  }
  getTotalTagAssociations(): Promise<number> {
    return this.coreDB.getTotalTagAssociations();
  }
}

