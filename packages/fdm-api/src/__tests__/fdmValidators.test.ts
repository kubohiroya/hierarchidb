import { toNodeId } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import {
  assertFdmNodeData,
  createFdmNodeData,
  createFdmNodeDataFromDraft,
  FDM_NODE_DATA_V1_DEFAULTS,
} from '../index.js';

describe('FDM node data contract', () => {
  it('creates complete version 1 data with exact defaults', () => {
    const data = createFdmNodeData({
      connectionName: 'local',
      spaceId: 'space-a',
    });

    expect(data).toEqual({
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
    });
    expect(data).not.toHaveProperty('idegsmProjectNodeId');
    expect(data).not.toHaveProperty('selectedStateDir');
    assertFdmNodeData(data);
  });

  it('preserves existing valid presentation values during edit promotion', () => {
    const existing = createFdmNodeData({
      connectionName: 'local',
      spaceId: 'space-a',
    });
    const edited = createFdmNodeDataFromDraft(
      {
        connectionName: 'remote',
        spaceId: 'space-b',
      },
      {
        ...existing,
        idegsmProjectNodeId: toNodeId('project-node'),
        selectedStateDir: 'states/run-a',
        viewMode: 'matrix-2d',
        filters: {
          profiles: ['p1'],
          datasets: [],
          computes: ['cpu'],
          checkpoints: ['2026'],
        },
        tabularSnapshotRefs: ['snapshot-a'],
      }
    );

    expect(edited).toMatchObject({
      connectionName: 'remote',
      spaceId: 'space-b',
      idegsmProjectNodeId: 'project-node',
      selectedStateDir: 'states/run-a',
      viewMode: 'matrix-2d',
      filters: {
        profiles: ['p1'],
        computes: ['cpu'],
        checkpoints: ['2026'],
      },
      tabularSnapshotRefs: ['snapshot-a'],
    });
  });

  it('rejects forbidden endpoint credentials and duplicated dashboard data', () => {
    for (const field of ['endpoint', 'credentials', 'dashboardState', 'tabularRows']) {
      expect(() =>
        assertFdmNodeData({
          ...FDM_NODE_DATA_V1_DEFAULTS,
          connectionName: 'local',
          spaceId: 'space-a',
          [field]: 'forbidden',
        })
      ).toThrow(field);
    }
  });

  it('rejects invalid axis maps instead of reordering or defaulting them', () => {
    expect(() =>
      createFdmNodeDataFromDraft({
        connectionName: 'local',
        spaceId: 'space-a',
        axisMap: {
          xOuter: 'profile',
          xInner: 'profile',
          y: 'checkpoint',
          z: 'compute',
        },
      })
    ).toThrow('permutation');
  });

  it('treats empty filters as valid unrestricted dimensions', () => {
    const data = createFdmNodeDataFromDraft({
      connectionName: 'local',
      spaceId: 'space-a',
      filters: {
        profiles: [],
        datasets: [],
        computes: [],
        checkpoints: [],
      },
    });

    expect(data.filters).toEqual(FDM_NODE_DATA_V1_DEFAULTS.filters);
  });

  it('does not backfill invalid existing records during edit promotion', () => {
    expect(() =>
      createFdmNodeData({ connectionName: 'local', spaceId: 'space-b' }, {
        ...FDM_NODE_DATA_V1_DEFAULTS,
        connectionName: 'local',
        spaceId: 'space-a',
        viewMode: 'legacy',
      } as never)
    ).toThrow('viewMode');
  });
});
