import { toNodeId } from '@hierarchidb/core-types';
import { describe, expect, it } from 'vitest';
import {
  assertFdmNodeData,
  createFdmNodeData,
  createFdmNodeDataFromDraft,
  createFdmSpaceCatalogEntries,
  FDM_NODE_DATA_V1_DEFAULTS,
  normalizeFdmNodeData,
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
          parameterSets: ['p1'],
          datasets: [],
          computes: ['cpu'],
          timelines: ['2026'],
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
        parameterSets: ['p1'],
        computes: ['cpu'],
        timelines: ['2026'],
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
          xOuter: 'parameterSet',
          xInner: 'parameterSet',
          y: 'timeline',
          z: 'compute',
        },
      })
    ).toThrow('duplicate');
  });

  it('treats empty filters as valid unrestricted dimensions', () => {
    const data = createFdmNodeDataFromDraft({
      connectionName: 'local',
      spaceId: 'space-a',
      filters: {
        parameterSets: [],
        datasets: [],
        computes: [],
        timelines: [],
      },
    });

    expect(data.filters).toEqual(FDM_NODE_DATA_V1_DEFAULTS.filters);
  });

  it('normalizes legacy saved filter and axis names into canonical node data', () => {
    const data = normalizeFdmNodeData({
      version: 1,
      connectionName: 'local',
      spaceId: 'space-a',
      viewMode: 'lattice-3d',
      filters: {
        profiles: ['baseline'],
        datasets: ['world'],
        computes: ['java'],
        checkpoints: ['INIT_WORLD'],
      },
      axisMap: {
        xOuter: 'profile',
        xInner: 'dataset',
        y: 'checkpoint',
        z: 'compute',
      },
      tabularSnapshotRefs: [],
    } as never);

    expect(data.filters).toEqual({
      parameterSets: ['baseline'],
      datasets: ['world'],
      computes: ['java'],
      timelines: ['INIT_WORLD'],
    });
    expect(data.axisMap).toEqual({
      xOuter: 'parameterSet',
      xInner: 'dataset',
      y: 'timeline',
      z: 'compute',
    });
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

  it('projects current space catalog metadata without inferring L6 provenance', () => {
    const entries = createFdmSpaceCatalogEntries({
      defaultSpaceId: 'baseline',
      spaces: [
        {
          spaceId: 'baseline',
          label: 'Baseline',
          defaultSpace: true,
          visible: true,
          archived: false,
          owner: 'team-a',
          layoutVersion: 'v2',
          legacyRoot: false,
          order: 1,
          createdAt: '2026-09-07T00:00:00Z',
          defaults: {
            profile: ['baseline'],
            dataset: ['world'],
            compute: ['java'],
            timeline: ['INIT_WORLD'],
          },
          warnings: ['read-only'],
        },
      ],
    });

    expect(entries).toEqual([
      {
        spaceId: 'baseline',
        label: 'Baseline',
        kind: 'unknown',
        catalog: {
          defaultSpace: true,
          visible: true,
          archived: false,
          owner: 'team-a',
          layoutVersion: 'v2',
          legacyRoot: false,
          order: 1,
          createdAt: '2026-09-07T00:00:00Z',
          defaults: {
            profile: ['baseline'],
            dataset: ['world'],
            compute: ['java'],
            timeline: ['INIT_WORLD'],
          },
          warnings: ['read-only'],
        },
        capability: {
          canRead: true,
          source: 'server',
        },
        provenance: {
          status: 'unavailable',
          spaceId: 'baseline',
          reason: 'FDM_SPACE_PROVENANCE_UNAVAILABLE',
        },
      },
    ]);
  });
});
