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
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

type LoadOptions = {
  readonly silent?: boolean;
};

type PackageLike = {
  readonly __path?: string;
};

const TRANSPILER_OPTIONS: ts.TranspileOptions['compilerOptions'] = {
  module: ts.ModuleKind.ES2020,
  target: ts.ScriptTarget.ES2020,
  resolveJsonModule: true,
  esModuleInterop: true,
  importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
};

async function evaluateManifestModule(
  manifestPath: string,
  { silent = false }: LoadOptions = {},
): Promise<Record<string, unknown> | undefined> {
  if (!fs.existsSync(manifestPath)) {
    return undefined;
  }

  const manifestDir = path.dirname(manifestPath);
  const tmpDir = path.join(manifestDir, '.manifest-eval');
  const tmpFile = path.join(tmpDir, `manifest.${Date.now()}.${Math.random().toString(16).slice(2)}.mjs`);

  try {
    await fs.promises.mkdir(tmpDir, { recursive: true });
    const source = await fs.promises.readFile(manifestPath, 'utf-8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: TRANSPILER_OPTIONS,
      fileName: manifestPath,
    });
    await fs.promises.writeFile(tmpFile, outputText, 'utf-8');

    const moduleUrl = pathToFileURL(tmpFile).href;
    const mod = await import(moduleUrl);
    const manifest = mod.PLUGIN_MANIFEST ?? mod.pluginManifest ?? mod.default;

    return manifest && typeof manifest === 'object'
      ? (manifest as Record<string, unknown>)
      : undefined;
  } catch (error) {
    if (!silent) {
      console.warn('[load-plugin-manifest] Failed to load manifest', manifestPath, error);
    }
    return undefined;
  } finally {
    try {
      await fs.promises.unlink(tmpFile);
    } catch {}
  }
}

export async function loadPluginManifestFromFile(
  manifestPath: string,
  options: LoadOptions = {},
): Promise<Record<string, unknown> | undefined> {
  return evaluateManifestModule(manifestPath, options);
}

export async function loadPluginManifestFromPackageJson(
  pkg: PackageLike,
  options: LoadOptions = {},
): Promise<Record<string, unknown> | undefined> {
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
