import type { StyleRecord } from './styleTypes.js';
import type { NodeId } from '@hierarchidb/core-types';

export interface StyleMutationAPI {
  upsertStyle(record: StyleRecord): Promise<void>;
  deleteStyle(nodeId: NodeId): Promise<void>;
}
