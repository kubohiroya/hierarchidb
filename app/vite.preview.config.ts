import { defineConfig, loadEnv } from 'vite';
import * as fs from 'node:fs';
import * as path from 'node:path';

type AliasEntry = { find: string; replacement: string };

function addAliasIfExists(rootDir: string, relativePath: string, find: string, target: AliasEntry[]) {
  const absolutePath = path.resolve(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) return;
  target.push({ find, replacement: absolutePath });
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolvePluginCandidate(candidates: string[], pluginName: string, rootDir: string): string | null {
  for (const candidate of candidates) {
    const resolved = path.resolve(rootDir, `../plugins/${pluginName}/${candidate}`);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return null;
}

// PreviewStep-specific config without React Router plugin
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appName = env.VITE_APP_NAME || '';
  const base = appName ? `/${appName}/` : '/';
  const rootDir = __dirname;

  const aliases: AliasEntry[] = [];

  const repoRoot = path.resolve(rootDir, '..');
  addAliasIfExists(rootDir, '../packages/runtime/worker/dist/index.ts', '@hierarchidb/runtime-worker', aliases);
  addAliasIfExists(rootDir, '../packages/runtime/client/dist/index.ts', '@hierarchidb/runtime-client', aliases);
  addAliasIfExists(rootDir, '../packages/feature/map-adapter/dist/index.ts', '@hierarchidb/map-adapter', aliases);
  addAliasIfExists(rootDir, '../packages/feature/tabular-source-xlsx/dist/index.ts', '@hierarchidb/tabular-source-xlsx', aliases);
  addAliasIfExists(rootDir, '../packages/util/dist/index.ts', '@hierarchidb/util', aliases);
  addAliasIfExists(rootDir, '../packages/ui/core/dist/index.ts', '@hierarchidb/ui-core', aliases);
  addAliasIfExists(rootDir, '../packages/ui/i18n/dist/index.js', '@hierarchidb/ui-i18n', aliases);
  addAliasIfExists(rootDir, '../packages/ui/icon/src/index.ts', '@hierarchidb/ui-icon', aliases);
  addAliasIfExists(rootDir, '../packages/runtime-ui/plugin-dialog/src/index.ts', '@hierarchidb/runtime-ui-plugin-dialog', aliases);
  addAliasIfExists(rootDir, '../packages/plugin-loader/base-plugin/dist/index.ts', '@hierarchidb/base-plugin', aliases);
  aliases.push({ find: '~', replacement: path.resolve(rootDir, './src') });

  const pluginPkgRoot = path.resolve(rootDir, '../plugins');
  if (fs.existsSync(pluginPkgRoot)) {
    const workerEntryCandidates = ['src/worker/index.ts', 'src/worker.ts'];
    const uiCandidates = ['src/ui/index.ts', 'src/ui.ts'];
    const iconCandidates = ['src/icon/index.ts', 'src/icon.ts'];
    const databaseCandidates = ['src/services/database/index.ts', 'src/database/index.ts', 'src/database.ts', 'src/worker/database/index.ts'];
    const rootCandidates = ['src/index.ts', 'src/index.tsx', 'src/index.mts', 'src/index.mjs', 'src/index.js', 'src/index.cjs'];

    for (const entry of fs.readdirSync(pluginPkgRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.endsWith('-plugin')) continue;

      const pluginName = entry.name;
      const specBase = `@hierarchidb/${pluginName}`;

      const rootDistPath = path.resolve(rootDir, `../plugins/${pluginName}/dist/index.js`);
      const rootSourcePath = resolvePluginCandidate(rootCandidates, pluginName, rootDir);
      if (fs.existsSync(rootDistPath)) {
        aliases.push({ find: new RegExp(`^${escapeForRegex(specBase)}$`), replacement: rootDistPath });
      } else if (rootSourcePath) {
        aliases.push({ find: new RegExp(`^${escapeForRegex(specBase)}$`), replacement: rootSourcePath });
      }

      const workerDistPath = path.resolve(rootDir, `../plugins/${pluginName}/dist/worker/index.js`);
      const workerSourcePath = resolvePluginCandidate(workerEntryCandidates, pluginName, rootDir);
      if (fs.existsSync(workerDistPath)) {
        aliases.push({ find: `${specBase}/worker`, replacement: workerDistPath });
      } else if (workerSourcePath) {
        aliases.push({ find: `${specBase}/worker`, replacement: workerSourcePath });
      }

      const uiDistPath = path.resolve(rootDir, `../plugins/${pluginName}/dist/ui/index.js`);
      const uiSourcePath = resolvePluginCandidate(uiCandidates, pluginName, rootDir);
      if (fs.existsSync(uiDistPath)) {
        aliases.push({ find: `${specBase}/ui`, replacement: uiDistPath });
      } else if (uiSourcePath) {
        aliases.push({ find: `${specBase}/ui`, replacement: uiSourcePath });
      }

      const iconDistPath = resolvePluginCandidate(['dist/icon/index.js'], pluginName, rootDir);
      const iconSourcePath = resolvePluginCandidate(iconCandidates, pluginName, rootDir);
      if (iconDistPath) {
        aliases.push({ find: `${specBase}/icon`, replacement: iconDistPath });
      } else if (iconSourcePath) {
        aliases.push({ find: `${specBase}/icon`, replacement: iconSourcePath });
      }

      const databaseDistPath =
        resolvePluginCandidate(
          [
            `dist/services/database/index.js`,
            `dist/worker/database/index.js`,
            `dist/database/index.js`,
          ],
          pluginName,
          rootDir,
        );
      const databaseSourcePath = resolvePluginCandidate(databaseCandidates, pluginName, rootDir);
      if (databaseDistPath) {
        aliases.push({ find: `${specBase}/database`, replacement: databaseDistPath });
      } else if (databaseSourcePath) {
        aliases.push({ find: `${specBase}/database`, replacement: databaseSourcePath });
      }
    }
  }


  return {
    base,
    preview: {
      port: 4173,
      open: true,
      host: true,
    },
    build: {
      outDir: 'build/client',
    },
    resolve: {
      alias: aliases,
    },
    worker: {
      format: 'es',
    },
    optimizeDeps: {
      exclude: [
        '@hierarchidb/runtime-worker',
        '@hierarchidb/runtime-client',
        '@hierarchidb/map-adapter',
        '@hierarchidb/tabular-source-xlsx',
        '@hierarchidb/runtime-ui-plugin-dialog',
      ],
    },
  };
});
