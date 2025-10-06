import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { LocationWorkingCopy } from '../../../types/index.js';
import { LocationMapPreviewStep } from '../LocationMapPreviewStep.js';
import { en } from '../../../i18n/en.js';

vi.mock('../batch/LocationMapPreview.js', () => ({
  LocationMapPreview: () => <div data-testid="map-preview" />,
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

const getEphemeralLocationDB = vi.fn(() => ({
  sessions: sessionsTable,
}));

vi.mock('../../../services/database/EphemeralLocationDB.js', () => ({
  __esModule: true,
  getEphemeralLocationDB,
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
    getEphemeralLocationDB.mockReset();
    getEphemeralLocationDB.mockReturnValue({ sessions: sessionsTable });
  });

  it('shows summary when session data is available', async () => {
    render(<LocationMapPreviewStep workingCopy={baseWorkingCopy} />);

    await waitFor(() => {
      expect(screen.getByText(en.mapPreview.summary.tiles.replace('{count}', '3'))).toBeInTheDocument();
    });
    expect(getSessionSummary).toHaveBeenCalledWith('session-1');
  });

  it('shows empty message when no session exists', async () => {
    getEphemeralLocationDB.mockReturnValue({ sessions: emptySessionsTable });

    render(<LocationMapPreviewStep workingCopy={baseWorkingCopy} />);

    await waitFor(() => {
      expect(screen.getByText(en.mapPreview.summary.noData)).toBeInTheDocument();
    });
  });

  it('shows error message when fetching summary fails', async () => {
    getSessionSummary.mockRejectedValueOnce(new Error('network error'));

    render(<LocationMapPreviewStep workingCopy={baseWorkingCopy} />);

    await waitFor(() => {
      expect(screen.getByText(/network error/)).toBeInTheDocument();
    });
  });
});
