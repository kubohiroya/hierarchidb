import type { NodeId } from '@hierarchidb/core-types';
import type {
  StagedFolderActionCliActionResult,
  StagedFolderActionCliExecutionFailureResult,
  StagedFolderActionCliExecutionHost,
  StagedFolderActionCliExecutionInput,
  StagedFolderActionCliExecutionSuccessResult,
  StagedFolderActionCliFailureError,
} from './runStagedFolderActionCli.js';
import type {
  StagedFolderActionCliBrowserMode,
  StagedFolderActionConfig,
} from './StagedFolderActionManifestTypes.js';
import type { StagedFolderActionRunRecord } from './StagedFolderActionProgressTypes.js';

export type StagedFolderActionCliRunnerInput = {
  runId: NodeId;
  sourceNodeId: NodeId;
  outputParentNodeId?: NodeId;
  config: StagedFolderActionConfig;
  browserMode?: StagedFolderActionCliBrowserMode;
};

export type StagedFolderActionCliRunner = (
  input: StagedFolderActionCliRunnerInput
) => Promise<StagedFolderActionRunRecord>;

export type CreateStagedFolderActionCliExecutionHostInput = {
  runStagedFolderAction: StagedFolderActionCliRunner;
  getRun?(runId: NodeId): Promise<StagedFolderActionRunRecord | null>;
  createRunId?: () => string;
  now?: () => number;
};

export function createStagedFolderActionCliExecutionHost({
  runStagedFolderAction,
  getRun,
  createRunId = createDefaultRunId,
  now = Date.now,
}: CreateStagedFolderActionCliExecutionHostInput): StagedFolderActionCliExecutionHost {
  return {
    run: async (input) => {
      const runId = createRunId() as NodeId;
      try {
        const record = await runStagedFolderAction({
          runId,
          sourceNodeId: input.sourceNodeId as NodeId,
          ...(input.outputParentNodeId === undefined
            ? {}
            : { outputParentNodeId: input.outputParentNodeId as NodeId }),
          config: input.config,
          ...(input.browserMode === undefined ? {} : { browserMode: input.browserMode }),
        });
        return toSuccessResult(input, record, now());
      } catch (error) {
        const record = await safeGetRun(getRun, runId);
        return toFailureResult(input, runId, error, record);
      }
    },
  };
}

function toSuccessResult(
  input: StagedFolderActionCliExecutionInput,
  record: StagedFolderActionRunRecord,
  completedAt: number
): StagedFolderActionCliExecutionSuccessResult {
  if (record.status !== 'completed') {
    throw new Error(`staged-folder-action runner returned non-completed status: ${record.status}`);
  }
  const buildQueueId = record.buildSession?.nodeId;
  return {
    ok: true,
    version: 1,
    dryRun: false,
    runId: record.runId,
    sourceNodeId: record.sourceNodeId,
    ...(input.outputParentNodeId === undefined
      ? {}
      : { outputParentNodeId: input.outputParentNodeId }),
    ...(input.browserMode === undefined ? {} : { browserMode: input.browserMode }),
    profileName: input.profileName,
    configPath: input.configPath,
    format: input.format,
    stagingMode: input.config.staging.mode,
    actions: input.config.actions.map((action) => action.type),
    ...(record.stagingRootNodeId === undefined
      ? {}
      : { stagingRootNodeId: record.stagingRootNodeId }),
    ...(buildQueueId === undefined ? {} : { buildQueueId }),
    actionResults: toActionResults(input.config, record),
    cleanup: {
      policy: input.config.staging.cleanup,
      status: resolveCleanupStatus(input.config, record),
    },
    warnings: [...(record.warnings ?? [])],
    pendingReferences: [...(record.pendingReferences ?? [])],
    dependencyChanges: [...(record.dependencyChanges ?? [])],
    elapsedMs: completedAt - input.startedAt,
  };
}

function toActionResults(
  config: StagedFolderActionConfig,
  record: StagedFolderActionRunRecord
): StagedFolderActionCliActionResult[] {
  return config.actions.flatMap((action) => {
    if (action.type !== 'build') {
      return [];
    }
    const buildQueueId = record.buildSession?.nodeId;
    if (buildQueueId === undefined) {
      return [];
    }
    return [
      {
        type: 'build',
        status: 'completed',
        buildQueueId,
      },
    ];
  });
}

