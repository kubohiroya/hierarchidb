import { isRetainedLegacyYamlDatabaseName } from '@hierarchidb/util';
import { broadcastMaintenanceShutdownRequest } from './maintenanceChannelConstants.js';
import {
  clearMaintenanceLock,
  type MaintenanceLockRecord,
  setMaintenanceLock,
} from './maintenanceLock.js';
import { type RuntimeShutdownResult, shutdownRuntimeHandles } from './runtimeShutdown.js';

const DEFAULT_LOCK_DURATION_MS = 120_000;
const DEFAULT_DELETE_RETRIES = 2;
const DEFAULT_DELETE_TIMEOUT_MS = 2_500;
const DEFAULT_DELETE_RETRY_DELAY_MS = 600;

export interface MaintenanceDeleteResult {
  deleted: string[];
  blocked: string[];
  failed: Array<{ name: string; errorMessage: string }>;
}

export interface MaintenanceExecutionResult {
  success: boolean;
  deletedDatabases: string[];
  blockedDatabases: string[];
  failedDatabases: Array<{ name: string; errorMessage: string }>;
  shutdownWarnings: string[];
  upgradeAttempted: boolean;
  upgradeSucceeded: boolean;
  message: string;
}

export interface MaintenanceStepEvent {
  step:
    | 'set-lock'
    | 'broadcast-shutdown'
    | 'local-shutdown'
    | 'delete-indexeddb'
    | 'clear-lock'
    | 'worker-upgrade';
  message: string;
}

export interface ExecuteIndexedDbMaintenanceOptions {
  sessionId: string;
  initializeWorker: () => Promise<void>;
  lockDurationMs?: number;
  now?: () => number;
  onStep?: (event: MaintenanceStepEvent) => void;
  broadcastShutdown?: (sessionId: string) => void;
  shutdownRuntime?: () => Promise<RuntimeShutdownResult>;
  deleteDatabases?: () => Promise<MaintenanceDeleteResult>;
}

type IndexedDbFactoryWithDatabases = IDBFactory & {
  databases?: () => Promise<Array<{ name?: string }>>;
};

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const resolveIndexedDbFactory = (): IndexedDbFactoryWithDatabases | null => {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return null;
  }
  return window.indexedDB as IndexedDbFactoryWithDatabases;
};

const listDatabaseNames = async (factory: IndexedDbFactoryWithDatabases): Promise<string[]> => {
  if (typeof factory.databases !== 'function') {
    return [];
  }
  const databases = await factory.databases();
  return Array.from(
    new Set(
      databases
        .map((db) => db.name)
        .filter(
          (name): name is string =>
            typeof name === 'string' && name.length > 0 && !isRetainedLegacyYamlDatabaseName(name)
        )
    )
  );
};

const deleteDatabaseOnce = async (
  factory: IndexedDbFactoryWithDatabases,
  name: string,
  timeoutMs: number
): Promise<{ status: 'deleted' | 'blocked' | 'failed'; errorMessage?: string }> => {
  return await new Promise((resolve) => {
    const request = factory.deleteDatabase(name);
    let settled = false;
    let blocked = false;

    const finish = (status: 'deleted' | 'blocked' | 'failed', errorMessage?: string): void => {
      if (settled) return;
      settled = true;
      resolve({ status, errorMessage });
    };

    const timer = setTimeout(() => {
      finish(blocked ? 'blocked' : 'failed', blocked ? 'delete-blocked-timeout' : 'delete-timeout');
    }, timeoutMs);

    request.onblocked = () => {
      blocked = true;
    };

    request.onsuccess = () => {
      clearTimeout(timer);
      finish('deleted');
    };

    request.onerror = () => {
      clearTimeout(timer);
      if (blocked) {
        finish('blocked', request.error?.message || 'delete-blocked');
      } else {
        finish('failed', request.error?.message || 'delete-failed');
      }
    };
  });
};

