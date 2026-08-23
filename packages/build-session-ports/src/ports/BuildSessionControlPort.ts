import type { NodeId, NodeType } from '@hierarchidb/core-types';

export type BuildSessionInputSource = 'committed' | 'working-copy';

export type BuildSessionPersistedStatus =
  | 'idle'
  | 'startAccepted'
  | 'running'
  | 'completed'
  | 'failed';

export type BuildExecutionStage = 'undefined' | 'idle' | 'source' | 'geometry' | 'tileEmit';

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
  subscribeBuildSession(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: BuildSessionSubscriptionCallback
  ): Promise<() => void>;
  startBuildSession(
    nodeType: NodeType,
    nodeId: NodeId,
    inputSource: BuildSessionInputSource
  ): Promise<void>;
  pauseBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>;
  cancelQueuedBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>;
  nextBuildStageRequest(nodeType: NodeType, nodeId: NodeId): Promise<void>;
}
