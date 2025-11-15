import { defineConfig } from 'tsdown';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string') {
    const msg = args[0];
    if (msg.includes('top-level "define" option is deprecated') || msg.includes('top-level "inject" option is deprecated')) {
      return;
    }
  }
  originalWarn(...args as Parameters<typeof console.warn>);
};

type PackageJson = {
  name?: string;
  type?: string;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
  tsdown?: Record<string, unknown>;
};

const DEFAULT_EXTERNAL = [
  'react',
  'react-dom',
  '@mui/material',
  '@mui/icons-material',
  '@emotion/react',
  '@emotion/styled',
  'jotai',
  'maplibre-gl',
  'dexie',
  'react-i18next',
  'i18next',
  'worker_threads',
];

const cwd = process.cwd();
const packageJsonPath = path.join(cwd, 'package.json');

let pkg: PackageJson = {};
try {
  pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
} catch {
  // Fallback to empty package.json when not available.
}

const dependencyNames = new Set<string>(DEFAULT_EXTERNAL);
for (const group of [
  pkg.dependencies,
  pkg.peerDependencies,
  pkg.optionalDependencies,
]) {
  if (!group) continue;
  for (const name of Object.keys(group)) {
    dependencyNames.add(name);
  }
}

const userConfig = pkg.tsdown ?? {};

const baseExternal = Array.from(dependencyNames);
let mergedExternal: unknown = baseExternal;

const userExternal = (userConfig as { external?: unknown }).external;
if (Array.isArray(userExternal)) {
  const extended = new Set<string>([...baseExternal, ...userExternal]);
  mergedExternal = Array.from(extended);
} else if (userExternal !== undefined) {
  mergedExternal = userExternal;
}

const { external: _ignoredExternal, outExtension: rawOutExtension, ...restUserConfig } = userConfig as {
  external?: unknown;
  outExtension?: unknown;
};

let normalizedOutExtension = rawOutExtension;
if (typeof rawOutExtension === 'string') {
  normalizedOutExtension = () => ({ js: rawOutExtension });
}

const defaultOutExtension = () => ({
  js: '.js',
  dts: '.d.ts',
});

const baseConfig = {
  name: pkg.name,
  format: ['esm'] as const,
  platform: 'node' as const,
  clean: false,
  sourcemap: true,
  outDir: 'dist',
  dts: true,
  external: mergedExternal as any,
  outExtension: defaultOutExtension,
  hash: false,
  splitting: false,
};

const finalConfig: Record<string, unknown> = {
  ...baseConfig,
  ...restUserConfig,
};

if (normalizedOutExtension !== undefined) {
  finalConfig.outExtension = normalizedOutExtension;
}

const transformConfig: Record<string, unknown> =
  typeof finalConfig.transform === 'object' && finalConfig.transform !== null
    ? { ...(finalConfig.transform as Record<string, unknown>) }
    : {};

if ('define' in finalConfig) {
  transformConfig.define = finalConfig.define;
  delete finalConfig.define;
}

if ('inject' in finalConfig) {
  transformConfig.inject = finalConfig.inject;
  delete finalConfig.inject;
}

if (Object.keys(transformConfig).length > 0) {
  finalConfig.transform = transformConfig;
}

const proxiedConfig = new Proxy(finalConfig, {
  set(target, prop, value) {
    if (prop === 'define' || prop === 'inject') {
      const transform = (target.transform ??= {});
      (transform as Record<string, unknown>)[prop as string] = value;
      return true;
    }
    (target as Record<string, unknown>)[prop as string] = value;
    return true;
  },
});

if (process.env.TSDOWN_DEBUG === '1') {
  console.log('[tsdown-config]', JSON.stringify(proxiedConfig, null, 2));
}

export default defineConfig(proxiedConfig as any);
