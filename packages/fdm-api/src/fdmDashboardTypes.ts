import type {
  FdmAxisDimension,
  FdmAxisMap,
  FdmFilters,
  FdmNodeData,
  FdmProjectionAvailability,
  FdmProjectionOrigin,
} from './fdmTypes.js';

export type FdmCellStatus = 'idle' | 'queued' | 'running' | 'blocked' | 'succeeded' | 'failed';
export type FdmDashboardConnectionState = 'connected' | 'reconnecting' | 'disconnected' | 'stale';

export interface FdmDimensionValue extends Record<string, unknown> {
  readonly id: string;
  readonly label: string;
}

export interface FdmDashboardDimensions extends Record<string, unknown> {
  readonly parameterSets: readonly FdmDimensionValue[];
  readonly datasets: readonly FdmDimensionValue[];
  readonly computes: readonly FdmDimensionValue[];
  readonly timelines: readonly FdmDimensionValue[];
  readonly rangeProfiles?: readonly FdmDimensionValue[];
  readonly snapshots?: readonly FdmDimensionValue[];
  /** @deprecated Use parameterSets. */
  readonly profiles?: readonly FdmDimensionValue[];
  /** @deprecated Use timelines. */
  readonly checkpoints?: readonly FdmDimensionValue[];
}

export interface FdmSnapshotRef extends Record<string, unknown> {
  readonly timelineId: string;
  readonly checkpoint?: string;
  readonly stateDir?: string;
  readonly resultRef?: string;
}

export interface FdmDashboardCell extends Record<string, unknown> {
  readonly id: string;
  readonly parameterSet: string;
  readonly dataset: string;
  readonly compute: string;
  readonly timeline: string;
  readonly status: FdmCellStatus;
  readonly updatedAt?: string;
  readonly message?: string;
  readonly progress?: number;
  readonly resultRef?: string;
  readonly rangeProfile?: string;
  readonly snapshot?: FdmSnapshotRef;
  /** @deprecated Use parameterSet. */
  readonly profile?: string;
  /** @deprecated Use timeline. */
  readonly checkpoint?: string;
}

export interface FdmDashboardSummary extends Record<string, unknown> {
  readonly totalCells: number;
  readonly succeeded: number;
  readonly running: number;
  readonly failed: number;
  readonly blocked: number;
}

export interface FdmRuntimeEvent extends Record<string, unknown> {
  readonly id: string;
  readonly cellId?: string;
  readonly status: FdmCellStatus;
  readonly message: string;
  readonly occurredAt: string;
}

export interface FdmDirectoryEntry extends Record<string, unknown> {
  readonly id: string;
  readonly label: string;
  readonly kind: 'directory' | 'file' | 'result';
  readonly logicalPath: readonly string[];
  readonly resultRef?: string;
}

export interface FdmResultLocation extends Record<string, unknown> {
  readonly cellId: string;
  readonly label: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly status: FdmCellStatus;
}

export interface FdmDashboardResponse extends Record<string, unknown> {
  readonly node: FdmNodeData;
  readonly connectionState: FdmDashboardConnectionState;
  readonly spaceLabel: string;
  readonly stateDirectories: readonly string[];
  readonly selectedStateDir?: string;
  readonly dimensions: FdmDashboardDimensions;
  readonly cells: readonly FdmDashboardCell[];
  readonly runtimeEvents: readonly FdmRuntimeEvent[];
  readonly logs: readonly string[];
  readonly directoryEntries: readonly FdmDirectoryEntry[];
  readonly resultLocations: readonly FdmResultLocation[];
  readonly workflow?: FdmWorkflowProjection;
  readonly ruleset?: FdmRulesetGovernanceProjection;
  readonly refreshedAt: string;
  readonly compatibility?: readonly FdmCompatibilityNotice[];
}

export type FdmWorkflowStatus =
  | 'CREATED'
  | 'PREFLIGHT_FAILED'
  | 'RUNNING'
  | 'DIAGNOSING'
  | 'WAITING_FOR_AGENT'
  | 'RECHECKING_REPAIR'
  | 'WAITING_FOR_HUMAN'
  | 'COMPLETED'
  | 'COMPLETED_WITH_WAIVER'
  | 'ABORTED'
  | 'CANCELLED'
  | 'VERIFYING_REPAIR'
  | 'COMPLETE';

export type FdmWorkflowOperationStatus =
  | 'PENDING'
  | 'READY'
  | 'RUNNING'
  | 'TERMINAL'
  | 'UNKNOWN_AFTER_INTERRUPTION';

export type FdmWorkflowOperationOutcome =
  | 'SUCCEEDED'
  | 'DRIFTED'
  | 'MISSING_ARTIFACT'
  | 'UNSUPPORTED_CAPABILITY'
  | 'EXECUTION_FAILED'
  | 'CANCELLED'
  | 'SKIPPED';

export type FdmWorkflowNextAction =
  | 'await-dependency'
  | 'complete-workflow'
  | 'execute-operation'
  | 'request-agent-work'
  | 'rerun-producer'
  | 'run-diagnosis'
  | 'retry-operation';

export interface FdmWorkflowOperationProjection extends Record<string, unknown> {
  readonly id: string;
  readonly label?: string;
  readonly status: FdmWorkflowOperationStatus;
  readonly outcome?: FdmWorkflowOperationOutcome;
  readonly nextAction?: FdmWorkflowNextAction;
  readonly message?: string;
  readonly updatedAt?: string;
}

