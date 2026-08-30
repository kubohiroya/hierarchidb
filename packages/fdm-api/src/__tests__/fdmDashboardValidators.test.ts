import {
  assertFdmDashboardResponse,
  type FdmDashboardResponse,
  filterFdmCells,
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
    tabularSnapshotRefs: [],
  },
  connectionState: 'connected',
  spaceLabel: 'FDM Space A',
  stateDirectories: ['state-001'],
  selectedStateDir: 'state-001',
  dimensions: {
    profiles: [{ id: 'profile-a', label: 'Profile A' }],
    datasets: [{ id: 'dataset-a', label: 'Dataset A' }],
    computes: [{ id: 'compute-a', label: 'Compute A' }],
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
      filterFdmCells(response.cells, { ...response.node.filters, profiles: ['missing'] })
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
});
