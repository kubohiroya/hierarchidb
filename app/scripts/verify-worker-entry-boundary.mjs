import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const appRoot = resolve(import.meta.dirname, '..');
const distRoot = resolve(appRoot, 'dist');
const sharedWorkerEntry = resolve(distRoot, 'shared-worker.js');
const sharedWorkerImportPattern =
  /\b(?:from\s*|import\s*(?:\(\s*)?)["'][^"']*shared-worker\.js(?:[?#][^"']*)?["']/;
const isoCsvAssetName = 'iso3166-2-level1.csv';
const workerRuntimeArtifactPattern = /(?:^|\/)worker-runtime-shared-[^/]+\.js$/;

const collectJavaScriptFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = resolve(directory, entry.name);
      if (entry.isDirectory()) return collectJavaScriptFiles(target);
      return entry.isFile() && entry.name.endsWith('.js') ? [target] : [];
    }),
  );
  return files.flat();
};

const artifacts = await collectJavaScriptFiles(distRoot);
const violations = [];
const unresolvedIsoBaseArtifacts = [];
let foundIsoCsvConsumer = false;

for (const artifact of artifacts) {
  if (artifact === sharedWorkerEntry) continue;
  const source = await readFile(artifact, 'utf8');
  if (sharedWorkerImportPattern.test(source)) {
    violations.push(artifact.slice(distRoot.length + 1));
  }
  if (workerRuntimeArtifactPattern.test(artifact) && source.includes(isoCsvAssetName)) {
    foundIsoCsvConsumer = true;
    const assetNameIndex = source.indexOf(isoCsvAssetName);
    const baseResolverStart = Math.max(0, assetNameIndex - 1_200);
    if (source.slice(baseResolverStart, assetNameIndex).includes('import.meta')) {
      unresolvedIsoBaseArtifacts.push(artifact.slice(distRoot.length + 1));
    }
  }
}

if (violations.length > 0) {
  throw new Error(
    `Worker artifacts must not import the SharedWorker entry: ${violations.sort().join(', ')}`,
  );
}

if (!foundIsoCsvConsumer) {
  throw new Error(`Worker artifacts do not contain the required ${isoCsvAssetName} consumer`);
}

if (unresolvedIsoBaseArtifacts.length > 0) {
  throw new Error(
    `Worker ISO asset base URL was not replaced at build time: ${unresolvedIsoBaseArtifacts.sort().join(', ')}`,
  );
}

console.log('[verify-worker-entry-boundary] passed');
