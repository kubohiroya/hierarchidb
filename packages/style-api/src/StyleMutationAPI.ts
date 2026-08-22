import type { NodeId } from '@hierarchidb/core-types';
import type { StyleRecord } from './styleTypes.js';

export interface StyleMutationAPI {
  upsertStyle(record: StyleRecord): Promise<void>;
  deleteStyle(nodeId: NodeId): Promise<void>;
}
