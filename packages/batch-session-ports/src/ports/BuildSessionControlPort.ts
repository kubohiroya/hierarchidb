import type { NodeId, NodeType } from '@hierarchidb/core-types';

export type BuildSessionPersistedStatus =
  | 'idle'
  | 'startAccepted'
  | 'running'
  | 'completed'
  | 'failed';

export type BuildExecutionStage = 'undefined' | 'idle' | 'fetch' | 'transform' | 'vt';

export type BuildSessionUiRequestState = 'none' | 'startRequested' | 'stopRequested';

export interface BuildSessionSnapshot {
  nodeType: NodeType;
  nodeId: NodeId;
  status: BuildSessionPersistedStatus;
  stage: BuildExecutionStage;
  updatedAt: number;
}

export type BuildSessionSubscriptionCallback = (snapshot: BuildSessionSnapshot) => void;

export interface BuildSessionControlPort {
  subscribeSessionRequest(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: BuildSessionSubscriptionCallback,
  ): Promise<() => void>;
  startSessionRequest(nodeType: NodeType, nodeId: NodeId): Promise<void>;
  stopSessionRequest(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>;
  cancelQueuedSessionRequest(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>;
  nextStageRequest(nodeType: NodeType, nodeId: NodeId): Promise<void>;
}
