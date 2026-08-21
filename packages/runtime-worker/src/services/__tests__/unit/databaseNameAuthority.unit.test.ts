import { getDBName } from '@hierarchidb/util';
import { describe, expect, it, vi } from 'vitest';
import { WorkerService } from '../../../WorkerService.js';
import { CoreDB } from '../../CoreDB.js';

describe('database name authority', () => {
  it('passes the exact composed name to CoreDB', () => {
    const databaseName = getDBName('test-authority', 'core');
    const database = CoreDB.createForTest(databaseName);

    expect(database.name).toBe('test-authority-core');
    database.close();
  });

  it('rejects an invalid prefix before IndexedDB open', () => {
    const openSpy = vi.spyOn(indexedDB, 'open');

    expect(() => {
      const databaseName = getDBName(' ', 'core');
      CoreDB.createForCanonicalRuntime(databaseName);
    }).toThrow('database-prefix-invalid');
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('rejects a worker prefix that differs from the build authority before IndexedDB open', async () => {
    const openSpy = vi.spyOn(indexedDB, 'open');

    await expect(
      WorkerService.getSingleton([], {
        databasePrefix: 'other',
        assertYamlStorageCanonicalAccess: () => {},
      })
    ).rejects.toThrow('worker-service-database-prefix-mismatch');
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
