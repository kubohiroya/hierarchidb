import { render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { toNodeId } from '@hierarchidb/common-types';
import type { LocationWorkingCopy } from '../../../types/index.js';
import { en } from '../../../i18n/en.js';

type SessionRecord = {
  sessionId: string;
  nodeId: unknown;
  createdAt: number;
  status?: string;
};

const {
  summaryMock,
  getSessionSummary,
  dbState,
  listLocationPointsMock,
  getEphemeralLocationDBMock,
} = vi.hoisted(() => {
  const summaryMock = {
    exists: true,
    tiles: 3,
    zoomRange: [4, 12] as [number, number],
    layers: ['location_points'],
    sizeBytes: 2048,
  };

  const getSessionSummary = vi.fn(async () => summaryMock);
  const dbState = { sessions: [] as SessionRecord[] };
  const listLocationPointsMock = vi.fn<[], Promise<any[]>>();

  const fakeDb = {
    sessions: {
      async put(record: SessionRecord) {
        const index = dbState.sessions.findIndex((item) => item.sessionId === record.sessionId);
        if (index >= 0) {
          dbState.sessions.splice(index, 1, record);
        } else {
          dbState.sessions.push(record);
        }
        return record.sessionId;
      },
      async count() {
        return dbState.sessions.length;
      },
      where(field: string) {
        return {
          equals(value: unknown) {
            return {
              async toArray() {
                if (field !== 'nodeId') return [];
                if (dbState.sessions.length === 0) return [];
                if (value == null) return [...dbState.sessions];
                return dbState.sessions.filter((session) => {
                  if (session.nodeId === value) return true;
                  const left = typeof session.nodeId === 'object' && session.nodeId !== null && 'toString' in session.nodeId
                    ? (session.nodeId as { toString: () => string }).toString()
                    : String(session.nodeId);
                  const right = typeof value === 'object' && value !== null && 'toString' in value
                    ? (value as { toString: () => string }).toString()
                    : String(value);
                  return left === right;
                });
              },
            };
          },
        };
      },
      async clear() {
        dbState.sessions.splice(0, dbState.sessions.length);
      },
    },
  };

  const getEphemeralLocationDBMock = vi.fn(() => fakeDb);

  return {
    summaryMock,
    getSessionSummary,
    dbState,
    listLocationPointsMock,
    getEphemeralLocationDBMock,
  };
});

vi.mock('../../../../services/database/EphemeralLocationDB.js', () => ({
  __esModule: true,
  getEphemeralLocationDB: getEphemeralLocationDBMock,
}));

vi.mock('../../../../services/database/EphemeralLocationDB', () => ({
  __esModule: true,
  getEphemeralLocationDB: getEphemeralLocationDBMock,
}));

vi.mock('../../../../services/tiles/LocationVectorTileService.js', () => ({
  LocationVectorTileService: vi.fn(() => ({
    getSessionSummary,
  })),
}));

vi.mock('../../../../services/tiles/LocationVectorTileService', () => ({
  LocationVectorTileService: vi.fn(() => ({
    getSessionSummary,
  })),
}));

vi.mock('../../../../services/pointRepository.js', () => ({
  __esModule: true,
  listLocationPoints: listLocationPointsMock,
}));

vi.mock('../../../../services/pointRepository', () => ({
  __esModule: true,
  listLocationPoints: listLocationPointsMock,
}));
let LocationMapPreviewStep: (typeof import('../LocationMapPreviewStep.js'))['LocationMapPreviewStep'];

beforeAll(async () => {
  ({ LocationMapPreviewStep } = await import('../LocationMapPreviewStep.js'));
});

const baseWorkingCopy: LocationWorkingCopy = {
  id: toNodeId('node-1'),
  treeNodeId: toNodeId('node-1'),
  nodeId: toNodeId('node-1'),
  version: 1,
  draft: {} as LocationWorkingCopy['draft'],
} as unknown as LocationWorkingCopy;

describe('LocationMapPreviewStep', () => {
  beforeEach(() => {
    dbState.sessions.splice(0, dbState.sessions.length);
    getSessionSummary.mockReset();
    getSessionSummary.mockResolvedValue(summaryMock);
    getEphemeralLocationDBMock.mockClear();
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
    if (!LocationMapPreviewStep) throw new Error('component not loaded');
    const db = getEphemeralLocationDBMock();
    await db.sessions.put({
      sessionId: 'session-1',
      nodeId: toNodeId('node-1'),
      createdAt: Date.now(),
      status: 'running',
    });
    expect(await db.sessions.count()).toBe(1);

    render(<LocationMapPreviewStep workingCopy={baseWorkingCopy} />);

    await waitFor(() => {
      expect(getEphemeralLocationDBMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(listLocationPointsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(getSessionSummary).toHaveBeenCalledWith('session-1');
    });

    const tilesLabel = await screen.findByText(/Generated tiles:/i);
    expect(tilesLabel.textContent).toContain('3');
    expect(listLocationPointsMock).toHaveBeenCalledWith(toNodeId('node-1'));
    expect(screen.getByText(/Layers: location_points/i)).toBeInTheDocument();
  });

  it('shows empty message when no session exists', async () => {
    if (!LocationMapPreviewStep) throw new Error('component not loaded');
    listLocationPointsMock.mockResolvedValueOnce([]);

    render(<LocationMapPreviewStep workingCopy={baseWorkingCopy} />);

    await waitFor(() => {
      expect(getEphemeralLocationDBMock).toHaveBeenCalled();
    });

    const message = await screen.findByText(en.mapPreview.summary.noData);
    expect(message).toBeInTheDocument();
    expect(listLocationPointsMock).toHaveBeenCalledWith(toNodeId('node-1'));
  });

  it('shows error message when fetching summary fails', async () => {
    if (!LocationMapPreviewStep) throw new Error('component not loaded');
    const db = getEphemeralLocationDBMock();
    await db.sessions.put({
      sessionId: 'session-1',
      nodeId: toNodeId('node-1'),
      createdAt: Date.now(),
    });
    expect(await db.sessions.count()).toBe(1);

    getSessionSummary.mockRejectedValueOnce(new Error('network error'));

    render(<LocationMapPreviewStep workingCopy={baseWorkingCopy} />);

    await waitFor(() => {
      expect(getEphemeralLocationDBMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(listLocationPointsMock).toHaveBeenCalled();
    });

    const errorMessage = await screen.findByText(/Failed to load map preview: network error/i);
    expect(errorMessage).toBeInTheDocument();
    expect(listLocationPointsMock).toHaveBeenCalledWith(toNodeId('node-1'));
  });
});
