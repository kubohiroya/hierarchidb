import { GroupEntity, PeerEntity } from './entity-types.js';
import { NodeType } from './id-types.js';
import { Timestamp } from './primitive-types.js';

export interface EntityBackup<TEntity extends PeerEntity = PeerEntity> {
  entity: TEntity;
  subEntities?: Record<string, GroupEntity[]>;
  metadata: {
    backupDate: Timestamp;
    version: string;
    nodeType: NodeType;
  };
}
