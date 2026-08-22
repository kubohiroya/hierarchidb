import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyWorkerEntryBoundary } from './worker-entry-boundary-verifier.mjs';

const withDist = async (files, run) => {
  const distRoot = await mkdtemp(join(tmpdir(), 'worker-entry-boundary-'));
  try {
    await mkdir(join(distRoot, 'assets'), { recursive: true });
    await Promise.all(
      Object.entries(files).map(async ([name, source]) => {
        const file = join(distRoot, name);
        if (name.includes('/')) {
          await mkdir(join(file, '..'), { recursive: true });
        }
        await writeFile(file, source);
      }),
    );
    return await run(distRoot);
  } finally {
    await rm(distRoot, { recursive: true, force: true });
  }
};

test('accepts neutral worker runtime chunks with build-time ISO base', async () => {
  await withDist(
    {
      'shared-worker.js': 'import "./assets/worker-runtime-shared-ok.js";',
      'assets/worker-runtime-shared-ok.js':
        `const env=import.meta.env;${'x'.repeat(1_300)}const csv="/hierarchidb/iso3166-2-level1.csv";`,
      'assets/app.js': 'import "./shared-worker.js";',
    },
    async (distRoot) => {
      await verifyWorkerEntryBoundary({ distRoot });
    },
  );
});

test('rejects non-entry artifacts that import the SharedWorker entry', async () => {
  await withDist(
    {
      'shared-worker.js': 'import "./assets/worker-runtime-shared-ok.js";',
      'assets/worker-runtime-shared-ok.js': 'const csv="/hierarchidb/iso3166-2-level1.csv";',
      'assets/worker-runtime-shared-bad.js': 'import "../shared-worker.js";',
    },
    async (distRoot) => {
      await assert.rejects(
        () => verifyWorkerEntryBoundary({ distRoot }),
        /must not import the SharedWorker entry/,
      );
    },
  );
});

test('rejects a SharedWorker entry with a bare vt-pbf import', async () => {
  await withDist(
    {
      'shared-worker.js':
        'import "@maplibre/vt-pbf";import "./assets/worker-runtime-shared-ok.js";',
      'assets/worker-runtime-shared-ok.js':
        'const csv="/hierarchidb/iso3166-2-level1.csv";',
    },
    async (distRoot) => {
      await assert.rejects(
        () => verifyWorkerEntryBoundary({ distRoot }),
        /must bundle @maplibre\/vt-pbf/,
      );
    },
  );
});

test('rejects worker ISO consumers with unresolved runtime base fallback', async () => {
  await withDist(
    {
      'shared-worker.js': 'import "./assets/worker-runtime-shared-bad.js";',
      'assets/worker-runtime-shared-bad.js':
        'const base=import.meta.env?.BASE_URL||"/";const csv=base+"iso3166-2-level1.csv";',
    },
    async (distRoot) => {
      await assert.rejects(
        () => verifyWorkerEntryBoundary({ distRoot }),
        /ISO asset base URL was not replaced/,
      );
    },
  );
});

test('rejects worker ISO consumers with an origin-root asset fallback', async () => {
  await withDist(
    {
      'shared-worker.js': 'import "./assets/worker-runtime-shared-bad.js";',
      'assets/worker-runtime-shared-bad.js': 'const csv="/iso3166-2-level1.csv";',
    },
    async (distRoot) => {
      await assert.rejects(
        () => verifyWorkerEntryBoundary({ distRoot }),
        /ISO asset base URL was not replaced/,
      );
    },
  );
});

test('rejects artifacts without the required worker ISO consumer', async () => {
  await withDist(
    {
      'shared-worker.js': 'import "./assets/worker-runtime-shared-ok.js";',
      'assets/worker-runtime-shared-ok.js': 'export const ready=true;',
    },
    async (distRoot) => {
      await assert.rejects(
        () => verifyWorkerEntryBoundary({ distRoot }),
        /do not contain the required iso3166-2-level1\.csv consumer/,
      );
    },
  );
});
