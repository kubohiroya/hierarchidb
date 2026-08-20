import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildStage } from './shapeBuildTypes.js';

export const LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING =
  'LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING' as const;

export const RESET_LEGACY_BUILD_SESSION_AND_TASKS = 'RESET_LEGACY_BUILD_SESSION_AND_TASKS' as const;

export type ShapeBuildSessionRecoverableContractError = {
  code: typeof LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING;
  recoverable: true;
  nodeId: NodeId;
  table: 'buildStageStatuses';
  field: 'inactiveMs';
  fieldPath: 'buildStageStatuses.inactiveMs';
  stageStatusId: string;
  stage: ShapeBuildStage;
  received: 'undefined';
  message: string;
};

export type ShapeBuildSessionProbeResult =
  | { kind: 'missing' }
  | { kind: 'available' }
  | {
      kind: 'recoverable-contract-error';
      error: ShapeBuildSessionRecoverableContractError;
    };

export type ShapeBuildSessionRecoveryRequest = {
  nodeId: NodeId;
  confirmation: typeof RESET_LEGACY_BUILD_SESSION_AND_TASKS;
  error: ShapeBuildSessionRecoverableContractError;
};

export type ShapeBuildSessionRecoveryDeletedRowCounts = {
  buildSessionConfigs: number;
  buildSessionHeartbeats: number;
  buildSessionStatuses: number;
  buildStageStatuses: number;
  buildTasks: number;
};

export type ShapeBuildSessionRecoveryResult = {
  nodeId: NodeId;
  deletedRowCounts: ShapeBuildSessionRecoveryDeletedRowCounts;
};

export class ShapeBuildSessionContractError extends Error {
  readonly details: ShapeBuildSessionRecoverableContractError;

  constructor(details: ShapeBuildSessionRecoverableContractError) {
    super(details.message);
    this.name = 'ShapeBuildSessionContractError';
    this.details = details;
  }
}

export const isShapeBuildSessionRecoverableContractError = (
  value: unknown
): value is ShapeBuildSessionRecoverableContractError => {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.code === LEGACY_BUILD_STAGE_INACTIVE_MS_MISSING &&
    candidate.recoverable === true &&
    typeof candidate.nodeId === 'string' &&
    candidate.nodeId.length > 0 &&
    candidate.table === 'buildStageStatuses' &&
    candidate.field === 'inactiveMs' &&
    candidate.fieldPath === 'buildStageStatuses.inactiveMs' &&
    typeof candidate.stageStatusId === 'string' &&
    candidate.stageStatusId.length > 0 &&
    (candidate.stage === 'source' ||
      candidate.stage === 'geometry' ||
      candidate.stage === 'tileEmit') &&
    candidate.received === 'undefined' &&
    typeof candidate.message === 'string' &&
    candidate.message.length > 0
  );
};

export const isShapeBuildSessionContractError = (
  value: unknown
): value is ShapeBuildSessionContractError => value instanceof ShapeBuildSessionContractError;
