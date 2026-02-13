import {
  executeIndexedDbMaintenance,
  type MaintenanceDeleteResult,
} from '~/maintenance/maintenanceExecution.js';
import { getMaintenanceLock } from '~/maintenance/maintenanceLock.js';

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