function resolveCleanupStatus(
  config: StagedFolderActionConfig,
  record: StagedFolderActionRunRecord
): StagedFolderActionCliExecutionSuccessResult['cleanup']['status'] {
  if (config.staging.mode === 'patch-source') {
    return 'not-run';
  }
  if (config.staging.cleanup === 'retain') {
    return 'retained';
  }
  if (record.status === 'completed') {
    return 'deleted';
  }
  return 'failed';
}

function toFailureResult(
  input: StagedFolderActionCliExecutionInput,
  runId: NodeId,
  error: unknown,
  record: StagedFolderActionRunRecord | null
): StagedFolderActionCliExecutionFailureResult {
  const failure = classifyRunnerError(error, record);
  return {
    ok: false,
    version: 1,
    dryRun: false,
    runId,
    sourceNodeId: input.sourceNodeId,
    ...(record?.stagingRootNodeId === undefined
      ? {}
      : { stagingRootNodeId: record.stagingRootNodeId }),
    ...(record?.buildSession?.nodeId === undefined
      ? {}
      : { buildQueueId: record.buildSession.nodeId }),
    ...(record?.currentAction === undefined
      ? {}
      : {
          actionIndex: record.currentAction.actionIndex,
          actionType: record.currentAction.actionType,
        }),
    error: {
      ...failure,
      runId,
      sourceNodeId: input.sourceNodeId,
      ...(record?.stagingRootNodeId === undefined
        ? {}
        : { stagingRootNodeId: record.stagingRootNodeId }),
      ...(record?.buildSession?.nodeId === undefined
        ? {}
        : { buildQueueId: record.buildSession.nodeId }),
      ...(record?.currentAction === undefined
        ? {}
        : {
            actionIndex: record.currentAction.actionIndex,
            actionType: record.currentAction.actionType,
          }),
    },
  };
}

async function safeGetRun(
  getRun: CreateStagedFolderActionCliExecutionHostInput['getRun'],
  runId: NodeId
): Promise<StagedFolderActionRunRecord | null> {
  if (getRun === undefined) {
    return null;
  }
  try {
    return await getRun(runId);
  } catch {
    return null;
  }
}

function classifyRunnerError(
  error: unknown,
  record: StagedFolderActionRunRecord | null
): StagedFolderActionCliFailureError {
  const message = error instanceof Error ? error.message : String(error);
  const actionType = record?.currentAction?.actionType;
  const phase = record?.phase;
  if (actionType === 'map-image-capture') {
    return {
      category: 'map-image-capture',
      code:
        message === 'map-image-capture action runner is not configured'
          ? 'STAGED_FOLDER_ACTION_MAP_IMAGE_CAPTURE_HOST_NOT_CONFIGURED'
          : 'STAGED_FOLDER_ACTION_MAP_IMAGE_CAPTURE_FAILED',
      message,
    };
  }
  if (actionType === 'build' || record?.buildSession?.status === 'failed') {
    return {
      category: 'build',
      code: 'STAGED_FOLDER_ACTION_BUILD_FAILED',
      message,
    };
  }
  if (phase === 'preparing-staging') {
    return {
      category: 'staging',
      code: 'STAGED_FOLDER_ACTION_STAGING_FAILED',
      message,
    };
  }
  if (phase === 'applying-overlay') {
    return {
      category: 'overlay',
      code: 'STAGED_FOLDER_ACTION_OVERLAY_FAILED',
      message,
    };
  }
  if (phase === 'resolving-references') {
    return {
      category: 'reference',
      code: 'STAGED_FOLDER_ACTION_REFERENCE_FAILED',
      message,
    };
  }
  if (actionType !== undefined) {
    return {
      category: 'action',
      code: 'STAGED_FOLDER_ACTION_ACTION_FAILED',
      message,
      actionType,
    };
  }
  return {
    category: 'internal',
    code: 'STAGED_FOLDER_ACTION_RUNNER_FAILED',
    message,
  };
}

function createDefaultRunId(): string {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('staged-folder-action CLI runId generator is not available');
  }
  return crypto.randomUUID();
}
