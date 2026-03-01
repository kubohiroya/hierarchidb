import type { NodeId } from '@hierarchidb/core-types';

type ShapeStagePlan = {
  sourceTotal?: number;
  geometryTotal?: number;
};

const planByNodeId = new Map<string, ShapeStagePlan>();

export const setSourcePlannedTotal = (nodeId: NodeId, total: number): void => {
  const key = String(nodeId);
  const existing = planByNodeId.get(key) ?? {};
  planByNodeId.set(key, { ...existing, sourceTotal: total });
};

export const setGeometryPlannedTotal = (nodeId: NodeId, total: number): void => {
  const key = String(nodeId);
  const existing = planByNodeId.get(key) ?? {};
  planByNodeId.set(key, { ...existing, geometryTotal: total });
};

export const getStagePlan = (nodeId: NodeId): ShapeStagePlan | null => {
  return planByNodeId.get(String(nodeId)) ?? null;
};

export const clearStagePlan = (nodeId: NodeId): void => {
  planByNodeId.delete(String(nodeId));
};
