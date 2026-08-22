import {
  deleteAllIndexedDbDatabases,
  executeIndexedDbMaintenance,
  type MaintenanceDeleteResult,
} from '../maintenanceExecution.ts';
import { getMaintenanceLock } from '../maintenanceLock.ts';

describe('executeIndexedDbMaintenance', () => {
  it('returns failure when delete reports blocked databases', async () => {
    const initializeWorker = vi.fn(async () => undefined);

    const blockedResult: MaintenanceDeleteResult = {
      deleted: ['core'],
      blocked: ['shape-ephemeral'],
      failed: [],
    };

    const result = await executeIndexedDbMaintenance({
      sessionId: 'session-blocked',
      initializeWorker,
      broadcastShutdown: vi.fn(),
      shutdownRuntime: vi.fn(async () => ({ warnings: [] })),
      deleteDatabases: vi.fn(async () => blockedResult),
    });

    expect(result.success).toBe(false);
    expect(result.blockedDatabases).toEqual(['shape-ephemeral']);
    expect(result.upgradeAttempted).toBe(false);
    expect(initializeWorker).not.toHaveBeenCalled();
    expect(getMaintenanceLock()).toBeNull();
  });

  it('reinitializes worker after successful delete', async () => {
    const initializeWorker = vi.fn(async () => undefined);
    const steps: string[] = [];

    const result = await executeIndexedDbMaintenance({
      sessionId: 'session-success',
      initializeWorker,
      broadcastShutdown: vi.fn(),
      shutdownRuntime: vi.fn(async () => ({ warnings: ['warn-1'] })),
      deleteDatabases: vi.fn(async () => ({ deleted: ['core'], blocked: [], failed: [] })),
      onStep: (event) => {
        steps.push(event.step);
      },
    });

    expect(result.success).toBe(true);
    expect(result.deletedDatabases).toEqual(['core']);
    expect(result.shutdownWarnings).toEqual(['warn-1']);
    expect(result.upgradeAttempted).toBe(true);
    expect(result.upgradeSucceeded).toBe(true);
    expect(initializeWorker).toHaveBeenCalledTimes(1);
    expect(steps).toContain('set-lock');
    expect(steps).toContain('worker-upgrade');
    expect(getMaintenanceLock()).toBeNull();
  });
});

describe('deleteAllIndexedDbDatabases', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    if (typeof originalWindow === 'undefined') {
      Reflect.deleteProperty(globalThis, 'window');
      return;
    }
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  });

  it('skips only exact retained legacy YamlDB names during generic deletion', async () => {
    const deleted: string[] = [];

    const indexedDb = {
      databases: async () => [
        { name: 'hierarchidb-core' },
        { name: 'hierarchidb-yaml' },
        { name: 'cart-yaml' },
        { name: 'prefix-hierarchidb-yaml' },
        { name: 'hierarchidb-yaml-copy' },
      ],
      deleteDatabase: (name: string) => {
        deleted.push(name);
        const request = {
          error: null,
          onblocked: null as (() => void) | null,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        queueMicrotask(() => {
          request.onsuccess?.();
        });
        return request;
      },
    };

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { indexedDB: indexedDb },
    });

    const result = await deleteAllIndexedDbDatabases({ retries: 0 });

    expect(deleted).toEqual([
      'hierarchidb-core',
      'cart-yaml',
      'prefix-hierarchidb-yaml',
      'hierarchidb-yaml-copy',
    ]);
    expect(result.deleted).toEqual(deleted);
    expect(result.blocked).toEqual([]);
    expect(result.failed).toEqual([]);
  });
});
