import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { LocationWorkingCopy } from '../../../types/index.js';
import { LocationMapPreviewStep } from '../LocationMapPreviewStep.js';
import { en } from '../../../i18n/en.js';

const {
  mapPreviewSpy,
  getEphemeralLocationDBMock,
  listLocationPointsMock,
} = vi.hoisted(() => ({
  mapPreviewSpy: vi.fn(),
  getEphemeralLocationDBMock: vi.fn(),
  listLocationPointsMock: vi.fn(),
}));

vi.mock('../batch/LocationMapPreview.js', () => ({
  LocationMapPreview: (props: unknown) => {
    mapPreviewSpy(props);
    return React.createElement('div', { 'data-testid': 'map-preview' });
  },
}));

const summaryMock = {
  exists: true,
  tiles: 3,
  zoomRange: [4, 12] as [number, number],
  layers: ['location_points'],
  sizeBytes: 2048,
};

const getSessionSummary = vi.fn(async () => summaryMock);

vi.mock('../../../services/tiles/LocationVectorTileService.js', () => ({
  LocationVectorTileService: vi.fn(() => ({
    getSessionSummary,
  })),
}));

const sessionsTable = {
  where: vi.fn(() => ({
    equals: vi.fn(() => ({
      toArray: vi.fn(async () => ([{ sessionId: 'session-1', nodeId: 'node-1', createdAt: 10 }])),
    })),
  })),
};

const emptySessionsTable = {
  where: vi.fn(() => ({
    equals: vi.fn(() => ({
      toArray: vi.fn(async () => ([])),
    })),
  })),
};

vi.mock('../../../services/database/EphemeralLocationDB.js', () => ({
  __esModule: true,
  getEphemeralLocationDB: getEphemeralLocationDBMock,
}));

vi.mock('../../../services/pointRepository.js', () => ({
  __esModule: true,
  listLocationPoints: listLocationPointsMock,
}));

const baseWorkingCopy: LocationWorkingCopy = {
  id: 'node-1',
  nodeId: 'node-1',
  version: 1,
} as unknown as LocationWorkingCopy;

describe('LocationMapPreviewStep', () => {
  beforeEach(() => {
    getSessionSummary.mockClear();
    sessionsTable.where.mockClear();
    getEphemeralLocationDBMock.mockReset();
    getEphemeralLocationDBMock.mockReturnValue({ sessions: sessionsTable });
    mapPreviewSpy.mockClear();
    listLocationPointsMock.mockReset();
    listLocationPointsMock.mockResolvedValue([
      {
        schemaVersion: 1,
        pid: 'point-1',
        name: 'Sample Point',
        latitude: 35.68,
        longitude: 139.76,
        kind: 'airport',
        gid0: 'JPN',
        payload: { importance: 1 },
      },
    ]);
  });

  it('shows summary when session data is available', async () => {
    render(<LocationMapPreviewStep workingCopy={baseWorkingCopy} />);

    await waitFor(() => {
      expect(screen.getByText(en.mapPreview.summary.tiles.replace('{count}', '3'))).toBeInTheDocument();
      expect(mapPreviewSpy).toHaveBeenCalled();
    });
    expect(getSessionSummary).toHaveBeenCalledWith('session-1');
    expect(listLocationPointsMock).toHaveBeenCalledWith('node-1');
    const props = mapPreviewSpy.mock.calls.at(-1)?.[0];
    expect(props?.locations).toHaveLength(1);
    expect(props?.locations?.[0]?.id).toBe('point-1');
  });

  it('shows empty message when no session exists', async () => {
    getEphemeralLocationDBMock.mockReturnValue({ sessions: emptySessionsTable });
    listLocationPointsMock.mockResolvedValueOnce([]);

    render(<LocationMapPreviewStep workingCopy={baseWorkingCopy} />);

    await waitFor(() => {
      expect(screen.getByText(en.mapPreview.summary.noData)).toBeInTheDocument();
      expect(mapPreviewSpy).toHaveBeenCalled();
    });
    const props = mapPreviewSpy.mock.calls.at(-1)?.[0];
    expect(props?.locations).toHaveLength(0);
  });

  it('shows error message when fetching summary fails', async () => {
    getSessionSummary.mockRejectedValueOnce(new Error('network error'));

    render(<LocationMapPreviewStep workingCopy={baseWorkingCopy} />);

    await waitFor(() => {
      expect(screen.getByText(/network error/)).toBeInTheDocument();
      expect(mapPreviewSpy).toHaveBeenCalled();
    });
    const props = mapPreviewSpy.mock.calls.at(-1)?.[0];
    expect(props?.locations).toHaveLength(1);
  });
});
