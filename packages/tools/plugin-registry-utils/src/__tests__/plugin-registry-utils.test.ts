import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConfigEnv, UserConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  createNodeTypeAliasPlugin,
  deriveNodeTypePluginAliases,
  discoverNodeTypePlugins,
  pickPreferredServiceSubpath,
  syncNodeTypeAliasesToTsconfig,
} from '../index.js';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hdb-registry-utils-'));
const packagesDir = path.join(tmpRoot, 'packages', 'node-type');

function writeFile(relPath: string, contents: string): void {
  fs.mkdirSync(path.dirname(relPath), { recursive: true });
  fs.writeFileSync(relPath, contents, 'utf-8');
}

beforeAll(() => {
  const fooPkgDir = path.join(packagesDir, 'foo-plugin');
  writeFile(
    path.join(fooPkgDir, 'package.json'),
    JSON.stringify(
      {
        name: '@hierarchidb/plugins-foo-plugin',
        type: 'module',
        exports: {
          '.': './dist/index.js',
          './services': './dist/services/index.js',
          './database': './dist/database/index.js',
        },
        hierarchidb: { plugin: { nodeType: 'foo' } },
      },
      null,
      2,
    ),
  );
  writeFile(path.join(fooPkgDir, 'src/services/index.ts'), 'export const foo = true;\n');
  writeFile(path.join(fooPkgDir, 'src/database/index.ts'), 'export const fooDb = true;\n');

  const barPkgDir = path.join(packagesDir, 'bar-plugin');
  writeFile(
    path.join(barPkgDir, 'package.json'),
    JSON.stringify(
      {
        name: '@hierarchidb/plugins-bar-plugin',
        type: 'module',
        exports: {
          '.': './dist/index.js',
        },
        hierarchidb: { plugin: { nodeType: 'bar' } },
      },
      null,
      2,
    ),
  );
  writeFile(path.join(barPkgDir, 'src/index.ts'), 'export const bar = true;\n');
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('plugin registry utils', () => {
  it('discovers node-type plugins and their subpaths', () => {
    const plugins = discoverNodeTypePlugins({ rootDir: tmpRoot });
    expect(plugins).toHaveLength(2);

    const foo = plugins.find((p) => p.nodeType === 'foo');
    expect(foo).toBeDefined();
    expect(foo?.subpaths.services.hasExport).toBe(true);
    expect(foo?.subpaths.services.srcPath).toContain('foo-plugin/src/services/index.ts');
    expect(foo?.subpaths.database.hasExport).toBe(true);

    const bar = plugins.find((p) => p.nodeType === 'bar');
    expect(bar).toBeDefined();
    expect(bar?.subpaths.services.hasExport).toBe(false);
    const fallback = pickPreferredServiceSubpath(bar!);
    expect(fallback?.type).toBe('root');
    expect(fallback?.hasExport).toBe(true);
  });

  it('derives alias entries for requested subpaths', () => {
    const plugins = discoverNodeTypePlugins({ rootDir: tmpRoot });
    const aliases = deriveNodeTypePluginAliases(plugins, { subpaths: ['services', 'database'] });
    expect(aliases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          find: '@hierarchidb/plugins-foo-plugin/services',
          replacement: expect.stringContaining('foo-plugin/src/services/index.ts'),
        }),
        expect.objectContaining({
          find: '@hierarchidb/plugins-foo-plugin/database',
          replacement: expect.stringContaining('foo-plugin/src/database/index.ts'),
        }),
      ]),
    );
    expect(aliases.some((alias) => alias.find.includes('bar-plugin'))).toBe(false);
  });

  it('writes TypeScript paths entries while preserving JSON-like content', () => {
    const tsconfigPath = path.join(tmpRoot, 'app', 'tsconfig.json');
    writeFile(
      tsconfigPath,
      `{
        // inline comment should be ignored
        "compilerOptions": {
          "baseUrl": ".",
          "paths": {}
        }
      }\n`,
    );

    syncNodeTypeAliasesToTsconfig({
      rootDir: tmpRoot,
      tsconfigPath,
      subpaths: ['services', 'database'],
    });

    const updated = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
    expect(updated.compilerOptions.paths['@hierarchidb/plugins-foo-plugin/services'][0]).toBe(
      '../packages/plugins/foo-plugin/src/services/index.ts',
    );
    expect(updated.compilerOptions.paths['@hierarchidb/plugins-foo-plugin/database'][0]).toBe(
      '../packages/plugins/foo-plugin/src/database/index.ts',
    );
  });

  it('injects Vite aliases via createNodeTypeAliasPlugin', async () => {
    const plugin = createNodeTypeAliasPlugin({
      rootDir: tmpRoot,
      subpaths: ['services', 'database'],
    });

    const hook = plugin.config;
    const env: ConfigEnv = { command: 'build', mode: 'production', isSsrBuild: false };
    const config: UserConfig = { resolve: {} };

    const result = await (async () => {
      if (!hook) return undefined;
      if (typeof hook === 'function') {
        return hook(config, env);
      }
      if (typeof hook === 'object' && 'handler' in hook && typeof hook.handler === 'function') {
        return hook.handler(config, env);
      }
      return undefined;
    })();
    expect(result?.resolve?.alias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          find: '@hierarchidb/plugins-foo-plugin/services',
          replacement: expect.stringContaining('foo-plugin/src/services/index.ts'),
        }),
      ]),
    );
  });
});
