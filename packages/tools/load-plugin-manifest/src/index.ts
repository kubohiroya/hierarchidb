/**
 * Module: tools/load-plugin-manifest
 * Purpose: utility used by generator scripts (e.g., `scripts/generate-plugin-loader.mjs`)
 * to load and evaluate TypeScript plugin manifest modules without spinning up a
 * build. It transpiles the manifest on the fly and returns the exported
 * metadata object.
 * Invocation: imported from Node scripts; not executed directly from the CLI.
 * Output: no files written. Consumers receive manifest JSON objects.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

type LoadOptions = {
  readonly silent?: boolean;
};

type PackageLike = {
  readonly __path?: string;
};

const TRANSPILER_OPTIONS: ts.TranspileOptions['compilerOptions'] = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  resolveJsonModule: true,
  esModuleInterop: true,
};

const fallbackRequire = createRequire(import.meta.url);

function evaluateManifestModule(manifestPath: string, { silent = false }: LoadOptions = {}): Record<string, unknown> | undefined {
  if (!fs.existsSync(manifestPath)) {
    return undefined;
  }

  try {
    const source = fs.readFileSync(manifestPath, 'utf-8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: TRANSPILER_OPTIONS,
      fileName: manifestPath,
    });

    const module = { exports: {} as Record<string, unknown> };
    const localRequire = (specifier: string): unknown => {
      if (specifier.endsWith('.json')) {
        const abs = path.resolve(path.dirname(manifestPath), specifier);

        return JSON.parse(fs.readFileSync(abs, 'utf-8'));
      }
      if (specifier === '@hierarchidb/common-types') {
        return {
          toNodeType: (value: string) => value,
        };
      }
      return fallbackRequire(specifier);
    };

    const fn = new Function('require', 'module', 'exports', outputText) as (
      req: (specifier: string) => unknown,
      mod: { exports: Record<string, unknown> },
      exports: Record<string, unknown>,
    ) => void;
    fn(localRequire, module, module.exports);

    const manifest = module.exports.PLUGIN_MANIFEST
      ?? module.exports.pluginManifest
      ?? module.exports.default;

    return manifest && typeof manifest === 'object'
      ? manifest
      : undefined;
  } catch (error) {
    if (!silent) {
      console.warn('[load-plugin-manifest] Failed to load manifest', manifestPath, error);
    }
    return undefined;
  }
}

export function loadPluginManifestFromFile(manifestPath: string, options: LoadOptions = {}): Record<string, unknown> | undefined {
  return evaluateManifestModule(manifestPath, options);
}

export function loadPluginManifestFromPackageJson(pkg: PackageLike, options: LoadOptions = {}): Record<string, unknown> | undefined {
  const pkgPath = pkg?.__path;
  if (!pkgPath) {
    return undefined;
  }
  const manifestPath = path.join(path.dirname(pkgPath), 'src', 'extension', 'plugin-manifest.ts');
  return evaluateManifestModule(manifestPath, options);
}

export function resolvePluginManifestPath(pkg: PackageLike): string | undefined {
  const pkgPath = pkg?.__path;
  if (!pkgPath) {
    return undefined;
  }
  return path.join(path.dirname(pkgPath), 'src', 'extension', 'plugin-manifest.ts');
}
