import { defineConfig } from 'tsdown';
import { existsSync, readFileSync, statSync } from 'node:fs';
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
type TsdownConfig = Parameters<typeof defineConfig>[0];
type TsdownUserConfig = Record<string, unknown>;

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
let mergedExternal: string[] = baseExternal;

const userConfigValues = userConfig as TsdownUserConfig;
const userExternal = userConfigValues.external;
if (Array.isArray(userExternal)) {
  const extended = new Set<string>([...baseExternal, ...userExternal]);
  mergedExternal = Array.from(extended);
} else if (typeof userExternal === 'string') {
  mergedExternal = [userExternal];
} else if (userExternal && typeof userExternal === 'object') {
  mergedExternal = Object.keys(userExternal).filter((key): key is string => typeof key === 'string');
}

const {
  external: _ignoredExternal,
  outExtension: rawOutExtension,
  tsconfig: userTsconfig,
  alias: userAlias,
  ...restUserConfig
} = userConfig as {
  external?: string[] | string | Record<string, unknown>;
  outExtension?: unknown;
  tsconfig?: unknown;
  alias?: Record<string, string>;
  [key: string]: unknown;
};

let normalizedOutExtension = rawOutExtension;
if (typeof rawOutExtension === 'string') {
  normalizedOutExtension = () => ({ js: rawOutExtension });
}

const defaultOutExtension = () => ({
  js: '.js',
  dts: '.d.ts',
});

const defaultAlias: Record<string, string> = {
  '~': path.resolve(cwd, 'src'),
  '~/' : path.resolve(cwd, 'src'),
};
const defaultPublicAliasPath = path.resolve(cwd, 'public');
if (existsSync(defaultPublicAliasPath)) {
  defaultAlias['~/public/'] = defaultPublicAliasPath;
  defaultAlias['~/public'] = defaultPublicAliasPath;
}

const mergedAlias = {
  ...defaultAlias,
  ...(typeof userAlias === 'object' && userAlias && !Array.isArray(userAlias) ? userAlias : {}),
};

const packageWorkspaceAliasPlugin = {
  name: 'workspace-tilde-alias',
  async resolveId(id: string) {
    if (!id.startsWith('~/')) {
      return undefined;
    }

    const normalizedPath = id.slice(2);
    const isPublic = normalizedPath.startsWith('public/');
    const baseDir = isPublic ? path.join(cwd, 'public') : path.join(cwd, 'src');
    const relativePath = isPublic ? normalizedPath.slice('public/'.length) : normalizedPath;
    const targetWithoutExt = path.join(baseDir, relativePath);

    const candidates = [
      targetWithoutExt,
      `${targetWithoutExt}.ts`,
      `${targetWithoutExt}.tsx`,
      `${targetWithoutExt}.mts`,
      `${targetWithoutExt}.cts`,
      `${targetWithoutExt}.js`,
      `${targetWithoutExt}.jsx`,
      `${targetWithoutExt}.mjs`,
      `${targetWithoutExt}.cjs`,
      `${targetWithoutExt}.json`,
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return candidate;
      }
    }

    return undefined;
  },
};

const baseConfig: TsdownConfig = {
  name: pkg.name,
  format: ['esm'] as const,
  platform: 'node' as const,
  clean: false,
  sourcemap: true,
  outDir: 'dist',
  dts: true,
  external: mergedExternal,
  outExtension: defaultOutExtension,
  hash: false,
  splitting: false,
};

const finalConfig: TsdownConfig = {
  ...baseConfig,
  ...restUserConfig,
  tsconfig: userTsconfig ?? true,
  alias: mergedAlias,
  plugins: [
    ...((() => {
      const userPlugins = (restUserConfig as { plugins?: unknown }).plugins;
      if (!userPlugins) return [];
      return Array.isArray(userPlugins) ? userPlugins : [userPlugins];
    })() as Array<unknown>),
    packageWorkspaceAliasPlugin,
  ],
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

export default defineConfig(proxiedConfig);
