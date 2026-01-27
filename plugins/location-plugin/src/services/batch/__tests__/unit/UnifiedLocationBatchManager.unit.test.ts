import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import type { NodeId, ProgressEvent } from '@hierarchidb/common-types';
import type { LocationPointInput, LocationTileSettings, SessionSummary } from '../../../../common/types/batch-types';
import type { LocationDB } from '../../../../database/EphemeralLocationDB';
//import type { LocationPointInput, LocationTileSettings, SessionSummary } from '../../../_obsolate_common/types/batch-types.js';
//import type { LocationDB } from '../../../database/EphemeralLocationDB.js';
type PendingSessionPayload = {
  nodeId: string;
  points: LocationPointInput[];
  settings: LocationTileSettings;
  config?: { concurrency?: number };
};

type VectorTilePayload = {
  id: string;
  nodeId: string;
};

type MockDbTables = {
  pending: Map<string, PendingSessionPayload>;
  vectorTiles: Map<string, VectorTilePayload>;
};

type MockDb = {
  pendingSessions: {
    put: (payload: PendingSessionPayload) => Promise<void>;
    get: (nodeId: string) => Promise<PendingSessionPayload | undefined>;
    delete: (nodeId: string) => Promise<void>;
  };
  vectorTiles: {
    put: (payload: VectorTilePayload) => Promise<void>;
    where: (field: string) => { equals: (value: string) => { delete: () => Promise<void> } };
  };
  clearExpiredPendingSessions: () => Promise<number>;
  clearExpiredVectorTiles: () => Promise<number>;
  clearVectorTilesForNode: (nodeId: string) => Promise<void>;
  table: (name: string) => MockDb['vectorTiles'] | MockDb['pendingSessions'];
};

let UnifiedLocationBatchManager: typeof import('../../UnifiedLocationBatchManager').UnifiedLocationBatchManager;
let LocationBatchSessionManager: typeof import('../../BatchSessionManager').LocationBatchSessionManager;

let mockDb: LocationDB;
let mockDbState: MockDb;
let mockState: MockDbTables;
const closeLocationDB = vi.fn();

function createMockDb(): [MockDb, MockDbTables] {
  const pending = new Map<string, PendingSessionPayload>();
  const vectorTiles = new Map<string, VectorTilePayload>();

  const db = {
    pendingSessions: {
      put: vi.fn(async (payload: PendingSessionPayload) => {
        pending.set(payload.nodeId, payload);
      }),
      get: vi.fn(async (nodeId: string) => pending.get(nodeId)),
      delete: vi.fn(async (nodeId: string) => {
        pending.delete(nodeId);
      }),
    },
    vectorTiles: {
      put: vi.fn(async (payload: VectorTilePayload) => {
        vectorTiles.set(payload.id, payload);
      }),
      where: vi.fn(() => ({ equals: vi.fn(() => ({ delete: vi.fn(async () => {}) })) })),
    },
    clearExpiredPendingSessions: vi.fn(async () => 0),
    clearExpiredVectorTiles: vi.fn(async () => 0),
    clearVectorTilesForNode: vi.fn(async (nodeId: string) => {
      vectorTiles.forEach((record, key) => {
        if (record.nodeId === nodeId) {
          vectorTiles.delete(key);
        }
      });
    }),
    table: vi.fn((name: string) => {
      if (name === 'vectorTiles') return db.vectorTiles;
      if (name === 'pendingSessions') return db.pendingSessions;
      throw new Error(`Unknown table ${name}`);
    }),
  } satisfies MockDb;

  return [db, { pending, vectorTiles }];
}

vi.mock('../../database/EphemeralLocationDB', () => ({
  __esModule: true,
  getLocationDB: () => mockDb,
  closeLocationDB,
}));

beforeAll(async () => {
  ({ UnifiedLocationBatchManager } = await import('../../UnifiedLocationBatchManager'));
  ({ LocationBatchSessionManager } = await import('../../BatchSessionManager'));
});

describe('UnifiedLocationBatchManager.onBatchProgress', () => {
  beforeEach(() => {
    [mockDbState, mockState] = createMockDb();
    mockDb = mockDbState as unknown as LocationDB;
    closeLocationDB.mockClear();
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
      cb({ nodeId: 'node-1' as NodeId, taskType: 'index', total: 20, completed: 10, failed: 0, percentage: 50, message: 'indexing' });
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

const createStubSessionManager = () => {
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

  return new StubSessionManager();
};

describe('UnifiedLocationBatchManager persistence contract', () => {
  beforeEach(() => {
    [mockDbState, mockState] = createMockDb();
    mockDb = mockDbState as unknown as LocationDB;
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
    const stub = createStubSessionManager();
    mgr.setDbProvider(() => mockDb);
    mgr.setInternalManager(stub);

    await mgr.prepareSession(sampleNode, { concurrency: 2 }, { points: samplePoints, settings: sampleSettings });

    const sessionStatus = await mgr.startBatchSession(sampleNode);
    expect(sessionStatus.nodeId).toBe(sampleNode);
    expect(mockDb.pendingSessions.delete).toHaveBeenCalledWith(sampleNode);
    expect(stub.createSpy).toHaveBeenCalledWith(sampleNode, samplePoints, sampleSettings, { concurrency: 2 });
    expect(mockDb.clearVectorTilesForNode).toHaveBeenCalledWith(sampleNode);
  });

});

describe('UnifiedLocationBatchManager control operations', () => {
  beforeEach(() => {
    [mockDbState] = createMockDb();
    mockDb = mockDbState as unknown as LocationDB;
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

    } finally {
      pauseSpy.mockRestore();
      resumeSpy.mockRestore();
    }
  });
});
