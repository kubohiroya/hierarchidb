import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import { createStagedFolderActionCliExecutionHost } from '../createStagedFolderActionCliExecutionHost.js';
import type { StagedFolderActionCliIo } from '../runStagedFolderActionCli.js';
import { runStagedFolderActionCli } from '../runStagedFolderActionCli.js';
import { runStagedFolderActionBundledCli } from '../runStagedFolderActionCliEntry.js';
import type { StagedFolderActionConfig } from '../StagedFolderActionManifestTypes.js';
import type { StagedFolderActionRunRecord } from '../StagedFolderActionProgressTypes.js';

const emptyConfig: StagedFolderActionConfig = {
  version: 1,
  staging: {
    mode: 'temporary-copy',
    cleanup: 'retain',
  },
  overlay: {
    nodes: [],
  },
  actions: [],
};

const buildConfig: StagedFolderActionConfig = {
  ...emptyConfig,
  staging: {
    mode: 'permanent-copy',
    cleanup: 'retain',
  },
  actions: [{ type: 'build', mode: 'session-manager' }],
};

const mapCaptureConfig: StagedFolderActionConfig = {
  ...emptyConfig,
  actions: [
    { type: 'build', mode: 'session-manager' },
    {
      type: 'map-image-capture',
      mode: 'map-ui',
      output: { path: 'out.png', width: 800, height: 600 },
      viewport: { bbox: [139, 35, 140, 36] },
      layers: [{ path: '.', visible: true }],
    },
  ],
};

