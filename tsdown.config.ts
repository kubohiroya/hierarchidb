import { defineConfig } from 'tsdown';
import { readFileSync } from 'node:fs';
import path from 'node:path';

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

const baseConfig = {
  name: pkg.name,
  format: ['esm'] as const,
  platform: 'node' as const,
  clean: false,
  sourcemap: true,
  outDir: 'dist',
  dts: true,
  external: mergedExternal as any,
};

const finalConfig: Record<string, unknown> = {
  ...baseConfig,
  ...restUserConfig,
};

if (normalizedOutExtension !== undefined) {
  finalConfig.outExtension = normalizedOutExtension;
}

export default defineConfig(finalConfig as any);
