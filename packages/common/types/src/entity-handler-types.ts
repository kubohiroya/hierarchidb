import type { EntityBackup } from './entity-backup-types.js';
import type { GroupEntity, PeerEntity } from './entity-types.js';
import type { NodeId } from './id-types.js';

export interface EntityHandler<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
> {
  createEntity(nodeId: NodeId, data?: Partial<TEntity>): Promise<TEntity>;

  getEntity(nodeId: NodeId): Promise<TEntity | undefined>;

  updateEntity(nodeId: NodeId, data: Partial<TEntity>): Promise<void>;

  deleteEntity(nodeId: NodeId): Promise<void>;

  createGroupEntity?(nodeId: NodeId, groupEntityType: string, data: TGroupEntity): Promise<void>;

  getGroupEntities?(nodeId: NodeId, groupEntityType: string): Promise<TGroupEntity[]>;

  deleteGroupEntities?(nodeId: NodeId, groupEntityType: string): Promise<void>;

  createDraft(nodeId: NodeId): Promise<TEntity>;

  commitDraft(nodeId: NodeId, draft: TEntity): Promise<void>;

  discardDraft(nodeId: NodeId): Promise<void>;

  duplicate?(nodeId: NodeId, newNodeId: NodeId): Promise<void>;

  backup?(nodeId: NodeId): Promise<EntityBackup<TEntity>>;

  restore?(nodeId: NodeId, backup: EntityBackup<TEntity>): Promise<void>;

  cleanup?(nodeId: NodeId): Promise<void>;
}
