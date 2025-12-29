import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import type { NodeId, ProgressEvent } from '@hierarchidb/common-types';
import type { LocationPointInput, LocationTileSettings, SessionSummary } from '../../../_obsolate_common/types/batch-types.js';

vi.mock('@hierarchidb/tabular-source-store', () => ({
  TabularWriter: class {
    async begin() {}
    async writeRows() {}
    async commit() {
      return { tableId: 'mock-table' };
    }
  },
}));

type MockDbTables = {
  pending: Map<string, any>;
  sessions: Map<string, any>;
  vectorTiles: Map<string, any>;
};

let mockDb: any;
let mockState: MockDbTables;
const closeEphemeralLocationDB = vi.fn();

function createMockDb(): [any, MockDbTables] {
  const pending = new Map<string, any>();
  const sessions = new Map<string, any>();
  const vectorTiles = new Map<string, any>();

  const db = {
    pendingSessions: {
      put: vi.fn(async (payload: any) => {
        pending.set(payload.nodeId, payload);
      }),
      get: vi.fn(async (nodeId: string) => pending.get(nodeId)),
      delete: vi.fn(async (nodeId: string) => {
        pending.delete(nodeId);
      }),
    },
    sessions: {
      put: vi.fn(async (payload: any) => {
        sessions.set(payload.nodeId, payload);
      }),
      update: vi.fn(async (nodeId: string, changes: any) => {
        const current = sessions.get(nodeId) ?? {};
        sessions.set(nodeId, { ...current, ...changes });
      }),
      where: vi.fn(() => ({ equals: vi.fn(() => ({ delete: vi.fn(async () => {}) })) })),
    },
    vectorTiles: {
      put: vi.fn(async (payload: any) => {
        vectorTiles.set(payload.id, payload);
      }),
      where: vi.fn(() => ({ equals: vi.fn(() => ({ delete: vi.fn(async () => {}) })) })),
    },
    clearExpiredSessions: vi.fn(async () => 0),
    clearExpiredPendingSessions: vi.fn(async () => 0),
    clearExpiredVectorTiles: vi.fn(async () => 0),
    clearVectorTilesForNode: vi.fn(async (nodeId: string) => {
      for (const [key, record] of vectorTiles.entries()) {
        if (record.nodeId === nodeId) {
          vectorTiles.delete(key);
        }
      }
    }),
    table: vi.fn((name: string) => {
      if (name === 'sessions') return db.sessions;
      if (name === 'vectorTiles') return db.vectorTiles;
      if (name === 'pendingSessions') return db.pendingSessions;
      throw new Error(`Unknown table ${name}`);
    }),
  } as const;

  return [db, { pending, sessions, vectorTiles }];
}

vi.mock('../../database/EphemeralLocationDB', () => ({
  __esModule: true,
  getEphemeralLocationDB: () => mockDb,
  closeEphemeralLocationDB,
}));

const { UnifiedLocationBatchManager } = await import('../../UnifiedLocationBatchManager');
const { LocationBatchSessionManager } = await import('../../BatchSessionManager');

describe('UnifiedLocationBatchManager.onBatchProgress', () => {
  beforeEach(() => {
    [mockDb, mockState] = createMockDb();
    closeEphemeralLocationDB.mockClear();
  });

  it('converts plugin events to StandardProgressEvent via adapter', async () => {
    const mgr = new UnifiedLocationBatchManager();
    class StubManager extends LocationBatchSessionManager {
      constructor(private readonly emit: (cb: (e: ProgressEvent) => void) => void) {
        super();
      }
      override onProgress(_nodeId: string, cb: (e: ProgressEvent) => void): () => void {
        this.emit(cb);
        return () => {};
      }
    }
    const stub = new StubManager((cb) => {
      cb({ nodeId: 'node-1' as NodeId, stage: 'index', total: 20, completed: 10, failed: 0, percentage: 50, currentTask: 'indexing' });
    });
    mgr.setInternalManager(stub);
    mgr.setDbProvider(() => mockDb);

    const spy = vi.fn();
    const unsubscribe = mgr.onBatchProgress('node-1' as NodeId, (event) => spy(event));
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0]?.[0];
    expect(arg?.nodeId).toBe('node-1');
    expect(arg?.stage).toBe('vectortile');
    expect(arg?.phase).toBe('running');
    unsubscribe();
  });
});

const sampleNode = 'node-123' as NodeId;
const samplePoints: LocationPointInput[] = [
  { lon: 139.76, lat: 35.68, id: 'tokyo', properties: { name: 'Tokyo' } },
  { lon: 135.5, lat: 34.66, id: 'osaka', properties: { name: 'Osaka' } },
];
const sampleSettings: LocationTileSettings = {
  zoomMinGenerate: 5,
  zoomMaxGenerate: 10,
  zoomMaxServe: 12,
};

class StubSessionManager extends LocationBatchSessionManager {
  public createSpy = vi.fn();
  private summary: SessionSummary | undefined;
  private progressCb?: (e: ProgressEvent) => void;

  override async createSession(
    nodeId: NodeId,
    points: LocationPointInput[],
    settings: LocationTileSettings,
    options?: { concurrency?: number },
  ): Promise<SessionSummary> {
    this.createSpy(nodeId, points, settings, options);
    this.summary = {
      nodeId,
      zoomMin: settings.zoomMinGenerate,
      zoomMax: settings.zoomMaxGenerate,
      zoomMaxServe: settings.zoomMaxServe,
      bbox: [0, 0, 0, 0],
      totalPoints: points.length,
      layers: ['location_points'],
    };
    return this.summary;
  }