describe('createStagedFolderActionCliExecutionHost', () => {
  it('bridges non-dry-run CLI execution into the injected runner', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100);
    const io = createIo({ 'config.json': JSON.stringify(buildConfig) });
    const runStagedFolderAction = vi.fn(async (input) =>
      createCompletedRecord({
        runId: input.runId,
        sourceNodeId: input.sourceNodeId,
        buildSession: {
          nodeType: 'shape' as NodeType,
          nodeId: 'build-node' as NodeId,
          status: 'completed',
        },
      })
    );
    const host = createStagedFolderActionCliExecutionHost({
      runStagedFolderAction,
      createRunId: () => 'run-cli-1',
      now: () => 115,
    });

    const exitCode = await runStagedFolderActionCli(
      [
        '--json',
        '--config',
        'config.json',
        '--source-node-id',
        'source-1',
        '--output-parent-node-id',
        'output-parent',
        '--profile',
        'debug',
      ],
      io,
      { executionHost: host }
    ).finally(() => {
      vi.useRealTimers();
    });
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      runId: string;
      sourceNodeId: string;
      outputParentNodeId: string;
      profileName: string;
      actionResults: Array<{ type: string; buildQueueId: string }>;
      elapsedMs: number;
    };

    expect(exitCode).toBe(0);
    expect(runStagedFolderAction).toHaveBeenCalledWith({
      runId: 'run-cli-1',
      sourceNodeId: 'source-1',
      outputParentNodeId: 'output-parent',
      config: buildConfig,
    });
    expect(result).toMatchObject({
      ok: true,
      runId: 'run-cli-1',
      sourceNodeId: 'source-1',
      outputParentNodeId: 'output-parent',
      profileName: 'debug',
      actionResults: [{ type: 'build', buildQueueId: 'build-node' }],
      elapsedMs: 15,
    });
  });

  it('preserves warnings and pending references from the runner record', async () => {
    const io = createIo({ 'config.json': JSON.stringify(emptyConfig) });
    const host = createStagedFolderActionCliExecutionHost({
      runStagedFolderAction: async (input) =>
        createCompletedRecord({
          runId: input.runId,
          sourceNodeId: input.sourceNodeId,
          warnings: [
            {
              category: 'reference',
              code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
              message: 'reference is pending',
              referencePath: 'imports/shape-a',
            },
          ],
          pendingReferences: [
            {
              status: 'pending',
              code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
              referencePath: 'imports/shape-a',
            },
          ],
        }),
      createRunId: () => 'run-references',
      now: () => 130,
    });

    const exitCode = await runStagedFolderActionCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source-1'],
      io,
      { executionHost: host }
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      warnings: Array<{ referencePath: string }>;
      pendingReferences: Array<{ status: string; referencePath: string }>;
    };

    expect(exitCode).toBe(0);
    expect(result).toMatchObject({
      ok: true,
      warnings: [{ referencePath: 'imports/shape-a' }],
      pendingReferences: [{ status: 'pending', referencePath: 'imports/shape-a' }],
    });
  });

  it('preserves dependency changes from the runner record', async () => {
    const io = createIo({ 'config.json': JSON.stringify(emptyConfig) });
    const host = createStagedFolderActionCliExecutionHost({
      runStagedFolderAction: async (input) =>
        createCompletedRecord({
          runId: input.runId,
          sourceNodeId: input.sourceNodeId,
          dependencyChanges: [
            {
              edgeId: 'edge-1',
              previousStatus: 'active',
              nextStatus: 'stale',
              buildTargetId: 'shape-1' as NodeId,
              targetFieldPath: 'data.source',
              rebuildPlanId: 'plan-1',
            },
          ],
        }),
      createRunId: () => 'run-dependency-changes',
      now: () => 130,
    });

    const exitCode = await runStagedFolderActionCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source-1'],
      io,
      { executionHost: host }
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      dependencyChanges: Array<{
        edgeId: string;
        previousStatus: string;
        nextStatus: string;
        buildTargetId: string;
      }>;
    };

    expect(exitCode).toBe(0);
    expect(result).toMatchObject({
      ok: true,
      dependencyChanges: [
        {
          edgeId: 'edge-1',
          previousStatus: 'active',
          nextStatus: 'stale',
          buildTargetId: 'shape-1',
        },
      ],
    });
  });

  it('includes completed map image capture action results in CLI success JSON', async () => {
    const io = createIo({ 'config.json': JSON.stringify(mapCaptureConfig) });
    const host = createStagedFolderActionCliExecutionHost({
      runStagedFolderAction: async (input) =>
        createCompletedRecord({
          runId: input.runId,
          sourceNodeId: input.sourceNodeId,
          buildSession: {
            nodeType: 'shape' as NodeType,
            nodeId: 'build-node' as NodeId,
            status: 'completed',
          },
        }),
      createRunId: () => 'run-map-success',
      now: () => 130,
    });

    const exitCode = await runStagedFolderActionCli(
      [
        '--json',
        '--config',
        'config.json',
        '--source-node-id',
        'source-1',
        '--browser',
        'headless',
      ],
      io,
      { executionHost: host }
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      actionResults: Array<{
        type: string;
        outputPath?: string;
        width?: number;
        height?: number;
      }>;
    };

    expect(exitCode).toBe(0);
    expect(result).toMatchObject({
      ok: true,
      actionResults: [
        { type: 'build', buildQueueId: 'build-node' },
        {
          type: 'map-image-capture',
          status: 'completed',
          outputPath: 'out.png',
          width: 800,
          height: 600,
        },
      ],
    });
  });

  it('maps missing map image capture host failures to the map-image-capture category', async () => {
    const io = createIo({ 'config.json': JSON.stringify(mapCaptureConfig) });
    const failedRecord = createFailedRecord({
      runId: 'run-map',
      sourceNodeId: 'source-1',
      currentAction: {
        actionIndex: 1,
        actionType: 'map-image-capture',
        phase: 'starting',
        percentage: 0,
      },
    });
    const host = createStagedFolderActionCliExecutionHost({
      runStagedFolderAction: async () => {
        throw new Error('map-image-capture action runner is not configured');
      },
      getRun: async () => failedRecord,
      createRunId: () => 'run-map',
    });

    const exitCode = await runStagedFolderActionCli(
      [
        '--json',
        '--config',
        'config.json',
        '--source-node-id',
        'source-1',
        '--browser',
        'headless',
      ],
      io,
      { executionHost: host }
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      actionIndex: number;
      actionType: string;
      error: { category: string; code: string; actionType: string };
    };

    expect(exitCode).toBe(5);
    expect(result).toMatchObject({
      ok: false,
      actionIndex: 1,
      actionType: 'map-image-capture',
      error: {
        category: 'map-image-capture',
        code: 'STAGED_FOLDER_ACTION_MAP_IMAGE_CAPTURE_HOST_NOT_CONFIGURED',
        actionType: 'map-image-capture',
      },
    });
  });

  it('keeps the original failure classification when progress lookup fails', async () => {
    const io = createIo({ 'config.json': JSON.stringify(emptyConfig) });
    const host = createStagedFolderActionCliExecutionHost({
      runStagedFolderAction: async () => {
        throw new Error('runner failed before progress lookup');
      },
      getRun: async () => {
        throw new Error('progress store unavailable');
      },
      createRunId: () => 'run-progress-unavailable',
    });

    const exitCode = await runStagedFolderActionCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source-1'],
      io,
      { executionHost: host }
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      error: { category: string; code: string; message: string };
    };

    expect(exitCode).toBe(70);
    expect(result).toMatchObject({
      ok: false,
      error: {
        category: 'internal',
        code: 'STAGED_FOLDER_ACTION_RUNNER_FAILED',
        message: 'runner failed before progress lookup',
      },
    });
  });
});

