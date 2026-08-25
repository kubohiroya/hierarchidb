import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NodeId } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import { createStagedFolderActionCliExecutionHost } from '../createStagedFolderActionCliExecutionHost.js';
import type { StagedFolderActionCliIo } from '../runStagedFolderActionCli.js';
import { runStagedFolderActionCli } from '../runStagedFolderActionCli.js';
import type { StagedFolderActionRunRecord } from '../StagedFolderActionProgressTypes.js';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('staged-folder-action CLI fixture contracts', () => {
  it('matches the representative dry-run fixture JSON output', async () => {
    const io = createFixtureIo();

    const exitCode = await runStagedFolderActionCli(
      [
        '--dry-run',
        '--json',
        '--config',
        'fixtures/manifests/dry-run-temporary-copy.json',
        '--source-node-id',
        'source-fixture',
      ],
      io
    );

    expect(exitCode).toBe(0);
    expect(JSON.parse(io.stdout.join(''))).toEqual(
      await readJsonFixture('expected/dry-run-temporary-copy.json')
    );
    expect(io.stderr).toEqual([]);
  });

  it('matches the representative injected non-dry-run fixture JSON output', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100);
    const io = createFixtureIo();
    const host = createStagedFolderActionCliExecutionHost({
      createRunId: () => 'run-fixture-success',
      now: () => 107,
      runStagedFolderAction: async (input) => ({
        runId: input.runId,
        sourceNodeId: input.sourceNodeId,
        stagingRootNodeId: 'stage-fixture' as NodeId,
        status: 'completed',
        phase: 'completed',
        progress: { total: 2, completed: 2, failed: 0, skipped: 0, percentage: 100 },
        buildSession: {
          nodeType: 'shape',
          nodeId: 'build-fixture' as NodeId,
          status: 'completed',
        },
        warnings: [],
        pendingReferences: [],
        dependencyChanges: [],
        actionResults: [],
        startedAt: 100,
        completedAt: 107,
        updatedAt: 107,
        revision: 1,
      }),
    });

    const exitCode = await runStagedFolderActionCli(
      [
        '--json',
        '--config',
        'fixtures/manifests/non-dry-run-permanent-copy.json',
        '--source-node-id',
        'source-fixture',
        '--output-parent-node-id',
        'output-parent-fixture',
        '--browser',
        'headless',
        '--profile',
        'ci',
      ],
      io,
      { executionHost: host }
    ).finally(() => {
      vi.useRealTimers();
    });

    expect(exitCode).toBe(0);
    expect(JSON.parse(io.stdout.join(''))).toEqual(
      await readJsonFixture('expected/non-dry-run-permanent-copy.json')
    );
    expect(io.stderr).toEqual([]);
  });

  it('keeps export writer failures as typed action failures', async () => {
    const io = createFixtureIo();
    const failedRecord = createFailedRecord({
      runId: 'run-fixture-writer-failure',
      sourceNodeId: 'source-fixture',
      currentAction: {
        actionIndex: 0,
        actionType: 'export-csv',
        phase: 'writing-output',
        percentage: 90,
      },
    });
    const host = createStagedFolderActionCliExecutionHost({
      createRunId: () => 'run-fixture-writer-failure',
      runStagedFolderAction: async () => {
        throw new Error('CSV writer failed');
      },
      getRun: async () => failedRecord,
    });

    const exitCode = await runStagedFolderActionCli(
      [
        '--json',
        '--config',
        'fixtures/manifests/failure-export-writer.json',
        '--source-node-id',
        'source-fixture',
      ],
      io,
      { executionHost: host }
    );

    expect(exitCode).toBe(5);
    expect(JSON.parse(io.stdout.join(''))).toEqual(
      await readJsonFixture('expected/export-writer-failure.json')
    );
  });

  it('keeps dependency contract violations as typed dependency failures', async () => {
    const io = createFixtureIo();
    const failedRecord = createFailedRecord({
      runId: 'run-fixture-dependency-failure',
      sourceNodeId: 'source-fixture',
      phase: 'resolving-references',
      error: 'dependency resolver returned stale edge without rebuild target',
    });
    const host = createStagedFolderActionCliExecutionHost({
      createRunId: () => 'run-fixture-dependency-failure',
      runStagedFolderAction: async () => {
        throw new Error('dependency resolver returned stale edge without rebuild target');
      },
      getRun: async () => failedRecord,
    });

    const exitCode = await runStagedFolderActionCli(
      [
        '--json',
        '--config',
        'fixtures/manifests/dry-run-temporary-copy.json',
        '--source-node-id',
        'source-fixture',
      ],
      io,
      { executionHost: host }
    );

    expect(exitCode).toBe(5);
    expect(JSON.parse(io.stdout.join(''))).toEqual(
      await readJsonFixture('expected/dependency-contract-failure.json')
    );
  });
});

async function readJsonFixture(relativePath: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(fixturesDir, relativePath), 'utf8'));
}

function createFixtureIo(): StagedFolderActionCliIo & {
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    readTextFile: (filePath) =>
      readFile(path.join(fixturesDir, normalizeFixturePath(filePath)), 'utf8'),
    writeStdout: (text) => {
      stdout.push(text);
    },
    writeStderr: (text) => {
      stderr.push(text);
    },
  };
}

function normalizeFixturePath(filePath: string): string {
  return filePath.startsWith('fixtures/') ? filePath.slice('fixtures/'.length) : filePath;
}

function createFailedRecord(
  input: Partial<StagedFolderActionRunRecord> &
    Pick<StagedFolderActionRunRecord, 'runId' | 'sourceNodeId'>
): StagedFolderActionRunRecord {
  return {
    runId: input.runId,
    sourceNodeId: input.sourceNodeId,
    stagingRootNodeId: input.stagingRootNodeId ?? ('stage-fixture' as NodeId),
    status: 'failed',
    phase: input.phase ?? 'failed',
    progress: { total: 1, completed: 0, failed: 1, skipped: 0, percentage: 0 },
    currentAction: input.currentAction,
    error: input.error ?? 'failed',
    warnings: [],
    pendingReferences: [],
    dependencyChanges: [],
    actionResults: [],
    startedAt: 100,
    completedAt: 107,
    updatedAt: 107,
    revision: 1,
  };
}
