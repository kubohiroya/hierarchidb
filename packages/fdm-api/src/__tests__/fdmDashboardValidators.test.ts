import {
  assertFdmDashboardResponse,
  type FdmDashboardResponse,
  type FdmWorkflowNextAction,
  type FdmWorkflowOperationOutcome,
  type FdmWorkflowOperationStatus,
  type FdmWorkflowStatus,
  filterFdmCells,
  normalizeFdmDashboardResponse,
  projectFdmCellAxisKey,
  summarizeFdmCells,
} from '../index.js';

const response: FdmDashboardResponse = {
  node: {
    version: 1,
    connectionName: 'local',
    spaceId: 'space-a',
    viewMode: 'lattice-3d',
    filters: {
      parameterSets: [],
      datasets: [],
      computes: [],
      timelines: [],
    },
    axisMap: {
      xOuter: 'parameterSet',
      xInner: 'dataset',
      y: 'timeline',
      z: 'compute',
    },
    tabularSnapshotRefs: [],
  },
  connectionState: 'connected',
  spaceLabel: 'FDM Space A',
  stateDirectories: ['state-001'],
  selectedStateDir: 'state-001',
  dimensions: {
    parameterSets: [{ id: 'parameter-a', label: 'Parameter A' }],
    datasets: [{ id: 'dataset-a', label: 'Dataset A' }],
    computes: [{ id: 'compute-a', label: 'Compute A' }],
    timelines: [{ id: 'timeline-a', label: 'Timeline A' }],
  },
  cells: [
    {
      id: 'cell-a',
      parameterSet: 'parameter-a',
      dataset: 'dataset-a',
      compute: 'compute-a',
      timeline: 'timeline-a',
      status: 'running',
      progress: 40,
      resultRef: 'result-a',
    },
  ],
  runtimeEvents: [
    {
      id: 'event-a',
      cellId: 'cell-a',
      status: 'running',
      message: 'started',
      occurredAt: '2026-08-30T00:00:00Z',
    },
  ],
  logs: ['job started'],
  directoryEntries: [
    {
      id: 'dir-a',
      label: 'results.csv',
      kind: 'result',
      logicalPath: ['results', 'results.csv'],
      resultRef: 'result-a',
    },
  ],
  resultLocations: [
    {
      cellId: 'cell-a',
      label: 'Tokyo',
      longitude: 139.767,
      latitude: 35.681,
      status: 'running',
    },
  ],
  refreshedAt: '2026-08-30T00:00:00Z',
};

