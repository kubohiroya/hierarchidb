import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import {
  assertFdmDashboardResponse,
  createFdmSpaceCatalogEntries,
  type FdmDashboardResponse,
  normalizeFdmDashboardResponse,
  normalizeFdmNodeData,
} from '../index.js';

type JsonRecord = Record<string, unknown>;

const fixtureRoot = new URL('../__fixtures__/fdm-seven-layer/', import.meta.url);

function readFixture<T extends JsonRecord>(relativePath: string): T {
  const fixtureUrl = new URL(relativePath, fixtureRoot);
  return JSON.parse(readFileSync(fixtureUrl, 'utf8')) as T;
}

function baseDashboardResponse(
  overrides: Partial<FdmDashboardResponse> = {}
): FdmDashboardResponse {
  return {
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
      },
    ],
    runtimeEvents: [],
    logs: [],
    directoryEntries: [],
    resultLocations: [],
    refreshedAt: '2026-09-08T00:00:00Z',
    ...overrides,
  };
}

describe('FDM seven-layer contract fixtures', () => {
  it('loads and validates the L0 timeline/checkpoint compatibility fixture', () => {
    const fixture = readFixture<{
      dimensions: { checkpoints: readonly { id: string; label: string }[] };
      cell: { checkpoint: string };
      expectedTimeline: string;
    }>('l0-timeline/legacy-checkpoint-axis.json');
    const dashboard = baseDashboardResponse();

    const { response, notices } = normalizeFdmDashboardResponse(
      baseDashboardResponse({
        dimensions: {
          parameterSets: dashboard.dimensions.parameterSets,
          datasets: dashboard.dimensions.datasets,
          computes: dashboard.dimensions.computes,
          checkpoints: fixture.dimensions.checkpoints,
        },
        cells: [
          {
            ...dashboard.cells[0],
            timeline: undefined,
            checkpoint: fixture.cell.checkpoint,
          },
        ],
      })
    );

    expect(response.cells[0]?.timeline).toBe(fixture.expectedTimeline);
    expect(notices.map((notice) => notice.code)).toContain('LEGACY_CHECKPOINT_ALIAS');
  });

  it('loads and validates the L1 parameterSet/profile node fixture', () => {
    const fixture = readFixture<{ node: never; expectedFilters: JsonRecord }>(
      'l1-parameter-set/legacy-profile-filter.json'
    );

    const normalized = normalizeFdmNodeData(fixture.node);

    expect(normalized.filters).toEqual(fixture.expectedFilters);
    expect(normalized.axisMap).toEqual({
      xOuter: 'parameterSet',
      xInner: 'dataset',
      y: 'timeline',
      z: 'compute',
    });
  });

  it('loads and validates the L2 resultRef snapshot fixture', () => {
    const fixture = readFixture<{
      cell: { resultRef: string };
      expectedSnapshot: JsonRecord;
    }>('l2-range-snapshot/result-ref-snapshot.json');

    const { response } = normalizeFdmDashboardResponse(
      baseDashboardResponse({
        cells: [{ ...baseDashboardResponse().cells[0], resultRef: fixture.cell.resultRef }],
      })
    );

    expect(response.cells[0]?.snapshot).toEqual(fixture.expectedSnapshot);
  });

  it('loads and validates the L3 runtime event bridge fixture', () => {
    const fixture = readFixture<{ runtimeEvent: FdmDashboardResponse['runtimeEvents'][number] }>(
      'l3-run-job/runtime-event-bridge.json'
    );

    expect(() =>
      assertFdmDashboardResponse(
        baseDashboardResponse({
          runtimeEvents: [fixture.runtimeEvent],
        })
      )
    ).not.toThrow();
  });

  it('loads and validates the L4 workflow projection fixture', () => {
    const fixture = readFixture<{ workflow: FdmDashboardResponse['workflow'] }>(
      'l4-workflow/workflow-projection.json'
    );

    expect(() =>
      assertFdmDashboardResponse(
        baseDashboardResponse({
          workflow: fixture.workflow,
        })
      )
    ).not.toThrow();
  });

  it('loads and validates the L5 ruleset governance fixture', () => {
    const fixture = readFixture<{ ruleset: FdmDashboardResponse['ruleset'] }>(
      'l5-ruleset/ruleset-governance.json'
    );

    expect(() =>
      assertFdmDashboardResponse(
        baseDashboardResponse({
          ruleset: fixture.ruleset,
        })
      )
    ).not.toThrow();
  });

  it('loads and validates the L6 current space catalog fixture without inferring provenance', () => {
    const fixture = readFixture<{
      catalog: Parameters<typeof createFdmSpaceCatalogEntries>[0];
      expectedProvenance: { status: string; reason: string };
    }>('l6-space/space-catalog-current-schema.json');

    const [entry] = createFdmSpaceCatalogEntries(fixture.catalog);

    expect(entry?.provenance).toMatchObject(fixture.expectedProvenance);
    expect(entry?.capability).toMatchObject({ canRead: true, source: 'server' });
  });

  it('loads and validates the L6 capability-present fixture without scoping provenance locally', () => {
    const fixture = readFixture<{
      catalog: Parameters<typeof createFdmSpaceCatalogEntries>[0];
      expectedCapability: JsonRecord;
      expectedProvenance: JsonRecord;
    }>('l6-space/space-catalog-with-capabilities.json');

    const entries = createFdmSpaceCatalogEntries(fixture.catalog);

    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry.capability).toMatchObject({
        canRead: true,
        source: 'server',
        ...fixture.expectedCapability,
      });
      expect(entry.capability).not.toHaveProperty('canFork');
      expect(entry.capability).not.toHaveProperty('canViewAcrossSpaces');
      expect(entry.provenance).toMatchObject({
        spaceId: entry.spaceId,
        ...fixture.expectedProvenance,
      });
    }
  });

  it('rejects negative fixtures for conflicts, credentials, and unknown workflow values', () => {
    const aliasConflict = readFixture<{ cell: JsonRecord; expectedError: string }>(
      'l0-timeline/negative-conflicting-checkpoint-axis.json'
    );
    const credential = readFixture<{ forbidden: JsonRecord; expectedError: string }>(
      'l3-run-job/negative-forbidden-credential-key.json'
    );
    const unknownWorkflow = readFixture<{
      workflow: FdmDashboardResponse['workflow'];
      expectedError: string;
    }>('l4-workflow/negative-unknown-workflow-status.json');

    expect(() =>
      normalizeFdmDashboardResponse(
        baseDashboardResponse({
          cells: [{ ...baseDashboardResponse().cells[0], ...aliasConflict.cell }],
        })
      )
    ).toThrow(aliasConflict.expectedError);
    expect(() =>
      assertFdmDashboardResponse({ ...baseDashboardResponse(), ...credential.forbidden })
    ).toThrow(credential.expectedError);
    expect(() =>
      assertFdmDashboardResponse(baseDashboardResponse({ workflow: unknownWorkflow.workflow }))
    ).toThrow(unknownWorkflow.expectedError);
  });
});
