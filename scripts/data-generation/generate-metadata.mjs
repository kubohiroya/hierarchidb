import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.resolve(repoRoot, 'packages/features/fetch-save-metadata/output');
const DEFAULT_BASE_URL = (process.env.HDB_METADATA_SOURCE_BASE_URL ?? 'https://raw.githubusercontent.com/hierarchidb/hierarchidb/main/packages/features/fetch-save-metadata/output').replace(/\/$/, '');

const DATASETS = {
  gadm: {
    fileName: 'gadm.json',
    envVar: 'HDB_GADM_METADATA_URL',
    fallbackPath: 'gadm.json',
  },
  geoboundaries: {
    fileName: 'geoboundaries.json',
    envVar: 'HDB_GEOBOUNDARIES_METADATA_URL',
    fallbackPath: 'geoboundaries.json',
  },
  naturalearth: {
    fileName: 'naturalearth.json',
    envVar: 'HDB_NATURALEARTH_METADATA_URL',
    fallbackPath: 'naturalearth.json',
  },
  osm: {
    fileName: 'osm.json',
    envVar: 'HDB_OSM_METADATA_URL',
    fallbackPath: 'osm.json',
  },
};

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fetchAndSaveMetadata({ sourceURL, outputFileName }) {
  const fullPath = path.join(outputDir, outputFileName);
  if (await fileExists(fullPath)) {
    console.log(`[metadata] ${outputFileName} already exists – skipping`);
    return;
  }

  await ensureDirectory(outputDir);
  console.log(`[metadata] fetching ${outputFileName} from ${sourceURL}`);
  const response = await fetch(sourceURL);
  if (!response.ok) {
    throw new Error(`Failed to download ${outputFileName}: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  const jsonContent = JSON.stringify(json, null, 2);
  await fs.writeFile(fullPath, jsonContent, 'utf-8');
  console.log(`[metadata] wrote ${outputFileName}`);
}

async function ensureDataset(key) {
  const config = DATASETS[key];
  const url = process.env[config.envVar] ?? `${DEFAULT_BASE_URL}/${config.fallbackPath}`;
  await fetchAndSaveMetadata({ sourceURL: url, outputFileName: config.fileName });
}

async function main() {
  const [, , arg] = process.argv;
  const datasetKeys = Object.keys(DATASETS);
  let targets;
  if (!arg || arg === '--all') {
    targets = datasetKeys;
  } else if (datasetKeys.includes(arg)) {
    targets = [arg];
  } else {
    console.error(`Unknown dataset "${arg}". Expected one of ${datasetKeys.join(', ')} or --all.`);
    process.exitCode = 1;
    return;
  }

  for (const key of targets) {
    // eslint-disable-next-line no-await-in-loop
    await ensureDataset(key);
  }
}

void main();
