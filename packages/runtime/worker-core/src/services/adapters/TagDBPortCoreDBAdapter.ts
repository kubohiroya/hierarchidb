import type { TagDBPort } from '@hierarchidb/tag';
import type { CoreDB } from '../CoreDB.js';
import type { TagId, NodeId, NodeTagAssociation, TagEntity } from '@hierarchidb/common-type';

export class TagDBPortCoreDBAdapter implements TagDBPort {
  constructor(private coreDB: CoreDB) {
  }

  createTag(tag: TagEntity): Promise<void> {
    return this.coreDB.createTag(tag);
  }

  getTag(tagId: TagId): Promise<TagEntity | undefined> {
    return this.coreDB.getTag(tagId);
  }

  updateTag(tag: TagEntity): Promise<void> {
    return this.coreDB.updateTag(tag);
  }

  deleteTag(tagId: TagId): Promise<void> {
    return this.coreDB.deleteTag(tagId);
  }

  getAllTags(): Promise<TagEntity[]> {
    return this.coreDB.getAllTags();
  }

  createTagAssociation(association: NodeTagAssociation): Promise<void> {
    return this.coreDB.createTagAssociation(association);
  }

  getTagAssociation(nodeId: NodeId, tagId: TagId): Promise<NodeTagAssociation | undefined> {
    return this.coreDB.getTagAssociation(nodeId, tagId);
  }

  removeTagAssociation(nodeId: NodeId, tagId: TagId): Promise<boolean> {
    return this.coreDB.removeTagAssociation(nodeId, tagId);
  }

  removeAllTagAssociations(tagId: TagId): Promise<number> {
    return this.coreDB.removeAllTagAssociations(tagId);
  }

  getTagAssociationsForNode(nodeId: NodeId): Promise<NodeTagAssociation[]> {
    return this.coreDB.getTagAssociationsForNode(nodeId);
  }

  getTagAssociationsForTag(tagId: TagId): Promise<NodeTagAssociation[]> {
    return this.coreDB.getTagAssociationsForTag(tagId);
  }

  getTotalTagAssociations(): Promise<number> {
    return this.coreDB.getTotalTagAssociations();
  }
}
