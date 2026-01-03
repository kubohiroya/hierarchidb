import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { appDir, appPkgPath, repoRoot } from './paths.ts';

const require = createRequire(import.meta.url);

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeFileIfChanged(filePath: string, contents: string): Promise<boolean> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  try {
    const current = await fs.readFile(filePath, 'utf8');
    if (current === contents) {
      return false;
    }
  } catch {
    // ignore read errors; we'll write the file below.
  }
  await fs.writeFile(filePath, contents, 'utf8');
  return true;
}

export async function readPluginPackageJSON(pkgName: string, nodeType: string) {
  try {
    const resolved = require.resolve(`${pkgName}/package.json`);
    const json = JSON.parse(await fs.readFile(resolved, 'utf8'));
    return { json, path: resolved, dir: path.dirname(resolved) };
  } catch {
    const fallback = path.join(repoRoot, 'plugins', `${nodeType}-plugin`, 'package.json');
    if (await fileExists(fallback)) {
      const json = JSON.parse(await fs.readFile(fallback, 'utf8'));
      return { json, path: fallback, dir: path.dirname(fallback) };
    }
  }
  return { json: undefined, path: undefined, dir: undefined };
}

export async function loadJsonIfExists(filePath: string): Promise<Record<string, any> | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadAppPackage() {
  const raw = await fs.readFile(appPkgPath, 'utf8');
  return JSON.parse(raw);
}

export async function removeLegacyArtifacts(): Promise<void> {
  const legacyPaths = [
    path.join(appDir, 'src', 'generated'),
    path.join(appDir, 'src', 'plugin-registry', 'generated'),
    path.join(repoRoot, 'packages', 'runtime-worker/worker', 'src', 'generated'),
    path.join(repoRoot, 'types', 'generated'),
  ];

  await Promise.all(
    legacyPaths.map(async (legacyPath) => {
      try {
        await fs.rm(legacyPath, { recursive: true, force: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[generate-plugin-registry] failed to remove legacy artefact', legacyPath, message);
      }
    }),
  );
}
