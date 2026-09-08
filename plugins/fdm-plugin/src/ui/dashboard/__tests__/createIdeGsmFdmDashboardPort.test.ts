import { FdmContractError, type FdmDashboardPort } from '@hierarchidb/fdm-api';
import { describe, expect, it, vi } from 'vitest';
import { createIdeGsmFdmDashboardPort } from '../createIdeGsmFdmDashboardPort.js';

const node = {
  version: 1,
  connectionName: 'local',
  spaceId: 'space-a',
  viewMode: 'lattice-3d',
  filters: {
    parameterSets: ['parameter-a'],
    datasets: ['dataset-a'],
    computes: ['compute-a'],
    timelines: ['timeline-a'],
  },
  axisMap: {
    xOuter: 'parameterSet',
    xInner: 'dataset',
    y: 'timeline',
    z: 'compute',
  },
  tabularSnapshotRefs: [],
} as const;

describe('createIdeGsmFdmDashboardPort', () => {
  it('loads dashboard status through the current ide-gsm timeline input shape', async () => {
    const client = {
      fdmDashboardStatus: vi.fn().mockResolvedValue({
        generatedAt: '2026-09-07T00:00:00Z',
        selectedSpaceId: 'space-a',
        selectedStateDir: 'state-a',
        availableStateDirs: ['state-a'],
        parameterSet: ['parameter-a'],
        profile: ['parameter-a'],
        dataset: ['dataset-a'],
        compute: ['compute-a'],
        timeline: ['timeline-a'],
        state: { status: 'READY' },
        live: { status: 'RUNNING', startedAt: '2026-09-07T00:00:01Z' },
        startup: null,
        cells: [
          {
            parameterSet: 'parameter-a',
            profile: 'parameter-a',
            dataset: 'dataset-a',
            compute: 'compute-a',
            timelinePoint: 'timeline-a',
            checkpoint: 'timeline-a',
            label: 'cell-a',
            source: null,
            bucket: 'RUNNING',
            rawStatus: 'RUNNING',
            accuracyLabel: null,
            summaryFile: 'summary.json',
            current: true,
            next: false,
            blockingDrift: false,
            variantCount: 1,
          },
        ],
      }),
      fdmCellDetail: vi.fn(),
      subscribeFdmCellLog: vi.fn(),
      fdmSweep: vi.fn(),
    };
    const port: FdmDashboardPort = createIdeGsmFdmDashboardPort(client);

    const response = await port.loadDashboard({
      node,
      filters: node.filters,
      axisMap: node.axisMap,
      selectedStateDir: 'state-a',
      signal: new AbortController().signal,
    });

    expect(client.fdmDashboardStatus).toHaveBeenCalledWith({
      spaceId: 'space-a',
      parameterSet: 'parameter-a',
      dataset: 'dataset-a',
      compute: 'compute-a',
      timeline: 'timeline-a',
      stateDir: 'state-a',
    });
    expect(response).toMatchObject({
      connectionState: 'connected',
      spaceLabel: 'space-a',
      selectedStateDir: 'state-a',
      cells: [
        {
          id: 'parameter-a::dataset-a::compute-a::timeline-a',
          parameterSet: 'parameter-a',
          timeline: 'timeline-a',
          checkpoint: 'timeline-a',
          status: 'running',
          resultRef: 'summary.json',
        },
      ],
      runtimeEvents: [
        {
          status: 'running',
          message: 'RUNNING',
        },
      ],
    });
  });

  it('runs fdmSweep for the selected dashboard cell and reloads status', async () => {
    const statusPayload = {
      generatedAt: '2026-09-07T00:00:00Z',
      selectedSpaceId: 'space-a',
      selectedStateDir: 'state-a',
      availableStateDirs: ['state-a'],
      parameterSet: ['parameter-a'],
      profile: ['parameter-a'],
      dataset: ['dataset-a'],
      compute: ['compute-a'],
      timeline: ['timeline-a'],
      state: { status: 'READY' },
      live: null,
      startup: null,
      cells: [
        {
          parameterSet: 'parameter-a',
          profile: 'parameter-a',
          dataset: 'dataset-a',
          compute: 'compute-a',
          timelinePoint: 'timeline-a',
          checkpoint: 'timeline-a',
          label: 'cell-a',
          source: null,
          bucket: 'READY',
          rawStatus: 'READY',
          accuracyLabel: null,
          summaryFile: null,
          current: false,
          next: true,
          blockingDrift: false,
          variantCount: 1,
        },
      ],
    };
    const client = {
      fdmDashboardStatus: vi.fn().mockResolvedValue(statusPayload),
      fdmCellDetail: vi.fn(),
      subscribeFdmCellLog: vi.fn(),
      fdmSweep: vi.fn().mockResolvedValue({ runId: 'run-1', workflowId: 'workflow-1' }),
    };
    const port = createIdeGsmFdmDashboardPort(client);

    await expect(
      port.performAction({
        node,
        action: 'run-selected',
        filters: node.filters,
        axisMap: node.axisMap,
        selectedStateDir: 'state-a',
        selectedCellId: 'parameter-a::dataset-a::compute-a::timeline-a',
        signal: new AbortController().signal,
      })
    ).resolves.toMatchObject({
      cells: [{ id: 'parameter-a::dataset-a::compute-a::timeline-a' }],
    });

    expect(client.fdmSweep).toHaveBeenCalledWith({
      spaceId: 'space-a',
      parameterSet: ['parameter-a'],
      dataset: ['dataset-a'],
      computeEngine: ['compute-a'],
      timeline: ['timeline-a'],
      stateDir: 'state-a',
    });
    expect(client.fdmDashboardStatus).toHaveBeenCalledTimes(2);
  });

  it('rejects run-selected without a selected dashboard cell', async () => {
    const port = createIdeGsmFdmDashboardPort({
      fdmDashboardStatus: vi.fn().mockResolvedValue({
        generatedAt: '2026-09-07T00:00:00Z',
        selectedSpaceId: 'space-a',
        selectedStateDir: null,
        availableStateDirs: [],
        parameterSet: [],
        profile: [],
        dataset: [],
        compute: [],
        timeline: [],
        state: null,
        live: null,
        startup: null,
        cells: [],
      }),
      fdmCellDetail: vi.fn(),
      subscribeFdmCellLog: vi.fn(),
      fdmSweep: vi.fn(),
    });

    await expect(
      port.performAction({
        node,
        action: 'run-selected',
        filters: node.filters,
        axisMap: node.axisMap,
        selectedCellId: 'cell-a',
        signal: new AbortController().signal,
      })
    ).rejects.toBeInstanceOf(FdmContractError);
  });

  it('loads selected cell detail through the current ide-gsm timelinePoint input shape', async () => {
    const client = {
      fdmDashboardStatus: vi.fn(),
      fdmCellDetail: vi.fn().mockResolvedValue({
        generatedAt: '2026-09-08T00:00:00Z',
        selectedStateDir: 'state-a',
        stage: null,
        startedAt: '2026-09-08T00:00:01Z',
        updatedAt: '2026-09-08T00:00:02Z',
        finishedAt: null,
        elapsedMs: 1000,
        estimatedRemainingMs: 2000,
        estimatedCompletedAt: '2026-09-08T00:00:04Z',
        logPath: 'logs/cell-a.log',
        latestLogLines: ['line 1', 'line 2'],
      }),
      subscribeFdmCellLog: vi.fn(),
      fdmSweep: vi.fn(),
    };
    const port = createIdeGsmFdmDashboardPort(client);

    const detail = await port.loadCellDetail?.({
      node,
      cell: {
        id: 'parameter-a::dataset-a::compute-a::timeline-a',
        parameterSet: 'parameter-a',
        dataset: 'dataset-a',
        compute: 'compute-a',
        timeline: 'timeline-a',
        status: 'running',
      },
      selectedStateDir: 'state-a',
      signal: new AbortController().signal,
    });

    expect(client.fdmCellDetail).toHaveBeenCalledWith({
      spaceId: 'space-a',
      parameterSet: 'parameter-a',
      dataset: 'dataset-a',
      compute: 'compute-a',
      timelinePoint: 'timeline-a',
      stateDir: 'state-a',
    });
    expect(detail).toMatchObject({
      logPath: 'logs/cell-a.log',
      latestLogLines: ['line 1', 'line 2'],
    });
  });

  it('subscribes selected cell logs and maps stream payloads to port events', () => {
    const unsubscribe = vi.fn();
    const client = {
      fdmDashboardStatus: vi.fn(),
      fdmCellDetail: vi.fn(),
      subscribeFdmCellLog: vi.fn((_input, onLog) => {
        onLog({
          generatedAt: '2026-09-08T00:00:00Z',
          stage: null,
          logPath: 'logs/cell-a.log',
          latestLogLines: ['live line'],
        });
        return unsubscribe;
      }),
      fdmSweep: vi.fn(),
    };
    const port = createIdeGsmFdmDashboardPort(client);
    const onLog = vi.fn();

    const dispose = port.subscribeCellLog?.(
      {
        node,
        cell: {
          id: 'parameter-a::dataset-a::compute-a::timeline-a',
          parameterSet: 'parameter-a',
          dataset: 'dataset-a',
          compute: 'compute-a',
          timeline: 'timeline-a',
          status: 'running',
        },
        selectedStateDir: 'state-a',
      },
      onLog
    );

    expect(client.subscribeFdmCellLog).toHaveBeenCalledWith(
      {
        spaceId: 'space-a',
        parameterSet: 'parameter-a',
        dataset: 'dataset-a',
        compute: 'compute-a',
        timelinePoint: 'timeline-a',
        stateDir: 'state-a',
      },
      expect.any(Function)
    );
    expect(onLog).toHaveBeenCalledWith(
      expect.objectContaining({
        logPath: 'logs/cell-a.log',
        latestLogLines: ['live line'],
      })
    );
    dispose?.();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('does not expose runtime event subscription without an injected project path resolver', () => {
    const port = createIdeGsmFdmDashboardPort({
      fdmDashboardStatus: vi.fn(),
      fdmCellDetail: vi.fn(),
      subscribeFdmCellLog: vi.fn(),
      subscribeFdmRuntimeEvents: vi.fn(),
      fdmSweep: vi.fn(),
    });

    expect(port.subscribeRuntimeEvents).toBeUndefined();
  });

  it('subscribes runtime events through a validated resolved project path', async () => {
    const unsubscribe = vi.fn();
    const client = {
      fdmDashboardStatus: vi.fn(),
      fdmCellDetail: vi.fn(),
      subscribeFdmCellLog: vi.fn(),
      subscribeFdmRuntimeEvents: vi.fn((_input, onEvent) => {
        onEvent({
          backendType: 'LOCAL',
          command: 'fdmSweep',
          compute: 'compute-a',
          connectionType: 'local',
          message: 'running sweep',
          phase: 'PROGRESS',
          progress: 50,
          projectRelativePath: 'projects/sample',
          receivedAt: '2026-09-08T00:00:00Z',
          recovered: false,
          taskId: 'task-a',
          username: 'user-a',
          backendMetadata: {},
        });
        return unsubscribe;
      }),
      fdmSweep: vi.fn(),
    };
    const port = createIdeGsmFdmDashboardPort(client, {
      resolveProjectRelativePath: () => 'projects/sample',
    });
    const onEvent = vi.fn();

    const dispose = await port.subscribeRuntimeEvents?.(
      {
        node,
        selectedStateDir: 'state-a',
      },
      onEvent
    );

    expect(client.subscribeFdmRuntimeEvents).toHaveBeenCalledWith(
      {
        projectRelativePath: 'projects/sample',
        stateDir: 'state-a',
      },
      expect.any(Function)
    );
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'fdm-runtime:task-a:2026-09-08T00:00:00Z:PROGRESS',
        status: 'running',
        message: 'running sweep',
        occurredAt: '2026-09-08T00:00:00Z',
      })
    );
    dispose?.();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('rejects unsafe runtime event project paths before subscribing', async () => {
    const subscribeFdmRuntimeEvents = vi.fn();
    const port = createIdeGsmFdmDashboardPort(
      {
        fdmDashboardStatus: vi.fn(),
        fdmCellDetail: vi.fn(),
        subscribeFdmCellLog: vi.fn(),
        subscribeFdmRuntimeEvents,
        fdmSweep: vi.fn(),
      },
      {
        resolveProjectRelativePath: () => '../outside',
      }
    );

    await expect(
      port.subscribeRuntimeEvents?.(
        {
          node,
          selectedStateDir: 'state-a',
        },
        vi.fn()
      )
    ).rejects.toThrow('FDM_RUNTIME_EVENTS_PROJECT_PATH_INVALID');
    expect(subscribeFdmRuntimeEvents).not.toHaveBeenCalled();
  });
});
