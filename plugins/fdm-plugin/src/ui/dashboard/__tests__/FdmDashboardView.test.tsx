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
    profiles: [
      { id: 'profile-a', label: 'Profile A' },
      { id: 'profile-b', label: 'Profile B' },
    ],
    datasets: [
      { id: 'dataset-a', label: 'Dataset A' },
      { id: 'dataset-b', label: 'Dataset B' },
    ],
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
      message: 'running cell',
      resultRef: 'result-a',
    },
    {
      id: 'cell-b',
      profile: 'profile-b',
      dataset: 'dataset-b',
      compute: 'compute-a',
      checkpoint: 'checkpoint-a',
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
      performAction: vi.fn().mockResolvedValue(response),
    };

    render(<FdmDashboardView node={response.node} port={port} />);

    expect(await screen.findByText('FDM Space A')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'FDM 3D lattice' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /FDM 3D cell cell-a running/ }));
    expect(screen.getByText('running cell')).toBeInTheDocument();

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
      xInner: 'profile',
      y: 'checkpoint',
      z: 'compute',
    });
  });
});
