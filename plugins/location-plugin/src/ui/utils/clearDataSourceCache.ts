import type { NodeId } from '@hierarchidb/core-types';
import { clearLocationPoints } from '~/services/pointRepository';

export const clearLocationDataSourceCache = async (
  nodeId: NodeId,
): Promise<void> => {
  await clearLocationPoints(nodeId);
};