export interface FdmWorkflowProjection extends Record<string, unknown> {
  readonly availability: FdmProjectionAvailability;
  readonly workflowId?: string;
  readonly status?: FdmWorkflowStatus;
  readonly nextAction?: FdmWorkflowNextAction;
  readonly operations?: readonly FdmWorkflowOperationProjection[];
  readonly origin?: FdmProjectionOrigin;
  readonly message?: string;
  readonly updatedAt?: string;
}

export interface FdmAcceptedKnownIssueProjection extends Record<string, unknown> {
  readonly issueNumber?: number;
  readonly issueUrl?: string;
  readonly reason?: string;
}

export interface FdmRulesetGovernanceProjection extends Record<string, unknown> {
  readonly availability: FdmProjectionAvailability;
  readonly rulesetId?: string;
  readonly version?: string;
  readonly fingerprint?: string;
  readonly digest?: string;
  readonly acceptedKnownIssues?: readonly FdmAcceptedKnownIssueProjection[];
  readonly origin?: FdmProjectionOrigin;
  readonly message?: string;
  readonly updatedAt?: string;
}

export type FdmCompatibilityNoticeCode =
  | 'LEGACY_PROFILE_ALIAS'
  | 'LEGACY_CHECKPOINT_ALIAS'
  | 'CANONICAL_PARAMETER_SET_BACKFILL'
  | 'CANONICAL_TIMELINE_BACKFILL';

export interface FdmCompatibilityNotice extends Record<string, unknown> {
  readonly code: FdmCompatibilityNoticeCode;
  readonly path: string;
  readonly message: string;
}

export interface FdmDashboardNormalizationResult extends Record<string, unknown> {
  readonly response: FdmDashboardResponse;
  readonly notices: readonly FdmCompatibilityNotice[];
}

export interface FdmDashboardQuery extends Record<string, unknown> {
  readonly node: FdmNodeData;
  readonly filters: FdmFilters;
  readonly axisMap: FdmAxisMap;
  readonly selectedStateDir?: string;
  readonly signal: AbortSignal;
}

export interface FdmDashboardActionInput extends Record<string, unknown> {
  readonly node: FdmNodeData;
  readonly action: 'refresh' | 'reconnect' | 'run-selected' | 'open-result';
  readonly filters: FdmFilters;
  readonly axisMap: FdmAxisMap;
  readonly selectedStateDir?: string;
  readonly selectedCellId?: string;
  readonly signal: AbortSignal;
}

export interface FdmDashboardCellDetailQuery extends Record<string, unknown> {
  readonly node: FdmNodeData;
  readonly cell: FdmDashboardCell;
  readonly selectedStateDir?: string;
  readonly signal: AbortSignal;
}

export interface FdmDashboardCellDetail extends Record<string, unknown> {
  readonly cell: FdmDashboardCell;
  readonly generatedAt?: string;
  readonly selectedStateDir?: string;
  readonly startedAt?: string;
  readonly updatedAt?: string;
  readonly finishedAt?: string;
  readonly elapsedMs?: number;
  readonly estimatedRemainingMs?: number;
  readonly estimatedCompletedAt?: string;
  readonly logPath?: string;
  readonly latestLogLines: readonly string[];
}

export interface FdmDashboardCellLogSubscriptionInput extends Record<string, unknown> {
  readonly node: FdmNodeData;
  readonly cell: FdmDashboardCell;
  readonly selectedStateDir?: string;
}

export interface FdmDashboardCellLogEvent extends Record<string, unknown> {
  readonly cell: FdmDashboardCell;
  readonly generatedAt?: string;
  readonly logPath?: string;
  readonly latestLogLines: readonly string[];
}

export type FdmDashboardCellLogListener = (event: FdmDashboardCellLogEvent) => void;

export interface FdmDashboardRuntimeEventSubscriptionInput extends Record<string, unknown> {
  readonly node: FdmNodeData;
  readonly selectedStateDir?: string;
}

export type FdmDashboardRuntimeEventListener = (event: FdmRuntimeEvent) => void;

export interface FdmDashboardPort {
  readonly loadDashboard: (query: FdmDashboardQuery) => Promise<FdmDashboardResponse>;
  readonly performAction: (input: FdmDashboardActionInput) => Promise<FdmDashboardResponse>;
  readonly loadCellDetail?: (query: FdmDashboardCellDetailQuery) => Promise<FdmDashboardCellDetail>;
  readonly subscribeCellLog?: (
    input: FdmDashboardCellLogSubscriptionInput,
    onLog: FdmDashboardCellLogListener
  ) => () => void;
  readonly subscribeRuntimeEvents?: (
    input: FdmDashboardRuntimeEventSubscriptionInput,
    onEvent: FdmDashboardRuntimeEventListener
  ) => (() => void) | Promise<() => void>;
}

export const FDM_CELL_STATUSES: readonly FdmCellStatus[] = [
  'idle',
  'queued',
  'running',
  'blocked',
  'succeeded',
  'failed',
] as const;

export const FDM_AXIS_TO_COLLECTION: Record<FdmAxisDimension, keyof FdmDashboardDimensions> = {
  parameterSet: 'parameterSets',
  profile: 'profiles',
  dataset: 'datasets',
  timeline: 'timelines',
  checkpoint: 'checkpoints',
  compute: 'computes',
};
