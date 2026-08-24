import type { NodeId } from '@hierarchidb/core-types';
import type { StagedFolderActionRunRecord } from '@hierarchidb/staged-folder-action';
import {
  createStagedFolderActionCliExecutionHost,
  type StagedFolderActionCliExecutionHost,
} from '@hierarchidb/staged-folder-action';
import type { RunStagedFolderActionInput } from '@hierarchidb/worker-api';

export type CreateStagedFolderActionCliWorkerExecutionHostInput = {
  runStagedFolderAction(input: RunStagedFolderActionInput): Promise<StagedFolderActionRunRecord>;
  getRun?(runId: NodeId): Promise<StagedFolderActionRunRecord | null>;
  createRunId?: () => string;
  now?: () => number;
};

export function createStagedFolderActionCliWorkerExecutionHost({
  runStagedFolderAction,
  getRun,
  createRunId,
  now,
}: CreateStagedFolderActionCliWorkerExecutionHostInput): StagedFolderActionCliExecutionHost {
  return createStagedFolderActionCliExecutionHost({
    runStagedFolderAction,
    ...(getRun === undefined ? {} : { getRun }),
    ...(createRunId === undefined ? {} : { createRunId }),
    ...(now === undefined ? {} : { now }),
  });
}
