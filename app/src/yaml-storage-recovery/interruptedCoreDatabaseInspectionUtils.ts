export const INTERRUPTED_CORE_DATABASE_NAME = 'hidb-core' as const;

export type OpenExactInterruptedCoreDatabaseResult =
  | Readonly<{ readonly ok: true; readonly database: IDBDatabase }>
  | Readonly<{ readonly ok: false; readonly reason: 'open' | 'blocked' | 'upgrade' }>;

export function openExactInterruptedCoreDatabase(
  factory: IDBFactory,
  nativeVersion: number
): Promise<OpenExactInterruptedCoreDatabaseResult> {
  return new Promise((resolve) => {
    let settled = false;
    let unexpectedUpgrade = false;
    const finish = (result: OpenExactInterruptedCoreDatabaseResult): void => {
      if (settled) {
        if (result.ok) result.database.close();
        return;
      }
      settled = true;
      resolve(result);
    };
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(INTERRUPTED_CORE_DATABASE_NAME, nativeVersion);
    } catch {
      finish(Object.freeze({ ok: false, reason: 'open' }));
      return;
    }
    request.onupgradeneeded = () => {
      unexpectedUpgrade = true;
      request.transaction?.abort();
    };
    request.onerror = () =>
      finish(Object.freeze({ ok: false, reason: unexpectedUpgrade ? 'upgrade' : 'open' }));
    request.onblocked = () => finish(Object.freeze({ ok: false, reason: 'blocked' }));
    request.onsuccess = () => {
      if (request.result.version !== nativeVersion) {
        request.result.close();
        finish(Object.freeze({ ok: false, reason: 'upgrade' }));
        return;
      }
      finish(Object.freeze({ ok: true, database: request.result }));
    };
  });
}

export function countAllInterruptedCoreDatabaseRecords(
  database: IDBDatabase
): Promise<number | null> {
  const storeNames = Array.from(database.objectStoreNames);
  return new Promise((resolve) => {
    let settled = false;
    let completedCounts = 0;
    let total = 0;
    const finish = (value: number | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(storeNames, 'readonly');
      for (const storeName of storeNames) {
        const request = transaction.objectStore(storeName).count();
        request.onerror = () => finish(null);
        request.onsuccess = () => {
          total += request.result;
          completedCounts += 1;
        };
      }
    } catch {
      finish(null);
      return;
    }
    transaction.onerror = () => finish(null);
    transaction.onabort = () => finish(null);
    transaction.oncomplete = () =>
      finish(completedCounts === storeNames.length && Number.isSafeInteger(total) ? total : null);
  });
}
