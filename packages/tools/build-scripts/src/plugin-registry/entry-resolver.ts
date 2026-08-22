import path from 'node:path';
import { fileExists } from './fs-utils.js';
import { registryOutputDir, repoRoot } from './paths.js';
import type { ManifestSummary, PluginSpecifierMode } from './types.js';

export function hasExportPath(paths: string[], target: string): boolean {
  return paths.some(
    (entry) => entry === target || entry === `${target}/index` || entry.startsWith(`${target}/`)
  );
}

export async function findEntryFile(
  packageDir: string,
  candidates: readonly string[]
): Promise<string | null> {
  for (const candidate of candidates) {
    const absolute = path.join(packageDir, candidate);
    if (await fileExists(absolute)) {
      return path.relative(repoRoot, absolute).split(path.sep).join('/');
    }
  }
  return null;
}

function toRelativeImportPath(entry: string): string {
  const absolute = path.join(repoRoot, entry);
  let relative = path.relative(registryOutputDir, absolute).split(path.sep).join('/');
  if (!relative.startsWith('.')) {
    relative = `./${relative}`;
  }
  return relative;
}

function createDistSpecifierExpression(
  distEntry: string | null | undefined,
  fallbackSpecifier: string
): string {
  if (!distEntry) {
    return JSON.stringify(fallbackSpecifier);
  }
  const relativePath = toRelativeImportPath(distEntry);
  return `new URL(${JSON.stringify(relativePath)}, import.meta.url).href`;
}

export function inferDistEntryForSpecifier(
  summary: ManifestSummary,
  specifier: string
): string | null {
  if (!specifier || !specifier.startsWith(summary.packageName)) {
    return null;
  }
  const suffix = specifier.slice(summary.packageName.length);
  switch (suffix) {
    case '':
    case '/':
      return summary.rootDistEntry;
    case '/worker':
      return summary.workerDistEntry;
    case '/ui':
      return summary.uiDistEntry;
    case '/database':
      return summary.databaseDistEntry;
    case '/_obsolate_common':
      return summary.commonDistEntry;
    case '/icon':
      return summary.iconComponent?.distEntry ?? null;
    default:
      return null;
  }
}

export function resolveSpecifierExpression(
  fallbackSpecifier: string,
  distEntry: string | null | undefined,
  mode: PluginSpecifierMode
): string {
  if (mode === 'dist-url') {
    return createDistSpecifierExpression(distEntry ?? null, fallbackSpecifier);
  }
  return JSON.stringify(fallbackSpecifier);
}

export function resolveTargetSpecifier(
  specifier: string,
  summary: ManifestSummary,
  mode: PluginSpecifierMode
): string {
  if (mode === 'dist-url') {
    const distEntry = inferDistEntryForSpecifier(summary, specifier);
    if (distEntry) {
      return createDistSpecifierExpression(distEntry, specifier);
    }
  }
  return JSON.stringify(specifier);
}
