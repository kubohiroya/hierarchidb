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

  it('rejects run-selected until a confirmed execution contract is available', async () => {
    const port = createIdeGsmFdmDashboardPort({
      fdmDashboardStatus: vi.fn(),
    });

    await expect(
      port.performAction({
        node,
        action: 'run-selected',
        selectedCellId: 'cell-a',
        signal: new AbortController().signal,
      })
    ).rejects.toBeInstanceOf(FdmContractError);
  });
});