describe('runStagedFolderActionBundledCli', () => {
  it('fails with a profile host-module error instead of the core host-not-configured error', async () => {
    const previousHostModule = process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE;
    delete process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE;
    const io = createIo({ 'config.json': JSON.stringify(emptyConfig) });

    const exitCode = await runStagedFolderActionBundledCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source-1'],
      io
    ).finally(() => {
      if (previousHostModule === undefined) {
        delete process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE;
      } else {
        process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE = previousHostModule;
      }
    });
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      error: { category: string; code: string };
    };

    expect(exitCode).toBe(2);
    expect(result).toMatchObject({
      ok: false,
      error: {
        category: 'profile',
        code: 'STAGED_FOLDER_ACTION_CLI_EXECUTION_HOST_MODULE_REQUIRED',
      },
    });
  });

  it('resolves a relative host module path from the current working directory', async () => {
    const previousHostModule = process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE;
    const previousCwd = process.cwd();
    const tempDir = await mkdtemp(path.join(tmpdir(), 'hdb-staged-folder-action-cli-'));
    process.chdir(tempDir);
    process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE = './host.mjs';
    await writeFile(
      path.join(tempDir, 'host.mjs'),
      `export default {
        run: async (input) => ({
          ok: true,
          version: 1,
          dryRun: false,
          runId: 'run-relative-host',
          sourceNodeId: input.sourceNodeId,
          profileName: input.profileName,
          configPath: input.configPath,
          format: input.format,
          stagingMode: input.config.staging.mode,
          actions: input.config.actions.map((action) => action.type),
          actionResults: [],
          cleanup: { policy: input.config.staging.cleanup, status: 'retained' },
          warnings: [],
          pendingReferences: [],
          dependencyChanges: [],
          elapsedMs: 1
        })
      };`
    );
    const io = createIo({ 'config.json': JSON.stringify(emptyConfig) });

    const exitCode = await runStagedFolderActionBundledCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source-1'],
      io
    ).finally(async () => {
      process.chdir(previousCwd);
      if (previousHostModule === undefined) {
        delete process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE;
      } else {
        process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE = previousHostModule;
      }
      await rm(tempDir, { recursive: true, force: true });
    });
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      runId: string;
      sourceNodeId: string;
    };

    expect(exitCode).toBe(0);
    expect(result).toMatchObject({
      ok: true,
      runId: 'run-relative-host',
      sourceNodeId: 'source-1',
    });
  });

  it('reports host module import failures as profile JSON errors', async () => {
    const previousHostModule = process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE;
    const previousCwd = process.cwd();
    const tempDir = await mkdtemp(path.join(tmpdir(), 'hdb-staged-folder-action-cli-'));
    process.chdir(tempDir);
    process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE = './missing-host.mjs';
    const io = createIo({ 'config.json': JSON.stringify(emptyConfig) });

    const exitCode = await runStagedFolderActionBundledCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source-1'],
      io
    ).finally(async () => {
      process.chdir(previousCwd);
      if (previousHostModule === undefined) {
        delete process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE;
      } else {
        process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE = previousHostModule;
      }
      await rm(tempDir, { recursive: true, force: true });
    });
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      error: { category: string; code: string; cause: string };
    };

    expect(exitCode).toBe(2);
    expect(result).toMatchObject({
      ok: false,
      error: {
        category: 'profile',
        code: 'STAGED_FOLDER_ACTION_CLI_EXECUTION_HOST_MODULE_INVALID',
      },
    });
    expect(result.error.cause).toContain('missing-host.mjs');
  });

  it('rejects host module exports whose run property is not callable', async () => {
    const previousHostModule = process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE;
    const previousCwd = process.cwd();
    const tempDir = await mkdtemp(path.join(tmpdir(), 'hdb-staged-folder-action-cli-'));
    process.chdir(tempDir);
    process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE = './invalid-host.mjs';
    await writeFile(path.join(tempDir, 'invalid-host.mjs'), `export default { run: true };`);
    const io = createIo({ 'config.json': JSON.stringify(emptyConfig) });

    const exitCode = await runStagedFolderActionBundledCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source-1'],
      io
    ).finally(async () => {
      process.chdir(previousCwd);
      if (previousHostModule === undefined) {
        delete process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE;
      } else {
        process.env.HDB_STAGED_FOLDER_ACTION_CLI_HOST_MODULE = previousHostModule;
      }
      await rm(tempDir, { recursive: true, force: true });
    });
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      error: { category: string; code: string };
    };

    expect(exitCode).toBe(2);
    expect(result).toMatchObject({
      ok: false,
      error: {
        category: 'profile',
        code: 'STAGED_FOLDER_ACTION_CLI_EXECUTION_HOST_MODULE_INVALID',
      },
    });
  });
});

