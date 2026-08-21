import { inspectInterruptedCoreDatabase } from '../yaml-storage-recovery/inspectInterruptedCoreDatabase.js';
import { inspectInterruptedCoreV1Database } from '../yaml-storage-recovery/inspectInterruptedCoreV1Database.js';
import { inspectYamlStorageCorrectiveRecovery } from '../yaml-storage-recovery/inspectYamlStorageCorrectiveRecovery.js';
import {
  initializeYamlStorageProductionPreflight,
  parseYamlStorageProductionPreflightMode,
  renderYamlStorageProductionPreflightModeFailure,
} from './initializeYamlStorageProductionPreflight.js';
import { runYamlStorageProductionPreflight } from './runYamlStorageProductionPreflight.js';

declare const __HDB_DATABASE_PREFIX__: string;
declare const __SOURCE_SHA__: string;

const ORIGIN_COORDINATOR_DATABASE_NAME = 'hierarchidb-origin-coordinator' as const;

async function digestSha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const mode = parseYamlStorageProductionPreflightMode(new URL(globalThis.location.href));
if (mode === null) {
  renderYamlStorageProductionPreflightModeFailure(document, __SOURCE_SHA__);
} else {
  initializeYamlStorageProductionPreflight({
    document,
    mode,
    releaseVersion: __SOURCE_SHA__,
    execute: async () => {
      const timestamp = new Date().toISOString();
      if (mode === 'recovery-interrupted-core-v1') {
        return await inspectInterruptedCoreV1Database({
          factory: globalThis.indexedDB,
          releaseVersion: __SOURCE_SHA__,
          timestamp,
        });
      }
      if (mode === 'recovery-interrupted-core') {
        return await inspectInterruptedCoreDatabase({
          factory: globalThis.indexedDB,
          releaseVersion: __SOURCE_SHA__,
          timestamp,
        });
      }
      if (mode === 'recovery-pre' || mode === 'recovery-post') {
        return await inspectYamlStorageCorrectiveRecovery({
          stage: mode,
          factory: globalThis.indexedDB,
          databaseNames: Object.freeze({
            coordinator: ORIGIN_COORDINATOR_DATABASE_NAME,
            canonicalCore: `${__HDB_DATABASE_PREFIX__}-core`,
            interruptedCore: 'hidb-core',
            yaml: `${__HDB_DATABASE_PREFIX__}-yaml`,
            recovery: `${__HDB_DATABASE_PREFIX__}-yaml-storage-recovery`,
          }),
          releaseVersion: __SOURCE_SHA__,
          timestamp,
          digestSha256Hex,
        });
      }
      return await runYamlStorageProductionPreflight({
        mode,
        factory: globalThis.indexedDB,
        databasePrefix: __HDB_DATABASE_PREFIX__,
        releaseVersion: __SOURCE_SHA__,
        timestamp,
        digestSha256Hex,
      });
    },
  });
}
