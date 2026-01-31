import type { NodeId } from '@hierarchidb/core-types';
import { clearLocationPoints } from '../../services/pointRepository.js';

export const clearLocationDataSourceCache = async (
  nodeId: NodeId,
): Promise<void> => {
  await clearLocationPoints(nodeId);
};
