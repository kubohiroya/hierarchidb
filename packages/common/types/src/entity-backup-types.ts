import { GroupEntity, PeerEntity } from './entity-types';
import { NodeType } from './id-types';
import { Timestamp } from './primitive-types';

export interface EntityBackup<TEntity extends PeerEntity = PeerEntity> {
  entity: TEntity;
  subEntities?: Record<string, GroupEntity[]>;
  metadata: {
    backupDate: Timestamp;
    version: string;
    nodeType: NodeType;
  };
}
