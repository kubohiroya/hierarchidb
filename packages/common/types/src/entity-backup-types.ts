import type { GroupEntity, PeerEntity } from './entity-types.js';
import type { NodeType } from './id-types.js';
import type { Timestamp } from './primitive-types.js';

export interface EntityBackup<TEntity extends PeerEntity = PeerEntity> {
  entity: TEntity;
  subEntities?: Record<string, GroupEntity[]>;
  metadata: {
    backupDate: Timestamp;
    version: string;
    nodeType: NodeType;
  };
}
