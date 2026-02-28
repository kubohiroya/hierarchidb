import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, '..', '..');
const fallbackRepoRoot = path.resolve(packageRoot, '..', '..', '..');

const findRepoRoot = (startDir: string): string => {
  let cursor = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(cursor, 'pnpm-workspace.yaml'))) {
      return cursor;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return fallbackRepoRoot;
};

export const repoRoot = findRepoRoot(packageRoot);

export const appDir = path.join(repoRoot, 'app');
export const appPkgPath = path.join(appDir, 'package.json');
export const pluginRegistryPackageDir = path.join(repoRoot, 'packages', 'plugin-registry');
export const registryGeneratedDir = path.join(pluginRegistryPackageDir, 'generated');
export const registryOutputFile = path.join(registryGeneratedDir, 'registry.ts');
export const registryDeclarationsFile = path.join(registryGeneratedDir, 'registry.modules.d.ts');
export const registryUiLoadersFile = path.join(registryGeneratedDir, 'ui-loaders.ts');
export const registryWorkerLoadersFile = path.join(registryGeneratedDir, 'worker-loaders.ts');
export const registryIconLoadersFile = path.join(registryGeneratedDir, 'icon-loaders.ts');
export const registryDatabaseLoadersFile = path.join(registryGeneratedDir, 'database-loaders.ts');
export const registryPluginDefinitionsFile = path.join(registryGeneratedDir, 'plugin-definitions.ts');
export const registryDerivationsFile = path.join(registryGeneratedDir, 'derivations.ts');
export const registryOutputDir = path.dirname(registryOutputFile);