describe('fdm dashboard validators', () => {
  it('accepts a dashboard response without server filesystem identity', () => {
    expect(() => assertFdmDashboardResponse(response)).not.toThrow();
    expect(summarizeFdmCells(response.cells)).toEqual({
      totalCells: 1,
      succeeded: 0,
      running: 1,
      failed: 0,
      blocked: 0,
    });
  });

  it('filters cells with empty arrays as unrestricted dimensions', () => {
    expect(filterFdmCells(response.cells, response.node.filters)).toHaveLength(1);
    expect(
      filterFdmCells(response.cells, { ...response.node.filters, parameterSets: ['missing'] })
    ).toHaveLength(0);
  });

  it('rejects raw server paths and invalid progress', () => {
    expect(() =>
      assertFdmDashboardResponse({
        ...response,
        directoryEntries: [
          { ...response.directoryEntries[0], absolutePath: '/srv/fdm/results.csv' },
        ],
      })
    ).toThrow(/absolutePath/);
    expect(() =>
      assertFdmDashboardResponse({
        ...response,
        cells: [{ ...response.cells[0], progress: 101 }],
      })
    ).toThrow(/progress/);
  });

  it('projects a cell value by dashboard axis', () => {
    expect(projectFdmCellAxisKey(response.cells[0], 'compute')).toBe('compute-a');
    expect(() => projectFdmCellAxisKey(response.cells[0], 'unknown')).toThrow(/axis/);
  });

  it('normalizes legacy profile and checkpoint names into seven-layer dashboard aliases', () => {
    const legacy = {
      ...response,
      node: {
        ...response.node,
        filters: {
          profiles: [],
          datasets: [],
          computes: [],
          checkpoints: [],
        },
        axisMap: {
          xOuter: 'profile',
          xInner: 'dataset',
          y: 'checkpoint',
          z: 'compute',
        },
      },
      dimensions: {
        profiles: [{ id: 'profile-a', label: 'Profile A' }],
        datasets: response.dimensions.datasets,
        computes: response.dimensions.computes,
        checkpoints: [{ id: 'checkpoint-a', label: 'Checkpoint A' }],
      },
      cells: [
        {
          id: 'cell-a',
          profile: 'profile-a',
          dataset: 'dataset-a',
          compute: 'compute-a',
          checkpoint: 'checkpoint-a',
          status: 'running',
          progress: 40,
          resultRef: 'result-a',
        },
      ],
    };

    const { response: normalized, notices } = normalizeFdmDashboardResponse(legacy);

    expect(normalized.dimensions.parameterSets).toEqual(legacy.dimensions.profiles);
    expect(normalized.dimensions.timelines).toEqual(legacy.dimensions.checkpoints);
    expect(normalized.cells[0]).toMatchObject({
      parameterSet: 'profile-a',
      timeline: 'checkpoint-a',
      snapshot: {
        timelineId: 'checkpoint-a',
        resultRef: 'result-a',
      },
    });
    expect(notices.map((notice) => notice.code)).toEqual(
      expect.arrayContaining([
        'LEGACY_PROFILE_ALIAS',
        'LEGACY_CHECKPOINT_ALIAS',
        'CANONICAL_PARAMETER_SET_BACKFILL',
        'CANONICAL_TIMELINE_BACKFILL',
      ])
    );
  });

  it('normalizes canonical parameter set and timeline names for legacy dashboard consumers', () => {
    const canonical = {
      ...response,
      dimensions: {
        parameterSets: [{ id: 'parameter-a', label: 'Parameter A' }],
        datasets: response.dimensions.datasets,
        computes: response.dimensions.computes,
        timelines: [{ id: 'timeline-a', label: 'Timeline A' }],
      },
      cells: [
        {
          id: 'cell-a',
          parameterSet: 'parameter-a',
          dataset: 'dataset-a',
          compute: 'compute-a',
          timeline: 'timeline-a',
          status: 'succeeded',
        },
      ],
    };

    const { response: normalized } = normalizeFdmDashboardResponse(canonical);

    expect(normalized.dimensions.profiles).toEqual(canonical.dimensions.parameterSets);
    expect(normalized.dimensions.checkpoints).toEqual(canonical.dimensions.timelines);
    expect(normalized.cells[0]).toMatchObject({
      profile: 'parameter-a',
      checkpoint: 'timeline-a',
      parameterSet: 'parameter-a',
      timeline: 'timeline-a',
    });
    expect(() => assertFdmDashboardResponse(normalized)).not.toThrow();
  });

  it('rejects conflicting canonical and legacy dashboard aliases', () => {
    expect(() =>
      normalizeFdmDashboardResponse({
        ...response,
        cells: [
          {
            ...response.cells[0],
            timeline: 'timeline-b',
            checkpoint: 'timeline-a',
          },
        ],
      })
    ).toThrow(/conflicts/);

    expect(() =>
      normalizeFdmDashboardResponse({
        ...response,
        dimensions: {
          ...response.dimensions,
          timelines: [{ id: 'timeline-b', label: 'Timeline B' }],
          checkpoints: [{ id: 'timeline-a', label: 'Timeline A' }],
        },
      })
    ).toThrow(/conflicts/);
  });

  it('accepts server-provided workflow and ruleset projections without local inference', () => {
    expect(() =>
      assertFdmDashboardResponse({
        ...response,
        workflow: {
          availability: 'available',
          workflowId: 'workflow-a',
          status: 'WAITING_FOR_AGENT',
          nextAction: 'request-agent-work',
          origin: { spaceId: 'space-a' },
          operations: [
            {
              id: 'verify-baseline',
              label: 'Verify baseline',
              status: 'TERMINAL',
              outcome: 'UNSUPPORTED_CAPABILITY',
              nextAction: 'run-diagnosis',
            },
          ],
        },
        ruleset: {
          availability: 'stale',
          rulesetId: 'ruleset-a',
          fingerprint: 'fingerprint-a',
          acceptedKnownIssues: [
            {
              reason: 'Server omitted the issue number',
            },
          ],
          origin: { spaceId: 'space-a' },
          message: 'Ruleset requires server-side revalidation',
        },
      })
    ).not.toThrow();
  });

  it('accepts every upstream workflow projection enum value explicitly', () => {
    const workflowStatuses: readonly FdmWorkflowStatus[] = [
      'CREATED',
      'PREFLIGHT_FAILED',
      'RUNNING',
      'DIAGNOSING',
      'WAITING_FOR_AGENT',
      'RECHECKING_REPAIR',
      'WAITING_FOR_HUMAN',
      'COMPLETED',
      'COMPLETED_WITH_WAIVER',
      'ABORTED',
      'CANCELLED',
      'VERIFYING_REPAIR',
      'COMPLETE',
    ];
    const operationStatuses: readonly FdmWorkflowOperationStatus[] = [
      'PENDING',
      'READY',
      'RUNNING',
      'TERMINAL',
      'UNKNOWN_AFTER_INTERRUPTION',
    ];
    const operationOutcomes: readonly FdmWorkflowOperationOutcome[] = [
      'SUCCEEDED',
      'DRIFTED',
      'MISSING_ARTIFACT',
      'UNSUPPORTED_CAPABILITY',
      'EXECUTION_FAILED',
      'CANCELLED',
      'SKIPPED',
    ];
    const nextActions: readonly FdmWorkflowNextAction[] = [
      'await-dependency',
      'complete-workflow',
      'execute-operation',
      'request-agent-work',
      'rerun-producer',
      'run-diagnosis',
      'retry-operation',
    ];

    for (const status of workflowStatuses) {
      expect(() =>
        assertFdmDashboardResponse({
          ...response,
          workflow: {
            availability: 'available',
            status,
          },
        })
      ).not.toThrow();
    }

    for (const status of operationStatuses) {
      expect(() =>
        assertFdmDashboardResponse({
          ...response,
          workflow: {
            availability: 'available',
            operations: [{ id: `operation-${status}`, status }],
          },
        })
      ).not.toThrow();
    }

    for (const outcome of operationOutcomes) {
      expect(() =>
        assertFdmDashboardResponse({
          ...response,
          workflow: {
            availability: 'available',
            operations: [{ id: `operation-${outcome}`, status: 'TERMINAL', outcome }],
          },
        })
      ).not.toThrow();
    }

    for (const nextAction of nextActions) {
      expect(() =>
        assertFdmDashboardResponse({
          ...response,
          workflow: {
            availability: 'available',
            nextAction,
            operations: [{ id: `operation-${nextAction}`, status: 'READY', nextAction }],
          },
        })
      ).not.toThrow();
    }
  });

  it('rejects unknown workflow projection enum values', () => {
    expect(() =>
      assertFdmDashboardResponse({
        ...response,
        workflow: {
          availability: 'available',
          status: 'DONE',
        },
      })
    ).toThrow(/workflow.status/);

    expect(() =>
      assertFdmDashboardResponse({
        ...response,
        workflow: {
          availability: 'available',
          operations: [
            {
              id: 'verify-baseline',
              status: 'READY',
              outcome: 'UNKNOWN_OUTCOME',
            },
          ],
        },
      })
    ).toThrow(/workflow.operation.outcome/);
  });
});
