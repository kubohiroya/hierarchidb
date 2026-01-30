import type { StyleRecord } from './styleTypes.js';
import type { NodeId } from '@hierarchidb/common-types';

export interface StyleMutationAPI {
  upsertStyle(record: StyleRecord): Promise<void>;
  deleteStyle(nodeId: NodeId): Promise<void>;
}
