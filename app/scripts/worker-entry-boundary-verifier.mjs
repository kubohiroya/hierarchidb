import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const appRoot = resolve(import.meta.dirname, '..');
const defaultDistRoot = resolve(appRoot, 'dist');
const sharedWorkerImportPattern =
  /\b(?:from\s*|import\s*(?:\(\s*)?)["'][^"']*shared-worker\.js(?:[?#][^"']*)?["']/;
const isoCsvAssetName = 'iso3166-2-level1.csv';
const workerRuntimeArtifactPattern = /(?:^|\/)(?:worker|shared-worker|worker-runtime-shared-[^/]+)\.js$/;
const unresolvedIsoBasePattern =
  /\bimport\.meta(?:\s*\.\s*env)?\b|(?:^|[^A-Za-z0-9_$])\/iso3166-2-level1\.csv(?:[^A-Za-z0-9_$]|$)/;

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

export const verifyWorkerEntryBoundary = async ({ distRoot = defaultDistRoot } = {}) => {
  const sharedWorkerEntry = resolve(distRoot, 'shared-worker.js');
  const artifacts = await collectJavaScriptFiles(distRoot);
  const sharedWorkerEntryImportArtifacts = [];
  const unresolvedIsoBaseArtifacts = [];
  let foundIsoCsvConsumer = false;

  for (const artifact of artifacts) {
    const source = await readFile(artifact, 'utf8');
    const relativeArtifact = artifact.slice(distRoot.length + 1);
    const isSharedWorkerEntry = artifact === sharedWorkerEntry;

    if (
      !isSharedWorkerEntry &&
      workerRuntimeArtifactPattern.test(artifact) &&
      sharedWorkerImportPattern.test(source)
    ) {
      sharedWorkerEntryImportArtifacts.push(relativeArtifact);
    }

    if (workerRuntimeArtifactPattern.test(artifact) && source.includes(isoCsvAssetName)) {
      foundIsoCsvConsumer = true;
      if (unresolvedIsoBasePattern.test(source)) {
        unresolvedIsoBaseArtifacts.push(relativeArtifact);
      }
    }
  }

  if (sharedWorkerEntryImportArtifacts.length > 0) {
    throw new Error(
      `Worker artifacts must not import the SharedWorker entry: ${sharedWorkerEntryImportArtifacts.sort().join(', ')}`,
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
};
