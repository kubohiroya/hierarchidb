import type { NodeId } from '@hierarchidb/core-types';
import { applyStagedFolderActionOverlays } from './applyStagedFolderActionOverlays.js';
import type { CoreDB } from './CoreDB.js';
import { createCopyOnWriteSubtree } from './createCopyOnWriteSubtree.js';
import type {
  StagedFolderActionRunnerDependencies,
  StagedFolderActionRunnerInput,
} from './runStagedFolderAction.js';
import type { StagedFolderActionProgressStore } from './stagedFolderActionProgressStore.js';
import {
  cleanupTemporaryStagingRoot,
  createTemporaryCopyStagingRoot,
} from './temporaryFolderHolderLifecycleUtils.js';

export { createStagedFolderActionCoreRunnerDependencies };

export type CreateStagedFolderActionCoreRunnerDependenciesInput = Pick<
  StagedFolderActionRunnerDependencies,
  | 'now'
  | 'runBuildAction'
  | 'runMapImageCaptureAction'
  | 'runExportFileAction'
  | 'runExportArchiveAction'
  | 'runImportMountAction'
  | 'safeUnmountImportMounts'
  | 'resolveReferences'
> & {
  coreDB: CoreDB;
  progressStore: StagedFolderActionProgressStore;
};

function createStagedFolderActionCoreRunnerDependencies({
  coreDB,
  progressStore,
  now,
  runBuildAction,
  runMapImageCaptureAction,
  runExportFileAction,
  runExportArchiveAction,
  runImportMountAction,
  safeUnmountImportMounts,
  resolveReferences,
}: CreateStagedFolderActionCoreRunnerDependenciesInput): StagedFolderActionRunnerDependencies {
  return {
    progressStore,
    now,
    prepareStaging: (input) => prepareCoreStaging(coreDB, input),
    applyOverlays: async ({ config, stagingRootNodeId }) => {
      if (config.overlay.nodes.length === 0) {
        return;
      }
      await applyStagedFolderActionOverlays(coreDB, {
        stagingMode: config.staging.mode,
        stagingRootNodeId,
        nodes: config.overlay.nodes,
      });
    },
    runBuildAction,
    runMapImageCaptureAction,
    runExportFileAction,
    runExportArchiveAction,
    runImportMountAction,
    safeUnmountImportMounts,
    resolveReferences,
    cleanup: async ({ config, stagingRootNodeId }) => {
      if (config.staging.mode !== 'temporary-copy') {
        return;
      }
      if (config.staging.cleanup === 'retain') {
        return;
      }
      await cleanupTemporaryStagingRoot(coreDB, stagingRootNodeId);
    },
  };
}

async function prepareCoreStaging(coreDB: CoreDB, input: StagedFolderActionRunnerInput) {
  if (input.config.staging.mode === 'patch-source') {
    return { stagingRootNodeId: input.sourceNodeId };
  }
  if (input.config.staging.mode === 'temporary-copy') {
    const root = await createTemporaryCopyStagingRoot(coreDB, {
      sourceNodeId: input.sourceNodeId,
      name: input.config.staging.name,
    });
    return { stagingRootNodeId: root.id as NodeId };
  }
  if (input.outputParentNodeId === undefined) {
    throw new Error('permanent-copy staging runner requires outputParentNodeId');
  }
  const root = await createCopyOnWriteSubtree(coreDB, {
    sourceNodeId: input.sourceNodeId,
    targetParentNodeId: input.outputParentNodeId,
    rootNameOverride: input.config.staging.name,
  });
  return { stagingRootNodeId: root.id as NodeId };
}
