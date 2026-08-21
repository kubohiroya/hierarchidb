import { clearLocationDatabases, LocationDB } from '@hierarchidb/location-store';
import { clearRouteDatabases, RouteDB } from '@hierarchidb/route-store';
import { getDBName } from '@hierarchidb/util';
import { describe, expect, it, vi } from 'vitest';
import { WorkerService } from '../../../WorkerService.js';
import { CoreDB } from '../../CoreDB.js';
import { writeVectorTileInput } from '../../vectorTileStageRunner.js';

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

  it('deletes only the exact location and route database names supplied by the caller', async () => {
    const locationName = 'authority-custom-location';
    const otherLocationName = 'authority-other-location';
    const routeName = 'authority-custom-route';
    const otherRouteName = 'authority-other-route';
    const databases = [
      new LocationDB(locationName),
      new LocationDB(otherLocationName),
      new RouteDB(routeName),
      new RouteDB(otherRouteName),
    ];
    await Promise.all(databases.map(async (database) => await database.open()));
    databases.forEach((database) => {
      database.close();
    });

    await clearLocationDatabases(locationName);
    await clearRouteDatabases(routeName);

    const remainingNames = new Set((await indexedDB.databases()).map((database) => database.name));
    expect(remainingNames.has(locationName)).toBe(false);
    expect(remainingNames.has(routeName)).toBe(false);
    expect(remainingNames.has(otherLocationName)).toBe(true);
    expect(remainingNames.has(otherRouteName)).toBe(true);

    await clearLocationDatabases(otherLocationName);
    await clearRouteDatabases(otherRouteName);
  });

  it('writes vector tile input only to the explicit chunk-store database', async () => {
    const databaseName = 'authority-vector-input-chunks';
    const openSpy = vi.spyOn(indexedDB, 'open');

    await writeVectorTileInput('authority-buffer', new Uint8Array([1, 2, 3]).buffer, {
      chunkStoreName: databaseName,
      contentType: 'application/octet-stream',
    });

    const openedNames = openSpy.mock.calls.map(([name]) => name);
    expect(openedNames).toContain(databaseName);
    expect(openedNames).not.toContain('test-chunks');
    openSpy.mockRestore();
  });
});
