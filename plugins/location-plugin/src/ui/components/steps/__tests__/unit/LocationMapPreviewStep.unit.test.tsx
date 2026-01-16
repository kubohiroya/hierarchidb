import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toNodeId } from '@hierarchidb/common-types';
import type { LocationEntity } from '../../../../common/types/index.js';
import en from '../../../../locales/en.json' with { type: 'json' };

type SessionRecord = {
  nodeId: unknown;
  createdAt: number;
  status?: string;
};

const {
  dbState,
  getLocationDBMock,
} = vi.hoisted(() => {
  const dbState = {
    sessions: [] as SessionRecord[],
    features: [] as Array<{ nodeId: unknown }>,
  };

  const fakeDb = {
    features: {
      where(field: string) {
        return {
          equals(value: unknown) {
            return {
              async count() {
                if (field !== 'nodeId') return 0;
                if (value == null) return dbState.features.length;
                return dbState.features.filter((row) => row.nodeId === value).length;
              },
            };
          },
        };
      },
    },
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
    dbState,
    getLocationDBMock,
  };
});

vi.mock('@hierarchidb/location-store', () => ({
  __esModule: true,
  getLocationDB: getLocationDBMock,
}));

const { LocationMapPreviewStep } = await import('../../LocationMapPreviewStep');

const nodeId = toNodeId('node-1');
const baseDraft: Partial<LocationEntity> = {
  nodeId,
};

describe('LocationMapPreviewStep', () => {
  beforeEach(() => {
    dbState.sessions.splice(0, dbState.sessions.length);
    dbState.features.splice(0, dbState.features.length);
    getLocationDBMock.mockClear();
  });

  it('shows summary when point data is available', async () => {
    if (!LocationMapPreviewStep) throw new Error('component not loaded');
    const db = getLocationDBMock();
    await db.sessions.put({
      nodeId,
      createdAt: Date.now(),
      status: 'running',
    });
    expect(await db.sessions.count()).toBe(1);
    dbState.features.push({ nodeId });

    render(<LocationMapPreviewStep draft={baseDraft} nodeId={nodeId} />);

    await waitFor(() => {
      expect(getLocationDBMock).toHaveBeenCalled();
    });

    const pointsLabel = await screen.findByText(/Stored points:/i);
    expect(pointsLabel.textContent).toContain('1');
  });

  it('shows empty message when no session exists', async () => {
    if (!LocationMapPreviewStep) throw new Error('component not loaded');
    render(<LocationMapPreviewStep draft={baseDraft} nodeId={nodeId} />);

    await waitFor(() => {
      expect(getLocationDBMock).toHaveBeenCalled();
    });

    const message = await screen.findByText(en.mapPreview.summary.noData);
    expect(message).not.toBeNull();
  });

  it('shows error message when fetching summary fails', async () => {
    if (!LocationMapPreviewStep) throw new Error('component not loaded');
    getLocationDBMock.mockImplementationOnce(() => {
      throw new Error('network error');
    });

    render(<LocationMapPreviewStep draft={baseDraft} nodeId={nodeId} />);

    await waitFor(() => {
      expect(getLocationDBMock).toHaveBeenCalled();
    });

    const errorMessage = await screen.findByText(/Failed to load map preview/i);
    expect(errorMessage).not.toBeNull();
  });
});
