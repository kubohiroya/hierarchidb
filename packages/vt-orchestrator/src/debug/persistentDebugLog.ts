import { Dexie, type Table } from 'dexie';
import { getBuildDatabasePrefix, getDBName } from '@hierarchidb/util';

export type PersistentDebugLogLevel = 'log' | 'warn' | 'error';

type PersistentDebugLogEntry = {
  id?: number;
  ts: number;
  level: PersistentDebugLogLevel;
  tag: string;
  message: string;
  dataText?: string;
};

const DEBUG_LOG_TABLE = 'logs';
const DEBUG_LOG_LIMIT = 2000;

class DebugLogDB extends Dexie {
  logs!: Table<PersistentDebugLogEntry, number>;

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      [DEBUG_LOG_TABLE]: '++id,ts,level,tag',
    });
    this.logs = this.table(DEBUG_LOG_TABLE);
  }
}

let debugLogDb: DebugLogDB | null = null;
let trimInFlight = false;

const isIndexedDbAvailable = (): boolean => typeof indexedDB !== 'undefined';

const getDebugLogDb = (): DebugLogDB | null => {
  if (!isIndexedDbAvailable()) return null;
  if (!debugLogDb) {
    debugLogDb = new DebugLogDB(
      getDBName(getBuildDatabasePrefix(), 'debug-log')
    );
  }
  return debugLogDb;
};

const serializeData = (data: unknown): string | undefined => {
  if (typeof data === 'undefined') return undefined;
  if (data === null) return 'null';
  if (data instanceof Error) {
    return JSON.stringify({
      name: data.name,
      message: data.message,
      stack: data.stack ?? null,
    });
  }
  if (typeof data === 'string') return data;
  try {
    const json = JSON.stringify(data);
    return typeof json === 'string' ? json : String(data);
  } catch (error) {
    try {
      return String(data);
    } catch {
      return `[unserializable:${String(error)}]`;
    }
  }
};

const trimDebugLogs = async (db: DebugLogDB): Promise<void> => {
  if (trimInFlight) return;
  trimInFlight = true;
  try {
    const total = await db.logs.count();
    if (total <= DEBUG_LOG_LIMIT) return;
    const excess = total - DEBUG_LOG_LIMIT;
    const keys = await db.logs.orderBy('id').limit(excess).primaryKeys();
    if (keys.length > 0) {
      await db.logs.bulkDelete(keys);
    }
  } finally {
    trimInFlight = false;
  }
};

export const persistDebugLog = async (
  level: PersistentDebugLogLevel,
  tag: string,
  message: string,
  data?: unknown,
): Promise<void> => {
  const db = getDebugLogDb();
  if (!db) return;
  const entry: PersistentDebugLogEntry = {
    ts: Date.now(),
    level,
    tag,
    message,
    dataText: serializeData(data),
  };
  await db.logs.add(entry);
  await trimDebugLogs(db);
};

export const logDebug = (
  level: PersistentDebugLogLevel,
  tag: string,
  message: string,
  data?: unknown,
): void => {
  const formatted = `[${tag}][TaskDebug] ${message}`;
  if (level === 'error') {
    console.error(formatted, data);
  } else if (level === 'log') {
    console.log(formatted, data);
  } else {
    console.warn(formatted, data);
  }
  try {
    void persistDebugLog(level, tag, message, data);
  } catch {
    // Ignore persistence failures to avoid interfering with runtime logic.
  }
};