  override getInitialSummary(): SessionSummary | undefined {
    return this.summary;
  }

  override onProgress(_nodeId: string, cb: (e: ProgressEvent) => void): () => void {
    this.progressCb = cb;
    return () => {
      this.progressCb = undefined;
    };
  }

  emit(event: ProgressEvent): void {
    this.progressCb?.(event);
  }
}

describe('UnifiedLocationBatchManager persistence contract', () => {
  beforeEach(() => {
    [mockDb, mockState] = createMockDb();
  });

  it('persists pending session via prepareSession', async () => {
    const mgr = new UnifiedLocationBatchManager();
    mgr.setDbProvider(() => mockDb);
    await mgr.prepareSession(sampleNode, { concurrency: 3 }, { points: samplePoints, settings: sampleSettings });

    expect(mockDb.clearExpiredPendingSessions).toHaveBeenCalledTimes(1);
    expect(mockDb.pendingSessions.put).toHaveBeenCalledTimes(1);
    const payload = mockState.pending.get(sampleNode);
    expect(payload).toBeDefined();
    expect(payload?.points).toEqual(samplePoints);
    expect(payload?.settings).toEqual(sampleSettings);
    expect(payload?.config).toEqual({ concurrency: 3 });
  });

  it('hydrates session from pendingSessions and records summary', async () => {
    const mgr = new UnifiedLocationBatchManager();
    const stub = new StubSessionManager();
    mgr.setDbProvider(() => mockDb);
    mgr.setInternalManager(stub);

    await mgr.prepareSession(sampleNode, { concurrency: 2 }, { points: samplePoints, settings: sampleSettings });

    const sessionNodeId = await mgr.startBatchSession(sampleNode);
    expect(sessionNodeId).toBe(sampleNode);
    expect(mockDb.pendingSessions.delete).toHaveBeenCalledWith(sampleNode);
    expect(stub.createSpy).toHaveBeenCalledWith(sampleNode, samplePoints, sampleSettings, { concurrency: 2 });
    expect(mockDb.clearVectorTilesForNode).toHaveBeenCalledWith(sampleNode);
    expect(mockDb.sessions.put).toHaveBeenCalledWith(expect.objectContaining({
      nodeId: sampleNode,
      status: 'running',
      totalPoints: samplePoints.length,
      config: { concurrency: 2 },
    }));
  });

  it('updates Dexie session progress on progress events', async () => {
    const mgr = new UnifiedLocationBatchManager();
    const stub = new StubSessionManager();
    mgr.setDbProvider(() => mockDb);
    mgr.setInternalManager(stub);

    await mgr.prepareSession(sampleNode, {}, { points: samplePoints, settings: sampleSettings });

    const sessionNodeId = await mgr.startBatchSession(sampleNode);

    const progressSpy = vi.fn();
    mgr.onBatchProgress(sessionNodeId, progressSpy);

    stub.emit({
      nodeId: sessionNodeId,
      stage: 'normalize',
      total: 10,
      completed: 4,
      failed: 0,
      percentage: 40,
      currentTask: 'normalizing',
    });

    await waitFor(() => {
      expect(mockDb.sessions.update).toHaveBeenCalledWith(sessionNodeId, expect.objectContaining({
        status: 'running',
        updatedAt: expect.any(Number),
        progress: expect.objectContaining({
          total: 10,
          completed: 4,
          failed: 0,
          percentage: 40,
          currentStage: 'simplify1',
          currentTask: 'normalizing',
        }),
      }));
    });

    stub.emit({
      nodeId: sessionNodeId,
      stage: 'completed',
      total: 10,
      completed: 10,
      failed: 0,
      percentage: 100,
      currentTask: 'done',
    });

    await waitFor(() => {
      expect(mockDb.sessions.update).toHaveBeenCalledWith(sessionNodeId, expect.objectContaining({
        status: 'completed',
      }));
    });

    expect(progressSpy).toHaveBeenCalledTimes(2);
  });
});

describe('UnifiedLocationBatchManager control operations', () => {
  beforeEach(() => {
    [mockDb] = createMockDb();
  });

  it('delegates pause/resume to internal session manager', async () => {
    const mgr = new UnifiedLocationBatchManager();
    mgr.setDbProvider(() => mockDb);

    const pauseSpy = vi.spyOn(LocationBatchSessionManager.prototype, 'pause');
    const resumeSpy = vi.spyOn(LocationBatchSessionManager.prototype, 'resume');

    try {
      await mgr.pauseBatchSession('node-test' as NodeId);
      await mgr.resumeBatchSession('node-test' as NodeId);

      expect(pauseSpy).toHaveBeenCalledWith('node-test');
      expect(resumeSpy).toHaveBeenCalledWith('node-test');

      expect(mockDb.sessions.update).toHaveBeenCalledWith('node-test', expect.objectContaining({ status: 'paused' }));
      expect(mockDb.sessions.update).toHaveBeenCalledWith('node-test', expect.objectContaining({ status: 'running' }));
    } finally {
      pauseSpy.mockRestore();
      resumeSpy.mockRestore();
    }
  });
});
