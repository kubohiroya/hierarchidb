import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { verifyWorkerEntryBoundary } from './worker-entry-boundary-verifier.mjs';

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isCli) {
  await verifyWorkerEntryBoundary();
  console.log('[verify-worker-entry-boundary] passed');
}
