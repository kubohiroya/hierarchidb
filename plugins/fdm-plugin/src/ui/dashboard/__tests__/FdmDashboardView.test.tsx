import '@testing-library/jest-dom/vitest';
import type { FdmDashboardPort, FdmDashboardResponse } from '@hierarchidb/fdm-api';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FdmDashboardView } from '../FdmDashboardView.js';
import { buildFdmLatticePoints } from '../fdmThreeLatticeModel.js';
import { replaceFdmAxisDimension } from '../useFdmDashboardController.js';

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
    parameterSets: [
      { id: 'parameter-a', label: 'Parameter A' },
      { id: 'parameter-b', label: 'Parameter B' },
    ],
    datasets: [
      { id: 'dataset-a', label: 'Dataset A' },
      { id: 'dataset-b', label: 'Dataset B' },
    ],
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
      message: 'running cell',
      resultRef: 'result-a',
    },
    {
      id: 'cell-b',
      parameterSet: 'parameter-b',
      dataset: 'dataset-b',
      compute: 'compute-a',
      timeline: 'timeline-a',
      status: 'succeeded',
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

describe('FdmDashboardView', () => {
  it('renders summary, 3D lattice, 2D matrix, map, feed, directory, and selected cell actions', async () => {
    const port: FdmDashboardPort = {
      loadDashboard: vi.fn().mockResolvedValue(response),
      loadCellDetail: vi.fn().mockResolvedValue({
        cell: response.cells[0],
        startedAt: '2026-08-30T00:00:01Z',
        updatedAt: '2026-08-30T00:00:02Z',
        logPath: 'logs/cell-a.log',
        latestLogLines: ['detail line'],
      }),
      subscribeCellLog: vi.fn((_input, onLog) => {
        onLog({
          cell: response.cells[0],
          logPath: 'logs/cell-a.log',
          latestLogLines: ['live line'],
        });
        return vi.fn();
      }),
      subscribeRuntimeEvents: vi.fn((_input, onEvent) => {
        onEvent({
          id: 'runtime-event-a',
          status: 'running',
          message: 'runtime progress',
          occurredAt: '2026-08-30T00:00:03Z',
        });
        return vi.fn();
      }),
      performAction: vi.fn().mockResolvedValue(response),
    };

    render(<FdmDashboardView node={response.node} port={port} />);

    expect(await screen.findByText('FDM Space A')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'FDM 3D lattice' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /FDM 3D cell cell-a running/ }));
    expect(screen.getByText('running cell')).toBeInTheDocument();
    await waitFor(() => expect(port.loadCellDetail).toHaveBeenCalled());
    await waitFor(() => expect(port.subscribeCellLog).toHaveBeenCalled());
    await waitFor(() => expect(port.subscribeRuntimeEvents).toHaveBeenCalled());
    expect(await screen.findByText('Log logs/cell-a.log')).toBeInTheDocument();
    expect(screen.getByText('detail line')).toBeInTheDocument();
    expect(screen.getByText('live line')).toBeInTheDocument();
    expect(screen.getByText(/runtime progress/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /2D matrix/ }));
    expect(screen.getByRole('grid', { name: 'FDM 2D matrix' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Map/ }));
    expect(screen.getByRole('img', { name: 'FDM result map' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /FDM map result Tokyo/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() =>
      expect(port.performAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'refresh' })
      )
    );
    expect(screen.getAllByText(/started/).length).toBeGreaterThan(0);
    expect(screen.getByText(/results\/results.csv/)).toBeInTheDocument();
  });

  it('renders server-provided workflow and ruleset projections without inferring them', async () => {
    const port: FdmDashboardPort = {
      loadDashboard: vi.fn().mockResolvedValue({
        ...response,
        workflow: {
          availability: 'available',
          workflowId: 'workflow-a',
          status: 'WAITING_FOR_HUMAN',
          nextAction: 'request-agent-work',
          operations: [
            {
              id: 'verify-baseline',
              status: 'TERMINAL',
              outcome: 'UNSUPPORTED_CAPABILITY',
            },
          ],
        },
        ruleset: {
          availability: 'stale',
          rulesetId: 'ruleset-a',
          acceptedKnownIssues: [{ reason: 'Missing server issue number' }],
          message: 'Ruleset requires server-side revalidation',
        },
      }),
      performAction: vi.fn(),
    };

    render(<FdmDashboardView node={response.node} port={port} />);

    expect(await screen.findByText('Workflow')).toBeInTheDocument();
    expect(screen.getByText('WAITING_FOR_HUMAN')).toBeInTheDocument();
    expect(
      screen.getByText(/verify-baseline: TERMINAL \/ UNSUPPORTED_CAPABILITY/)
    ).toBeInTheDocument();
    expect(screen.getByText('Ruleset')).toBeInTheDocument();
    expect(screen.getByText('ruleset-a')).toBeInTheDocument();
    expect(screen.getByText(/accepted known issue: unavailable/)).toBeInTheDocument();
  });

  it('normalizes legacy saved node presentation before loading dashboard data', async () => {
    const legacyNode = {
      ...response.node,
      filters: {
        profiles: ['parameter-a'],
        datasets: [],
        computes: [],
        checkpoints: ['timeline-a'],
      },
      axisMap: {
        xOuter: 'profile',
        xInner: 'dataset',
        y: 'checkpoint',
        z: 'compute',
      },
    };
    const port: FdmDashboardPort = {
      loadDashboard: vi.fn().mockResolvedValue(response),
      performAction: vi.fn().mockResolvedValue(response),
    };

    render(<FdmDashboardView node={legacyNode as never} port={port} />);

    expect(await screen.findByText('FDM Space A')).toBeInTheDocument();
    await waitFor(() =>
      expect(port.loadDashboard).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: {
            parameterSets: ['parameter-a'],
            datasets: [],
            computes: [],
            timelines: ['timeline-a'],
          },
          axisMap: {
            xOuter: 'parameterSet',
            xInner: 'dataset',
            y: 'timeline',
            z: 'compute',
          },
        })
      )
    );
  });

  it('builds deterministic Three.js lattice vectors from axis mapping', () => {
    const points = buildFdmLatticePoints({
      cells: response.cells,
      dimensions: response.dimensions,
      filters: response.node.filters,
      axisMap: response.node.axisMap,
      selectedCellId: 'cell-b',
    });

    expect(
      points.map((point) => [
        point.cell.id,
        point.position.x,
        point.position.y,
        point.position.z,
        point.isSelected,
      ])
    ).toEqual([
      ['cell-a', 0, 0, 0, false],
      ['cell-b', 4, 0, 0, true],
    ]);
  });

  it('swaps axis dimensions so every axis update remains a valid permutation', () => {
    expect(replaceFdmAxisDimension(response.node.axisMap, 'xOuter', 'dataset')).toEqual({
      xOuter: 'dataset',
      xInner: 'parameterSet',
      y: 'timeline',
      z: 'compute',
    });
  });
});
