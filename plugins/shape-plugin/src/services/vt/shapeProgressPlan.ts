import type { NodeId } from '@hierarchidb/core-types';

type ShapeStagePlan = {
  transformTotal?: number;
};

const planByNodeId = new Map<string, ShapeStagePlan>();

export const setTransformPlannedTotal = (nodeId: NodeId, total: number): void => {
  const key = String(nodeId);
  const existing = planByNodeId.get(key) ?? {};
  planByNodeId.set(key, { ...existing, transformTotal: total });
};

export const getStagePlan = (nodeId: NodeId): ShapeStagePlan | null => {
  return planByNodeId.get(String(nodeId)) ?? null;
};

export const clearStagePlan = (nodeId: NodeId): void => {
  planByNodeId.delete(String(nodeId));
};
