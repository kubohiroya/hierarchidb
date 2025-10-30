import { defineConfig, loadEnv } from 'vite';
import * as fs from 'node:fs';
import * as path from 'node:path';

type AliasEntry = { find: string | RegExp; replacement: string };

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

    const legacyMappings: Array<[string, string]> = [
    ['@hierarchidb/components', '../packages/components/dist/index.js'],
    ['@hierarchidb/plugin-ui-host', '../packages/plugin-ui-host/dist/index.js'],
    ['@hierarchidb/ui-auth', '../packages/ui/auth/dist/index.js'],
    ['@hierarchidb/ui-dialog', '../packages/ui/dialog/dist/index.js'],
    ['@hierarchidb/ui-icon', '../packages/ui/icon/dist/index.js'],
    ['@hierarchidb/ui-i18n', '../packages/ui/i18n/dist/index.js'],
    ['@hierarchidb/ui-layout', '../packages/ui/layout/dist/index.js'],
    ['@hierarchidb/ui-map', '../packages/ui/map/dist/index.js'],
    ['@hierarchidb/ui-navigation', '../packages/ui/navigation/dist/index.js'],
    ['@hierarchidb/ui-routing', '../packages/ui/routing/dist/index.js'],
    ['@hierarchidb/ui-theme', '../packages/ui/theme/dist/index.js'],
    ['@hierarchidb/ui-tour', '../packages/ui/tour/dist/index.js'],
    ['@hierarchidb/ui-treeconsole-base', '../packages/ui/treeconsole/base/dist/index.js'],
    ['@hierarchidb/ui-treeconsole-breadcrumb', '../packages/ui/treeconsole/breadcrumb/dist/index.js'],
    ['@hierarchidb/ui-treeconsole-toolbar', '../packages/ui/treeconsole/toolbar/dist/index.js'],
    ['@hierarchidb/ui-treeconsole-treetable', '../packages/ui/treeconsole/treetable/dist/index.js'],
    ['@hierarchidb/ui-usermenu', '../packages/ui/usermenu/dist/index.js'],
    ['@hierarchidb/common-api', '../packages/common/api/dist/index.js'],
    ['@hierarchidb/common-auth', '../packages/common/auth/dist/index.js'],
    ['@hierarchidb/common-types', '../packages/common/types/dist/index.js'],
    ['@hierarchidb/util', '../packages/util/dist/index.js'],
    ['@hierarchidb/runtime-client', '../packages/runtime/client/dist/index.js'],
    ['@hierarchidb/runtime-worker', '../packages/runtime/worker/dist/index.js'],
    ['@hierarchidb/map-adapter', '../packages/feature/map-adapter/dist/index.js'],
    ['@hierarchidb/plugin-presentation', '../packages/plugin-presentation/dist/index.js'],
    ['@hierarchidb/plugin-registry', '../packages/plugin-registry/dist/registry.js'],
    ['@hierarchidb/plugin-registry/derivations', '../packages/plugin-registry/dist/derivations.js'],
    ['@hierarchidb/plugin-registry/types', '../packages/plugin-registry/dist/types.d.ts'],
    ['@hierarchidb/plugin-ui-sdk', '../packages/plugin-ui-sdk/dist/index.js'],
    ['@hierarchidb/folder-plugin', '../plugins/folder-plugin/dist/index.js'],
    ['@hierarchidb/location-plugin', '../plugins/location-plugin/dist/index.js'],
    ['@hierarchidb/linker-plugin', '../plugins/linker-plugin/dist/index.js'],
    ['@hierarchidb/resolver-plugin', '../plugins/resolver-plugin/dist/index.js'],
    ['@hierarchidb/route-plugin', '../plugins/route-plugin/dist/index.js'],
    ['@hierarchidb/shape-plugin', '../plugins/shape-plugin/dist/index.js'],
    ['@hierarchidb/spreadsheet-plugin', '../plugins/spreadsheet-plugin/dist/index.js'],
    ['@hierarchidb/styler-plugin', '../plugins/styler-plugin/dist/index.js'],
    ['@hierarchidb/tabular-source-xlsx', '../packages/feature/tabular-source-xlsx/dist/index.js'],
    ['@hierarchidb/timeline-plugin', '../plugins/timeline-plugin/dist/index.js'],
  ];
  addAliasIfExists(rootDir, '../packages/runtime/worker/dist/index.ts', '@hierarchidb/feature-core/runtime-worker', aliases);
  addAliasIfExists(rootDir, '../packages/runtime/client/dist/index.ts', '@hierarchidb/feature-core/runtime-client', aliases);
  addAliasIfExists(rootDir, '../packages/feature/map-adapter/dist/index.ts', '@hierarchidb/feature-core/map-adapter', aliases);
  addAliasIfExists(rootDir, '../packages/feature/tabular-source-xlsx/dist/index.ts', '@hierarchidb/feature-core/tabular-source-xlsx', aliases);
  addAliasIfExists(rootDir, '../packages/util/dist/index.ts', '@hierarchidb/feature-core/util', aliases);
  addAliasIfExists(rootDir, '../packages/ui/i18n/dist/index.js', '@hierarchidb/ui-shell/ui-i18n', aliases);
  addAliasIfExists(rootDir, '../packages/ui/icon/src/index.ts', '@hierarchidb/ui-shell/ui-icon', aliases);
  addAliasIfExists(rootDir, '../packages/runtime-ui/plugin-dialog/src/index.ts', '@hierarchidb/runtime-ui-plugin-dialog', aliases);
  addAliasIfExists(rootDir, '../packages/plugin-loader/base-plugin/dist/index.ts', '@hierarchidb/base-plugin', aliases);
  for (const [spec, rel] of legacyMappings) {
    addAliasIfExists(rootDir, rel, spec, aliases);
  }
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
        '@hierarchidb/feature-core/runtime-worker',
        '@hierarchidb/feature-core/runtime-client',
        '@hierarchidb/feature-core/map-adapter',
        '@hierarchidb/feature-core/tabular-source-xlsx',
        '@hierarchidb/runtime-ui-plugin-dialog',
      ],
    },
  };
});
