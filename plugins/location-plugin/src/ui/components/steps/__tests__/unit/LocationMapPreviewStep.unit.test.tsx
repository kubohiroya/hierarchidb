import { render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { toNodeId } from '@hierarchidb/common-types';
import type { LocationEntity } from '../../../../common/types/index.js';
import type { LocationPointId } from '../../../../common/entities/LocationPoint.js';
import en from '../../../../locales/en.json' with { type: 'json' };

type SessionRecord = {
  nodeId: unknown;
  createdAt: number;
  status?: string;
};

const {
  summaryMock,
  getLocationSessionSummary,
  dbState,
  listLocationPointsMock,
  getLocationDBMock,
} = vi.hoisted(() => {
  const summaryMock = {
    exists: true,
    tiles: 3,
    zoomRange: [4, 12] as [number, number],
    layers: ['location_points'],
    sizeBytes: 2048,
  };

  const getLocationSessionSummary = vi.fn(async () => summaryMock);
  const dbState = { sessions: [] as SessionRecord[] };
  const listLocationPointsMock = vi.fn<[], Promise<any[]>>();

  const fakeDb = {
    sessions: {
      async put(record: SessionRecord) {
        const index = dbState.sessions.findIndex((item) => item.nodeId === record.nodeId);
        if (index >= 0) {
          dbState.sessions.splice(index, 1, record);
        } else {
          dbState.sessions.push(record);
        }
        return record.nodeId;
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

  const getLocationDBMock = vi.fn(() => fakeDb);

  return {
    summaryMock,
    getLocationSessionSummary,
    dbState,
    listLocationPointsMock,
    getLocationDBMock,
  };
});

vi.mock('@hierarchidb/location-store', () => ({
  __esModule: true,
  getLocationDB: getLocationDBMock,
}));

vi.mock('../../../../../common/tiles/locationVectorTiles', () => ({
  getLocationSessionSummary,
}));

vi.mock('../../../../../services/pointRepository', () => ({
  __esModule: true,
  listLocationPoints: listLocationPointsMock,
}));
let LocationMapPreviewStep: (typeof import('../../LocationMapPreviewStep'))['LocationMapPreviewStep'];

beforeAll(async () => {
  ({ LocationMapPreviewStep } = await import('../../LocationMapPreviewStep'));
});

const nodeId = toNodeId('node-1');
const baseDraft: Partial<LocationEntity> = {
  nodeId,
};

describe('LocationMapPreviewStep', () => {
  beforeEach(() => {
    dbState.sessions.splice(0, dbState.sessions.length);
    getLocationSessionSummary.mockReset();
    getLocationSessionSummary.mockResolvedValue(summaryMock);
    getLocationDBMock.mockClear();
    listLocationPointsMock.mockReset();
    listLocationPointsMock.mockResolvedValue([
      {
        schemaVersion: 2,
        pointId: 'point-1' as LocationPointId,
        name: 'Sample Point',
        latitude: 35.68,
        longitude: 139.76,
        kind: 'airport',
        countryCode: 'JPN',
        metadata: { importance: 1 },
      },
    ]);
  });

  it('shows summary when session data is available', async () => {
    if (!LocationMapPreviewStep) throw new Error('component not loaded');
    const db = getLocationDBMock();
    await db.sessions.put({
      nodeId,
      createdAt: Date.now(),
      status: 'running',
    });
    expect(await db.sessions.count()).toBe(1);

    render(<LocationMapPreviewStep draft={baseDraft} nodeId={nodeId} />);

    await waitFor(() => {
      expect(getLocationDBMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(listLocationPointsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(getLocationSessionSummary).toHaveBeenCalledWith(nodeId);
    });

    const tilesLabel = await screen.findByText(/Generated tiles:/i);
    expect(tilesLabel.textContent).toContain('3');
    expect(listLocationPointsMock).toHaveBeenCalledWith(nodeId);
    expect(screen.getByText(/Layers: location_points/i)).not.toBeNull();
  });

  it('shows empty message when no session exists', async () => {
    if (!LocationMapPreviewStep) throw new Error('component not loaded');
    listLocationPointsMock.mockResolvedValueOnce([]);

    render(<LocationMapPreviewStep draft={baseDraft} nodeId={nodeId} />);

    await waitFor(() => {
      expect(getLocationDBMock).toHaveBeenCalled();
    });

    const message = await screen.findByText(en.mapPreview.summary.noData);
    expect(message).not.toBeNull();
    expect(listLocationPointsMock).toHaveBeenCalledWith(nodeId);
  });

  it('shows error message when fetching summary fails', async () => {
    if (!LocationMapPreviewStep) throw new Error('component not loaded');
    const db = getLocationDBMock();
    await db.sessions.put({
      nodeId,
      createdAt: Date.now(),
    });
    expect(await db.sessions.count()).toBe(1);

    getLocationSessionSummary.mockRejectedValueOnce(new Error('network error'));

    render(<LocationMapPreviewStep draft={baseDraft} nodeId={nodeId} />);

    await waitFor(() => {
      expect(getLocationDBMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(listLocationPointsMock).toHaveBeenCalled();
    });

    const errorMessage = await screen.findByText(/Failed to load map preview\./i);
    expect(errorMessage).not.toBeNull();
    expect(listLocationPointsMock).toHaveBeenCalledWith(nodeId);
  });
});
