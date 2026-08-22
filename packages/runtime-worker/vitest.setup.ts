/**
 * Worker Package Test Setup
 * Uses base setup with worker-specific configurations
 */

// Import base setup (includes all _obsolate_common mocks)
import 'fake-indexeddb/auto';
import '../../vitest.database-prefix.setup.ts';
import { ReadableStream, WritableStream } from 'node:stream/web';
import { gunzipSync, gzipSync } from 'node:zlib';
import { initializeEphemeralDB } from '@hierarchidb/gis-sdk';
import { initializeLocationDB } from '@hierarchidb/location-store';
import { initializeRouteDB } from '@hierarchidb/route-store';
import { initializeShapeDB } from '@hierarchidb/shape-store';
import { getDBName } from '@hierarchidb/util';

initializeEphemeralDB(getDBName('test', 'ephemeral'));
initializeLocationDB(getDBName('test', 'location'));
initializeRouteDB(getDBName('test', 'route'));
initializeShapeDB(getDBName('test', 'shape'));

// Minimal worker-specific test setup for isolated unit tests.
// Intentionally avoids importing monorepo-wide setup to prevent tsconfig resolution issues.

type EntitiesDbTable = {
  delete(id: string): Promise<void> | void;
};

type EntitiesDbAdapter = {
  open(): Promise<void> | void;
  table(name: string): EntitiesDbTable | undefined;
};

type EntitiesOverrideFactory =
  | EntitiesDbAdapter
  | (() => EntitiesDbAdapter | Promise<EntitiesDbAdapter | undefined> | undefined)
  | (() => Promise<EntitiesDbAdapter | undefined>);

type TestGlobal = typeof globalThis & {
  __HDB_PLUGIN_ENTITY_OVERRIDES__?: Record<string, EntitiesOverrideFactory>;
  __HDB_SILENCE_WORKER_LOGS__?: boolean;
};

const globalWithOverrides = globalThis as TestGlobal;

type CompressionStreamLike = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
};

type CompressionStreamConstructor = new (format: string) => CompressionStreamLike;

type TestGlobalWithCompression = typeof globalThis & {
  CompressionStream?: CompressionStreamConstructor;
  DecompressionStream?: CompressionStreamConstructor;
};

const globalWithCompression = globalThis as TestGlobalWithCompression;

const createBufferedStream = (
  transform: (input: Uint8Array) => Uint8Array
): CompressionStreamLike => {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const readable = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
    },
  });
  const chunks: Uint8Array[] = [];
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
    },
    close() {
      if (!controller) return;
      const merged = Buffer.concat(chunks.map((part) => Buffer.from(part)));
      const output = transform(new Uint8Array(merged));
      controller.enqueue(output);
      controller.close();
    },
  });
  return { readable, writable };
};

if (!globalWithCompression.CompressionStream) {
  class CompressionStreamPolyfill {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;

    constructor(format: string) {
      if (format !== 'gzip') {
        throw new Error(`Unsupported compression format: ${format}`);
      }
      const { readable, writable } = createBufferedStream((input) => {
        const compressed = gzipSync(Buffer.from(input));
        return new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength);
      });
      this.readable = readable;
      this.writable = writable;
    }
  }
  globalWithCompression.CompressionStream = CompressionStreamPolyfill;
}

if (!globalWithCompression.DecompressionStream) {
  class DecompressionStreamPolyfill {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;

    constructor(format: string) {
      if (format !== 'gzip') {
        throw new Error(`Unsupported decompression format: ${format}`);
      }
      const { readable, writable } = createBufferedStream((input) => {
        const decompressed = gunzipSync(Buffer.from(input));
        return new Uint8Array(
          decompressed.buffer,
          decompressed.byteOffset,
          decompressed.byteLength
        );
      });
      this.readable = readable;
      this.writable = writable;
    }
  }
  globalWithCompression.DecompressionStream = DecompressionStreamPolyfill;
}

// Reduce noisy logs in test output without affecting production behavior.
globalWithOverrides.__HDB_SILENCE_WORKER_LOGS__ = true;

// Provide lightweight EntitiesDB overrides so peer-entity cleanup code paths
// do not attempt to import plugin-specific Dexie implementations during unit tests.
const createMockEntitiesDB = (): EntitiesDbAdapter => {
  const rows = new Map<string, unknown>();
  return {
    async open() {
      /* no-op */
    },
    table() {
      return {
        async delete(id: string) {
          rows.delete(id);
        },
      };
    },
  };
};

const overrides = (globalWithOverrides.__HDB_PLUGIN_ENTITY_OVERRIDES__ ??= {});
for (const type of [
  'folder',
  'route',
  'resolver',
  'shape',
  'location',
  'spreadsheet',
  'styler',
  'basemap',
  'linker',
  'timeline',
]) {
  if (!overrides[type]) {
    overrides[type] = async () => createMockEntitiesDB();
  }
}
