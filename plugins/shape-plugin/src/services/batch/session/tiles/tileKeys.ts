import type { NodeId } from '@hierarchidb/common-types';

export function buildStageTileKey(nodeId: NodeId, z: number, x: number, y: number): string {
  return `${String(nodeId)}-${z}-${x}-${y}`;
}

