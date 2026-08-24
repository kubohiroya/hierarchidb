import { describe, expect, it } from 'vitest';
import {
  runStagedFolderActionCli,
  type StagedFolderActionCliExecutionHost,
  StagedFolderActionCliHostError,
  type StagedFolderActionCliIo,
} from '../runStagedFolderActionCli.js';

const jsonManifest = JSON.stringify({
  version: 1,
  staging: {
    mode: 'temporary-copy',
    cleanup: 'retain',
  },
  overlay: {
    nodes: [],
  },
  actions: [],
});

const yamlManifest = `
version: 1
staging:
  mode: temporary-copy
  cleanup: retain
overlay:
  nodes: []
actions:
  - type: build
    mode: session-manager
  - type: map-image-capture
    mode: map-ui
    output:
      path: out.png
      width: 800
      height: 600
    viewport:
      bbox: [139, 35, 140, 36]
    layers:
      - path: "."
        visible: true
`;

describe('runStagedFolderActionCli', () => {
  it('validates JSON manifests in dry-run mode and writes a JSON result', async () => {
    const io = createIo({ 'config.json': jsonManifest });

    const exitCode = await runStagedFolderActionCli(
      ['--dry-run', '--json', '--config', 'config.json', '--source-node-id', 'source'],
      io
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      dryRun: boolean;
      stagingMode: string;
      profileName: string;
      actions: string[];
    };

    expect(exitCode).toBe(0);
    expect(result).toMatchObject({
      ok: true,
      dryRun: true,
      stagingMode: 'temporary-copy',
      profileName: 'default',
      actions: [],
    });
  });

  it('validates YAML manifests with map image capture browser mode', async () => {
    const io = createIo({ 'config.yaml': yamlManifest });

    const exitCode = await runStagedFolderActionCli(
      [
        '--dry-run',
        '--json',
        '--config',
        'config.yaml',
        '--source-node-id',
        'source',
        '--browser',
        'headless',
        '--profile',
        'debug',
      ],
      io
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      browserMode: string;
      profileName: string;
      actions: string[];
    };

    expect(exitCode).toBe(0);
    expect(result).toMatchObject({
      ok: true,
      browserMode: 'headless',
      profileName: 'debug',
      actions: ['build', 'map-image-capture'],
    });
  });

  it('fails when required CLI arguments are missing', async () => {
    const io = createIo({});

    const exitCode = await runStagedFolderActionCli(['--dry-run', '--json'], io);
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      error: { category: string; code: string };
    };

    expect(exitCode).toBe(1);
    expect(result).toMatchObject({
      ok: false,
      error: {
        category: 'cli',
        code: 'STAGED_FOLDER_ACTION_CLI_MISSING_ARGUMENT',
      },
    });
  });

  it('fails explicitly when execution is requested before host integration exists', async () => {
    const io = createIo({ 'config.json': jsonManifest });

    const exitCode = await runStagedFolderActionCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source'],
      io
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      error: { category: string; code: string };
    };

    expect(exitCode).toBe(1);
    expect(result).toMatchObject({
      ok: false,
      error: {
        category: 'cli',
        code: 'STAGED_FOLDER_ACTION_CLI_EXECUTION_HOST_NOT_CONFIGURED',
      },
    });
  });

  it('runs non-dry execution through an injected host', async () => {
    const io = createIo({ 'config.json': jsonManifest });
    const receivedInputs: Array<{
      sourceNodeId: string;
      profileName: string;
      dryRun?: boolean;
      actionTypes: string[];
    }> = [];
    const host: StagedFolderActionCliExecutionHost = {
      run: async (input) => {
        receivedInputs.push({
          sourceNodeId: input.sourceNodeId,
          profileName: input.profileName,
          actionTypes: input.config.actions.map((action) => action.type),
        });
        return {
          ok: true,
          version: 1,
          dryRun: false,
          runId: 'run-1',
          sourceNodeId: input.sourceNodeId,
          profileName: input.profileName,
          configPath: input.configPath,
          format: input.format,
          stagingMode: input.config.staging.mode,
          actions: input.config.actions.map((action) => action.type),
          stagingRootNodeId: 'stage-1',
          actionResults: [],
          cleanup: {
            policy: input.config.staging.cleanup,
            status: 'retained',
          },
          warnings: [],
          pendingReferences: [],
          dependencyChanges: [],
          elapsedMs: 12,
        };
      },
    };

    const exitCode = await runStagedFolderActionCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source', '--profile', 'debug'],
      io,
      { executionHost: host }
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      dryRun: boolean;
      runId: string;
      profileName: string;
      cleanup: { status: string };
    };

    expect(exitCode).toBe(0);
    expect(receivedInputs).toEqual([
      {
        sourceNodeId: 'source',
        profileName: 'debug',
        actionTypes: [],
      },
    ]);
    expect(result).toMatchObject({
      ok: true,
      dryRun: false,
      runId: 'run-1',
      profileName: 'debug',
      cleanup: {
        status: 'retained',
      },
    });
  });

  it('preserves non-empty reference and dependency result arrays from the injected host', async () => {
    const io = createIo({ 'config.json': jsonManifest });
    const host: StagedFolderActionCliExecutionHost = {
      run: async (input) => ({
        ok: true,
        version: 1,
        dryRun: false,
        runId: 'run-references',
        sourceNodeId: input.sourceNodeId,
        profileName: input.profileName,
        configPath: input.configPath,
        format: input.format,
        stagingMode: input.config.staging.mode,
        actions: input.config.actions.map((action) => action.type),
        stagingRootNodeId: 'stage-1',
        actionResults: [],
        cleanup: {
          policy: input.config.staging.cleanup,
          status: 'retained',
        },
        warnings: [
          {
            category: 'reference',
            code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
            message: 'lazy reference is unresolved',
            dependentNodeId: 'dependent-1',
            referencePath: 'imports/shape-a',
          },
        ],
        pendingReferences: [
          {
            status: 'pending',
            code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
            dependentNodeId: 'dependent-1',
            referencePath: 'imports/shape-a',
            expectedTargetType: 'shape',
          },
          {
            status: 'resolved',
            code: 'STAGED_FOLDER_ACTION_REFERENCE_RESOLVED',
            dependentNodeId: 'dependent-2',
            referencePath: 'imports/shape-b',
            resolvedTargetNodeId: 'target-shape-b',
          },
        ],
        dependencyChanges: [
          {
            edgeId: 'edge-1',
            previousStatus: 'active',
            nextStatus: 'stale',
            sourceNodeId: 'dependent-1',
            targetNodeId: 'dependency-1',
          },
        ],
        elapsedMs: 12,
      }),
    };

    const exitCode = await runStagedFolderActionCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source'],
      io,
      { executionHost: host }
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      warnings: unknown[];
      pendingReferences: Array<{ status: string; referencePath: string }>;
      dependencyChanges: Array<{ edgeId: string; previousStatus: string; nextStatus: string }>;
    };

    expect(exitCode).toBe(0);
    expect(result).toMatchObject({
      ok: true,
      warnings: [
        {
          category: 'reference',
          code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
          referencePath: 'imports/shape-a',
        },
      ],
      pendingReferences: [
        {
          status: 'pending',
          referencePath: 'imports/shape-a',
        },
        {
          status: 'resolved',
          referencePath: 'imports/shape-b',
        },
      ],
      dependencyChanges: [
        {
          edgeId: 'edge-1',
          previousStatus: 'active',
          nextStatus: 'stale',
        },
      ],
    });
  });

  it('returns cleanup exit code when the injected host reports cleanup failure', async () => {
    const io = createIo({ 'config.json': jsonManifest });
    const host: StagedFolderActionCliExecutionHost = {
      run: async (input) => ({
        ok: true,
        version: 1,
        dryRun: false,
        runId: 'run-cleanup-failed',
        sourceNodeId: input.sourceNodeId,
        profileName: input.profileName,
        configPath: input.configPath,
        format: input.format,
        stagingMode: input.config.staging.mode,
        actions: input.config.actions.map((action) => action.type),
        actionResults: [],
        cleanup: {
          policy: input.config.staging.cleanup,
          status: 'failed',
          error: 'cleanup denied',
        },
        warnings: [],
        pendingReferences: [],
        dependencyChanges: [],
        elapsedMs: 12,
      }),
    };

    const exitCode = await runStagedFolderActionCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source'],
      io,
      { executionHost: host }
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      cleanup: { status: string; error: string };
    };

    expect(exitCode).toBe(7);
    expect(result).toMatchObject({
      ok: true,
      cleanup: {
        status: 'failed',
        error: 'cleanup denied',
      },
    });
  });

  it('preserves a typed failure result returned by the injected host', async () => {
    const io = createIo({ 'config.json': jsonManifest });
    const host: StagedFolderActionCliExecutionHost = {
      run: async (input) => ({
        ok: false,
        version: 1,
        dryRun: false,
        runId: 'run-build-failed',
        sourceNodeId: input.sourceNodeId,
        stagingRootNodeId: 'stage-1',
        buildQueueId: 'build-1',
        error: {
          category: 'build',
          code: 'STAGED_FOLDER_ACTION_BUILD_FAILED',
          message: 'build failed',
          runId: 'run-build-failed',
          sourceNodeId: input.sourceNodeId,
          stagingRootNodeId: 'stage-1',
          buildQueueId: 'build-1',
        },
      }),
    };

    const exitCode = await runStagedFolderActionCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source'],
      io,
      { executionHost: host }
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      runId: string;
      error: { category: string; code: string; buildQueueId: string };
    };

    expect(exitCode).toBe(4);
    expect(result).toMatchObject({
      ok: false,
      runId: 'run-build-failed',
      error: {
        category: 'build',
        code: 'STAGED_FOLDER_ACTION_BUILD_FAILED',
        buildQueueId: 'build-1',
      },
    });
  });

  it('returns dependency exit code for typed dependency failures', async () => {
    const io = createIo({ 'config.json': jsonManifest });
    const host: StagedFolderActionCliExecutionHost = {
      run: async (input) => ({
        ok: false,
        version: 1,
        dryRun: false,
        runId: 'run-dependency-failed',
        sourceNodeId: input.sourceNodeId,
        stagingRootNodeId: 'stage-1',
        error: {
          category: 'dependency',
          code: 'STAGED_FOLDER_ACTION_DEPENDENCY_UNRESOLVED',
          message: 'dependency is unresolved',
          runId: 'run-dependency-failed',
          sourceNodeId: input.sourceNodeId,
          stagingRootNodeId: 'stage-1',
          dependentNodeId: 'dependent-1',
          referencePath: 'imports/shape-a',
        },
      }),
    };

    const exitCode = await runStagedFolderActionCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source'],
      io,
      { executionHost: host }
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      error: { category: string; code: string; referencePath: string };
      warnings?: unknown[];
    };

    expect(exitCode).toBe(5);
    expect(result).toMatchObject({
      ok: false,
      error: {
        category: 'dependency',
        code: 'STAGED_FOLDER_ACTION_DEPENDENCY_UNRESOLVED',
        referencePath: 'imports/shape-a',
      },
    });
    expect(result.warnings).toBeUndefined();
  });

  it('preserves a typed host error thrown by the injected host', async () => {
    const io = createIo({ 'config.json': jsonManifest });
    const host: StagedFolderActionCliExecutionHost = {
      run: async (input) => {
        throw new StagedFolderActionCliHostError({
          ok: false,
          version: 1,
          dryRun: false,
          runId: 'run-action-failed',
          sourceNodeId: input.sourceNodeId,
          actionIndex: 0,
          actionType: 'map-image-capture',
          error: {
            category: 'map-image-capture',
            code: 'STAGED_FOLDER_ACTION_MAP_CAPTURE_FAILED',
            message: 'map capture failed',
            runId: 'run-action-failed',
            sourceNodeId: input.sourceNodeId,
            actionIndex: 0,
            actionType: 'map-image-capture',
          },
        });
      },
    };

    const exitCode = await runStagedFolderActionCli(
      ['--json', '--config', 'config.json', '--source-node-id', 'source'],
      io,
      { executionHost: host }
    );
    const result = JSON.parse(io.stdout.join('')) as {
      ok: boolean;
      runId: string;
      actionIndex: number;
      actionType: string;
      error: { category: string; code: string; actionType: string };
    };

    expect(exitCode).toBe(5);
    expect(result).toMatchObject({
      ok: false,
      runId: 'run-action-failed',
      actionIndex: 0,
      actionType: 'map-image-capture',
      error: {
        category: 'map-image-capture',
        code: 'STAGED_FOLDER_ACTION_MAP_CAPTURE_FAILED',
        actionType: 'map-image-capture',
      },
    });
  });
});

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