export const deleteAllIndexedDbDatabases = async (options?: {
  retries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
}): Promise<MaintenanceDeleteResult> => {
  const factory = resolveIndexedDbFactory();
  if (!factory) {
    return {
      deleted: [],
      blocked: [],
      failed: [{ name: '__all__', errorMessage: 'indexeddb-unavailable' }],
    };
  }

  const retries = options?.retries ?? DEFAULT_DELETE_RETRIES;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_DELETE_TIMEOUT_MS;
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_DELETE_RETRY_DELAY_MS;

  const names = await listDatabaseNames(factory);
  if (names.length === 0) {
    return { deleted: [], blocked: [], failed: [] };
  }

  const deleted = new Set<string>();
  const failed = new Map<string, string>();
  let pending = [...names];

  for (let attempt = 0; attempt <= retries && pending.length > 0; attempt += 1) {
    const results = await Promise.all(
      pending.map(async (name) => {
        const outcome = await deleteDatabaseOnce(factory, name, timeoutMs);
        return { name, ...outcome };
      })
    );

    const blockedNext: string[] = [];

    for (const result of results) {
      if (result.status === 'deleted') {
        deleted.add(result.name);
        failed.delete(result.name);
        continue;
      }
      if (result.status === 'blocked') {
        blockedNext.push(result.name);
        continue;
      }
      failed.set(result.name, result.errorMessage || 'delete-failed');
    }

    pending = blockedNext;
    if (pending.length > 0 && attempt < retries) {
      await wait(retryDelayMs);
    }
  }

  return {
    deleted: Array.from(deleted),
    blocked: pending,
    failed: Array.from(failed.entries()).map(([name, errorMessage]) => ({ name, errorMessage })),
  };
};

export const executeIndexedDbMaintenance = async (
  options: ExecuteIndexedDbMaintenanceOptions
): Promise<MaintenanceExecutionResult> => {
  const now = options.now ?? (() => Date.now());
  const lockRecord: MaintenanceLockRecord = {
    sessionId: options.sessionId,
    createdAt: now(),
    expiresAt: now() + (options.lockDurationMs ?? DEFAULT_LOCK_DURATION_MS),
  };

  const onStep = options.onStep;
  const broadcastShutdown = options.broadcastShutdown ?? broadcastMaintenanceShutdownRequest;
  const shutdownRuntime = options.shutdownRuntime ?? shutdownRuntimeHandles;
  const deleteDatabases = options.deleteDatabases ?? (() => deleteAllIndexedDbDatabases());

  let shutdownWarnings: string[] = [];
  let deleteResult: MaintenanceDeleteResult = { deleted: [], blocked: [], failed: [] };
  let upgradeAttempted = false;
  let upgradeSucceeded = false;

  onStep?.({ step: 'set-lock', message: 'Maintenance lock enabled.' });
  setMaintenanceLock(lockRecord);

  try {
    onStep?.({ step: 'broadcast-shutdown', message: 'Sent shutdown request to open tabs.' });
    broadcastShutdown(options.sessionId);

    onStep?.({
      step: 'local-shutdown',
      message: 'Shutting down local workers and closing handles.',
    });
    const shutdownResult = await shutdownRuntime();
    shutdownWarnings = shutdownResult.warnings;

    onStep?.({ step: 'delete-indexeddb', message: 'Deleting IndexedDB databases.' });
    deleteResult = await deleteDatabases();

    if (deleteResult.blocked.length > 0 || deleteResult.failed.length > 0) {
      const blockedCount = deleteResult.blocked.length;
      const failedCount = deleteResult.failed.length;
      return {
        success: false,
        deletedDatabases: deleteResult.deleted,
        blockedDatabases: deleteResult.blocked,
        failedDatabases: deleteResult.failed,
        shutdownWarnings,
        upgradeAttempted,
        upgradeSucceeded,
        message: `Database delete incomplete (blocked=${blockedCount}, failed=${failedCount}).`,
      };
    }

    onStep?.({ step: 'clear-lock', message: 'Clearing maintenance lock before worker upgrade.' });
    clearMaintenanceLock(options.sessionId);

    onStep?.({ step: 'worker-upgrade', message: 'Re-initializing worker to trigger DB upgrade.' });
    upgradeAttempted = true;
    await options.initializeWorker();
    upgradeSucceeded = true;

    return {
      success: true,
      deletedDatabases: deleteResult.deleted,
      blockedDatabases: [],
      failedDatabases: [],
      shutdownWarnings,
      upgradeAttempted,
      upgradeSucceeded,
      message: 'IndexedDB maintenance completed successfully.',
    };
  } catch (error) {
    return {
      success: false,
      deletedDatabases: deleteResult.deleted,
      blockedDatabases: deleteResult.blocked,
      failedDatabases: deleteResult.failed,
      shutdownWarnings,
      upgradeAttempted,
      upgradeSucceeded,
      message: `Maintenance execution failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    clearMaintenanceLock(options.sessionId);
  }
};
