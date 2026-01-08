import type { NodeId } from '@hierarchidb/common-types';
import { clearLocationPoints } from '../../services/pointRepository.js';

export const clearLocationDataSourceCache = async (
  nodeId: NodeId,
): Promise<void> => {
  await clearLocationPoints(nodeId);
};
