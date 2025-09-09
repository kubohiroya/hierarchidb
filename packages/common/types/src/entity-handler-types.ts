import { EntityBackup } from './entity-backup-types';
import { GroupEntity, PeerEntity } from './entity-types';
import { NodeId } from './id-types';

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

  createWorkingCopy(nodeId: NodeId): Promise<TEntity>;

  commitWorkingCopy(nodeId: NodeId, workingCopy: TEntity): Promise<void>;

  discardWorkingCopy(nodeId: NodeId): Promise<void>;

  duplicate?(nodeId: NodeId, newNodeId: NodeId): Promise<void>;

  backup?(nodeId: NodeId): Promise<EntityBackup<TEntity>>;

  restore?(nodeId: NodeId, backup: EntityBackup<TEntity>): Promise<void>;

  cleanup?(nodeId: NodeId): Promise<void>;
}
