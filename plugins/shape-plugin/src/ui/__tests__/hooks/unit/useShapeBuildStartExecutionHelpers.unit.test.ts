import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  runStartSessionRequest,
  toPersistedStartStatusPatch,
} from '../../../components/build-progress/internal/useShapeBuildSessionControlActions/useShapeBuildStartExecutionConstants';

describe('useShapeBuildStartExecutionHelpers', () => {
  let onTrace: ReturnType<typeof vi.fn>;
  let beginBuildStartupStep: ReturnType<typeof vi.fn>;
  let finishBuildStartupStep: ReturnType<typeof vi.fn>;
  let emitBuildSessionTransitionLog: ReturnType<typeof vi.fn>;
  let advanceBuildSessionTransitionPhase: ReturnType<typeof vi.fn>;
  let updateSessionRecord: ReturnType<typeof vi.fn>;
  let runTimedStep: ReturnType<typeof vi.fn>;
  let bridgeRef: { current: { startBuildSession: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    onTrace = vi.fn();
    beginBuildStartupStep = vi.fn();
    finishBuildStartupStep = vi.fn();
    emitBuildSessionTransitionLog = vi.fn();
    advanceBuildSessionTransitionPhase = vi.fn();
    updateSessionRecord = vi.fn().mockResolvedValue(true);
    runTimedStep = vi.fn((_: string, task: () => Promise<unknown>) => task());
    bridgeRef = {
      current: {
        startBuildSession: vi.fn(async () => ({ status: 'running' as const })),
      },
    };
  });

  it('runStartSessionRequest sends a worker start request and records success trace', async () => {
    const result = await runStartSessionRequest({
      activeNodeId: 'node-start-test',
      bridgeRef,
      onTrace,
      startupSource: 'manual',
      requestStartedAt: 1_700_000_000_000,
      beginBuildStartupStep,
      finishBuildStartupStep,
      emitBuildSessionTransitionLog,
      runTimedStep,
      data: {
        buildConfig: {
          dataSourceName: 'manual-ds',
        },
        selectedArrayByCountries: [],
      },
      advanceBuildSessionTransitionPhase,
    });

    expect(bridgeRef.current.startBuildSession).toHaveBeenCalledWith(
      'shape',
      'node-start-test',
      undefined,
    );
    expect(beginBuildStartupStep).toHaveBeenCalledWith('payload-build', expect.objectContaining({
      source: 'manual',
      mode: 'worker-side',
      dataSource: 'manual-ds',
    }));
    expect(finishBuildStartupStep).toHaveBeenCalledWith(
      'session-start-request',
      'success',
      expect.objectContaining({
        status: 'running',
        hasError: false,
      }),
    );
    expect(emitBuildSessionTransitionLog).toHaveBeenCalledWith(
      'info',
      'start session response',
      expect.objectContaining({ status: 'running', hasError: false }),
    );
    expect(onTrace).toHaveBeenCalledWith(expect.objectContaining({
      event: 'request-finished:success',
      payload: expect.objectContaining({ nextStatus: 'running' }),
    }));
    expect(result.statusResult.status).toBe('running');
  });

  it('runStartSessionRequest uses startBuildSession for resume semantics as well', async () => {
    const result = await runStartSessionRequest({
      activeNodeId: 'node-resume-label-test',
      bridgeRef,
      onTrace,
      startupSource: 'manual',
      requestStartedAt: 1_700_000_000_100,
      beginBuildStartupStep,
      finishBuildStartupStep,
      emitBuildSessionTransitionLog,
      runTimedStep,
      data: {
        buildConfig: { dataSourceName: 'resume-like-ds' },
        selectedArrayByCountries: [],
      },
      advanceBuildSessionTransitionPhase,
      updateSessionRecord,
    });

    expect(bridgeRef.current.startBuildSession).toHaveBeenCalledWith(
      'shape',
      'node-resume-label-test',
      undefined,
    );
    expect(result.statusResult.status).toBe('running');
  });

  it.each(['completed', 'failed'] as const)(
    'persists a terminal endpoint for a %s start response',
    (status) => {
      expect(toPersistedStartStatusPatch(status, 1_700_000_000_200)).toEqual({
        status,
        stopReason: status,
        canResume: false,
        completedAt: 1_700_000_000_200,
      });
    }
  );

  it('does not synthesize a terminal endpoint for a running start response', () => {
    expect(toPersistedStartStatusPatch('running', undefined)).toEqual({
      status: 'running',
      canResume: false,
    });
  });

  it('preserves a paused start response', () => {
    expect(toPersistedStartStatusPatch('paused', undefined)).toEqual({
      status: 'paused',
      canResume: true,
    });
  });

  it.each(['idle', 'queued', 'recycled'] as const)(
    'rejects an unsupported %s start response',
    (status) => {
      expect(() => toPersistedStartStatusPatch(status, undefined)).toThrow(
        `unsupported start response status: ${status}`
      );
    }
  );

  it.each(['completed', 'failed'] as const)(
    'rejects a %s start response without its persisted terminal endpoint',
    (status) => {
      expect(() => toPersistedStartStatusPatch(status, undefined)).toThrow(
        `completedAt is required for terminal status ${status}`
      );
    }
  );
});
