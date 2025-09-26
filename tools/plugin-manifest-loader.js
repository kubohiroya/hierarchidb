import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const TRANSPILER_OPTIONS = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  resolveJsonModule: true,
  esModuleInterop: true,
};

function evaluateManifestModule(manifestPath, { silent = false } = {}) {
  if (!fs.existsSync(manifestPath)) {
    return undefined;
  }

  try {
    const source = fs.readFileSync(manifestPath, 'utf-8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: TRANSPILER_OPTIONS,
      fileName: manifestPath,
    });

    const module = { exports: {} };
    const localRequire = (specifier) => {
      if (specifier.endsWith('.json')) {
        const abs = path.resolve(path.dirname(manifestPath), specifier);
        return JSON.parse(fs.readFileSync(abs, 'utf-8'));
      }
      throw new Error(`Unsupported import '${specifier}' in ${manifestPath}`);
    };

    const fn = new Function('require', 'module', 'exports', outputText);
    fn(localRequire, module, module.exports);

    const manifest = module.exports.PLUGIN_MANIFEST
      ?? module.exports.pluginManifest
      ?? module.exports.default;

    return manifest && typeof manifest === 'object'
      ? manifest
      : undefined;
  } catch (error) {
    if (!silent) {
      console.warn('[plugin-manifest-loader] Failed to load manifest', manifestPath, error);
    }
    return undefined;
  }
}

export function loadPluginManifestFromFile(manifestPath, options = {}) {
  return evaluateManifestModule(manifestPath, options);
}

export function loadPluginManifestFromPackageJson(pkg, options = {}) {
  const pkgPath = pkg?.__path;
  if (!pkgPath) {
    return undefined;
  }
  const manifestPath = path.join(path.dirname(pkgPath), 'src', 'extension', 'plugin-manifest.ts');
  return evaluateManifestModule(manifestPath, options);
}

export function resolvePluginManifestPath(pkg) {
  const pkgPath = pkg?.__path;
  if (!pkgPath) {
    return undefined;
  }
  return path.join(path.dirname(pkgPath), 'src', 'extension', 'plugin-manifest.ts');
}

