import type { NodeId } from '@hierarchidb/core-types';
import type {
  NodeTagAssociation,
  TagAssociationScope,
  TagEntity,
  TagId,
} from '@hierarchidb/tag-api';
import type { TagDBPort } from '@hierarchidb/tag';
import type { CoreDB } from '../CoreDB.js';

export class TagDBPortCoreDBAdapter implements TagDBPort {
  constructor(private coreDB: CoreDB) {}

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

  getTagAssociation(
    nodeId: NodeId,
    tagId: TagId,
    scope: TagAssociationScope
  ): Promise<NodeTagAssociation | undefined> {
    return this.coreDB.getTagAssociation(nodeId, tagId, scope);
  }

  removeTagAssociation(nodeId: NodeId, tagId: TagId, scope: TagAssociationScope): Promise<boolean> {
    return this.coreDB.removeTagAssociation(nodeId, tagId, scope);
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
