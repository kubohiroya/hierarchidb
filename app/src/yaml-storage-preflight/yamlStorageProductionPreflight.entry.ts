import {
  initializeYamlStorageProductionPreflight,
  parseYamlStorageProductionPreflightMode,
  renderYamlStorageProductionPreflightModeFailure,
} from './initializeYamlStorageProductionPreflight.js';
import { runYamlStorageProductionPreflight } from './runYamlStorageProductionPreflight.js';

declare const __HDB_DATABASE_PREFIX__: string;
declare const __SOURCE_SHA__: string;

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
    execute: async () =>
      await runYamlStorageProductionPreflight({
        mode,
        factory: globalThis.indexedDB,
        databasePrefix: __HDB_DATABASE_PREFIX__,
        releaseVersion: __SOURCE_SHA__,
        timestamp: new Date().toISOString(),
        digestSha256Hex,
      }),
  });
}
