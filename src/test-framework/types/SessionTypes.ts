// Session-related type definitions

export type NodeId = string;
export type SessionId = string;
export type TaskId = string;

export interface SessionHandle {
  sessionId: SessionId;
  nodeId: NodeId;
  createdAt: number;
}

export interface BuildMetadata {
  nodeId: NodeId;
  buildType: 'new' | 'reset' | 'cache-cleared';
  stages: BuildStage[];
  metadata?: Record<string, unknown>;
}

export type BuildStage = 
  | 'initialization'
  | 'metadata-generation'
  | 'task-creation'
  | 'parallel-execution'
  | 'aggregation'
  | 'completion';

export interface SessionState {
  sessionId: SessionId;
  nodeId: NodeId;
  status: SessionStatus;
  currentStage: BuildStage;
  taskProgress: Record<TaskId, TaskProgress>;
  startTime: number;
  lastUpdateTime: number;
}

export type SessionStatus = 
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'error';

export interface TaskProgress {
  taskId: TaskId;
  status: TaskStatus;
  progress: number; // 0-100
  startTime?: number;
  completionTime?: number;
  error?: string;
}

export type TaskStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export interface TaskSnapshot {
  nodeId: NodeId;
  stage: BuildStage;
  tasks: TaskSummary[];
  generatedAt: number;
  metadata: BuildMetadata;
}

export interface TaskSummary {
  taskId: TaskId;
  name: string;
  stage: BuildStage;
  estimatedDuration?: number;
  dependencies?: TaskId[];
}

export interface SessionResult {
  sessionId: SessionId;
  status: SessionStatus;
  completedAt: number;
  duration: number;
  taskResults: TaskResult[];
  error?: string;
}

export interface TaskResult {
  taskId: TaskId;
  status: TaskStatus;
  duration: number;
  output?: unknown;
  error?: string;
}