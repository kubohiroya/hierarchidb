import { EntityBackup } from './entity-backup-types';
import { GroupEntity, PeerEntity } from './entity-types';
import { NodeId } from './id-types';
import { WorkingCopyProperties } from './working-copy-types';

// エンティティハンドラー
export interface EntityHandler<
  TEntity extends PeerEntity = PeerEntity,
  TGroupEntity extends GroupEntity = GroupEntity,
  TWorkingCopy extends TEntity & WorkingCopyProperties = TEntity & WorkingCopyProperties,
> {
  // エンティティ操作
  createEntity(nodeId: NodeId, data?: Partial<TEntity>): Promise<TEntity>;
  getEntity(nodeId: NodeId): Promise<TEntity | undefined>;
  updateEntity(nodeId: NodeId, data: Partial<TEntity>): Promise<void>;
  deleteEntity(nodeId: NodeId): Promise<void>;

  // サブエンティティ操作
  createGroupEntity?(nodeId: NodeId, groupEntityType: string, data: TGroupEntity): Promise<void>;
  getGroupEntities?(nodeId: NodeId, groupEntityType: string): Promise<TGroupEntity[]>;
  deleteGroupEntities?(nodeId: NodeId, groupEntityType: string): Promise<void>;

  // ワーキングコピー操作
  createWorkingCopy(nodeId: NodeId): Promise<TWorkingCopy>;
  commitWorkingCopy(nodeId: NodeId, workingCopy: TWorkingCopy): Promise<void>;
  discardWorkingCopy(nodeId: NodeId): Promise<void>;

  // 特殊操作
  duplicate?(nodeId: NodeId, newNodeId: NodeId): Promise<void>;
  backup?(nodeId: NodeId): Promise<EntityBackup<TEntity>>;
  restore?(nodeId: NodeId, backup: EntityBackup<TEntity>): Promise<void>;
  cleanup?(nodeId: NodeId): Promise<void>;
}
