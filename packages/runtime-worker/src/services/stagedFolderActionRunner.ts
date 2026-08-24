import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type {
  MapImageCaptureBrowserMode,
  MapImageCaptureIntent,
  StagedFolderAction,
  StagedFolderActionConfig,
} from '@hierarchidb/staged-folder-action';
import { createMapImageCaptureIntent } from '@hierarchidb/staged-folder-action';
import type { StagedFolderActionProgressStore } from './stagedFolderActionProgressStore.js';

export interface StagedFolderActionRunnerInput {
  runId: NodeId;
  sourceNodeId: NodeId;
  config: StagedFolderActionConfig;
  browserMode?: MapImageCaptureBrowserMode;
}

export interface StagedFolderActionPreparedStaging {
  stagingRootNodeId: NodeId;
}

export interface StagedFolderActionBuildResult {
  nodeType: NodeType;
  nodeId: NodeId;
  status: string;
}

export interface StagedFolderActionRunnerDependencies {
  progressStore: StagedFolderActionProgressStore;
  now: () => number;
  prepareStaging(input: StagedFolderActionRunnerInput): Promise<StagedFolderActionPreparedStaging>;
  applyOverlays(input: {
    config: StagedFolderActionConfig;
    stagingRootNodeId: NodeId;
  }): Promise<void>;
  runBuildAction(input: {
    action: Extract<StagedFolderAction, { type: 'build' }>;
    config: StagedFolderActionConfig;
    stagingRootNodeId: NodeId;
    runId: NodeId;
  }): Promise<StagedFolderActionBuildResult>;
  runMapImageCaptureAction?(input: {
    intent: MapImageCaptureIntent;
    config: StagedFolderActionConfig;
    stagingRootNodeId: NodeId;
    runId: NodeId;
  }): Promise<void>;
  cleanup?(input: {
    config: StagedFolderActionConfig;
    stagingRootNodeId: NodeId;
    runId: NodeId;
  }): Promise<void>;
}

export const runStagedFolderAction = async (
  dependencies: StagedFolderActionRunnerDependencies,
  input: StagedFolderActionRunnerInput
) => {
  const { progressStore } = dependencies;
  const startedAt = dependencies.now();
  await progressStore.createRun({
    runId: input.runId,
    sourceNodeId: input.sourceNodeId,
    now: startedAt,
  });

  try {
    await progressStore.updateRun(input.runId, {
      status: 'running',
      phase: 'preparing-staging',
      progress: progressFor(input.config.actions.length, 0),
      updatedAt: dependencies.now(),
    });
    const staging = await dependencies.prepareStaging(input);

    await progressStore.updateRun(input.runId, {
      status: 'running',
      phase: 'applying-overlay',
      stagingRootNodeId: staging.stagingRootNodeId,
      progress: progressFor(input.config.actions.length, 0),
      updatedAt: dependencies.now(),
    });
    await dependencies.applyOverlays({
      config: input.config,
      stagingRootNodeId: staging.stagingRootNodeId,
    });

    for (const [actionIndex, action] of input.config.actions.entries()) {
      await runAction(dependencies, input, staging.stagingRootNodeId, action, actionIndex);
    }

    if (dependencies.cleanup) {
      await progressStore.updateRun(input.runId, {
        status: 'running',
        phase: 'cleanup',
        progress: progressFor(input.config.actions.length, input.config.actions.length),
        updatedAt: dependencies.now(),
      });
      await dependencies.cleanup({
        config: input.config,
        stagingRootNodeId: staging.stagingRootNodeId,
        runId: input.runId,
      });
    }

    return progressStore.updateRun(input.runId, {
      status: 'completed',
      phase: 'completed',
      currentAction: undefined,
      progress: progressFor(input.config.actions.length, input.config.actions.length),
      completedAt: dependencies.now(),
      updatedAt: dependencies.now(),
    });
  } catch (error) {
    await progressStore.updateRun(input.runId, {
      status: 'failed',
      phase: 'failed',
      error: error instanceof Error ? error.message : String(error),
      completedAt: dependencies.now(),
      updatedAt: dependencies.now(),
    });
    throw error;
  }
};

const runAction = async (
  dependencies: StagedFolderActionRunnerDependencies,
  input: StagedFolderActionRunnerInput,
  stagingRootNodeId: NodeId,
  action: StagedFolderAction,
  actionIndex: number
): Promise<void> => {
  const progressStore = dependencies.progressStore;
  await progressStore.updateRun(input.runId, {
    status: 'running',
    phase: 'running-action',
    currentAction: {
      actionIndex,
      actionType: action.type,
      phase: 'starting',
      percentage: 0,
    },
    progress: progressFor(input.config.actions.length, actionIndex),
    updatedAt: dependencies.now(),
  });

  if (action.type === 'build') {
    const buildSession = await dependencies.runBuildAction({
      action,
      config: input.config,
      stagingRootNodeId,
      runId: input.runId,
    });
    await progressStore.updateRun(input.runId, {
      status: 'running',
      phase: 'running-action',
      currentAction: {
        actionIndex,
        actionType: action.type,
        phase: 'completed',
        percentage: 100,
      },
      buildSession,
      progress: progressFor(input.config.actions.length, actionIndex + 1),
      updatedAt: dependencies.now(),
    });
    return;
  }

  if (action.type === 'map-image-capture') {
    if (!dependencies.runMapImageCaptureAction) {
      throw new Error('map-image-capture action runner is not configured');
    }
    if (!input.browserMode) {
      throw new Error('map-image-capture action requires browserMode');
    }
    const intent = createMapImageCaptureIntent({
      action,
      actionIndex,
      runId: input.runId,
      stagingRootNodeId,
      browserMode: input.browserMode,
    });
    await progressStore.putMapImageCaptureIntent(intent, dependencies.now());
    await dependencies.runMapImageCaptureAction({
      intent,
      config: input.config,
      stagingRootNodeId,
      runId: input.runId,
    });
    await progressStore.updateRun(input.runId, {
      status: 'running',
      phase: 'running-action',
      currentAction: {
        actionIndex,
        actionType: action.type,
        phase: 'completed',
        percentage: 100,
      },
      progress: progressFor(input.config.actions.length, actionIndex + 1),
      updatedAt: dependencies.now(),
    });
    return;
  }

  throw new Error(`staged-folder-action runner for ${action.type} is not configured`);
};

const progressFor = (total: number, completed: number) => ({
  total,
  completed,
  failed: 0,
  skipped: 0,
  percentage: total === 0 ? 100 : (completed / total) * 100,
});