type TestRunRecordInput = Partial<StagedFolderActionRunRecord> &
  Pick<StagedFolderActionRunRecord, 'runId' | 'sourceNodeId'>;

function createCompletedRecord(input: TestRunRecordInput): StagedFolderActionRunRecord {
  return {
    runId: input.runId,
    sourceNodeId: input.sourceNodeId,
    stagingRootNodeId: input.stagingRootNodeId ?? ('stage-1' as NodeId),
    status: 'completed',
    phase: 'completed',
    progress: { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 100 },
    warnings: input.warnings ?? [],
    pendingReferences: input.pendingReferences ?? [],
    dependencyChanges: input.dependencyChanges ?? [],
    buildSession: input.buildSession,
    startedAt: 100,
    completedAt: 115,
    updatedAt: 115,
    revision: 1,
  };
}

function createFailedRecord(input: TestRunRecordInput): StagedFolderActionRunRecord {
  return {
    runId: input.runId,
    sourceNodeId: input.sourceNodeId,
    stagingRootNodeId: input.stagingRootNodeId ?? ('stage-1' as NodeId),
    status: 'failed',
    phase: 'failed',
    progress: { total: 1, completed: 0, failed: 1, skipped: 0, percentage: 0 },
    currentAction: input.currentAction,
    error: input.error ?? 'failed',
    warnings: [],
    pendingReferences: [],
    dependencyChanges: input.dependencyChanges ?? [],
    startedAt: 100,
    completedAt: 115,
    updatedAt: 115,
    revision: 1,
  };
}

function createIo(files: Record<string, string>): StagedFolderActionCliIo & {
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    readTextFile: async (filePath) => {
      const content = files[filePath];
      if (content === undefined) {
        throw new Error(`file not found: ${filePath}`);
      }
      return content;
    },
    writeStdout: (text) => {
      stdout.push(text);
    },
    writeStderr: (text) => {
      stderr.push(text);
    },
  };
}
